package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.shop.ModelMenuOption;
import com.ams.bomcore.domain.shop.ShopAccessToken;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopOrderItem;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.repository.*;
import com.ams.bomcore.service.bom.BomService;
import com.ams.bomcore.service.inventory.OrderDeductionService;
import com.ams.bomcore.util.QrCodeUtil;
import com.ams.bomcore.util.VietQrBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.Map;

@Service
public class ShopOrderService {

    private final ShopOrderRepository shopOrderRepository;
    private final ShopOrderItemRepository shopOrderItemRepository;
    private final ShopTableRepository shopTableRepository;
    private final ShopAccessTokenRepository shopAccessTokenRepository;
    private final ModelMenuOptionRepository menuOptionRepository;
    private final ModelRepository modelRepository;
    private final CompanyRepository companyRepository;
    private final TenantRepository tenantRepository;
    private final ShopPricingService shopPricingService;
    private final BomService bomService;
    private final OrderDeductionService orderDeductionService;

    @Value("${app.shop.public-base-url:http://localhost:5173/bom-inventory}")
    private String publicBaseUrl;

    public ShopOrderService(ShopOrderRepository shopOrderRepository,
                            ShopOrderItemRepository shopOrderItemRepository,
                            ShopTableRepository shopTableRepository,
                            ShopAccessTokenRepository shopAccessTokenRepository,
                            ModelMenuOptionRepository menuOptionRepository,
                            ModelRepository modelRepository,
                            CompanyRepository companyRepository,
                            TenantRepository tenantRepository,
                            ShopPricingService shopPricingService,
                            BomService bomService,
                            OrderDeductionService orderDeductionService) {
        this.shopOrderRepository = shopOrderRepository;
        this.shopOrderItemRepository = shopOrderItemRepository;
        this.shopTableRepository = shopTableRepository;
        this.shopAccessTokenRepository = shopAccessTokenRepository;
        this.menuOptionRepository = menuOptionRepository;
        this.modelRepository = modelRepository;
        this.companyRepository = companyRepository;
        this.tenantRepository = tenantRepository;
        this.shopPricingService = shopPricingService;
        this.bomService = bomService;
        this.orderDeductionService = orderDeductionService;
    }

    // ── Menu ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Model> getMenu(UUID tenantId, UUID companyId) {
        return modelRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)
                .stream()
                .filter(m -> m.getSellingPrice() != null && Boolean.TRUE.equals(m.getIsActive()))
                .toList();
    }

    // ── Order creation ────────────────────────────────────────────────

    @Transactional
    public ShopOrderResponseDto createOrder(CreateOrderRequest req, UUID tenantId, UUID companyId) {
        ShopOrder order = new ShopOrder();
        order.setTenantId(tenantId);
        order.setCompanyId(companyId);
        order.setOrderCode(String.valueOf(System.currentTimeMillis()));

        // Assign sequence number — manual override or auto-increment
        if (req.manualOrderNumber() != null) {
            order.setOrderNumber(req.manualOrderNumber());
        } else {
            companyRepository.incrementOrderNumber(companyId);
            companyRepository.flush();
            Integer nextNum = companyRepository.findById(companyId)
                    .map(Company::getLastOrderNumber).orElse(null);
            order.setOrderNumber(nextNum);
        }
        order.setFulfillmentType(req.fulfillmentType());
        order.setCustomerName(req.customerName());
        order.setCustomerPhone(req.customerPhone());
        order.setDeliveryProvider(req.deliveryProvider());
        order.setDeliveryAddress(req.deliveryAddress());
        order.setDeliveryFee(req.deliveryFee());
        order.setPaymentMethod(req.paymentMethod() != null ? req.paymentMethod() : ShopOrder.PAYMENT_CASH);
        order.setNotes(req.notes());

        if (ShopOrder.FULFILLMENT_DINE_IN.equals(req.fulfillmentType()) && req.tableId() != null) {
            ShopTable table = shopTableRepository.findById(req.tableId())
                    .orElseThrow(() -> new IllegalArgumentException("Table not found"));
            if (!table.getTenantId().equals(tenantId) || !table.getCompanyId().equals(companyId)) {
                throw new IllegalArgumentException("Table does not belong to this company");
            }
            order.setTable(table);
        }

        if (req.token() != null && !req.token().isBlank()) {
            order.setSourceToken(req.token());
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            order.setStaffName(auth.getName());
        }

        shopOrderRepository.save(order);

        List<ShopOrderItem> items = new ArrayList<>();
        BigDecimal[] totals = { BigDecimal.ZERO, BigDecimal.ZERO };
        buildItems(order, req.items(), null, items, totals, tenantId, companyId);

        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        order.setTotalAmount(totals[0].add(fee));
        order.setTotalRawCost(totals[1]);

        // Generate payment QR immediately for prepayment (BANK_QR) orders
        if ("BANK_QR".equals(order.getPaymentMethod())) {
            Company company = companyRepository.findById(companyId).orElse(null);
            if (company != null && company.getBankBin() != null && !company.getBankBin().isBlank()
                    && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank()) {
                order.setPaymentQr(VietQrBuilder.buildUrl(
                        company.getBankBin(),
                        company.getBankAccountNumber(),
                        company.getBankAccountName(),
                        order.getTotalAmount(),
                        order.getOrderCode()
                ));
            }
        }

        shopOrderRepository.save(order);

        return ShopOrderResponseDto.from(order, items);
    }

    // ── Status transitions ────────────────────────────────────────────

    @Transactional
    public ShopOrderResponseDto confirmOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_PENDING);
        order.setStatus(ShopOrder.STATUS_CONFIRMED);
        order.setConfirmedAt(Instant.now());
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto startPreparing(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_CONFIRMED);

        List<ShopOrderItem> items = shopOrderItemRepository.findAllByOrder_Id(orderId);
        for (ShopOrderItem item : items) {
            var bomOpt = bomService.getActiveBomForModel(item.getModel().getId(), tenantId);
            if (bomOpt.isEmpty()) continue;
            List<BomItemEntity> bomItems = bomService.getBomItems(bomOpt.get().getId(), tenantId, companyId);

            // Build BOM tree to correctly compute deduction quantities for recursive structures.
            // effectiveOrderQty for a child = parentChainMultiplier × shopItemQty where
            // parentChainMultiplier is the product of all ancestor BOM item quantities.
            Map<UUID, List<BomItemEntity>> childMap = new HashMap<>();
            List<BomItemEntity> bomRoots = new ArrayList<>();
            for (BomItemEntity bi : bomItems) {
                if (bi.getParentItem() == null) {
                    bomRoots.add(bi);
                } else {
                    UUID parentId = bi.getParentItem().getId();
                    childMap.computeIfAbsent(parentId, k -> new ArrayList<>()).add(bi);
                }
            }
            deductBomTree(bomRoots, BigDecimal.ONE, childMap, item.getQuantity(), tenantId, companyId);
        }

        order.setStatus(ShopOrder.STATUS_PREPARING);
        shopOrderRepository.save(order);
        return dto(order);
    }

    /**
     * Traverses the BOM tree and issues consumeForProduction for each node using the correct
     * effective quantity: parentChainMultiplier × shopItemQty is passed as orderQty so that
     * consumeForProduction computes: bomItem.quantity × (parentChainMultiplier × shopItemQty).
     */
    private void deductBomTree(List<BomItemEntity> nodes, BigDecimal parentChainMultiplier,
                                Map<UUID, List<BomItemEntity>> childMap,
                                BigDecimal shopItemQty, UUID tenantId, UUID companyId) {
        for (BomItemEntity node : nodes) {
            try {
                orderDeductionService.consumeForProduction(
                        node.getId(), parentChainMultiplier.multiply(shopItemQty), tenantId, companyId);
            } catch (Exception e) {
                // log but do not block status transition — partial stock is acceptable
            }
            List<BomItemEntity> children = childMap.get(node.getId());
            if (children != null && !children.isEmpty()) {
                BigDecimal childMultiplier = parentChainMultiplier.multiply(node.getQuantity());
                deductBomTree(children, childMultiplier, childMap, shopItemQty, tenantId, companyId);
            }
        }
    }

    @Transactional
    public ShopOrderResponseDto markReady(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_PREPARING);
        order.setStatus(ShopOrder.STATUS_READY);
        order.setReadyAt(Instant.now());

        // Regenerate VietQR URL at ready time (ensures amount is final)
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company != null && company.getBankBin() != null && !company.getBankBin().isBlank()
                && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank()) {
            order.setPaymentQr(VietQrBuilder.buildUrl(
                    company.getBankBin(),
                    company.getBankAccountNumber(),
                    company.getBankAccountName(),
                    order.getTotalAmount(),
                    order.getOrderCode()
            ));
        }
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto pickupOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_READY);
        order.setStatus(ShopOrder.STATUS_PICKED_UP);
        order.setCompletedAt(Instant.now());
        order.setPaymentStatus(ShopOrder.PAY_STATUS_PAID);
        shopOrderRepository.save(order);
        disableSourceToken(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto completeOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_READY);
        order.setStatus(ShopOrder.STATUS_COMPLETED);
        order.setCompletedAt(Instant.now());
        order.setPaymentStatus(ShopOrder.PAY_STATUS_PAID);
        shopOrderRepository.save(order);
        disableSourceToken(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto cancelOrder(UUID orderId, String reason, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (ShopOrder.STATUS_COMPLETED.equals(order.getStatus())
                || ShopOrder.STATUS_PICKED_UP.equals(order.getStatus())
                || ShopOrder.STATUS_CANCELLED.equals(order.getStatus())) {
            throw new IllegalStateException("Cannot cancel order in status: " + order.getStatus());
        }
        order.setStatus(ShopOrder.STATUS_CANCELLED);
        if (reason != null && !reason.isBlank()) {
            order.setCancelReason(reason.trim());
        }
        shopOrderRepository.save(order);
        return dto(order);
    }

    // ── Queries ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ShopOrderResponseDto> listActiveOrders(UUID tenantId, UUID companyId) {
        List<String> active = List.of(
                ShopOrder.STATUS_PENDING, ShopOrder.STATUS_CONFIRMED,
                ShopOrder.STATUS_PREPARING, ShopOrder.STATUS_READY
        );
        return shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(tenantId, companyId, active)
                .stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public ShopOrderResponseDto getOrderByCode(String orderCode, UUID tenantId, UUID companyId) {
        ShopOrder order = shopOrderRepository.findByOrderCodeAndTenantIdAndCompanyId(orderCode, tenantId, companyId)
                .orElseThrow(() -> new NoSuchElementException("Order not found: " + orderCode));
        return dto(order);
    }

    @Transactional(readOnly = true)
    public ShopOrderResponseDto getOrder(UUID orderId, UUID tenantId, UUID companyId) {
        return dto(requireOrder(orderId, tenantId, companyId));
    }

    @Transactional(readOnly = true)
    public List<ShopOrderResponseDto> listOrders(UUID tenantId, UUID companyId, String status) {
        List<ShopOrder> orders = status != null && !status.isBlank()
                ? shopOrderRepository.findAllByTenantIdAndCompanyIdAndStatusOrderByCreatedAtDesc(tenantId, companyId, status)
                : shopOrderRepository.findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(tenantId, companyId);
        return orders.stream().map(o -> ShopOrderResponseDto.from(o, shopOrderItemRepository.findAllByOrder_Id(o.getId()))).toList();
    }

    // ── Table management ──────────────────────────────────────────────

    @Transactional
    public ShopTable createTable(String tableName, UUID tenantId, UUID companyId) {
        ShopTable table = new ShopTable();
        table.setTenantId(tenantId);
        table.setCompanyId(companyId);
        table.setTableName(tableName);
        return shopTableRepository.save(table);
    }

    @Transactional
    public ShopTable updateTable(UUID tableId, String tableName, Boolean isActive, UUID tenantId, UUID companyId) {
        ShopTable table = shopTableRepository.findById(tableId)
                .orElseThrow(() -> new NoSuchElementException("Table not found"));
        if (!table.getTenantId().equals(tenantId) || !table.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Table does not belong to this company");
        }
        if (tableName != null) table.setTableName(tableName);
        if (isActive != null) table.setIsActive(isActive);
        return shopTableRepository.save(table);
    }

    @Transactional
    public void deleteTable(UUID tableId, UUID tenantId, UUID companyId) {
        ShopTable table = shopTableRepository.findById(tableId)
                .orElseThrow(() -> new NoSuchElementException("Table not found"));
        if (!table.getTenantId().equals(tenantId) || !table.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Table does not belong to this company");
        }
        shopTableRepository.delete(table);
    }

    public List<ShopTable> listTables(UUID tenantId, UUID companyId) {
        return shopTableRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
    }

    @Transactional
    public String generateTableQr(UUID tableId, UUID tenantId, UUID companyId) {
        ShopTable table = shopTableRepository.findById(tableId)
                .orElseThrow(() -> new NoSuchElementException("Table not found"));
        if (!table.getTenantId().equals(tenantId) || !table.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Table does not belong to this company");
        }

        // Reuse existing valid token or create a fresh one
        String tokenStr = shopAccessTokenRepository
                .findAllByTableIdAndTokenType(tableId, ShopAccessToken.TYPE_TABLE_QR)
                .stream()
                .filter(ShopAccessToken::isValid)
                .map(ShopAccessToken::getToken)
                .findFirst()
                .orElseGet(() -> {
                    ShopAccessToken sat = new ShopAccessToken();
                    sat.setToken(UUID.randomUUID().toString());
                    sat.setTenantId(tenantId);
                    sat.setCompanyId(companyId);
                    sat.setTableId(tableId);
                    sat.setTokenType(ShopAccessToken.TYPE_TABLE_QR);
                    sat.setDescription("Table QR: " + table.getTableName());
                    shopAccessTokenRepository.save(sat);
                    return sat.getToken();
                });

        String url = publicBaseUrl + "/shop/menu?t=" + tokenStr;
        return QrCodeUtil.generateBase64Png(url, 300);
    }

    @Transactional
    public String generateWalkUpQr(Integer seq, UUID tenantId, UUID companyId) {
        ShopAccessToken sat = new ShopAccessToken();
        sat.setToken(UUID.randomUUID().toString());
        sat.setTenantId(tenantId);
        sat.setCompanyId(companyId);
        sat.setTokenType(ShopAccessToken.TYPE_TABLE_QR);
        sat.setDescription("Walk-up QR" + (seq != null ? " #" + seq : ""));
        shopAccessTokenRepository.save(sat);
        String url = publicBaseUrl + "/shop/menu?t=" + sat.getToken()
                   + (seq != null ? "&seq=" + seq : "");
        return QrCodeUtil.generateBase64Png(url, 400);
    }

    // ── Display board ─────────────────────────────────────────────────

    @Transactional
    public ShopAccessToken generateDisplayBoardToken(UUID tenantId, UUID companyId) {
        // Reuse existing valid token or create a fresh one with 24-hour expiry
        return shopAccessTokenRepository
                .findAllByTenantIdAndCompanyId(tenantId, companyId)
                .stream()
                .filter(t -> ShopAccessToken.TYPE_DISPLAY_BOARD.equals(t.getTokenType()))
                .filter(ShopAccessToken::isValid)
                .findFirst()
                .orElseGet(() -> {
                    ShopAccessToken sat = new ShopAccessToken();
                    sat.setToken(UUID.randomUUID().toString());
                    sat.setTenantId(tenantId);
                    sat.setCompanyId(companyId);
                    sat.setTokenType(ShopAccessToken.TYPE_DISPLAY_BOARD);
                    sat.setExpiresAt(java.time.Instant.now().plus(24, java.time.temporal.ChronoUnit.HOURS));
                    sat.setDescription("Display board token");
                    return shopAccessTokenRepository.save(sat);
                });
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDisplayBoardOrders(String token) {
        ShopAccessToken sat = shopAccessTokenRepository.findByToken(token)
                .orElseThrow(() -> new NoSuchElementException("Token not found"));
        if (!sat.isValid()) throw new IllegalStateException("Token expired or disabled");

        UUID tId = sat.getTenantId();
        UUID cId = sat.getCompanyId();

        List<ShopOrderResponseDto> confirmed = shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(tId, cId, List.of(ShopOrder.STATUS_CONFIRMED))
                .stream().map(this::dto).toList();

        List<ShopOrderResponseDto> preparing = shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(tId, cId, List.of(ShopOrder.STATUS_PREPARING))
                .stream().map(this::dto).toList();

        List<ShopOrderResponseDto> readyList = shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(tId, cId, List.of(ShopOrder.STATUS_READY))
                .stream().map(this::dto).toList();

        List<ShopOrderResponseDto> pickedUp = shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(tId, cId, List.of(ShopOrder.STATUS_PICKED_UP))
                .stream().map(this::dto).toList();

        // "preparing" key keeps backward compat (confirmed+preparing combined for old board)
        var inProgress = new java.util.ArrayList<ShopOrderResponseDto>();
        inProgress.addAll(confirmed);
        inProgress.addAll(preparing);
        inProgress.sort(java.util.Comparator.comparingInt(d -> d.getOrderNumber() != null ? d.getOrderNumber() : Integer.MAX_VALUE));

        return Map.of(
                "preparing",  inProgress,
                "ready",      readyList,
                "confirmed",  confirmed,
                "processing", preparing,
                "pickedUp",   pickedUp
        );
    }

    @Transactional
    public void resetOrderSequence(int resetTo, UUID tenantId, UUID companyId) {
        companyRepository.resetOrderNumber(companyId, resetTo);
    }

    @Transactional
    public ShopOrderResponseDto setOrderNumber(UUID orderId, int number, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        order.setOrderNumber(number);
        shopOrderRepository.save(order);
        return dto(order);
    }

    public BigDecimal estimateShopeeExpressFee(BigDecimal weightKg) {
        // TODO: replace with real Shopee Open-Platform credentials and API call
        if (weightKg == null || weightKg.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.valueOf(20000);
        if (weightKg.compareTo(BigDecimal.ONE) <= 0) return BigDecimal.valueOf(20000);
        if (weightKg.compareTo(BigDecimal.valueOf(3)) <= 0) return BigDecimal.valueOf(30000);
        return BigDecimal.valueOf(40000);
    }

    // ── Payment ───────────────────────────────────────────────────────

    @Transactional
    public ShopOrderResponseDto switchToQrPayment(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (isFinalStatus(order.getStatus())) {
            throw new IllegalStateException("Cannot change payment method of a completed or cancelled order");
        }
        order.setPaymentMethod(ShopOrder.PAYMENT_BANK_QR);
        order.setSplitCashAmount(null);
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company != null && company.getBankBin() != null && !company.getBankBin().isBlank()
                && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank()) {
            order.setPaymentQr(VietQrBuilder.buildUrl(
                    company.getBankBin(), company.getBankAccountNumber(),
                    company.getBankAccountName(), order.getTotalAmount(), order.getOrderCode()));
        }
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto splitPayment(UUID orderId, BigDecimal cashAmount, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (isFinalStatus(order.getStatus())) {
            throw new IllegalStateException("Cannot change payment method of a completed or cancelled order");
        }
        BigDecimal total = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        if (cashAmount == null || cashAmount.compareTo(BigDecimal.ZERO) < 0 || cashAmount.compareTo(total) > 0) {
            throw new IllegalArgumentException("Cash amount must be between 0 and " + total);
        }
        BigDecimal qrAmount = total.subtract(cashAmount);
        order.setPaymentMethod(ShopOrder.PAYMENT_SPLIT);
        order.setSplitCashAmount(cashAmount);
        Company company = companyRepository.findById(companyId).orElse(null);
        if (qrAmount.compareTo(BigDecimal.ZERO) > 0 && company != null
                && company.getBankBin() != null && !company.getBankBin().isBlank()
                && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank()) {
            order.setPaymentQr(VietQrBuilder.buildUrl(
                    company.getBankBin(), company.getBankAccountNumber(),
                    company.getBankAccountName(), qrAmount, order.getOrderCode()));
        } else {
            order.setPaymentQr(null);
        }
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto setOrderTable(UUID orderId, UUID tableId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (tableId == null) {
            order.setTable(null);
        } else {
            ShopTable table = shopTableRepository.findById(tableId)
                    .orElseThrow(() -> new IllegalArgumentException("Table not found"));
            if (!table.getTenantId().equals(tenantId) || !table.getCompanyId().equals(companyId)) {
                throw new IllegalArgumentException("Table does not belong to this company");
            }
            order.setTable(table);
        }
        shopOrderRepository.save(order);
        List<ShopOrderItem> items = shopOrderItemRepository.findAllByOrder_Id(orderId);
        return ShopOrderResponseDto.from(order, items);
    }

    @Transactional
    public ShopOrderResponseDto revertToCash(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (isFinalStatus(order.getStatus())) {
            throw new IllegalStateException("Cannot change payment method of a completed or cancelled order");
        }
        order.setPaymentMethod(ShopOrder.PAYMENT_CASH);
        order.setPaymentQr(null);
        order.setSplitCashAmount(null);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto markAsPaid(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (ShopOrder.STATUS_CANCELLED.equals(order.getStatus())) {
            throw new IllegalStateException("Cannot mark cancelled order as paid");
        }
        order.setPaymentStatus(ShopOrder.PAY_STATUS_PAID);
        shopOrderRepository.save(order);
        return dto(order);
    }

    // ── Order editing & revert ────────────────────────────────────────

    @Transactional
    public ShopOrderResponseDto revertOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_CONFIRMED);
        order.setStatus(ShopOrder.STATUS_PENDING);
        order.setConfirmedAt(null);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto updateOrderItems(UUID orderId, List<ItemRequest> newItems, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_PENDING);

        // Delete children before parents to respect the self-referencing FK
        List<ShopOrderItem> existing = shopOrderItemRepository.findAllByOrder_Id(orderId);
        shopOrderItemRepository.deleteAll(existing.stream().filter(i -> i.getParentItem() != null).toList());
        shopOrderItemRepository.deleteAll(existing.stream().filter(i -> i.getParentItem() == null).toList());

        List<ShopOrderItem> items = new ArrayList<>();
        BigDecimal[] totals = { BigDecimal.ZERO, BigDecimal.ZERO };
        buildItems(order, newItems, null, items, totals, tenantId, companyId);

        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        order.setTotalAmount(totals[0].add(fee));
        order.setTotalRawCost(totals[1]);

        if ("BANK_QR".equals(order.getPaymentMethod())) {
            Company company = companyRepository.findById(companyId).orElse(null);
            if (company != null && company.getBankBin() != null && !company.getBankBin().isBlank()
                    && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank()) {
                order.setPaymentQr(VietQrBuilder.buildUrl(
                        company.getBankBin(), company.getBankAccountNumber(),
                        company.getBankAccountName(), order.getTotalAmount(), order.getOrderCode()));
            }
        }

        shopOrderRepository.save(order);
        return ShopOrderResponseDto.from(order, items);
    }

    // ── Recursive item builder ────────────────────────────────────────

    /**
     * Recursively saves ItemRequest nodes (and their sideItems children) under the given parent.
     * totals[0] = running totalAmount, totals[1] = running totalRawCost.
     */
    private void buildItems(ShopOrder order, List<ItemRequest> requests, ShopOrderItem parent,
                             List<ShopOrderItem> accumulator, BigDecimal[] totals,
                             UUID tenantId, UUID companyId) {
        if (requests == null) return;
        for (var req : requests) {
            Model model = modelRepository.findById(req.modelId())
                    .orElseThrow(() -> new IllegalArgumentException("Model not found: " + req.modelId()));
            BigDecimal qty = req.quantity();
            BigDecimal unitPrice = req.unitPriceOverride() != null
                    ? req.unitPriceOverride()
                    : (model.getSellingPrice() != null ? model.getSellingPrice() : BigDecimal.ZERO);
            ShopPricingService.RawCostBreakdown costBreakdown =
                    shopPricingService.calculateRawCost(model.getId(), qty, tenantId, companyId);
            BigDecimal unitRawCost = qty.compareTo(BigDecimal.ZERO) > 0
                    ? costBreakdown.total().divide(qty, 4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal optionAddOn = calculateOptionAddOn(model.getId(), req.selectedOptions(), tenantId, companyId);
            BigDecimal lineTotal = unitPrice.add(optionAddOn).multiply(qty);

            ShopOrderItem item = new ShopOrderItem();
            item.setOrder(order);
            item.setParentItem(parent);
            item.setModel(model);
            item.setModelName(model.getModelName());
            item.setQuantity(qty);
            item.setUnitPrice(unitPrice);
            item.setUnitRawCost(unitRawCost);
            item.setOptionAddOn(optionAddOn);
            item.setLineTotal(lineTotal);
            item.setSelectedOptions(req.selectedOptions());
            item.setItemNotes(req.itemNotes());
            shopOrderItemRepository.save(item);
            accumulator.add(item);

            totals[0] = totals[0].add(lineTotal);
            totals[1] = totals[1].add(costBreakdown.total());

            buildItems(order, req.sideItems(), item, accumulator, totals, tenantId, companyId);
        }
    }

    // ── Option add-on pricing ─────────────────────────────────────────

    /**
     * Sums the prices of selected option choices for a single item unit.
     * Groups marked isFree=true contribute 0 regardless of choice prices.
     * Handles both old string[] choices and new {label,price}[] choices.
     */
    private BigDecimal calculateOptionAddOn(UUID modelId, String selectedOptionsJson,
                                            UUID tenantId, UUID companyId) {
        if (selectedOptionsJson == null || selectedOptionsJson.isBlank()) return BigDecimal.ZERO;
        List<ModelMenuOption> groups =
                menuOptionRepository.findAllByModelIdAndTenantIdAndCompanyIdOrderByDisplayOrderAsc(
                        modelId, tenantId, companyId);
        if (groups.isEmpty()) return BigDecimal.ZERO;

        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> selected;
        try {
            selected = mapper.readValue(selectedOptionsJson, new TypeReference<>() {});
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }

        BigDecimal total = BigDecimal.ZERO;
        for (ModelMenuOption group : groups) {
            if (Boolean.TRUE.equals(group.getIsFree())) continue;
            Object chosenRaw = selected.get(group.getGroupName());
            if (chosenRaw == null) continue;

            // Parse choices: [{label,price}] or [string]
            List<Map<String, Object>> choiceDefs;
            try {
                choiceDefs = mapper.readValue(group.getChoices(), new TypeReference<>() {});
            } catch (Exception e) {
                continue;
            }

            // Normalize chosen value(s) to a set of label strings
            Set<String> chosenLabels = new HashSet<>();
            if (chosenRaw instanceof List<?> list) {
                for (Object o : list) chosenLabels.add(o.toString());
            } else {
                chosenLabels.add(chosenRaw.toString());
            }

            for (Map<String, Object> choice : choiceDefs) {
                Object labelObj = choice.get("label");
                Object priceObj = choice.get("price");
                if (labelObj == null || priceObj == null) continue;
                if (chosenLabels.contains(labelObj.toString())) {
                    try {
                        total = total.add(new BigDecimal(priceObj.toString()));
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        return total;
    }

    // ── Token management ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ShopAccessToken> listTokens(UUID tenantId, UUID companyId) {
        return shopAccessTokenRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
    }

    @Transactional
    public ShopAccessToken setTokenEnabled(UUID tokenId, boolean enabled, UUID tenantId, UUID companyId) {
        ShopAccessToken sat = shopAccessTokenRepository.findById(tokenId)
                .orElseThrow(() -> new NoSuchElementException("Token not found"));
        if (!sat.getTenantId().equals(tenantId) || !sat.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Token does not belong to this company");
        }
        sat.setEnabled(enabled);
        return shopAccessTokenRepository.save(sat);
    }

    @Transactional
    public void deleteToken(UUID tokenId, UUID tenantId, UUID companyId) {
        ShopAccessToken sat = shopAccessTokenRepository.findById(tokenId)
                .orElseThrow(() -> new NoSuchElementException("Token not found"));
        if (!sat.getTenantId().equals(tenantId) || !sat.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Token does not belong to this company");
        }
        shopAccessTokenRepository.delete(sat);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private void disableSourceToken(ShopOrder order) {
        if (order.getSourceToken() == null || order.getSourceToken().isBlank()) return;
        shopAccessTokenRepository.findByToken(order.getSourceToken()).ifPresent(sat -> {
            // Only disable walk-up QR tokens (TABLE_QR with no table assigned)
            if (ShopAccessToken.TYPE_TABLE_QR.equals(sat.getTokenType()) && sat.getTableId() == null) {
                sat.setEnabled(false);
                shopAccessTokenRepository.save(sat);
            }
        });
    }

    private ShopOrder requireOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = shopOrderRepository.findById(orderId)
                .orElseThrow(() -> new NoSuchElementException("Order not found: " + orderId));
        if (!order.getTenantId().equals(tenantId) || !order.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Order does not belong to this company");
        }
        return order;
    }

    private static boolean isFinalStatus(String status) {
        return ShopOrder.STATUS_CANCELLED.equals(status)
                || ShopOrder.STATUS_COMPLETED.equals(status)
                || ShopOrder.STATUS_PICKED_UP.equals(status);
    }

    private void requireStatus(ShopOrder order, String expected) {
        if (!expected.equals(order.getStatus())) {
            throw new IllegalStateException("Order must be in status " + expected + " but is " + order.getStatus());
        }
    }

    private ShopOrderResponseDto dto(ShopOrder order) {
        return ShopOrderResponseDto.from(order, shopOrderItemRepository.findAllByOrder_Id(order.getId()));
    }

    // ── Request DTOs ──────────────────────────────────────────────────

    public static class ItemRequest {
        private UUID modelId;
        private BigDecimal quantity;
        private String selectedOptions;
        private String itemNotes;
        private BigDecimal unitPriceOverride;
        private List<ItemRequest> sideItems;

        public UUID modelId() { return modelId; }
        public BigDecimal quantity() { return quantity; }
        public String selectedOptions() { return selectedOptions; }
        public String itemNotes() { return itemNotes; }
        public BigDecimal unitPriceOverride() { return unitPriceOverride; }
        public List<ItemRequest> sideItems() { return sideItems != null ? sideItems : Collections.emptyList(); }

        public void setModelId(UUID v) { this.modelId = v; }
        public void setQuantity(BigDecimal v) { this.quantity = v; }
        public void setSelectedOptions(String v) { this.selectedOptions = v; }
        public void setItemNotes(String v) { this.itemNotes = v; }
        public void setUnitPriceOverride(BigDecimal v) { this.unitPriceOverride = v; }
        public void setSideItems(List<ItemRequest> v) { this.sideItems = v; }
    }

    // ── Menu options (admin) ───────────────────────────────────────────

    public List<ModelMenuOption> listMenuOptions(UUID modelId, UUID tenantId, UUID companyId) {
        return menuOptionRepository.findAllByModelIdAndTenantIdAndCompanyIdOrderByDisplayOrderAsc(modelId, tenantId, companyId);
    }

    public List<ModelMenuOption> listAllMenuOptions(UUID tenantId, UUID companyId) {
        return menuOptionRepository.findAllByTenantIdAndCompanyIdOrderByDisplayOrderAsc(tenantId, companyId);
    }

    @Transactional
    public ModelMenuOption saveMenuOption(ModelMenuOption opt) {
        return menuOptionRepository.save(opt);
    }

    @Transactional
    public void deleteMenuOption(UUID optionId, UUID tenantId, UUID companyId) {
        ModelMenuOption opt = menuOptionRepository.findById(optionId)
                .orElseThrow(() -> new NoSuchElementException("Option not found"));
        if (!opt.getTenantId().equals(tenantId) || !opt.getCompanyId().equals(companyId))
            throw new IllegalArgumentException("Not your option");
        menuOptionRepository.delete(opt);
    }

    public record CreateOrderRequest(
            String fulfillmentType,
            UUID tableId,
            String customerName,
            String customerPhone,
            String deliveryProvider,
            String deliveryAddress,
            BigDecimal deliveryFee,
            String paymentMethod,
            String notes,
            List<ItemRequest> items,
            Integer manualOrderNumber,
            String token
    ) {}

    public String generateOrderTagQr(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        String url = publicBaseUrl + "/shop/order/" + order.getOrderCode()
                   + "?tenantId=" + tenantId + "&companyId=" + companyId;
        return QrCodeUtil.generateBase64Png(url, 300);
    }
}
