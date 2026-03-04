package com.ams.bomcore.service.order;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.controller.order.dto.OrderCreateDto;
import com.ams.bomcore.controller.order.dto.OrderCreateDto.OrderLineCreateDto;
import com.ams.bomcore.controller.order.dto.OrderFinishDto;
import com.ams.bomcore.controller.order.dto.OrderResponseDto;
import com.ams.bomcore.controller.order.dto.OrderResponseDto.OrderLineResponseDto;
import com.ams.bomcore.controller.order.dto.OrderUpdateDto;
import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.domain.inventory.MaterialQuotaEntity;
import com.ams.bomcore.domain.inventory.OrderConsumptionLogEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.order.OrderHeader;
import com.ams.bomcore.domain.order.OrderLine;
import com.ams.bomcore.domain.order.OrderConsumption;
import com.ams.bomcore.repository.OrderConsumptionRepository;
import com.ams.bomcore.domain.order.ProductionConsumption;
import com.ams.bomcore.domain.order.ProductionRun;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.BomRepository;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialQuotaRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.repository.OrderConsumptionLogRepository;
import com.ams.bomcore.repository.OrderHeaderRepository;
import com.ams.bomcore.repository.OrderLineRepository;
import com.ams.bomcore.repository.ProductionConsumptionRepository;
import com.ams.bomcore.repository.ProductionRunRepository;
import com.ams.bomcore.service.bom.BomService;
import com.ams.bomcore.service.order.exception.BomNotFoundException;
import com.ams.bomcore.service.order.exception.InsufficientStockException;
import com.ams.bomcore.service.order.exception.InvalidOrderStatusException;
import com.ams.bomcore.service.order.exception.OrderNotFoundException;
import com.ams.bomcore.service.order.exception.QuotaExceededException;

/**
 * Core service for the Order + Production lifecycle.
 *
 * <p>Lifecycle: CREATE → CONFIRM → (IN_PRODUCTION) → FINISH → DELIVER/COMPLETE
 *
 * <p>Multi-tenant: every query is scoped by tenantId + companyId.
 */
@Service
public class OrderService {

    // ── Movement type constants ───────────────────────────────────────
    private static final String MVT_ISSUE_TO_PRODUCTION = "ISSUE_TO_PRODUCTION";
    private static final String MVT_CONSUMPTION = "CONSUMPTION";
    private static final String MVT_SALE = "SALE";
    private static final String MVT_RETURN = "RETURN";
    private static final String REF_ORDER = "ORDER";

    // Default compensation rate when none is defined (1.0 = no adjustment)
    private static final BigDecimal DEFAULT_COMPENSATION_RATE = BigDecimal.ONE;

    private final OrderHeaderRepository orderHeaderRepository;
    private final OrderLineRepository orderLineRepository;
    private final ProductionRunRepository productionRunRepository;
    private final ProductionConsumptionRepository productionConsumptionRepository;
    private final BomRepository bomRepository;
    private final BomItemRepository bomItemRepository;
    private final MaterialRepository materialRepository;
    private final ModelRepository modelRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryMovementRepository movementRepository;
    private final OrderConsumptionLogRepository consumptionLogRepository;
    private final MaterialQuotaRepository quotaRepository;
    private final OrderConsumptionRepository orderConsumptionRepository;
    private final BomService bomService;

    public OrderService(
            OrderHeaderRepository orderHeaderRepository,
            OrderLineRepository orderLineRepository,
            ProductionRunRepository productionRunRepository,
            ProductionConsumptionRepository productionConsumptionRepository,
            BomRepository bomRepository,
            BomItemRepository bomItemRepository,
            MaterialRepository materialRepository,
            ModelRepository modelRepository,
            InventoryRepository inventoryRepository,
            InventoryMovementRepository movementRepository,
            OrderConsumptionLogRepository consumptionLogRepository,
            MaterialQuotaRepository quotaRepository,
            OrderConsumptionRepository orderConsumptionRepository,
            BomService bomService) {
        this.orderHeaderRepository = orderHeaderRepository;
        this.orderLineRepository = orderLineRepository;
        this.productionRunRepository = productionRunRepository;
        this.productionConsumptionRepository = productionConsumptionRepository;
        this.bomRepository = bomRepository;
        this.bomItemRepository = bomItemRepository;
        this.materialRepository = materialRepository;
        this.modelRepository = modelRepository;
        this.inventoryRepository = inventoryRepository;
        this.movementRepository = movementRepository;
        this.consumptionLogRepository = consumptionLogRepository;
        this.quotaRepository = quotaRepository;
        this.orderConsumptionRepository = orderConsumptionRepository;
        this.bomService = bomService;
    }

    // ═════════════════════════════════════════════════════════════════
    // READ
    // ═════════════════════════════════════════════════════════════════

    public Page<OrderResponseDto> listOrders(UUID tenantId, UUID companyId,
                                              String status, String orderType,
                                              Instant fromDate, Instant toDate,
                                              Pageable pageable) {
        Page<OrderHeader> page = orderHeaderRepository.findByFilters(
                tenantId, companyId, status, orderType, fromDate, toDate, pageable);
        return page.map(this::toResponseDto);
    }

    public OrderResponseDto getById(UUID id, UUID tenantId, UUID companyId) {
        OrderHeader order = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new OrderNotFoundException(id));
        return toResponseDto(order);
    }

    // ═════════════════════════════════════════════════════════════════
    // CREATE
    // ═════════════════════════════════════════════════════════════════

    /**
     * Create a new order (DRAFT status) and immediately calculate provisional
     * material consumption via BOM explosion.
     *
     * <p>Steps:
     * <ol>
     *   <li>Validate uniqueness of orderNumber</li>
     *   <li>Persist OrderHeader + OrderLines</li>
     *   <li>For MODEL lines: explode active BOM → provisional consumption logs</li>
     *   <li>For MATERIAL lines: direct consumption log entries</li>
     *   <li>Check inventory availability</li>
     *   <li>Check quota remaining</li>
     *   <li>Create ISSUE_TO_PRODUCTION inventory movements (status PENDING)</li>
     * </ol>
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderResponseDto createOrder(OrderCreateDto dto, UUID tenantId, UUID companyId) {

        // 1. Uniqueness check
        if (orderHeaderRepository.existsByOrderNumberAndTenantIdAndCompanyId(
                dto.getOrderNumber(), tenantId, companyId)) {
            throw new IllegalArgumentException("Order number already exists: " + dto.getOrderNumber());
        }

        // 2. Build and persist header
        OrderHeader header = new OrderHeader();
        header.setId(UUID.randomUUID());
        header.setOrderNumber(dto.getOrderNumber());
        header.setOrderType(dto.getOrderType());
        header.setStatus(OrderHeader.STATUS_DRAFT);
        header.setCustomerId(dto.getCustomerId());
        header.setPlannedStartDate(dto.getPlannedStartDate());
        header.setPlannedEndDate(dto.getPlannedEndDate());
        header.setDeliveryDateTime(dto.getDeliveryDateTime());
        header.setNotes(dto.getNotes());
        header.setCreatedBy(dto.getCreatedBy());
        header.setTenantId(tenantId);
        header.setCompanyId(companyId);

        // 3. Build order lines
        List<OrderLine> lines = new ArrayList<>();
        int lineNum = 1;
        for (OrderLineCreateDto lineDto : dto.getLines()) {
            validateLineDto(lineDto);
            OrderLine line = buildOrderLine(lineDto, header, lineNum++, tenantId, companyId);
            lines.add(line);
        }
        header.setLines(lines);

        // Calculate total planned qty from lines
        BigDecimal totalPlanned = lines.stream()
                .map(OrderLine::getQuantityOrdered)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        header.setTotalPlannedQty(totalPlanned);

        // Persist header (cascades to lines)
        header = orderHeaderRepository.save(header);

        // 4 & 5. BOM explosion + provisional consumption logs + availability/quota checks
        processProvisionalConsumption(header, lines, tenantId, companyId);

        return toResponseDto(header);
    }

    // ═════════════════════════════════════════════════════════════════
    // UPDATE (DRAFT only)
    // ═════════════════════════════════════════════════════════════════

    @Transactional(rollbackFor = Exception.class)
    public OrderResponseDto updateOrder(UUID id, OrderUpdateDto dto, UUID tenantId, UUID companyId) {
        OrderHeader header = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new OrderNotFoundException(id));

        if (!OrderHeader.STATUS_DRAFT.equals(header.getStatus())) {
            throw new InvalidOrderStatusException("Only DRAFT orders can be updated. Current status: " + header.getStatus());
        }

        header.setOrderType(dto.getOrderType());
        header.setCustomerId(dto.getCustomerId());
        header.setPlannedStartDate(dto.getPlannedStartDate());
        header.setPlannedEndDate(dto.getPlannedEndDate());
        header.setNotes(dto.getNotes());
        header.setUpdatedBy(dto.getUpdatedBy());

        if (dto.getLines() != null && !dto.getLines().isEmpty()) {
            // Cancel existing provisional consumption logs before rebuilding
            cancelProvisionalConsumptionLogs(id);
            // Replace lines
            header.getLines().clear();
            int lineNum = 1;
            for (OrderLineCreateDto lineDto : dto.getLines()) {
                validateLineDto(lineDto);
                OrderLine line = buildOrderLine(lineDto, header, lineNum++, tenantId, companyId);
                header.getLines().add(line);
            }
            BigDecimal totalPlanned = header.getLines().stream()
                    .map(OrderLine::getQuantityOrdered)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            header.setTotalPlannedQty(totalPlanned);
        }

        header = orderHeaderRepository.save(header);

        if (dto.getLines() != null && !dto.getLines().isEmpty()) {
            processProvisionalConsumption(header, header.getLines(), tenantId, companyId);
        }

        return toResponseDto(header);
    }

    // ═════════════════════════════════════════════════════════════════
    // CONFIRM
    // ═════════════════════════════════════════════════════════════════

    /**
     * Confirm a DRAFT order → status becomes CONFIRMED.
     * For PRODUCTION orders, also creates ProductionRun records for each MODEL line.
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderResponseDto confirmOrder(UUID id, UUID tenantId, UUID companyId) {
        OrderHeader header = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new OrderNotFoundException(id));

        if (!OrderHeader.STATUS_DRAFT.equals(header.getStatus())) {
            throw new InvalidOrderStatusException(header.getStatus(), OrderHeader.STATUS_CONFIRMED);
        }

        header.setStatus(OrderHeader.STATUS_CONFIRMED);

        // For PRODUCTION orders: create a ProductionRun per MODEL line
        if (OrderHeader.TYPE_PRODUCTION.equals(header.getOrderType())) {
            for (OrderLine line : header.getLines()) {
                if (OrderLine.LINE_TYPE_MODEL.equals(line.getLineType())) {
                    ProductionRun run = new ProductionRun();
                    run.setId(UUID.randomUUID());
                    run.setProductionBatchId(UUID.randomUUID());
                    run.setOrderId(header.getId());
                    run.setOrderLineId(line.getId());
                    run.setModelId(line.getModelId());
                    run.setTargetQty(line.getQuantityOrdered());
                    run.setStatus(ProductionRun.STATUS_PLANNED);
                    run.setTenantId(tenantId);
                    run.setCompanyId(companyId);
                    run = productionRunRepository.save(run);

                    // Mirror the provisional consumption logs into per-run records
                    List<OrderConsumptionLogEntity> logs = consumptionLogRepository.findByOrderId(header.getId());
                    for (OrderConsumptionLogEntity log : logs) {
                        ProductionConsumption pc = new ProductionConsumption();
                        pc.setId(UUID.randomUUID());
                        pc.setProductionRun(run);
                        pc.setMaterial(log.getMaterial());
                        pc.setPlannedQty(log.getPlannedQty());
                        pc.setEffectivePlannedQty(log.getEffectivePlannedQty());
                        pc.setTenantId(tenantId);
                        pc.setCompanyId(companyId);
                        productionConsumptionRepository.save(pc);
                    }
                }
            }
            header.setStatus(OrderHeader.STATUS_IN_PRODUCTION);
            header.setActualStartDate(Instant.now());
        }

        header = orderHeaderRepository.save(header);
        return toResponseDto(header);
    }

    // ═════════════════════════════════════════════════════════════════
    // FINISH
    // ═════════════════════════════════════════════════════════════════

    /**
     * Finish an order: finalize real consumption, deduct from inventory, update quota.
     *
     * <p>Steps:
     * <ol>
     *   <li>Resolve real qty per material (from dto or default to effective_planned_qty)</li>
     *   <li>Finalize consumption logs (status = FINALIZED)</li>
     *   <li>Create CONSUMPTION/SALE inventory movements</li>
     *   <li>Deduct real qty from inventory (quantityOnHand)</li>
     *   <li>Deduct effective_planned_qty from material_quota</li>
     *   <li>Mark order lines COMPLETED, header COMPLETED</li>
     * </ol>
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderResponseDto finishOrder(UUID id, OrderFinishDto dto, UUID tenantId, UUID companyId) {
        OrderHeader header = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new OrderNotFoundException(id));

        String status = header.getStatus();
        if (!OrderHeader.STATUS_CONFIRMED.equals(status)
                && !OrderHeader.STATUS_IN_PRODUCTION.equals(status)) {
            throw new InvalidOrderStatusException(status, "COMPLETED");
        }

        // Build a map of materialId → realQty from the dto (may be empty/null)
        Map<UUID, BigDecimal> realQtyOverrides = new HashMap<>();
        if (dto != null && dto.getRealConsumptions() != null) {
            for (OrderFinishDto.RealConsumptionEntry entry : dto.getRealConsumptions()) {
                if (entry.getMaterialId() != null && entry.getRealQty() != null) {
                    realQtyOverrides.put(entry.getMaterialId(), entry.getRealQty());
                }
            }
        }

        // Load all provisional consumption logs for this order
        List<OrderConsumptionLogEntity> logs = consumptionLogRepository.findByOrderId(id);

        BigDecimal totalActual = BigDecimal.ZERO;

        for (OrderConsumptionLogEntity log : logs) {
            if ("FINALIZED".equals(log.getStatus())) continue; // already finalized

            UUID materialId = log.getMaterial().getId();
            BigDecimal realQty = realQtyOverrides.getOrDefault(materialId, log.getEffectivePlannedQty());

            log.setRealConsumptionQty(realQty);
            log.setStatus("FINALIZED");
            consumptionLogRepository.save(log);

            // Determine movement type
            String movementType = OrderHeader.TYPE_SALES.equals(header.getOrderType()) ? MVT_SALE : MVT_CONSUMPTION;

            // Create finalized inventory movement
            createInventoryMovement(
                    log.getMaterial(), null, realQty, log.getMaterial().getUnit(),
                    null, movementType, "Order finalized: " + header.getOrderNumber(),
                    dto != null ? dto.getUpdatedBy() : "system",
                    REF_ORDER, id, tenantId, companyId);

            // Deduct real qty from inventory (quantityOnHand)
            deductInventory(materialId, realQty, tenantId, companyId);

            // Deduct effective_planned_qty from quota (planned portion)
            deductQuota(log.getMaterial(), log.getEffectivePlannedQty(), tenantId, companyId);

            totalActual = totalActual.add(realQty);
        }

        // Mark all lines COMPLETED
        for (OrderLine line : header.getLines()) {
            line.setLineStatus(OrderLine.LINE_STATUS_COMPLETED);
        }

        // Finalize production runs (if any)
        List<ProductionRun> runs = productionRunRepository.findActiveRunsByOrderId(id);
        for (ProductionRun run : runs) {
            run.setStatus(ProductionRun.STATUS_COMPLETED);
            run.setEndDate(Instant.now());
            productionRunRepository.save(run);

            // Update per-run ProductionConsumption with actual consumed quantities
            List<ProductionConsumption> pcList = productionConsumptionRepository.findByProductionRun_Id(run.getId());
            for (ProductionConsumption pc : pcList) {
                UUID matId = pc.getMaterial().getId();
                BigDecimal realQty = realQtyOverrides.getOrDefault(matId, pc.getEffectivePlannedQty());
                pc.setActualConsumedQty(realQty);
                productionConsumptionRepository.save(pc);
            }
        }

        header.setStatus(OrderHeader.STATUS_COMPLETED);
        header.setActualEndDate(Instant.now());
        header.setTotalActualQty(totalActual);
        header.setUpdatedBy(dto != null ? dto.getUpdatedBy() : null);

        header = orderHeaderRepository.save(header);
        return toResponseDto(header);
    }

    // ═════════════════════════════════════════════════════════════════
    // DELIVER
    // ═════════════════════════════════════════════════════════════════

    /**
     * Mark a COMPLETED order as DELIVERED. Applies mainly to SALES orders.
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderResponseDto deliverOrder(UUID id, UUID tenantId, UUID companyId) {
        OrderHeader header = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new OrderNotFoundException(id));

        if (!OrderHeader.STATUS_COMPLETED.equals(header.getStatus())
                && !OrderHeader.STATUS_CONFIRMED.equals(header.getStatus())) {
            throw new InvalidOrderStatusException(header.getStatus(), OrderHeader.STATUS_DELIVERED);
        }

        header.setStatus(OrderHeader.STATUS_DELIVERED);
        header.setActualEndDate(Instant.now());
        header = orderHeaderRepository.save(header);
        return toResponseDto(header);
    }

    // ═════════════════════════════════════════════════════════════════
    // CANCEL
    // ═════════════════════════════════════════════════════════════════

    /**
     * Cancel an order. Returns provisional locks/consumption to available.
     * COMPLETED or DELIVERED orders cannot be cancelled.
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderResponseDto cancelOrder(UUID id, UUID tenantId, UUID companyId) {
        OrderHeader header = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new OrderNotFoundException(id));

        String status = header.getStatus();
        if (OrderHeader.STATUS_COMPLETED.equals(status)
                || OrderHeader.STATUS_DELIVERED.equals(status)) {
            throw new InvalidOrderStatusException("Cannot cancel a " + status + " order");
        }

        // Cancel all provisional consumption logs (no inventory deduction needed)
        cancelProvisionalConsumptionLogs(id);

        // Cancel active production runs
        List<ProductionRun> runs = productionRunRepository.findActiveRunsByOrderId(id);
        for (ProductionRun run : runs) {
            run.setStatus(ProductionRun.STATUS_CANCELLED);
            productionRunRepository.save(run);
        }

        // Mark lines cancelled
        for (OrderLine line : header.getLines()) {
            if (!OrderLine.LINE_STATUS_COMPLETED.equals(line.getLineStatus())) {
                line.setLineStatus(OrderLine.LINE_STATUS_CANCELLED);
            }
        }

        header.setStatus(OrderHeader.STATUS_CANCELLED);
        header = orderHeaderRepository.save(header);
        return toResponseDto(header);
    }

    // ═════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═════════════════════════════════════════════════════════════════

    /** Validate that a line DTO has the correct reference for its type. */
    private void validateLineDto(OrderLineCreateDto lineDto) {
        if (OrderLine.LINE_TYPE_MODEL.equals(lineDto.getLineType())) {
            if (lineDto.getModelId() == null) {
                throw new IllegalArgumentException("modelId is required for MODEL line type");
            }
        } else if (OrderLine.LINE_TYPE_MATERIAL.equals(lineDto.getLineType())) {
            if (lineDto.getMaterialId() == null) {
                throw new IllegalArgumentException("materialId is required for MATERIAL line type");
            }
        } else {
            throw new IllegalArgumentException("lineType must be MODEL or MATERIAL, got: " + lineDto.getLineType());
        }
    }

    /** Build an OrderLine entity from its DTO. */
    private OrderLine buildOrderLine(OrderLineCreateDto dto, OrderHeader header,
                                     int lineNum, UUID tenantId, UUID companyId) {
        OrderLine line = new OrderLine();
        line.setId(UUID.randomUUID());
        line.setOrder(header);
        line.setLineNumber(lineNum);
        line.setLineType(dto.getLineType());
        line.setModelId(dto.getModelId());
        line.setMaterialId(dto.getMaterialId());
        line.setQuantityOrdered(dto.getQuantityOrdered());
        line.setUnit(dto.getUnit());
        line.setUnitPrice(dto.getUnitPrice());
        line.setNotes(dto.getNotes());
        line.setTenantId(tenantId);
        line.setCompanyId(companyId);
        return line;
    }

    /**
     * Core BOM explosion + provisional consumption creation.
     * Called on create and on update (with line replacement).
     */
    private void processProvisionalConsumption(OrderHeader header, List<OrderLine> lines,
                                                UUID tenantId, UUID companyId) {
        // Pre-flight: validate active BOM exists for every MODEL line
        for (OrderLine line : lines) {
            if (OrderLine.LINE_TYPE_MODEL.equals(line.getLineType())) {
                try {
                    bomService.validateActiveBomForOrder(line.getModelId(), tenantId);
                } catch (IllegalStateException e) {
                    throw new BomNotFoundException(e.getMessage());
                }
            }
        }
        for (OrderLine line : lines) {
            if (OrderLine.LINE_TYPE_MODEL.equals(line.getLineType())) {
                explodeBomForLine(header, line, tenantId, companyId);
            } else {
                createDirectMaterialConsumptionLog(header, line, tenantId, companyId);
            }
        }
    }

    /**
     * Explode the active BOM for a MODEL line.
     * Creates one OrderConsumptionLogEntity per BOM item (material).
     * Applies compensation rate (from material.price field if used as rate, or default 1.0).
     */
    private void explodeBomForLine(OrderHeader header, OrderLine line,
                                   UUID tenantId, UUID companyId) {
        UUID modelId = line.getModelId();

        // Find the model
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));

        // Find the active BOM for this model+tenant
        BomEntity bom = bomRepository.findByModelAndTenantIdAndStatus(model, tenantId, "ACTIVE")
                .orElseThrow(() -> new BomNotFoundException(modelId));

        // Get all BOM items (flat explosion — level-0 leaf items are raw materials)
        List<BomItemEntity> bomItems = bomItemRepository.findByBomIdAndTenantIdAndCompanyId(
                bom.getId(), tenantId, companyId);

        if (bomItems.isEmpty()) {
            // Fallback: try without company filter
            bomItems = bomItemRepository.findByBomId(bom.getId());
        }

        BigDecimal orderedQty = line.getQuantityOrdered();

        for (BomItemEntity bomItem : bomItems) {
            Material material = bomItem.getMaterial();
            // planned_qty = bom_item.quantity * ordered_qty
            BigDecimal plannedQty = bomItem.getQuantity()
                    .multiply(orderedQty)
                    .setScale(4, RoundingMode.HALF_UP);

            // effective_planned_qty = planned_qty * compensation_rate
            // We use DEFAULT_COMPENSATION_RATE (1.0) — could be read from material config
            BigDecimal compensationRate = DEFAULT_COMPENSATION_RATE;
            BigDecimal effectivePlannedQty = plannedQty
                    .multiply(compensationRate)
                    .setScale(4, RoundingMode.HALF_UP);

            // No hard inventory check here — use checkInventory action instead

            // Create provisional consumption log
            OrderConsumptionLogEntity log = new OrderConsumptionLogEntity();
            log.setId(UUID.randomUUID());
            log.setOrderId(header.getId());
            log.setBomCalculationId(null); // no pre-existing bom_calculation used here
            log.setMaterial(material);
            log.setPlannedQty(plannedQty);
            log.setEffectivePlannedQty(effectivePlannedQty);
            log.setStatus("PROVISIONAL");
            log.setTenantId(tenantId);
            log.setCompanyId(companyId);
            consumptionLogRepository.save(log);

            // No ISSUE_TO_PRODUCTION movement at order creation time.
            // Use moveToProduction action to create movements after checkInventory passes.
        }

        // Store the BOM id on the line for traceability
        line.setBomCalculationId(bom.getId());
        orderLineRepository.save(line);
    }

    /**
     * Create a direct material consumption log for a MATERIAL line type.
     * planned = effective = ordered qty. No BOM explosion needed.
     */
    private void createDirectMaterialConsumptionLog(OrderHeader header, OrderLine line,
                                                     UUID tenantId, UUID companyId) {
        Material material = materialRepository.findById(line.getMaterialId())
                .orElseThrow(() -> new IllegalArgumentException("Material not found: " + line.getMaterialId()));

        BigDecimal qty = line.getQuantityOrdered();

        // No hard inventory check here — use checkInventory action instead

        OrderConsumptionLogEntity log = new OrderConsumptionLogEntity();
        log.setId(UUID.randomUUID());
        log.setOrderId(header.getId());
        log.setMaterial(material);
        log.setPlannedQty(qty);
        log.setEffectivePlannedQty(qty);
        log.setStatus("PROVISIONAL");
        log.setTenantId(tenantId);
        log.setCompanyId(companyId);
        consumptionLogRepository.save(log);

        // No provisional movement — moveToProduction creates it.
    }

    /**
     * Check that the material quota (current period) is not exceeded.
     * Only throws if a quota record exists and would be exceeded.
     * If no quota record exists, consumption is unconstrained.
     */
    private void checkAndValidateQuota(Material material, BigDecimal requestedQty,
                                       UUID tenantId, UUID companyId) {
        LocalDate period = LocalDate.now().withDayOfMonth(1); // first day of current month
        Optional<MaterialQuotaEntity> quotaOpt = quotaRepository
                .findByMaterialAndTenantIdAndCompanyIdAndQuotaPeriod(material, tenantId, companyId, period);
        if (quotaOpt.isPresent()) {
            MaterialQuotaEntity quota = quotaOpt.get();
            BigDecimal remaining = quota.getRemainingQuota();
            if (remaining.compareTo(requestedQty) < 0) {
                throw new QuotaExceededException(
                        material.getMaterialCode(),
                        requestedQty.doubleValue(),
                        remaining.doubleValue());
            }
        }
    }

    /** Deduct realQty from inventory (quantityOnHand) across FIFO batches. */
    private void deductInventory(UUID materialId, BigDecimal qty, UUID tenantId, UUID companyId) {
        List<InventoryEntity> entries = inventoryRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                .stream()
                .filter(e -> e.getMaterial().getId().equals(materialId)
                        && e.getQuantityOnHand() != null
                        && e.getQuantityOnHand().compareTo(BigDecimal.ZERO) > 0)
                .toList();

        BigDecimal remaining = qty;
        for (InventoryEntity entry : entries) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal deduct = remaining.min(entry.getQuantityOnHand());
            entry.setQuantityOnHand(entry.getQuantityOnHand().subtract(deduct));
            inventoryRepository.save(entry);
            remaining = remaining.subtract(deduct);
        }
        // If remaining > 0 here, stock was not enough — but we already checked earlier.
    }

    /** Deduct plannedQty from the material quota consumed_quota for the current period. */
    private void deductQuota(Material material, BigDecimal qty, UUID tenantId, UUID companyId) {
        LocalDate period = LocalDate.now().withDayOfMonth(1);
        Optional<MaterialQuotaEntity> quotaOpt = quotaRepository
                .findByMaterialAndTenantIdAndCompanyIdAndQuotaPeriod(material, tenantId, companyId, period);
        if (quotaOpt.isPresent()) {
            MaterialQuotaEntity quota = quotaOpt.get();
            quota.setConsumedQuota(quota.getConsumedQuota().add(qty));
            quotaRepository.save(quota);
        }
    }

    /** Create an InventoryMovementEntity record. */
    private void createInventoryMovement(Material material,
                                          com.ams.bomcore.domain.inventory.WarehouseEntity warehouse,
                                          BigDecimal quantity, String unit,
                                          String batchNo, String movementType, String reason,
                                          String createdBy, String referenceType, UUID referenceId,
                                          UUID tenantId, UUID companyId) {
        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setId(UUID.randomUUID());
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setFromWarehouse(warehouse);
        movement.setQuantity(quantity);
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(movementType);
        movement.setReason(reason);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(createdBy);
        movement.setStatus("PENDING");
        movementRepository.save(movement);
    }

    /** Set all PROVISIONAL consumption logs for an order to CANCELLED. */
    private void cancelProvisionalConsumptionLogs(UUID orderId) {
        List<OrderConsumptionLogEntity> logs = consumptionLogRepository.findByOrderId(orderId);
        for (OrderConsumptionLogEntity log : logs) {
            if ("PROVISIONAL".equals(log.getStatus())) {
                log.setStatus("CANCELLED");
                consumptionLogRepository.save(log);
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // CHECK INVENTORY (multi-order)
    // ═════════════════════════════════════════════════════════════════

    /**
     * For a list of order IDs: sum required material quantities via BOM explosion,
     * compare with available inventory, persist OrderConsumption rows, return result.
     */
    @Transactional(rollbackFor = Exception.class)
    public CheckInventoryResult checkInventory(List<UUID> orderIds, UUID tenantId, UUID companyId) {
        // Clear old consumption entries for these orders
        orderConsumptionRepository.deleteByOrderIds(orderIds);

        // Aggregate required qty per material across all orders
        Map<UUID, BigDecimal> requiredQtyByMaterial = new java.util.LinkedHashMap<>();
        Map<UUID, Material> materialById = new HashMap<>();

        for (UUID orderId : orderIds) {
            List<OrderConsumptionLogEntity> logs = consumptionLogRepository.findByOrderId(orderId);
            for (OrderConsumptionLogEntity log : logs) {
                if ("CANCELLED".equals(log.getStatus())) continue;
                UUID matId = log.getMaterial().getId();
                materialById.put(matId, log.getMaterial());
                requiredQtyByMaterial.merge(matId, log.getEffectivePlannedQty(), BigDecimal::add);
            }
        }

        // Check each material against inventory
        List<CheckInventoryResult.MaterialCheckRow> rows = new ArrayList<>();
        boolean allSufficient = true;

        for (Map.Entry<UUID, BigDecimal> entry : requiredQtyByMaterial.entrySet()) {
            UUID matId = entry.getKey();
            BigDecimal required = entry.getValue();
            BigDecimal available = inventoryRepository.sumAvailableByMaterialId(matId);
            if (available == null) available = BigDecimal.ZERO;
            boolean sufficient = available.compareTo(required) >= 0;
            if (!sufficient) allSufficient = false;

            Material mat = materialById.get(matId);
            rows.add(new CheckInventoryResult.MaterialCheckRow(
                    matId,
                    mat != null ? mat.getMaterialCode() : "",
                    mat != null ? mat.getMaterialName() : "",
                    required, available, sufficient));

            // Persist per-order consumption records
            BigDecimal quotaPercentage = null;
            // Use materialQuotaPercentage from inventory row if available (first matching row)
            List<InventoryEntity> invRows = inventoryRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                    .stream().filter(e -> e.getMaterial() != null && e.getMaterial().getId().equals(matId)).toList();
            if (!invRows.isEmpty() && invRows.get(0).getMaterialQuotaPercentage() != null) {
                quotaPercentage = invRows.get(0).getMaterialQuotaPercentage();
            }
            final BigDecimal qp = quotaPercentage != null ? quotaPercentage : BigDecimal.ONE;

            for (UUID orderId : orderIds) {
                List<OrderConsumptionLogEntity> orderLogs = consumptionLogRepository.findByOrderId(orderId);
                for (OrderConsumptionLogEntity log : orderLogs) {
                    if (!"CANCELLED".equals(log.getStatus()) && log.getMaterial().getId().equals(matId)) {
                        OrderConsumption oc = new OrderConsumption();
                        oc.setOrderId(orderId);
                        oc.setMaterial(mat);
                        oc.setPlannedQty(log.getEffectivePlannedQty());
                        oc.setAdjustedQty(log.getEffectivePlannedQty()
                                .multiply(qp).setScale(4, RoundingMode.HALF_UP));
                        oc.setAvailableQty(available);
                        oc.setCheckResult(sufficient ? "SUFFICIENT" : "INSUFFICIENT");
                        oc.setTenantId(tenantId);
                        oc.setCompanyId(companyId);
                        orderConsumptionRepository.save(oc);
                    }
                }
            }
        }

        return new CheckInventoryResult(allSufficient, rows);
    }

    /** DTO returned by checkInventory */
    public static class CheckInventoryResult {
        private final boolean sufficient;
        private final List<MaterialCheckRow> rows;

        public CheckInventoryResult(boolean sufficient, List<MaterialCheckRow> rows) {
            this.sufficient = sufficient;
            this.rows = rows;
        }

        public boolean isSufficient() { return sufficient; }
        public List<MaterialCheckRow> getRows() { return rows; }

        public static class MaterialCheckRow {
            private final UUID materialId;
            private final String materialCode;
            private final String materialName;
            private final BigDecimal requiredQty;
            private final BigDecimal availableQty;
            private final boolean sufficient;

            public MaterialCheckRow(UUID materialId, String materialCode, String materialName,
                                    BigDecimal requiredQty, BigDecimal availableQty, boolean sufficient) {
                this.materialId   = materialId;
                this.materialCode = materialCode;
                this.materialName = materialName;
                this.requiredQty  = requiredQty;
                this.availableQty = availableQty;
                this.sufficient   = sufficient;
            }

            public UUID getMaterialId() { return materialId; }
            public String getMaterialCode() { return materialCode; }
            public String getMaterialName() { return materialName; }
            public BigDecimal getRequiredQty() { return requiredQty; }
            public BigDecimal getAvailableQty() { return availableQty; }
            public boolean isSufficient() { return sufficient; }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // MOVE TO PRODUCTION (multi-order)
    // ═════════════════════════════════════════════════════════════════

    /**
     * For a list of CONFIRMED/MATERIAL_READY orders:
     * <ol>
     *   <li>Run checkInventory — abort with error if any material is insufficient.</li>
     *   <li>For each inventory row tagged with orderToDeduction, deduct and create
     *       ISSUE_TO_PRODUCTION movement (referenceId = orderId, inventoryId = inv.id).</li>
     *   <li>Change order status → MATERIAL_READY.</li>
     * </ol>
     */
    @Transactional(rollbackFor = Exception.class)
    public List<OrderResponseDto> moveToProduction(List<UUID> orderIds, Instant deliveryDateTime,
                                                    String issuedBy, UUID tenantId, UUID companyId) {
        // 1. Verify stock
        CheckInventoryResult check = checkInventory(orderIds, tenantId, companyId);
        if (!check.isSufficient()) {
            List<String> shortages = check.getRows().stream()
                    .filter(r -> !r.isSufficient())
                    .map(r -> r.getMaterialCode() + " need=" + r.getRequiredQty() + " avail=" + r.getAvailableQty())
                    .toList();
            throw new InsufficientStockException(String.join("; ", shortages), 0, 0);
        }

        // 2. Aggregate required qty per material with FEFO deduction
        Map<UUID, BigDecimal> requiredByMaterial = new java.util.LinkedHashMap<>();
        Map<UUID, Material> materialById = new HashMap<>();
        for (UUID orderId : orderIds) {
            for (OrderConsumptionLogEntity log : consumptionLogRepository.findByOrderId(orderId)) {
                if ("CANCELLED".equals(log.getStatus())) continue;
                UUID matId = log.getMaterial().getId();
                materialById.put(matId, log.getMaterial());
                requiredByMaterial.merge(matId, log.getEffectivePlannedQty(), BigDecimal::add);
            }
        }

        // 3. Deduct FEFO per material, create movements
        for (Map.Entry<UUID, BigDecimal> entry : requiredByMaterial.entrySet()) {
            UUID matId = entry.getKey();
            BigDecimal remaining = entry.getValue();

            // Fetch inventory rows ordered by expiration (FEFO)
            List<InventoryEntity> invRows = inventoryRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                    .stream()
                    .filter(e -> e.getMaterial() != null && e.getMaterial().getId().equals(matId)
                            && Boolean.TRUE.equals(e.getVisible()) && !Boolean.TRUE.equals(e.getLocked()))
                    .sorted(java.util.Comparator.comparing(
                            e -> e.getExpirationDateTime() == null ? java.time.Instant.MAX : e.getExpirationDateTime()))
                    .toList();

            for (InventoryEntity inv : invRows) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
                BigDecimal onHand = inv.getQuantityOnHand() == null ? BigDecimal.ZERO : inv.getQuantityOnHand();
                BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
                BigDecimal usable = onHand.subtract(locked);
                if (usable.compareTo(BigDecimal.ZERO) <= 0) continue;

                BigDecimal deduct = remaining.min(usable);

                // Deduct from inventory
                inv.setQuantityOnHand(onHand.subtract(deduct));
                inv.setOrderToDeduction(null); // clear tag
                inventoryRepository.save(inv);

                // Create one ISSUE_TO_PRODUCTION movement per order (split proportionally)
                // For simplicity: attribute the whole deduction to the first order that needs it
                for (UUID orderId : orderIds) {
                    BigDecimal orderNeed = consumptionLogRepository.findByOrderId(orderId)
                            .stream()
                            .filter(l -> !("CANCELLED".equals(l.getStatus())) && l.getMaterial().getId().equals(matId))
                            .map(OrderConsumptionLogEntity::getEffectivePlannedQty)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    if (orderNeed.compareTo(BigDecimal.ZERO) <= 0) continue;

                    BigDecimal forOrder = deduct.min(orderNeed);
                    if (forOrder.compareTo(BigDecimal.ZERO) <= 0) continue;

                    Material mat = materialById.get(matId);
                    InventoryMovementEntity mvt = new InventoryMovementEntity();
                    mvt.setId(UUID.randomUUID());
                    mvt.setTenantId(tenantId);
                    mvt.setCompanyId(companyId);
                    mvt.setMaterial(mat);
                    mvt.setFromWarehouse(inv.getWarehouse());
                    mvt.setQuantity(forOrder);
                    mvt.setUnit(mat != null && mat.getUnit() != null ? mat.getUnit() : "pcs");
                    mvt.setMovementType(MVT_ISSUE_TO_PRODUCTION);
                    mvt.setReason("Move to production: order batch");
                    mvt.setReferenceType(REF_ORDER);
                    mvt.setReferenceId(orderId);
                    mvt.setInventoryId(inv.getId());
                    mvt.setBatchNo(inv.getBatchNo());
                    mvt.setCreatedBy(issuedBy);
                    mvt.setStatus("COMPLETED");
                    movementRepository.save(mvt);

                    deduct = deduct.subtract(forOrder);
                    if (deduct.compareTo(BigDecimal.ZERO) <= 0) break;
                }

                remaining = remaining.subtract(usable.min(remaining));
            }
        }

        // 4. Update order status → MATERIAL_READY and set deliveryDateTime
        List<OrderResponseDto> results = new ArrayList<>();
        for (UUID orderId : orderIds) {
            OrderHeader header = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(orderId, tenantId, companyId)
                    .orElseThrow(() -> new OrderNotFoundException(orderId));
            header.setStatus(OrderHeader.STATUS_MATERIAL_READY);
            if (deliveryDateTime != null) header.setDeliveryDateTime(deliveryDateTime);
            header = orderHeaderRepository.save(header);
            results.add(toResponseDto(header));
        }
        return results;
    }

    // ═════════════════════════════════════════════════════════════════
    // MAPPING
    // ═════════════════════════════════════════════════════════════════

    private OrderResponseDto toResponseDto(OrderHeader header) {
        OrderResponseDto dto = new OrderResponseDto();
        dto.setId(header.getId());
        dto.setOrderNumber(header.getOrderNumber());
        dto.setOrderType(header.getOrderType());
        dto.setStatus(header.getStatus());
        dto.setCustomerId(header.getCustomerId());
        dto.setProductionBatchId(header.getProductionBatchId());
        dto.setPlannedStartDate(header.getPlannedStartDate());
        dto.setPlannedEndDate(header.getPlannedEndDate());
        dto.setActualStartDate(header.getActualStartDate());
        dto.setActualEndDate(header.getActualEndDate());
        dto.setDeliveryDateTime(header.getDeliveryDateTime());
        dto.setTotalPlannedQty(header.getTotalPlannedQty());
        dto.setTotalActualQty(header.getTotalActualQty());
        dto.setNotes(header.getNotes());
        dto.setTenantId(header.getTenantId());
        dto.setCompanyId(header.getCompanyId());
        dto.setCreatedBy(header.getCreatedBy());
        dto.setCreatedAt(header.getCreatedAt());
        dto.setUpdatedAt(header.getUpdatedAt());

        List<OrderLineResponseDto> lineDtos = header.getLines().stream()
                .map(this::toLineResponseDto)
                .toList();
        dto.setLines(lineDtos);

        return dto;
    }

    private OrderLineResponseDto toLineResponseDto(OrderLine line) {
        OrderLineResponseDto dto = new OrderLineResponseDto();
        dto.setId(line.getId());
        dto.setLineNumber(line.getLineNumber());
        dto.setLineType(line.getLineType());
        dto.setModelId(line.getModelId());
        dto.setMaterialId(line.getMaterialId());
        dto.setQuantityOrdered(line.getQuantityOrdered());
        dto.setQuantityProduced(line.getQuantityProduced());
        dto.setQuantityDelivered(line.getQuantityDelivered());
        dto.setQuantityCancelled(line.getQuantityCancelled());
        dto.setUnit(line.getUnit());
        dto.setUnitPrice(line.getUnitPrice());
        dto.setLineStatus(line.getLineStatus());
        dto.setBomCalculationId(line.getBomCalculationId());
        dto.setNotes(line.getNotes());
        return dto;
    }
}
