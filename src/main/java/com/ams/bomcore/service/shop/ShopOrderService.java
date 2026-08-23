package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.shop.ModelMenuOption;
import com.ams.bomcore.domain.shop.ShopAccessToken;
import com.ams.bomcore.domain.shop.ShopBill;
import com.ams.bomcore.domain.shop.ShopBillItem;
import com.ams.bomcore.domain.shop.ShopCustomer;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopOrderItem;
import com.ams.bomcore.domain.shop.ShopMaterialAudit;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.domain.shop.ShopVoucher;
import com.ams.bomcore.repository.*;
import com.ams.bomcore.service.bom.BomService;
import java.util.HashSet;
import java.util.Set;
import com.ams.bomcore.service.inventory.OrderDeductionService;
import com.ams.bomcore.util.QrCodeUtil;
import com.ams.bomcore.util.VietQrBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.Map;

@Service
public class ShopOrderService {

    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
    public static final int DEFAULT_WALK_UP_MAX_ORDERS = 12;

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
    private final ShopMaterialAuditService shopMaterialAuditService;
    private final ShopCustomerRepository shopCustomerRepository;
    private final ShopVoucherRepository shopVoucherRepository;
    private final ShopBillRepository shopBillRepository;
    private final ShopBillItemRepository shopBillItemRepository;
    private final ShopLocalizedLabelService shopLocalizedLabelService;

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
                            OrderDeductionService orderDeductionService,
                            ShopMaterialAuditService shopMaterialAuditService,
                            ShopCustomerRepository shopCustomerRepository,
                            ShopVoucherRepository shopVoucherRepository,
                            ShopBillRepository shopBillRepository,
                            ShopBillItemRepository shopBillItemRepository,
                            ShopLocalizedLabelService shopLocalizedLabelService) {
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
        this.shopMaterialAuditService = shopMaterialAuditService;
        this.shopCustomerRepository = shopCustomerRepository;
        this.shopVoucherRepository = shopVoucherRepository;
        this.shopBillRepository = shopBillRepository;
        this.shopBillItemRepository = shopBillItemRepository;
        this.shopLocalizedLabelService = shopLocalizedLabelService;
    }

    // ── Menu ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Model> getMenu(UUID tenantId, UUID companyId) {
        List<Model> all = modelRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
        List<Model> active = all.stream()
                .filter(m -> m.getSellingPrice() != null && Boolean.TRUE.equals(m.getIsActive()))
                .toList();

        // Collect IDs referenced in allowedSideIds of any active menu item
        Set<String> neededSideIds = new HashSet<>();
        for (Model m : active) {
            if (m.getAllowedSideIds() != null) {
                try {
                    JsonNode node = JSON_MAPPER.readTree(m.getAllowedSideIds());
                    if (node.isArray()) {
                        for (JsonNode entry : node) {
                            if (entry.isTextual()) {
                                neededSideIds.add(entry.asText());
                            } else if (entry.isObject()) {
                                JsonNode modelId = entry.get("modelId");
                                if (modelId != null && modelId.isTextual()) {
                                    neededSideIds.add(modelId.asText());
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }
        }
        if (neededSideIds.isEmpty()) return active;

        // Include priced-but-inactive models that are used as side items
        Set<String> activeIds = active.stream()
                .map(m -> m.getId().toString())
                .collect(java.util.stream.Collectors.toSet());
        List<Model> sideOnly = all.stream()
                .filter(m -> m.getSellingPrice() != null
                        && !Boolean.TRUE.equals(m.getIsActive())
                        && neededSideIds.contains(m.getId().toString())
                        && !activeIds.contains(m.getId().toString()))
                .toList();
        if (sideOnly.isEmpty()) return active;

        List<Model> result = new ArrayList<>(active);
        result.addAll(sideOnly);
        return result;
    }

    // ── Order creation ────────────────────────────────────────────────

    @Transactional
    public ShopOrderResponseDto createOrder(CreateOrderRequest req, UUID tenantId, UUID companyId) {
        return createOrder(req, tenantId, companyId, ZoneId.systemDefault());
    }

    @Transactional
    public ShopOrderResponseDto createOrder(CreateOrderRequest req, UUID tenantId, UUID companyId, ZoneId orderZone) {
        ShopOrder order = new ShopOrder();
        order.setTenantId(tenantId);
        order.setCompanyId(companyId);
        order.setOrderCode(String.valueOf(System.currentTimeMillis()));

        // Queue QR orders always take the next number from the counter sequence.
        // Ignore any client-provided seq/manualOrderNumber so an old/bookmarked URL
        // cannot submit a duplicate or out-of-order counter number.
        boolean queueQrOrder = isQueueQrToken(req.token(), tenantId, companyId);
        if (req.manualOrderNumber() != null && !queueQrOrder) {
            order.setOrderNumber(req.manualOrderNumber());
        } else {
            companyRepository.incrementOrderNumber(companyId);
            companyRepository.flush();
            Integer nextNum = companyRepository.findById(companyId)
                    .map(Company::getLastOrderNumber).orElse(null);
            order.setOrderNumber(nextNum);
        }

        // Daily sequence: count orders placed today in the caller local timezone.
        ZoneId zone = orderZone != null ? orderZone : ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);
        Instant dayStart = today.atStartOfDay(zone).toInstant();
        Instant dayEnd   = today.plusDays(1).atStartOfDay(zone).toInstant();
        long todayCount  = shopOrderRepository.countOrdersInDay(companyId, dayStart, dayEnd);
        order.setDailySeq((int) todayCount + 1);

        order.setFulfillmentType(req.fulfillmentType());
        order.setCustomerName(req.customerName());
        order.setCustomerPhone(req.customerPhone());
        order.setDeliveryProvider(req.deliveryProvider());
        order.setDeliveryAddress(req.deliveryAddress());
        order.setCustomerTableTag(req.customerTableTag());
        order.setRequestedFulfillmentAt(req.requestedFulfillmentAt());
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
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));

        shopOrderRepository.save(order);
        resetOrderBills(order, items);

        return dto(order);
    }

    private boolean isQueueQrToken(String token, UUID tenantId, UUID companyId) {
        if (token == null || token.isBlank()) return false;
        return shopAccessTokenRepository.findByToken(token)
                .filter(ShopAccessToken::isValid)
                .filter(access -> tenantId.equals(access.getTenantId()))
                .filter(access -> companyId.equals(access.getCompanyId()))
                .map(access -> ShopAccessToken.TYPE_QUEUE_QR.equals(access.getTokenType()))
                .orElse(false);
    }

    /**
     * Creates a counter order with its own short-lived customer session. The token lets the
     * customer track this order and place more orders from the same QR for four hours.
     */
    @Transactional
    public ShopOrderResponseDto createCounterOrder(CreateOrderRequest req, UUID tenantId, UUID companyId,
                                                    ZoneId orderZone) {
        ShopAccessToken token = createWalkUpToken(null, DEFAULT_WALK_UP_MAX_ORDERS, tenantId, companyId,
                "Manual counter order");
        CreateOrderRequest sessionRequest = new CreateOrderRequest(
                req.fulfillmentType(), req.tableId(), req.customerName(), req.customerPhone(),
                req.deliveryProvider(), req.deliveryAddress(), req.deliveryFee(), req.paymentMethod(),
                req.notes(), req.items(), req.manualOrderNumber(), token.getToken(),
                req.customerTableTag(), req.requestedFulfillmentAt());
        return createOrder(sessionRequest, tenantId, companyId, orderZone);
    }

    // ── Status transitions ────────────────────────────────────────────

    @Transactional
    public ShopOrderResponseDto confirmOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_PENDING);
        if (Boolean.TRUE.equals(order.getCustomerEditing()))
            throw new IllegalStateException("Customer is currently editing this order - please wait.");
        order.setStatus(ShopOrder.STATUS_CONFIRMED);
        order.setConfirmedAt(Instant.now());
        // Customers may pay only after staff has confirmed the order.
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));
        shopOrderRepository.save(order);
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company != null && Boolean.TRUE.equals(company.getRealtimeInventory())) {
            shopMaterialAuditService.recordOrderDemand(order, ShopMaterialAudit.SOURCE_CONFIRM);
        }
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto confirmAndRequestPayment(UUID orderId, UUID tenantId, UUID companyId) {
        confirmOrder(orderId, tenantId, companyId);
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (!ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus())) {
            order.setPaymentRequestedAt(Instant.now());
            shopOrderRepository.save(order);
        }
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto changeTableByCustomer(String orderCode, UUID tableId, String token) {
        ShopOrder order = requireOrderByCode(orderCode);
        if (order.getSourceToken() != null && !order.getSourceToken().isBlank()
                && !order.getSourceToken().equals(token)) {
            throw new IllegalArgumentException("Order session does not match");
        }
        if (ShopOrder.STATUS_CANCELLED.equals(order.getStatus()) || ShopOrder.STATUS_COMPLETED.equals(order.getStatus())) {
            throw new IllegalStateException("Finished orders cannot change table");
        }
        return setOrderTable(order.getId(), tableId, order.getTenantId(), order.getCompanyId());
    }

    // Customer edit-lock endpoints ──────────────────────────────────

    @Transactional
    public ShopOrderResponseDto startCustomerEdit(String orderCode, UUID tenantId, UUID companyId) {
        ShopOrder order = shopOrderRepository.findByOrderCodeAndTenantIdAndCompanyId(orderCode, tenantId, companyId)
                .orElseThrow(() -> new NoSuchElementException("Order not found"));
        if (!ShopOrder.STATUS_PENDING.equals(order.getStatus()))
            throw new IllegalStateException("Order can only be edited while PENDING");
        order.setCustomerEditing(true);
        order.setCustomerEditingSince(Instant.now());
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto cancelCustomerEdit(String orderCode, UUID tenantId, UUID companyId) {
        ShopOrder order = shopOrderRepository.findByOrderCodeAndTenantIdAndCompanyId(orderCode, tenantId, companyId)
                .orElseThrow(() -> new NoSuchElementException("Order not found"));
        order.setCustomerEditing(false);
        order.setCustomerEditingSince(null);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto forceConfirmOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_PENDING);
        order.setCustomerEditing(false);
        order.setCustomerEditingSince(null);
        order.setStatus(ShopOrder.STATUS_CONFIRMED);
        order.setConfirmedAt(Instant.now());
        shopOrderRepository.save(order);
        shopMaterialAuditService.recordOrderDemand(order, ShopMaterialAudit.SOURCE_FORCE_CONFIRM);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto updateOrderByCustomer(String orderCode, List<ItemRequest> newItems, UUID tenantId, UUID companyId) {
        ShopOrder order = shopOrderRepository.findByOrderCodeAndTenantIdAndCompanyId(orderCode, tenantId, companyId)
                .orElseThrow(() -> new NoSuchElementException("Order not found"));
        if (!ShopOrder.STATUS_PENDING.equals(order.getStatus()))
            throw new IllegalStateException("Order can only be updated while PENDING");

        BigDecimal[] totals = { BigDecimal.ZERO, BigDecimal.ZERO };
        List<ShopOrderItem> items = replaceOrderItems(order, newItems, totals, tenantId, companyId);

        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        order.setTotalAmount(totals[0].add(fee));
        order.setTotalRawCost(totals[1]);
        order.setCustomerEditing(false);
        order.setCustomerEditingSince(null);
        order.setStatus(ShopOrder.STATUS_PENDING);
        order.setConfirmedAt(null);
        order.setReadyAt(null);
        order.setCompletedAt(null);
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));
        shopOrderRepository.save(order);
        resetOrderBills(order, items);
        return dto(order);
    }

    @Transactional(readOnly = true)
    public List<ShopOrderResponseDto> getActiveTableOrders(UUID tableId, UUID tenantId, UUID companyId) {
        return shopOrderRepository.findAllByTable_IdAndTenantIdAndCompanyIdAndStatusIn(
                tableId, tenantId, companyId,
                List.of(ShopOrder.STATUS_PENDING, ShopOrder.STATUS_CONFIRMED,
                        ShopOrder.STATUS_PREPARING, ShopOrder.STATUS_READY))
                .stream().map(this::dto).toList();
    }

    @Transactional
    public ShopOrderResponseDto startPreparing(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_CONFIRMED);
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company != null && Boolean.TRUE.equals(company.getPrepaidMenu())
                && !ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus())) {
            throw new IllegalStateException(
                    "Prepaid Menu is enabled. Mark this order as paid before starting preparation.");
        }

        shopMaterialAuditService.deductOrderMaterials(order, ShopMaterialAudit.SOURCE_PREPARE);

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
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));
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
        order.setPaymentRequestedAt(null);
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
        order.setPaymentRequestedAt(null);
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
        if (ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus())) {
            throw new IllegalStateException("Cannot cancel a paid order");
        }
        order.setStatus(ShopOrder.STATUS_CANCELLED);
        if (reason != null && !reason.isBlank()) {
            order.setCancelReason(reason.trim());
        }
        shopOrderRepository.save(order);
        disableSourceToken(order);
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
        return listOrders(tenantId, companyId, status, null, null);
    }

    @Transactional(readOnly = true)
    public List<ShopOrderResponseDto> listOrders(UUID tenantId, UUID companyId, String status, Instant fromTime, Instant toTime) {
        String normalizedStatus = status != null && !status.isBlank() ? status : null;
        List<ShopOrder> orders = shopOrderRepository.searchStaffOrders(tenantId, companyId, normalizedStatus, fromTime, toTime);
        return orders.stream().map(this::dto).toList();
    }

    // ── Table management ──────────────────────────────────────────────

    @Transactional
    public ShopTable createTable(String tableName, String tableNameTranslations, UUID tenantId, UUID companyId) {
        ShopTable table = new ShopTable();
        table.setTenantId(tenantId);
        table.setCompanyId(companyId);
        table.setTableName(tableName);
        table.setTableNameTranslations(tableNameTranslations);
        return shopTableRepository.save(table);
    }

    @Transactional
    public ShopTable updateTable(UUID tableId, String tableName, String tableNameTranslations, Boolean isActive, UUID tenantId, UUID companyId) {
        ShopTable table = shopTableRepository.findById(tableId)
                .orElseThrow(() -> new NoSuchElementException("Table not found"));
        if (!table.getTenantId().equals(tenantId) || !table.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Table does not belong to this company");
        }
        if (tableName != null) table.setTableName(tableName);
        if (tableNameTranslations != null) table.setTableNameTranslations(tableNameTranslations);
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

    public record TableQrResult(String qrBase64, String token, int activeOrderCount) {}

    @Transactional
    public TableQrResult generateTableQr(UUID tableId, UUID tenantId, UUID companyId) {
        ShopTable table = shopTableRepository.findById(tableId)
                .orElseThrow(() -> new NoSuchElementException("Table not found"));
        if (!table.getTenantId().equals(tenantId) || !table.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Table does not belong to this company");
        }

        // Check for active (uncleared) orders on this table
        int activeOrderCount = shopOrderRepository
                .findAllByTable_IdAndTenantIdAndCompanyIdAndStatusIn(
                        tableId, tenantId, companyId,
                        List.of(ShopOrder.STATUS_PENDING, ShopOrder.STATUS_CONFIRMED,
                                ShopOrder.STATUS_PREPARING, ShopOrder.STATUS_READY))
                .size();

        // Always create a fresh token for each press — 4-hour ordering window
        ShopAccessToken sat = new ShopAccessToken();
        sat.setToken(UUID.randomUUID().toString());
        sat.setTenantId(tenantId);
        sat.setCompanyId(companyId);
        sat.setTableId(tableId);
        sat.setTokenType(ShopAccessToken.TYPE_TABLE_QR);
        sat.setDescription("Table QR: " + table.getTableName());
        sat.setExpiresAt(java.time.Instant.now().plus(4, java.time.temporal.ChronoUnit.HOURS));
        shopAccessTokenRepository.save(sat);

        String url = publicBaseUrl + "/shop/menu?t=" + sat.getToken();
        return new TableQrResult(QrCodeUtil.generateBase64Png(url, 300), sat.getToken(), activeOrderCount);
    }

    public record WalkUpQrResult(String qrBase64, String qrUrl, String token, Integer seq, Integer maxOrders) {}

    @Transactional
    public WalkUpQrResult generateWalkUpQr(Integer seq, Integer maxOrders, UUID tenantId, UUID companyId) {
        int limit = normalizeMaxOrders(maxOrders);
        ShopAccessToken sat = createWalkUpToken(seq, limit, tenantId, companyId, null);
        String url = publicBaseUrl + "/shop/menu?t=" + sat.getToken()
                   + (seq != null ? "&seq=" + seq : "");
        return new WalkUpQrResult(QrCodeUtil.generateBase64Png(url, 400), url, sat.getToken(), seq, limit);
    }

    private ShopAccessToken createWalkUpToken(Integer seq, int maxOrders, UUID tenantId, UUID companyId,
                                               String description) {
        ShopAccessToken sat = new ShopAccessToken();
        sat.setToken(UUID.randomUUID().toString());
        sat.setTenantId(tenantId);
        sat.setCompanyId(companyId);
        sat.setTokenType(ShopAccessToken.TYPE_TABLE_QR);
        sat.setDescription(description != null ? description : "Walk-up QR" + (seq != null ? " #" + seq : ""));
        sat.setExpiresAt(java.time.Instant.now().plus(4, java.time.temporal.ChronoUnit.HOURS));
        sat.setMaxOrders(maxOrders);
        return shopAccessTokenRepository.save(sat);
    }

    private int normalizeMaxOrders(Integer maxOrders) {
        if (maxOrders == null) return DEFAULT_WALK_UP_MAX_ORDERS;
        if (maxOrders < 1) return 1;
        if (maxOrders > 500) return 500;
        return maxOrders;
    }

    public record QueueQrResult(String qrBase64, String qrUrl, String token, Instant expiresAt, int validDays,
                                String language) {}

    @Transactional
    public QueueQrResult generateQueueQr(Integer validDays, boolean forceNew, String language,
                                         UUID tenantId, UUID companyId) {
        int days = validDays != null ? validDays : 30;
        if (days < 1) days = 1;
        if (days > 366) days = 366;
        Set<String> supportedLanguages = Set.of("en", "cn", "tw", "ja", "ko", "es", "dv", "ms", "id", "vi", "th");
        String lang = language != null ? language.trim().toLowerCase(Locale.ROOT) : "vi";
        if (!supportedLanguages.contains(lang)) lang = "vi";

        if (!forceNew) {
            ShopAccessToken current = shopAccessTokenRepository
                    .findAllByTenantIdAndCompanyId(tenantId, companyId)
                    .stream()
                    .filter(t -> ShopAccessToken.TYPE_QUEUE_QR.equals(t.getTokenType()))
                    .filter(ShopAccessToken::isValid)
                    .findFirst()
                    .orElse(null);
            if (current != null) {
                String currentUrl = publicBaseUrl + "/shop/menu?tenantId=" + tenantId + "&companyId=" + companyId + "&lang=" + lang;
                return new QueueQrResult(QrCodeUtil.generateBase64Png(currentUrl, 400), currentUrl,
                        current.getToken(), current.getExpiresAt(), days, lang);
            }
        }

        ShopAccessToken sat = new ShopAccessToken();
        sat.setToken(UUID.randomUUID().toString());
        sat.setTenantId(tenantId);
        sat.setCompanyId(companyId);
        sat.setTokenType(ShopAccessToken.TYPE_QUEUE_QR);
        sat.setDescription("Queue QR - web ordering - language " + lang);
        Instant expiresAt = Instant.now().plus(days, java.time.temporal.ChronoUnit.DAYS);
        sat.setExpiresAt(expiresAt);
        shopAccessTokenRepository.save(sat);

        String url = publicBaseUrl + "/shop/menu?tenantId=" + tenantId + "&companyId=" + companyId + "&lang=" + lang;
        return new QueueQrResult(QrCodeUtil.generateBase64Png(url, 400), url, sat.getToken(), expiresAt, days, lang);
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
        boolean prepaidMenu = companyRepository.findById(cId)
                .map(Company::getPrepaidMenu)
                .orElse(false);

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
                "prepaidMenu", prepaidMenu,
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

    private boolean hasBankConfig(Company company) {
        return company != null
                && company.getBankBin() != null && !company.getBankBin().isBlank()
                && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank();
    }

    private BigDecimal payableAmount(ShopOrder order) {
        BigDecimal total = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal discount = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal payable = total.subtract(discount);
        return payable.compareTo(BigDecimal.ZERO) > 0 ? payable : BigDecimal.ZERO;
    }

    private BigDecimal splitCashPortion(ShopOrder order) {
        BigDecimal payable = payableAmount(order);
        BigDecimal cash = order.getSplitCashAmount() != null ? order.getSplitCashAmount() : BigDecimal.ZERO;
        if (cash.compareTo(BigDecimal.ZERO) < 0) return BigDecimal.ZERO;
        return cash.compareTo(payable) > 0 ? payable : cash;
    }

    private BigDecimal splitQrPortion(ShopOrder order) {
        return payableAmount(order).subtract(splitCashPortion(order));
    }

    private void refreshPaymentQr(ShopOrder order, Company company) {
        BigDecimal amount;
        if (ShopOrder.PAYMENT_BANK_QR.equals(order.getPaymentMethod())) {
            amount = payableAmount(order);
        } else if (ShopOrder.PAYMENT_SPLIT.equals(order.getPaymentMethod())) {
            BigDecimal cash = splitCashPortion(order);
            order.setSplitCashAmount(cash);
            amount = payableAmount(order).subtract(cash);
        } else {
            order.setPaymentQr(null);
            return;
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0 || !hasBankConfig(company)) {
            order.setPaymentQr(null);
            return;
        }

        order.setPaymentQr(VietQrBuilder.buildUrl(
                company.getBankBin(), company.getBankAccountNumber(),
                company.getBankAccountName(), amount, order.getOrderCode()));
    }
    @Transactional
    public ShopOrderResponseDto switchToQrPayment(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (isFinalStatus(order.getStatus())) {
            throw new IllegalStateException("Cannot change payment method of a completed or cancelled order");
        }
        order.setPaymentMethod(ShopOrder.PAYMENT_BANK_QR);
        order.setSplitCashAmount(null);
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto switchToQrPaymentByCustomer(String orderCode) {
        ShopOrder order = requireOrderByCode(orderCode);
        if (isFinalStatus(order.getStatus())) {
            throw new IllegalStateException("Cannot change payment method of a completed or cancelled order");
        }
        if (ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus())) {
            throw new IllegalStateException("A paid order cannot change payment method");
        }
        if (!ShopOrder.PAYMENT_CASH.equals(order.getPaymentMethod())) {
            throw new IllegalStateException("Only a cash order can be changed to bank payment");
        }
        Company company = companyRepository.findById(order.getCompanyId()).orElse(null);
        if (!hasBankConfig(company)) {
            throw new IllegalStateException("Bank payment is not configured for this shop");
        }
        order.setPaymentMethod(ShopOrder.PAYMENT_BANK_QR);
        order.setSplitCashAmount(null);
        refreshPaymentQr(order, company);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto splitPayment(UUID orderId, BigDecimal cashAmount, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (isFinalStatus(order.getStatus())) {
            throw new IllegalStateException("Cannot change payment method of a completed or cancelled order");
        }
        BigDecimal total = payableAmount(order);
        if (cashAmount == null || cashAmount.compareTo(BigDecimal.ZERO) < 0 || cashAmount.compareTo(total) > 0) {
            throw new IllegalArgumentException("Cash amount must be between 0 and " + total);
        }
        order.setPaymentMethod(ShopOrder.PAYMENT_SPLIT);
        order.setSplitCashAmount(cashAmount);
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto revertOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (!ShopOrder.STATUS_CONFIRMED.equals(order.getStatus())
                && !ShopOrder.STATUS_PREPARING.equals(order.getStatus())) {
            throw new IllegalStateException("Only confirmed or preparing orders can be reverted");
        }
        if (ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus())) {
            throw new IllegalStateException("Cannot revert a paid order");
        }
        order.setStatus(ShopOrder.STATUS_PENDING);
        order.setConfirmedAt(null);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto revertToCash(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (isFinalStatus(order.getStatus())) {
            throw new IllegalStateException("Cannot change payment method of a completed or cancelled order");
        }
        order.setPaymentMethod(ShopOrder.PAYMENT_CASH);
        order.setSplitCashAmount(null);
        order.setPaymentQr(null);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto markAsPaid(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (ShopOrder.STATUS_CANCELLED.equals(order.getStatus())) {
            throw new IllegalStateException("Cannot mark a cancelled order as paid");
        }
        order.setPaymentStatus(ShopOrder.PAY_STATUS_PAID);
        order.setPaymentRequestedAt(null);
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
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto setOrderSeat(UUID orderId, UUID tableId, String customerTableTag, String fulfillmentType,
                                             UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (ShopOrder.STATUS_CANCELLED.equals(order.getStatus()) || ShopOrder.STATUS_COMPLETED.equals(order.getStatus())) {
            throw new IllegalStateException("Cannot change table for a finished order");
        }
        if (fulfillmentType != null && !Set.of(ShopOrder.FULFILLMENT_DINE_IN, ShopOrder.FULFILLMENT_PICKUP,
                ShopOrder.FULFILLMENT_DELIVERY).contains(fulfillmentType)) {
            throw new IllegalArgumentException("Invalid fulfillment type");
        }
        if (fulfillmentType != null) order.setFulfillmentType(fulfillmentType);
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
        order.setCustomerTableTag(customerTableTag == null || customerTableTag.isBlank() ? null : customerTableTag.trim());
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto updateOrderItems(UUID orderId, List<ItemRequest> newItems, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        requireStatus(order, ShopOrder.STATUS_PENDING);

        BigDecimal[] totals = { BigDecimal.ZERO, BigDecimal.ZERO };
        List<ShopOrderItem> items = replaceOrderItems(order, newItems, totals, tenantId, companyId);

        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        order.setTotalAmount(totals[0].add(fee));
        order.setTotalRawCost(totals[1]);

        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));

        shopOrderRepository.save(order);
        resetOrderBills(order, items);
        return dto(order);
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
        if (parent != null) validateSideItemRequests(parent, requests);
        for (var req : requests) {
            if (req == null || req.modelId() == null) {
                throw new IllegalArgumentException("Each order item must have a modelId");
            }
            if (req.quantity() == null || req.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Order item quantity must be greater than zero");
            }
            Model model = modelRepository.findById(req.modelId())
                    .orElseThrow(() -> new IllegalArgumentException("Model not found: " + req.modelId()));
            if (!tenantId.equals(model.getTenantId()) || !companyId.equals(model.getCompanyId())) {
                throw new IllegalArgumentException("Model not found: " + req.modelId());
            }
            BigDecimal qty = req.quantity();
            BigDecimal unitPrice = req.unitPriceOverride() != null
                    ? req.unitPriceOverride()
                    : (model.getSellingPrice() != null ? model.getSellingPrice() : BigDecimal.ZERO);
            List<ModelMenuOption> optionGroups = menuOptionRepository
                    .findAllByModelIdAndTenantIdAndCompanyIdOrderByDisplayOrderAsc(model.getId(), tenantId, companyId);
            ShopPricingService.RawCostBreakdown costBreakdown =
                    shopPricingService.calculateRawCost(model.getId(), qty, req.selectedOptions(), optionGroups, tenantId, companyId);
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

    private void validateSideItemRequests(ShopOrderItem parent, List<ItemRequest> requests) {
        Map<UUID, Integer> limits = parseAllowedSideLimits(parent.getModel());
        Map<UUID, BigDecimal> requestedByModel = new LinkedHashMap<>();

        for (ItemRequest request : requests) {
            if (request == null || request.modelId() == null) {
                throw new IllegalArgumentException("Each side/topping item must have a modelId");
            }
            if (request.quantity() == null || request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Side/topping quantity must be greater than zero");
            }
            if (!limits.containsKey(request.modelId())) {
                throw new IllegalArgumentException("Side/topping is not allowed for " + parent.getModelName());
            }
            requestedByModel.merge(request.modelId(), request.quantity(), BigDecimal::add);
        }

        for (Map.Entry<UUID, BigDecimal> requested : requestedByModel.entrySet()) {
            int maxPerItem = limits.get(requested.getKey());
            if (maxPerItem == Integer.MAX_VALUE) continue;
            BigDecimal maximum = parent.getQuantity().multiply(BigDecimal.valueOf(maxPerItem));
            if (requested.getValue().compareTo(maximum) > 0) {
                throw new IllegalArgumentException(
                        "Side/topping quantity exceeds the maximum of " + maxPerItem + " per " + parent.getModelName());
            }
        }
    }

    private Map<UUID, Integer> parseAllowedSideLimits(Model parentModel) {
        Map<UUID, Integer> limits = new LinkedHashMap<>();
        String raw = parentModel != null ? parentModel.getAllowedSideIds() : null;
        if (raw == null || raw.isBlank()) return limits;

        try {
            JsonNode parsed = JSON_MAPPER.readTree(raw);
            if (!parsed.isArray()) {
                throw new IllegalArgumentException("Invalid side/topping configuration for " + parentModel.getModelName());
            }
            for (JsonNode entry : parsed) {
                String rawId = entry.isTextual()
                        ? entry.asText()
                        : entry.isObject() && entry.hasNonNull("modelId") ? entry.get("modelId").asText() : null;
                if (rawId == null || rawId.isBlank()) continue;

                UUID modelId = UUID.fromString(rawId);
                int maxQty = entry.isObject() && entry.hasNonNull("maxQty")
                        ? entry.get("maxQty").asInt(1)
                        : Integer.MAX_VALUE;
                limits.putIfAbsent(modelId, maxQty > 0 ? maxQty : 1);
            }
            return limits;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid side/topping configuration for " + parentModel.getModelName(), ex);
        }
    }

    private List<ShopOrderItem> replaceOrderItems(ShopOrder order, List<ItemRequest> newItems, BigDecimal[] totals,
                                                  UUID tenantId, UUID companyId) {
        List<ShopBillItem> billAssignments = shopBillItemRepository.findAllByOrderItem_Order_Id(order.getId());
        if (!billAssignments.isEmpty()) {
            shopBillItemRepository.deleteAll(billAssignments);
            shopBillItemRepository.flush();
        }

        // Delete children before parents to respect the self-referencing FK.
        List<ShopOrderItem> existing = shopOrderItemRepository.findAllByOrder_Id(order.getId());
        shopOrderItemRepository.deleteAll(existing.stream().filter(i -> i.getParentItem() != null).toList());
        shopOrderItemRepository.deleteAll(existing.stream().filter(i -> i.getParentItem() == null).toList());
        shopOrderItemRepository.flush();

        List<ShopOrderItem> items = new ArrayList<>();
        buildItems(order, newItems, null, items, totals, tenantId, companyId);
        return items;
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

            Map<String, BigDecimal> chosenQuantities = new HashMap<>();
            if (chosenRaw instanceof Map<?, ?> chosenMap) {
                for (Map.Entry<?, ?> entry : chosenMap.entrySet()) {
                    if (entry.getKey() == null) continue;
                    BigDecimal qty = selectedOptionQuantity(entry.getValue());
                    if (qty.compareTo(BigDecimal.ZERO) > 0) {
                        chosenQuantities.put(entry.getKey().toString(), qty);
                    }
                }
            } else if (chosenRaw instanceof Collection<?> chosenList) {
                for (Object label : chosenList) {
                    if (label != null) chosenQuantities.merge(label.toString(), BigDecimal.ONE, BigDecimal::add);
                }
            } else {
                chosenQuantities.put(chosenRaw.toString(), BigDecimal.ONE);
            }

            for (Map<String, Object> choice : choiceDefs) {
                Object labelObj = choice.get("label");
                Object priceObj = choice.get("price");
                if (labelObj == null || priceObj == null) continue;
                BigDecimal qty = chosenQuantities.get(labelObj.toString());
                if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) continue;
                try {
                    total = total.add(new BigDecimal(priceObj.toString()).multiply(qty));
                } catch (NumberFormatException ignored) {}
            }
        }
        return total;
    }

    private BigDecimal selectedOptionQuantity(Object raw) {
        if (raw == null) return BigDecimal.ZERO;
        try {
            BigDecimal qty = new BigDecimal(raw.toString());
            return qty.compareTo(BigDecimal.ZERO) > 0 ? qty : BigDecimal.ZERO;
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
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

    // Token session controls

    @Transactional
    public ShopAccessToken lockCounterSession(String token, UUID tenantId, UUID companyId, String lockedBy) {
        ShopAccessToken sat = requireScopedToken(token, tenantId, companyId);
        sat.setCounterLocked(true);
        sat.setCounterLockedAt(Instant.now());
        sat.setCounterLockedBy(lockedBy != null && !lockedBy.isBlank() ? lockedBy : null);
        return shopAccessTokenRepository.save(sat);
    }

    @Transactional
    public ShopAccessToken unlockCounterSession(String token, UUID tenantId, UUID companyId) {
        ShopAccessToken sat = requireScopedToken(token, tenantId, companyId);
        sat.setCounterLocked(false);
        sat.setCounterLockedAt(null);
        sat.setCounterLockedBy(null);
        return shopAccessTokenRepository.save(sat);
    }

    @Transactional(readOnly = true)
    public ShopAccessToken requireScopedToken(String token, UUID tenantId, UUID companyId) {
        ShopAccessToken sat = shopAccessTokenRepository.findByToken(token)
                .orElseThrow(() -> new NoSuchElementException("Token not found"));
        if (!sat.getTenantId().equals(tenantId) || !sat.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Token does not belong to this company");
        }
        return sat;
    }

    public long countAcceptedOrdersForToken(String token) {
        if (token == null || token.isBlank()) return 0;
        return shopOrderRepository.findAllBySourceTokenOrderByCreatedAtDesc(token).stream()
                .filter(order -> !ShopOrder.STATUS_CANCELLED.equals(order.getStatus()))
                .count();
    }

    // Split / Merge bills

    public record SplitResult(ShopOrderResponseDto original, ShopOrderResponseDto newBill) {}

    @Transactional
    public SplitResult splitBill(UUID orderId, List<UUID> rootItemIds, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (rootItemIds == null || rootItemIds.isEmpty()) {
            throw new IllegalArgumentException("Select at least one item");
        }
        ensureOrderBills(order);

        List<ShopBillItem> visibleAssignments = activeAssignmentsForOrder(order);
        Set<UUID> rootIds = new HashSet<>(rootItemIds);
        Set<UUID> selectedIds = new HashSet<>();
        long rootCount = 0;
        long selectedRootCount = 0;
        for (ShopBillItem assignment : visibleAssignments) {
            ShopOrderItem item = assignment.getOrderItem();
            if (item == null) continue;
            boolean root = item.getParentItem() == null;
            if (root) rootCount++;
            boolean selected = rootIds.contains(item.getId())
                    || (item.getParentItem() != null && rootIds.contains(item.getParentItem().getId()));
            if (selected) {
                selectedIds.add(item.getId());
                if (root) selectedRootCount++;
            }
        }

        if (selectedIds.isEmpty()) throw new IllegalArgumentException("No items selected");
        if (rootCount > 0 && selectedRootCount >= rootCount) {
            throw new IllegalArgumentException("Cannot move all items - keep at least one item in the original bill");
        }

        List<ShopBillItem> toMove = visibleAssignments.stream()
                .filter(assignment -> assignment.getOrderItem() != null && selectedIds.contains(assignment.getOrderItem().getId()))
                .toList();
        if (toMove.isEmpty()) throw new IllegalArgumentException("No bill items selected");

        ShopBill splitFrom = toMove.get(0).getBill();
        ShopBill newBill = createBill(order, nextBillNumber(order), splitFrom);
        Set<UUID> affectedBillIds = new HashSet<>();
        affectedBillIds.add(newBill.getId());
        for (ShopBillItem assignment : toMove) {
            if (assignment.getBill() != null) affectedBillIds.add(assignment.getBill().getId());
            assignment.setBill(newBill);
            ShopOrder sourceOrder = assignment.getOrderItem() != null ? assignment.getOrderItem().getOrder() : null;
            if (sourceOrder != null && sourceOrder.getId().equals(order.getId())) {
                assignment.setOriginalBill(newBill);
            }
        }
        shopBillItemRepository.saveAll(toMove);
        recalcBillsByIds(affectedBillIds);
        recalcOrderFromBills(order);
        return new SplitResult(dto(order), null);
    }

    @Transactional
    public ShopOrderResponseDto mergeBills(UUID primaryId, List<UUID> otherIds, UUID tenantId, UUID companyId) {
        if (otherIds == null || otherIds.isEmpty()) {
            throw new IllegalArgumentException("Select at least one order to merge");
        }
        ShopOrder primary = requireOrder(primaryId, tenantId, companyId);
        ensureOrderBills(primary);
        ShopBill primaryBill = firstActiveBill(primary)
                .orElseGet(() -> createBill(primary, nextBillNumber(primary), null));
        UUID mergeBatchId = UUID.randomUUID();
        Instant now = Instant.now();
        boolean mergedAny = false;

        for (UUID otherId : otherIds) {
            if (otherId == null || otherId.equals(primaryId)) continue;
            ShopOrder other = requireOrder(otherId, tenantId, companyId);
            if (isFinalStatus(other.getStatus())) {
                throw new IllegalArgumentException("Cannot merge final order #" + orderDisplay(other));
            }
            ensureOrderBills(other);
            List<ShopBill> sourceBills = activeBills(other);
            for (ShopBill sourceBill : sourceBills) {
                if (sourceBill.getId().equals(primaryBill.getId())) continue;
                List<ShopBillItem> assignments = shopBillItemRepository.findAllByBill_Id(sourceBill.getId());
                for (ShopBillItem assignment : assignments) {
                    assignment.setBill(primaryBill);
                    assignment.setOriginalBill(sourceBill);
                }
                shopBillItemRepository.saveAll(assignments);
                addBillAdjustment(primaryBill, sourceBill);

                sourceBill.setStatus(ShopBill.STATUS_MERGED);
                sourceBill.setMergedIntoBill(primaryBill);
                sourceBill.setMergeBatchId(mergeBatchId);
                sourceBill.setPreMergeOrderStatus(other.getStatus());
                sourceBill.setPreMergeCancelReason(other.getCancelReason());
                sourceBill.setMergedAt(now);
                shopBillRepository.save(sourceBill);
                mergedAny = true;
            }
            other.setStatus(ShopOrder.STATUS_CANCELLED);
            other.setCancelReason("Merged into #" + orderDisplay(primary));
            shopOrderRepository.save(other);
        }

        if (!mergedAny) throw new IllegalArgumentException("No active bills were merged");
        recalcBillTotals(primaryBill);
        recalcOrderFromBills(primary);
        return dto(primary);
    }

    @Transactional
    public ShopOrderResponseDto undoMergeBills(UUID primaryId, UUID mergeBatchId, UUID tenantId, UUID companyId) {
        ShopOrder primary = requireOrder(primaryId, tenantId, companyId);
        List<ShopBill> targetBills = activeBills(primary);
        if (targetBills.isEmpty()) throw new IllegalArgumentException("This order has no active bill to undo");

        List<UUID> targetBillIds = targetBills.stream().map(ShopBill::getId).toList();
        List<ShopBill> mergedBills = shopBillRepository.findAllByMergedIntoBill_IdInAndStatus(targetBillIds, ShopBill.STATUS_MERGED);
        if (mergeBatchId != null) {
            mergedBills = mergedBills.stream()
                    .filter(bill -> mergeBatchId.equals(bill.getMergeBatchId()))
                    .toList();
        } else if (!mergedBills.isEmpty()) {
            Optional<UUID> latestBatch = mergedBills.stream()
                    .filter(bill -> bill.getMergeBatchId() != null)
                    .max(Comparator.comparing(ShopBill::getMergedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                    .map(ShopBill::getMergeBatchId);
            if (latestBatch.isPresent()) {
                UUID batch = latestBatch.get();
                mergedBills = mergedBills.stream()
                        .filter(bill -> batch.equals(bill.getMergeBatchId()))
                        .toList();
            }
        }
        if (mergedBills.isEmpty()) throw new IllegalArgumentException("No merge found to undo");

        Set<UUID> affectedTargetBillIds = new HashSet<>(targetBillIds);
        for (ShopBill sourceBill : mergedBills) {
            List<ShopBillItem> assignments = shopBillItemRepository.findAllByOriginalBill_Id(sourceBill.getId()).stream()
                    .filter(assignment -> assignment.getBill() != null
                            && assignment.getBill().getOrder() != null
                            && primary.getId().equals(assignment.getBill().getOrder().getId()))
                    .toList();
            for (ShopBillItem assignment : assignments) {
                if (assignment.getBill() != null) affectedTargetBillIds.add(assignment.getBill().getId());
                assignment.setBill(sourceBill);
                assignment.setOriginalBill(sourceBill);
            }
            shopBillItemRepository.saveAll(assignments);
            subtractBillAdjustment(sourceBill.getMergedIntoBill(), sourceBill);

            sourceBill.setStatus(ShopBill.STATUS_ACTIVE);
            sourceBill.setMergedIntoBill(null);
            sourceBill.setMergeBatchId(null);
            sourceBill.setMergedAt(null);
            shopBillRepository.save(sourceBill);

            ShopOrder sourceOrder = sourceBill.getOrder();
            if (sourceOrder != null) {
                String previousStatus = sourceBill.getPreMergeOrderStatus();
                sourceOrder.setStatus(previousStatus != null && !previousStatus.isBlank() ? previousStatus : ShopOrder.STATUS_PENDING);
                sourceOrder.setCancelReason(sourceBill.getPreMergeCancelReason());
                shopOrderRepository.save(sourceOrder);
                recalcBillTotals(sourceBill);
                recalcOrderFromBills(sourceOrder);
            }
        }

        recalcBillsByIds(affectedTargetBillIds);
        recalcOrderFromBills(primary);
        return dto(primary);
    }
    // ── Discount / voucher ─────────────────────────────────────────────

    @Transactional
    public ShopOrderResponseDto patchDiscount(UUID orderId, BigDecimal discountAmount, String voucherCode, UUID tenantId, UUID companyId) {
        return patchDiscount(orderId, null, discountAmount, voucherCode, tenantId, companyId);
    }

    @Transactional
    public ShopOrderResponseDto patchDiscount(UUID orderId, UUID billId, BigDecimal discountAmount, String voucherCode, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        ensureOrderBills(order);
        ShopBill bill = resolveDiscountBill(order, billId);
        if (discountAmount != null) bill.setDiscountAmount(nonNegative(discountAmount));
        if (voucherCode != null) {
            String clean = voucherCode.trim();
            if (clean.isBlank()) {
                bill.setVoucherCode(null);
            } else {
                shopVoucherRepository.findByTenantIdAndCompanyIdAndCode(tenantId, companyId, clean.toUpperCase())
                    .ifPresent(v -> validateManualVoucherCode(v, orderId, bill.getId()));
                bill.setVoucherCode(clean);
            }
        }
        shopBillRepository.save(bill);
        recalcBillTotals(bill);
        recalcOrderFromBills(order);
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));
        shopOrderRepository.save(order);
        return dto(order);
    }

    private void validateManualVoucherCode(ShopVoucher voucher, UUID orderId, UUID billId) {
        if (voucher.getExpiryDate() != null && voucher.getExpiryDate().isBefore(LocalDate.now()))
            throw new IllegalStateException("Voucher has expired");
        if (ShopVoucher.STATUS_CANCELLED.equals(voucher.getStatus()))
            throw new IllegalStateException("Voucher is cancelled");
        boolean sameOrder = orderId != null && orderId.equals(voucher.getRedeemedOrderId());
        boolean sameBill = billId != null && billId.equals(voucher.getRedeemedBillId());
        if (ShopVoucher.STATUS_USED.equals(voucher.getStatus()) && !sameOrder && !sameBill)
            throw new IllegalStateException("Voucher is already used");
    }

    // ── Customer CRUD ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ShopCustomer> listCustomers(UUID tenantId, UUID companyId, String q) {
        if (q != null && !q.isBlank())
            return shopCustomerRepository.search(tenantId, companyId, q.trim());
        return shopCustomerRepository.findAllByTenantIdAndCompanyIdOrderByNameAsc(tenantId, companyId);
    }

    @Transactional(readOnly = true)
    public java.util.Optional<ShopCustomer> getCustomer(UUID id, UUID tenantId, UUID companyId) {
        return shopCustomerRepository.findById(id)
            .filter(c -> c.getTenantId().equals(tenantId) && c.getCompanyId().equals(companyId));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCustomerHistory(UUID customerId, UUID tenantId, UUID companyId) {
        ShopCustomer c = shopCustomerRepository.findById(customerId)
            .orElseThrow(() -> new java.util.NoSuchElementException("Customer not found"));
        if (!c.getTenantId().equals(tenantId) || !c.getCompanyId().equals(companyId))
            throw new IllegalArgumentException("Not your customer");

        List<ShopOrderResponseDto> purchases = shopOrderRepository
            .findAllByCustomerIdAndTenantIdAndCompanyId(customerId, tenantId, companyId)
            .stream()
            .sorted(Comparator.comparing(ShopOrder::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .map(this::dto)
            .toList();

        List<Map<String, Object>> vouchers = shopVoucherRepository
            .findAllByCustomerIdAndTenantIdAndCompanyIdOrderByCreatedAtDesc(customerId, tenantId, companyId)
            .stream()
            .map(v -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", v.getId());
                m.put("code", v.getCode());
                m.put("faceValue", v.getFaceValue());
                m.put("salePrice", v.getSalePrice());
                m.put("status", v.getStatus());
                m.put("issuedOrderId", v.getIssuedOrderId());
                m.put("redeemedOrderId", v.getRedeemedOrderId());
                m.put("redeemedCustomerId", v.getRedeemedCustomerId());
                m.put("redeemedCustomerName", v.getRedeemedCustomerName());
                m.put("redeemedAt", v.getRedeemedAt());
                m.put("expiryDate", v.getExpiryDate());
                m.put("createdAt", v.getCreatedAt());
                m.put("notes", v.getNotes());
                return m;
            })
            .toList();

        List<Map<String, Object>> appliedOrders = purchases.stream()
            .filter(o -> o.getVoucherCode() != null && !o.getVoucherCode().isBlank())
            .map(o -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("orderId", o.getId());
                m.put("orderNumber", o.getOrderNumber());
                m.put("orderCode", o.getOrderCode());
                m.put("voucherCode", o.getVoucherCode());
                m.put("discountAmount", o.getDiscountAmount());
                m.put("createdAt", o.getCreatedAt());
                return m;
            })
            .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("customer", c);
        result.put("purchases", purchases);
        result.put("vouchers", vouchers);
        result.put("appliedOrders", appliedOrders);
        return result;
    }

    @Transactional
    public ShopCustomer saveCustomer(ShopCustomer customer, UUID tenantId, UUID companyId) {
        String cleanCode = normalizeCustomerCode(customer.getCustomerCode());
        ShopCustomer target;
        if (customer.getId() != null) {
            target = shopCustomerRepository.findById(customer.getId())
                .orElseThrow(() -> new java.util.NoSuchElementException("Customer not found"));
            if (!target.getTenantId().equals(tenantId) || !target.getCompanyId().equals(companyId))
                throw new IllegalArgumentException("Not your customer");
        } else {
            target = new ShopCustomer();
            target.setTenantId(tenantId);
            target.setCompanyId(companyId);
            target.setPoints(customer.getPoints() != null ? customer.getPoints() : 0);
        }

        if (cleanCode == null) cleanCode = generateCustomerCode();
        final UUID currentId = target.getId();
        final String candidateCode = cleanCode;
        shopCustomerRepository.findByTenantIdAndCompanyIdAndCustomerCodeIgnoreCase(tenantId, companyId, candidateCode)
            .filter(existing -> currentId == null || !existing.getId().equals(currentId))
            .ifPresent(existing -> { throw new IllegalArgumentException("Customer code already exists"); });

        target.setName(customer.getName());
        target.setPhone(customer.getPhone());
        target.setEmail(customer.getEmail());
        target.setNotes(customer.getNotes());
        target.setCustomerCode(cleanCode);
        return shopCustomerRepository.save(target);
    }

    private String generateCustomerCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    private String normalizeCustomerCode(String value) {
        if (value == null) return null;
        String clean = value.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        if (clean.isBlank()) return null;
        return clean.length() > 20 ? clean.substring(0, 20) : clean;
    }

    @Transactional
    public void deleteCustomer(UUID id, UUID tenantId, UUID companyId) {
        ShopCustomer c = shopCustomerRepository.findById(id)
            .orElseThrow(() -> new java.util.NoSuchElementException("Customer not found"));
        if (!c.getTenantId().equals(tenantId) || !c.getCompanyId().equals(companyId))
            throw new IllegalArgumentException("Not your customer");
        shopCustomerRepository.delete(c);
    }

    @Transactional
    public ShopOrderResponseDto linkCustomer(UUID orderId, UUID customerId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (customerId != null) {
            ShopCustomer c = shopCustomerRepository.findById(customerId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Customer not found"));
            if (!c.getTenantId().equals(tenantId) || !c.getCompanyId().equals(companyId))
                throw new IllegalArgumentException("Not your customer");
        }
        order.setCustomerId(customerId);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopCustomer addPoints(UUID customerId, int points, UUID tenantId, UUID companyId) {
        ShopCustomer c = shopCustomerRepository.findById(customerId)
            .orElseThrow(() -> new java.util.NoSuchElementException("Customer not found"));
        if (!c.getTenantId().equals(tenantId) || !c.getCompanyId().equals(companyId))
            throw new IllegalArgumentException("Not your customer");
        c.setPoints((c.getPoints() != null ? c.getPoints() : 0) + points);
        return shopCustomerRepository.save(c);
    }

    // ── Points / Loyalty ───────────────────────────────────────────────

    @Transactional
    public ShopCustomer earnPointsFromOrder(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        if (order.getCustomerId() == null)
            throw new IllegalStateException("No customer linked to this order");
        Company company = companyRepository.findById(companyId).orElseThrow();
        BigDecimal net = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        if (order.getDiscountAmount() != null) net = net.subtract(order.getDiscountAmount());
        int pts = calcPoints(net, company.getPointsConversionRate(), company.getPointsRoundUp());
        if (pts <= 0) throw new IllegalStateException("Order total too low to earn points at current rate");
        ShopCustomer c = shopCustomerRepository.findById(order.getCustomerId())
            .orElseThrow(() -> new java.util.NoSuchElementException("Customer not found"));
        c.setPoints(c.getPoints() + pts);
        return shopCustomerRepository.save(c);
    }

    @Transactional
    public ShopCustomer recalculateCustomerPoints(UUID customerId, UUID tenantId, UUID companyId) {
        ShopCustomer c = shopCustomerRepository.findById(customerId)
            .orElseThrow(() -> new java.util.NoSuchElementException("Customer not found"));
        if (!c.getTenantId().equals(tenantId) || !c.getCompanyId().equals(companyId))
            throw new IllegalArgumentException("Not your customer");
        Company company = companyRepository.findById(companyId).orElseThrow();
        List<ShopOrder> orders = shopOrderRepository.findAllByCustomerIdAndTenantIdAndCompanyId(customerId, tenantId, companyId);
        int total = 0;
        for (ShopOrder o : orders) {
            if (ShopOrder.STATUS_CANCELLED.equals(o.getStatus())) continue;
            BigDecimal net = o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO;
            if (o.getDiscountAmount() != null) net = net.subtract(o.getDiscountAmount());
            total += calcPoints(net, company.getPointsConversionRate(), company.getPointsRoundUp());
        }
        c.setPoints(total);
        return shopCustomerRepository.save(c);
    }

    public static int calcPoints(BigDecimal amount, int rate, boolean roundUp) {
        if (amount == null || rate <= 0) return 0;
        BigDecimal pts = amount.divide(BigDecimal.valueOf(rate), 10, RoundingMode.DOWN);
        return roundUp ? pts.setScale(0, RoundingMode.CEILING).intValue()
                       : pts.setScale(0, RoundingMode.FLOOR).intValue();
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private BigDecimal sumLineTotals(List<ShopOrderItem> items) {
        return items.stream()
            .map(i -> i.getLineTotal() != null ? i.getLineTotal() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumRawCost(List<ShopOrderItem> items) {
        return items.stream()
            .map(i -> (i.getUnitRawCost() != null && i.getQuantity() != null)
                ? i.getUnitRawCost().multiply(i.getQuantity()) : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void disableSourceToken(ShopOrder order) {
        String token = order.getSourceToken();
        if (token == null || token.isBlank()) return;

        ShopAccessToken sat = shopAccessTokenRepository.findByToken(token).orElse(null);
        if (sat == null || !Boolean.TRUE.equals(sat.getEnabled())) return;

        // Disable when every order in the session has reached a terminal state
        List<ShopOrder> sessionOrders = shopOrderRepository.findAllBySourceTokenOrderByCreatedAtDesc(token);
        boolean allDone = !sessionOrders.isEmpty()
                && sessionOrders.stream().allMatch(o -> isFinalStatus(o.getStatus()));
        if (allDone) {
            sat.setEnabled(false);
            shopAccessTokenRepository.save(sat);
        }
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

    private ShopBill createBill(ShopOrder order, int billNumber, ShopBill splitFromBill) {
        ShopBill bill = new ShopBill();
        bill.setTenantId(order.getTenantId());
        bill.setCompanyId(order.getCompanyId());
        bill.setOrder(order);
        bill.setBillNumber(billNumber);
        bill.setStatus(ShopBill.STATUS_ACTIVE);
        bill.setSplitFromBill(splitFromBill);
        bill.setTotalAmount(BigDecimal.ZERO);
        bill.setTotalRawCost(BigDecimal.ZERO);
        bill.setDiscountAmount(BigDecimal.ZERO);
        bill.setVoucherCode(null);
        return shopBillRepository.save(bill);
    }

    private int nextBillNumber(ShopOrder order) {
        long current = shopBillRepository.countByOrder_Id(order.getId());
        return (int) current + 1;
    }

    private List<ShopBill> activeBills(ShopOrder order) {
        return shopBillRepository.findAllByOrder_IdAndStatusOrderByCreatedAtAsc(order.getId(), ShopBill.STATUS_ACTIVE);
    }

    private Optional<ShopBill> firstActiveBill(ShopOrder order) {
        return activeBills(order).stream().findFirst();
    }

    private BigDecimal money(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private BigDecimal nonNegative(BigDecimal value) {
        BigDecimal safe = money(value);
        return safe.compareTo(BigDecimal.ZERO) > 0 ? safe : BigDecimal.ZERO;
    }

    private BigDecimal billDiscountAmount(ShopBill bill) {
        if (bill == null) return BigDecimal.ZERO;
        BigDecimal discount = nonNegative(bill.getDiscountAmount());
        BigDecimal total = nonNegative(bill.getTotalAmount());
        return discount.compareTo(total) > 0 ? total : discount;
    }

    private String cleanVoucherCodes(String value) {
        if (value == null || value.isBlank()) return null;
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        for (String part : value.split(",")) {
            String clean = part == null ? "" : part.trim();
            if (!clean.isBlank()) codes.add(clean);
        }
        return codes.isEmpty() ? null : String.join(", ", codes);
    }

    private String combineVoucherCodes(String... values) {
        if (values == null || values.length == 0) return null;
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        for (String value : values) {
            String clean = cleanVoucherCodes(value);
            if (clean == null) continue;
            for (String part : clean.split(",")) {
                String code = part.trim();
                if (!code.isBlank()) codes.add(code);
            }
        }
        return codes.isEmpty() ? null : String.join(", ", codes);
    }

    private String removeVoucherCodes(String current, String toRemove) {
        String cleanCurrent = cleanVoucherCodes(current);
        if (cleanCurrent == null) return null;
        Set<String> remove = new HashSet<>();
        String cleanRemove = cleanVoucherCodes(toRemove);
        if (cleanRemove != null) {
            for (String part : cleanRemove.split(",")) {
                String code = part.trim();
                if (!code.isBlank()) remove.add(code);
            }
        }
        LinkedHashSet<String> keep = new LinkedHashSet<>();
        for (String part : cleanCurrent.split(",")) {
            String code = part.trim();
            if (!code.isBlank() && !remove.contains(code)) keep.add(code);
        }
        return keep.isEmpty() ? null : String.join(", ", keep);
    }

    private ShopBill resolveDiscountBill(ShopOrder order, UUID billId) {
        List<ShopBill> bills = activeBills(order);
        if (billId != null) {
            return bills.stream()
                    .filter(bill -> billId.equals(bill.getId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Bill not found for this order"));
        }
        if (bills.size() == 1) return bills.get(0);
        if (bills.isEmpty()) throw new IllegalArgumentException("This order has no active bill");
        throw new IllegalArgumentException("Select which bill receives the discount or voucher");
    }

    private void migrateLegacyOrderDiscountToBill(ShopOrder order, List<ShopBill> bills) {
        if (order == null || bills == null || bills.isEmpty()) return;
        boolean anyBillDiscount = bills.stream().anyMatch(bill ->
                nonNegative(bill.getDiscountAmount()).compareTo(BigDecimal.ZERO) > 0
                        || cleanVoucherCodes(bill.getVoucherCode()) != null);
        if (anyBillDiscount) return;
        BigDecimal orderDiscount = nonNegative(order.getDiscountAmount());
        String orderVoucher = cleanVoucherCodes(order.getVoucherCode());
        if (orderDiscount.compareTo(BigDecimal.ZERO) <= 0 && orderVoucher == null) return;
        ShopBill target = bills.stream()
                .filter(bill -> bill.getBillNumber() != null && bill.getBillNumber() == 1)
                .findFirst()
                .orElse(bills.get(0));
        target.setDiscountAmount(orderDiscount);
        target.setVoucherCode(orderVoucher);
        shopBillRepository.save(target);
    }

    private void addBillAdjustment(ShopBill target, ShopBill source) {
        if (target == null || source == null) return;
        target.setDiscountAmount(nonNegative(target.getDiscountAmount()).add(nonNegative(source.getDiscountAmount())));
        target.setVoucherCode(combineVoucherCodes(target.getVoucherCode(), source.getVoucherCode()));
        shopBillRepository.save(target);
    }

    private void subtractBillAdjustment(ShopBill target, ShopBill source) {
        if (target == null || source == null) return;
        BigDecimal next = nonNegative(target.getDiscountAmount()).subtract(nonNegative(source.getDiscountAmount()));
        target.setDiscountAmount(next.compareTo(BigDecimal.ZERO) > 0 ? next : BigDecimal.ZERO);
        target.setVoucherCode(removeVoucherCodes(target.getVoucherCode(), source.getVoucherCode()));
        shopBillRepository.save(target);
    }

    private List<ShopBillItem> activeAssignmentsForOrder(ShopOrder order) {
        return shopBillItemRepository.findAllByBill_Order_Id(order.getId()).stream()
                .filter(assignment -> assignment.getBill() != null
                        && ShopBill.STATUS_ACTIVE.equals(assignment.getBill().getStatus()))
                .toList();
    }

    private void resetOrderBills(ShopOrder order, List<ShopOrderItem> items) {
        List<ShopBill> existingActiveBills = activeBills(order);
        ShopBill bill;
        if (existingActiveBills.size() == 1) {
            // Preserve bill identity because redeemed vouchers reference this bill across item edits.
            bill = existingActiveBills.get(0);
        } else {
            shopBillRepository.deleteAllByOrder_Id(order.getId());
            bill = createBill(order, 1, null);
        }
        bill.setDiscountAmount(nonNegative(order.getDiscountAmount()));
        bill.setVoucherCode(cleanVoucherCodes(order.getVoucherCode()));
        shopBillRepository.save(bill);
        List<ShopBillItem> assignments = new ArrayList<>();
        for (ShopOrderItem item : items) {
            ShopBillItem assignment = new ShopBillItem();
            assignment.setBill(bill);
            assignment.setOriginalBill(bill);
            assignment.setOrderItem(item);
            assignments.add(assignment);
        }
        shopBillItemRepository.saveAll(assignments);
        recalcBillTotals(bill);
        recalcOrderFromBills(order);
    }

    private void ensureOrderBills(ShopOrder order) {
        List<ShopOrderItem> sourceItems = shopOrderItemRepository.findAllByOrder_Id(order.getId());
        List<ShopBill> activeBills = activeBills(order);
        ShopBill defaultBill = activeBills.stream().findFirst()
                .orElseGet(() -> createBill(order, nextBillNumber(order), null));
        Map<UUID, ShopBillItem> byItemId = new HashMap<>();
        for (ShopBillItem assignment : shopBillItemRepository.findAllByOrderItem_Order_Id(order.getId())) {
            if (assignment.getOrderItem() != null) byItemId.put(assignment.getOrderItem().getId(), assignment);
        }
        List<ShopBillItem> missing = new ArrayList<>();
        for (ShopOrderItem item : sourceItems) {
            if (byItemId.containsKey(item.getId())) continue;
            ShopBillItem assignment = new ShopBillItem();
            assignment.setBill(defaultBill);
            assignment.setOriginalBill(defaultBill);
            assignment.setOrderItem(item);
            missing.add(assignment);
        }
        if (!missing.isEmpty()) shopBillItemRepository.saveAll(missing);
        recalcBillsByIds(activeBills(order).stream().map(ShopBill::getId).toList());
        recalcOrderFromBills(order);
    }

    private void recalcBillsByIds(Collection<UUID> billIds) {
        if (billIds == null || billIds.isEmpty()) return;
        for (UUID billId : billIds) {
            shopBillRepository.findById(billId).ifPresent(this::recalcBillTotals);
        }
    }

    private void recalcBillTotals(ShopBill bill) {
        List<ShopOrderItem> items = shopBillItemRepository.findAllByBill_Id(bill.getId()).stream()
                .map(ShopBillItem::getOrderItem)
                .filter(Objects::nonNull)
                .toList();
        BigDecimal total = sumLineTotals(items);
        bill.setTotalAmount(total);
        bill.setTotalRawCost(sumRawCost(items));
        BigDecimal discount = nonNegative(bill.getDiscountAmount());
        if (discount.compareTo(total) > 0) discount = total;
        bill.setDiscountAmount(discount);
        bill.setVoucherCode(cleanVoucherCodes(bill.getVoucherCode()));
        shopBillRepository.save(bill);
    }

    private void recalcOrderFromBills(ShopOrder order) {
        List<ShopBill> bills = activeBills(order);
        migrateLegacyOrderDiscountToBill(order, bills);
        BigDecimal itemTotal = bills.stream()
                .map(bill -> bill.getTotalAmount() != null ? bill.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal rawTotal = bills.stream()
                .map(bill -> bill.getTotalRawCost() != null ? bill.getTotalRawCost() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountTotal = bills.stream()
                .map(this::billDiscountAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        order.setTotalAmount(itemTotal.add(fee));
        order.setTotalRawCost(rawTotal);
        order.setDiscountAmount(discountTotal);
        order.setVoucherCode(combineVoucherCodes(bills.stream().map(ShopBill::getVoucherCode).toArray(String[]::new)));
        shopOrderRepository.save(order);
    }

    private String orderDisplay(ShopOrder order) {
        return order.getOrderNumber() != null ? String.valueOf(order.getOrderNumber()) : order.getOrderCode();
    }

    private ShopOrderResponseDto dto(ShopOrder order) {
        ShopOrderResponseDto response;
        List<ShopBill> ownedBills = shopBillRepository.findAllByOrder_IdOrderByCreatedAtAsc(order.getId());
        if (ownedBills.isEmpty()) {
            response = ShopOrderResponseDto.from(order, shopOrderItemRepository.findAllByOrder_Id(order.getId()));
            return shopLocalizedLabelService.applyToOrder(response);
        }

        List<ShopBillItem> currentAssignments = activeAssignmentsForOrder(order);
        Map<UUID, ShopBill> itemBillMap = new LinkedHashMap<>();
        Map<UUID, List<ShopOrderItem>> billItemsMap = new LinkedHashMap<>();
        List<ShopOrderItem> visibleItems = new ArrayList<>();
        Set<UUID> seenItemIds = new HashSet<>();
        for (ShopBillItem assignment : currentAssignments) {
            ShopBill bill = assignment.getBill();
            ShopOrderItem item = assignment.getOrderItem();
            if (bill == null || item == null) continue;
            itemBillMap.put(item.getId(), bill);
            billItemsMap.computeIfAbsent(bill.getId(), ignored -> new ArrayList<>()).add(item);
            if (seenItemIds.add(item.getId())) visibleItems.add(item);
        }

        List<ShopBill> responseBills = new ArrayList<>(ownedBills);
        Set<UUID> responseBillIds = new HashSet<>();
        for (ShopBill bill : responseBills) responseBillIds.add(bill.getId());
        List<UUID> activeOwnedIds = ownedBills.stream()
                .filter(bill -> ShopBill.STATUS_ACTIVE.equals(bill.getStatus()))
                .map(ShopBill::getId)
                .toList();
        if (!activeOwnedIds.isEmpty()) {
            for (ShopBill mergedSource : shopBillRepository.findAllByMergedIntoBill_IdInAndStatus(activeOwnedIds, ShopBill.STATUS_MERGED)) {
                if (responseBillIds.add(mergedSource.getId())) responseBills.add(mergedSource);
            }
        }

        for (ShopBill bill : responseBills) {
            if (billItemsMap.containsKey(bill.getId())) continue;
            List<ShopOrderItem> items = shopBillItemRepository.findAllByOriginalBill_Id(bill.getId()).stream()
                    .map(ShopBillItem::getOrderItem)
                    .filter(Objects::nonNull)
                    .toList();
            if (!items.isEmpty()) billItemsMap.put(bill.getId(), items);
        }

        if (visibleItems.isEmpty()) {
            visibleItems = shopOrderItemRepository.findAllByOrder_Id(order.getId());
            for (ShopBillItem assignment : shopBillItemRepository.findAllByOrderItem_Order_Id(order.getId())) {
                if (assignment.getOrderItem() != null) {
                    ShopBill displayBill = assignment.getOriginalBill() != null ? assignment.getOriginalBill() : assignment.getBill();
                    if (displayBill != null) itemBillMap.putIfAbsent(assignment.getOrderItem().getId(), displayBill);
                }
            }
        }

        response = ShopOrderResponseDto.from(order, visibleItems, responseBills, itemBillMap, billItemsMap);
        return shopLocalizedLabelService.applyToOrder(response);
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
            String token,
            String customerTableTag,
            Instant requestedFulfillmentAt
    ) {}

    public record BulkImportOrder(
            String externalOrderId,
            String customerName,
            String customerPhone,
            String notes,
            List<ItemRequest> items
    ) {}

    public record BulkImportRequest(String source, boolean deductNow, List<BulkImportOrder> orders) {}

    public record BulkImportResult(int created, int skipped, int failed, List<String> errors) {}

    @Transactional
    public BulkImportResult importExternalOrders(BulkImportRequest request, UUID tenantId, UUID companyId) {
        if (request == null || request.orders() == null || request.orders().isEmpty()) {
            throw new IllegalArgumentException("No orders supplied for import");
        }
        String source = request.source() == null ? "EXTERNAL" : request.source().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("CUKCUK", "KIOTVIET", "EXTERNAL").contains(source)) source = "EXTERNAL";
        int created = 0;
        int skipped = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (BulkImportOrder imported : request.orders()) {
            String externalId = imported.externalOrderId() == null ? "" : imported.externalOrderId().trim();
            if (externalId.isBlank()) {
                failed++;
                errors.add("An order is missing its external order ID");
                continue;
            }
            String importToken = "IMPORT:" + source + ":" + companyId + ":" + externalId;
            boolean exists = shopOrderRepository.findAllBySourceTokenOrderByCreatedAtDesc(importToken).stream()
                    .anyMatch(o -> tenantId.equals(o.getTenantId()) && companyId.equals(o.getCompanyId()));
            if (exists) {
                skipped++;
                continue;
            }
            try {
                CreateOrderRequest create = new CreateOrderRequest(
                        ShopOrder.FULFILLMENT_PICKUP, null, imported.customerName(), imported.customerPhone(),
                        source, null, BigDecimal.ZERO, ShopOrder.PAYMENT_CASH,
                        imported.notes(), imported.items(), null, importToken, null, null);
                ShopOrderResponseDto dto = createOrder(create, tenantId, companyId);
                ShopOrder order = shopOrderRepository.findById(dto.getId()).orElseThrow();
                order.setStatus(ShopOrder.STATUS_CONFIRMED);
                order.setConfirmedAt(Instant.now());
                shopOrderRepository.save(order);
                shopMaterialAuditService.recordOrderDemand(order, "IMPORT_" + source);
                if (request.deductNow()) {
                    shopMaterialAuditService.deductOrderMaterials(order, "IMPORT_" + source);
                }
                created++;
            } catch (RuntimeException ex) {
                failed++;
                errors.add(externalId + ": " + (ex.getMessage() == null ? "Import failed" : ex.getMessage()));
            }
        }
        return new BulkImportResult(created, skipped, failed, errors);
    }

    public String generateOrderTagQr(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        String url = publicBaseUrl + "/shop/order/" + order.getOrderCode();
        if (order.getSourceToken() != null && !order.getSourceToken().isBlank()) {
            url += "?t=" + java.net.URLEncoder.encode(order.getSourceToken(), java.nio.charset.StandardCharsets.UTF_8);
        }
        return QrCodeUtil.generateBase64Png(url, 300);
    }

    public String generateCounterOrderQr(String orderCode) {
        ShopOrder order = requireOrderByCode(orderCode);
        String payload = "SHOP_ORDER:" + order.getOrderCode();
        return QrCodeUtil.generateBase64Png(payload, 360);
    }

    @Transactional
    public ShopOrderResponseDto confirmScannedOrder(String orderCode, UUID tenantId, UUID companyId) {
        String clean = orderCode == null ? "" : orderCode.trim();
        int marker = clean.lastIndexOf("/shop/order/");
        if (marker >= 0) clean = clean.substring(marker + "/shop/order/".length()).split("[?&#]")[0];
        if (clean.startsWith("SHOP_ORDER:")) clean = clean.substring("SHOP_ORDER:".length());
        return confirmOrder(requireOrderByCode(clean).getId(), tenantId, companyId);
    }

    // ── Customer self-cancel (separate from staff cancel) ────────────

    @Transactional
    public ShopOrderResponseDto cancelByCustomer(String orderCode, String note) {
        ShopOrder order = requireOrderByCode(orderCode);
        if (!ShopOrder.STATUS_PENDING.equals(order.getStatus())) {
            throw new IllegalStateException("Order can only be cancelled by customer while PENDING");
        }
        if (ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus())) {
            throw new IllegalStateException("Cannot cancel a paid order");
        }
        order.setStatus(ShopOrder.STATUS_CANCELLED);
        order.setCustomerCancelled(true);
        if (note != null && !note.isBlank()) {
            order.setCustomerCancelNote(note.trim());
        }
        // cancelReason (staff column) intentionally left untouched
        shopOrderRepository.save(order);
        disableSourceToken(order);
        return dto(order);
    }

    // ── Token session (customer tracking session) ─────────────────────

    public record TokenSessionDto(
        String token,
        boolean valid,
        java.time.Instant expiresAt,
        java.time.Instant createdAt,
        Integer maxOrders,
        long acceptedOrderCount,
        boolean counterLocked,
        java.time.Instant counterLockedAt,
        String counterLockedBy,
        List<ShopOrderResponseDto> orders
    ) {}

    @Transactional(readOnly = true)
    public TokenSessionDto getOrdersByToken(String token) {
        ShopAccessToken sat = shopAccessTokenRepository.findByToken(token)
                .orElseThrow(() -> new NoSuchElementException("Token not found"));
        List<ShopOrder> sessionOrders = shopOrderRepository.findAllBySourceTokenOrderByCreatedAtDesc(token);
        List<ShopOrderResponseDto> orders = sessionOrders.stream().map(this::dto).toList();
        long acceptedOrderCount = sessionOrders.stream()
                .filter(order -> !ShopOrder.STATUS_CANCELLED.equals(order.getStatus()))
                .count();
        return new TokenSessionDto(token, sat.isValid(), sat.getExpiresAt(), sat.getCreatedAt(),
                sat.getMaxOrders(), acceptedOrderCount, Boolean.TRUE.equals(sat.getCounterLocked()),
                sat.getCounterLockedAt(), sat.getCounterLockedBy(), orders);
    }

    // ── Staff: combined receipt for a token ──────────────────────────

    @Transactional(readOnly = true)
    public List<ShopOrderResponseDto> getOrdersByTokenForStaff(String token, UUID tenantId, UUID companyId) {
        return shopOrderRepository.findAllBySourceTokenOrderByCreatedAtDesc(token)
                .stream()
                .filter(o -> o.getTenantId().equals(tenantId) && o.getCompanyId().equals(companyId))
                .map(this::dto)
                .toList();
    }

    // ── Code-only public order methods (no tenant/company in URL) ─────

    private ShopOrder requireOrderByCode(String orderCode) {
        return shopOrderRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new NoSuchElementException("Order not found: " + orderCode));
    }

    @Transactional(readOnly = true)
    public ShopOrderResponseDto getOrderByCode(String orderCode) {
        return dto(requireOrderByCode(orderCode));
    }

    @Transactional
    public ShopOrderResponseDto startCustomerEdit(String orderCode) {
        ShopOrder order = requireOrderByCode(orderCode);
        if (!ShopOrder.STATUS_PENDING.equals(order.getStatus()))
            throw new IllegalStateException("Order can only be edited while PENDING");
        order.setCustomerEditing(true);
        order.setCustomerEditingSince(Instant.now());
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto cancelCustomerEdit(String orderCode) {
        ShopOrder order = requireOrderByCode(orderCode);
        order.setCustomerEditing(false);
        order.setCustomerEditingSince(null);
        shopOrderRepository.save(order);
        return dto(order);
    }

    @Transactional
    public ShopOrderResponseDto updateOrderByCustomer(String orderCode, List<ItemRequest> newItems) {
        ShopOrder order = requireOrderByCode(orderCode);
        if (!ShopOrder.STATUS_PENDING.equals(order.getStatus()))
            throw new IllegalStateException("Order can only be updated while PENDING");
        UUID tenantId  = order.getTenantId();
        UUID companyId = order.getCompanyId();
        BigDecimal[] totals = { BigDecimal.ZERO, BigDecimal.ZERO };
        List<ShopOrderItem> items = replaceOrderItems(order, newItems, totals, tenantId, companyId);
        BigDecimal fee = order.getDeliveryFee() != null ? order.getDeliveryFee() : BigDecimal.ZERO;
        order.setTotalAmount(totals[0].add(fee));
        order.setTotalRawCost(totals[1]);
        order.setCustomerEditing(false);
        order.setCustomerEditingSince(null);
        order.setStatus(ShopOrder.STATUS_PENDING);
        order.setConfirmedAt(null);
        order.setReadyAt(null);
        order.setCompletedAt(null);
        refreshPaymentQr(order, companyRepository.findById(companyId).orElse(null));
        shopOrderRepository.save(order);
        resetOrderBills(order, items);
        return dto(order);
    }

    // ── Pickup scan (public — no auth) ────────────────────────────────

    @Transactional
    public ShopOrderResponseDto markPickupScan(String orderCode) {
        ShopOrder order = requireOrderByCode(orderCode);
        order.setPickupScannedAt(Instant.now());
        return dto(shopOrderRepository.save(order));
    }

    @Transactional(readOnly = true)
    public Optional<ShopOrderResponseDto> getActivePickup(UUID tenantId, UUID companyId) {
        Instant cutoff = Instant.now().minusSeconds(300);
        return shopOrderRepository
                .findTopByTenantIdAndCompanyIdAndPickupScannedAtAfterOrderByPickupScannedAtDesc(tenantId, companyId, cutoff)
                .map(this::dto);
    }

    public String generatePickupQr(UUID orderId, UUID tenantId, UUID companyId) {
        ShopOrder order = requireOrder(orderId, tenantId, companyId);
        String url = publicBaseUrl + "/shop/pickup/" + order.getOrderCode();
        return QrCodeUtil.generateBase64Png(url, 300);
    }
}
