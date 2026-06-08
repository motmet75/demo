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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        shopOrderRepository.save(order);

        List<ShopOrderItem> items = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalRawCost = BigDecimal.ZERO;

        for (var lineReq : req.items()) {
            Model model = modelRepository.findById(lineReq.modelId())
                    .orElseThrow(() -> new IllegalArgumentException("Model not found: " + lineReq.modelId()));

            BigDecimal qty = lineReq.quantity();
            BigDecimal unitPrice = model.getSellingPrice() != null ? model.getSellingPrice() : BigDecimal.ZERO;
            ShopPricingService.RawCostBreakdown costBreakdown =
                    shopPricingService.calculateRawCost(model.getId(), qty, tenantId, companyId);
            BigDecimal unitRawCost = qty.compareTo(BigDecimal.ZERO) > 0
                    ? costBreakdown.total().divide(qty, 4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal lineTotal = unitPrice.multiply(qty);

            ShopOrderItem item = new ShopOrderItem();
            item.setOrder(order);
            item.setModel(model);
            item.setModelName(model.getModelName());
            item.setQuantity(qty);
            item.setUnitPrice(unitPrice);
            item.setUnitRawCost(unitRawCost);
            item.setLineTotal(lineTotal);
            item.setSelectedOptions(lineReq.selectedOptions());
            item.setItemNotes(lineReq.itemNotes());
            shopOrderItemRepository.save(item);
            items.add(item);

            totalAmount = totalAmount.add(lineTotal);
            totalRawCost = totalRawCost.add(costBreakdown.total());
        }

        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        order.setTotalAmount(totalAmount.add(fee));
        order.setTotalRawCost(totalRawCost);

        // Generate payment QR immediately for prepayment (BANK_QR) orders
        if ("BANK_QR".equals(order.getPaymentMethod())) {
            Company company = companyRepository.findById(companyId).orElse(null);
            if (company != null && company.getBankBin() != null && !company.getBankBin().isBlank()
                    && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank()) {
                String payload = VietQrBuilder.build(
                        company.getBankBin(),
                        company.getBankAccountNumber(),
                        order.getTotalAmount(),
                        order.getOrderCode()
                );
                order.setPaymentQr(QrCodeUtil.generateBase64Png(payload, 300));
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
            for (BomItemEntity bomItem : bomItems) {
                try {
                    orderDeductionService.consumeForProduction(bomItem.getId(), item.getQuantity(), tenantId, companyId);
                } catch (Exception e) {
                    // log but do not block status transition — partial stock is acceptable
                }
            }
        }

        order.setStatus(ShopOrder.STATUS_PREPARING);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto markReady(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_PREPARING);
        order.setStatus(ShopOrder.STATUS_READY);
        order.setReadyAt(Instant.now());

        // Generate payment QR as clean local PNG (no logo)
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company != null && company.getBankBin() != null && !company.getBankBin().isBlank()
                && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank()) {
            String payload = VietQrBuilder.build(
                    company.getBankBin(),
                    company.getBankAccountNumber(),
                    order.getTotalAmount(),
                    order.getOrderCode()
            );
            order.setPaymentQr(QrCodeUtil.generateBase64Png(payload, 300));
        } else {
            String fallback = "ORDER:" + order.getOrderCode() + " AMOUNT:" + order.getTotalAmount();
            order.setPaymentQr(QrCodeUtil.generateBase64Png(fallback, 300));
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
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto cancelOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (ShopOrder.STATUS_COMPLETED.equals(order.getStatus())
                || ShopOrder.STATUS_PICKED_UP.equals(order.getStatus())
                || ShopOrder.STATUS_CANCELLED.equals(order.getStatus())) {
            throw new IllegalStateException("Cannot cancel order in status: " + order.getStatus());
        }
        order.setStatus(ShopOrder.STATUS_CANCELLED);
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

        List<String> active  = List.of(ShopOrder.STATUS_PENDING, ShopOrder.STATUS_CONFIRMED, ShopOrder.STATUS_PREPARING);
        List<String> ready   = List.of(ShopOrder.STATUS_READY);

        List<ShopOrderResponseDto> preparing = shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(sat.getTenantId(), sat.getCompanyId(), active)
                .stream().map(this::dto).toList();

        List<ShopOrderResponseDto> readyList = shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(sat.getTenantId(), sat.getCompanyId(), ready)
                .stream().map(this::dto).toList();

        return Map.of("preparing", preparing, "ready", readyList);
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

    // ── Helpers ───────────────────────────────────────────────────────

    private ShopOrder requireOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = shopOrderRepository.findById(orderId)
                .orElseThrow(() -> new NoSuchElementException("Order not found: " + orderId));
        if (!order.getTenantId().equals(tenantId) || !order.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Order does not belong to this company");
        }
        return order;
    }

    private void requireStatus(ShopOrder order, String expected) {
        if (!expected.equals(order.getStatus())) {
            throw new IllegalStateException("Order must be in status " + expected + " but is " + order.getStatus());
        }
    }

    private ShopOrderResponseDto dto(ShopOrder order) {
        return ShopOrderResponseDto.from(order, shopOrderItemRepository.findAllByOrder_Id(order.getId()));
    }

    // ── Request records ───────────────────────────────────────────────

    public record ItemRequest(UUID modelId, BigDecimal quantity, String selectedOptions, String itemNotes) {}

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
            Integer manualOrderNumber
    ) {}

    public String generateOrderTagQr(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        String url = publicBaseUrl + "/shop/order/" + order.getOrderCode()
                   + "?tenantId=" + tenantId + "&companyId=" + companyId;
        return QrCodeUtil.generateBase64Png(url, 300);
    }
}
