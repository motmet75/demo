package com.ams.bomcore.service.order;

import java.math.BigDecimal;
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

import com.ams.bomcore.context.UserContext;
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
import com.ams.bomcore.domain.order.OrderConsumption;
import com.ams.bomcore.domain.order.OrderHeader;
import com.ams.bomcore.domain.order.OrderLine;
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
import com.ams.bomcore.repository.OrderConsumptionRepository;
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
//        if (orderHeaderRepository.existsByOrderNumberAndTenantIdAndCompanyId(
//                dto.getOrderNumber(), tenantId, companyId)) {
//            throw new IllegalArgumentException("Order number already exists: " + dto.getOrderNumber());
//        }

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
        header.setDestinationWarehouseId(dto.getDestinationWarehouseId());
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

        header.setOrderNumber(dto.getOrderNumber());
        header.setOrderType(dto.getOrderType());
        header.setCustomerId(dto.getCustomerId());
        header.setPlannedStartDate(dto.getPlannedStartDate());
        header.setPlannedEndDate(dto.getPlannedEndDate());
        header.setNotes(dto.getNotes());
        header.setDestinationWarehouseId(dto.getDestinationWarehouseId());
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
                && !OrderHeader.STATUS_IN_PRODUCTION.equals(status)
                && !OrderHeader.STATUS_MATERIAL_READY.equals(status)) {
            throw new InvalidOrderStatusException(status, "COMPLETED");
        }

        // If stock was already deducted by moveToProduction, skip the inventory deduction
        // to avoid a double-deduction of quantityOnHand.
        boolean stockAlreadyDeducted = OrderHeader.STATUS_MATERIAL_READY.equals(status);

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
            if ("FINALIZED".equals(log.getStatus())) {
				continue; // already finalized
			}

            UUID materialId = log.getMaterial().getId();
            BigDecimal realQty = realQtyOverrides.getOrDefault(materialId, log.getEffectivePlannedQty());

            log.setRealConsumptionQty(realQty);
            log.setStatus("FINALIZED");
            consumptionLogRepository.save(log);

            // Determine movement type
            String movementType = OrderHeader.TYPE_SALES.equals(header.getOrderType()) ? MVT_SALE : MVT_CONSUMPTION;

            // Always create a finalized CONSUMPTION/SALE movement for the audit trail.
            // quantityTotal is NEVER touched — only quantityOnHand via deductInventory.
            createInventoryMovement(
                    log.getMaterial(), null, realQty, log.getMaterial().getUnit(),
                    null, movementType, "Order finalized: " + header.getOrderNumber(),
                    dto != null ? dto.getUpdatedBy() : "system",
                    REF_ORDER, id, tenantId, companyId);

            // Only deduct quantityOnHand if moveToProduction has NOT already done so.
            // This prevents double-deduction when the order went through MATERIAL_READY.
            if (!stockAlreadyDeducted) {
                deductInventory(materialId, realQty, tenantId, companyId);
            }

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
        // Store selected BOM id early — will be overwritten with resolved bom id after explosion
        if (dto.getBomId() != null) {
            line.setBomCalculationId(dto.getBomId());
        }
        return line;
    }

    /**
     * Core BOM explosion + provisional consumption creation.
     * Called on create and on update (with line replacement).
     */
    private void processProvisionalConsumption(OrderHeader header, List<OrderLine> lines,
                                                UUID tenantId, UUID companyId) {
        // Pre-flight: validate that a BOM (active or specified) exists for every MODEL line
        for (OrderLine line : lines) {
            if (OrderLine.LINE_TYPE_MODEL.equals(line.getLineType())) {
                if (line.getBomCalculationId() != null) {
                    // Specific BOM chosen — validate it exists and belongs to this tenant
                    bomRepository.findByIdAndTenantIdAndCompanyId(line.getBomCalculationId(), tenantId, companyId)
                            .orElseThrow(() -> new BomNotFoundException("BOM not found: " + line.getBomCalculationId()));
                } else {
                    try {
                        bomService.validateActiveBomForOrder(line.getModelId(), tenantId);
                    } catch (IllegalStateException e) {
                        throw new BomNotFoundException(e.getMessage());
                    }
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
     * Explode the BOM for a MODEL line.
     * Uses the BOM id stored on the line (set from OrderLineCreateDto.bomId) if present,
     * otherwise falls back to the ACTIVE BOM for the model+tenant.
     */
    private void explodeBomForLine(OrderHeader header, OrderLine line,
                                   UUID tenantId, UUID companyId) {
        UUID modelId = line.getModelId();

        // Find the model
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));

        // Resolve BOM: use caller-supplied bomId if present, else find ACTIVE
        BomEntity bom;
        if (line.getBomCalculationId() != null) {
            bom = bomRepository.findById(line.getBomCalculationId())
                    .orElseThrow(() -> new BomNotFoundException(line.getBomCalculationId()));
        } else {
            bom = bomRepository.findByModelAndTenantIdAndStatus(model, tenantId, "ACTIVE")
                    .orElseThrow(() -> new BomNotFoundException(modelId));
        }

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
                    .multiply(orderedQty);

            // ✅ FIXED: effectivePlannedQty = plannedQty (full BOM demand)
            // Quota percentage is ONLY for deduction logic (limits how much can be pulled from inventory).
            // It does NOT reduce the actual planned requirement.
            // This is the full quantity needed for production.
            BigDecimal effectivePlannedQty = plannedQty;

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

    /**
     * Deduct {@code qty} from inventory for a given material using the
     * <strong>orderToDeduction-alpha + quota-cap</strong> algorithm:
     *
     * <ol>
     *   <li>Sort eligible rows by {@code orderToDeduction} label alphabetically
     *       ascending (null / blank → placed last), then FEFO as tiebreaker.</li>
     *   <li>For each row compute the deductible ceiling:
     *       <pre>deductible = availableQty - quotaPercentage * availableQty
     *              = onHand × (1 - quota% / 100) - locked</pre>
     *       The quota fraction is the scrap/waste buffer that must stay in the warehouse.</li>
     *   <li>Take {@code min(remaining demand, deductible)} from this row, advance to the
     *       next row when the current row is exhausted.</li>
     * </ol>
     *
     * Only {@code quantity_on_hand} and {@code updated_at} are written — no other columns
     * are touched (avoids overwriting {@code orderToDeduction} labels, etc.).
     *
     * @param materialId material to deduct
     * @param qty        total demand quantity to satisfy
     * @param tenantId   tenant scope
     * @param companyId  company scope
     */
    private void deductInventory(UUID materialId, BigDecimal qty, UUID tenantId, UUID companyId) {
        // 1. Load and sort rows: alpha by orderToDeduction (null/blank last), then FEFO
        List<InventoryEntity> entries = inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)
                .stream()
                .filter(e -> e.getMaterial() != null
                        && e.getMaterial().getId().equals(materialId)
                        && Boolean.TRUE.equals(e.getVisible())
                        && !Boolean.TRUE.equals(e.getLocked())
                        && e.getQuantityOnHand() != null
                        && e.getQuantityOnHand().compareTo(BigDecimal.ZERO) > 0)
                .sorted(java.util.Comparator
                        // Group 2 (tagged) first, Group 1 (null/blank) last
                        .<InventoryEntity>comparingInt(e ->
                                (e.getOrderToDeduction() == null || e.getOrderToDeduction().isBlank()) ? 1 : 0)
                        // Within Group 2: sort by orderToDeduction A→Z
                        .thenComparing(e ->
                                (e.getOrderToDeduction() == null || e.getOrderToDeduction().isBlank())
                                        ? "" : e.getOrderToDeduction().trim(),
                                String.CASE_INSENSITIVE_ORDER)
                        // Then by materialCode A→Z (both groups)
                        .thenComparing(e ->
                                e.getMaterial() != null && e.getMaterial().getMaterialCode() != null
                                        ? e.getMaterial().getMaterialCode() : "",
                                String.CASE_INSENSITIVE_ORDER))
                .toList();

        BigDecimal remaining = qty;
        Instant now = Instant.now();



        for (InventoryEntity entry : entries) {

            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
				break;
			}

            BigDecimal onHand = entry.getQuantityOnHand();
            BigDecimal locked = entry.getQuantityLocked() != null ? entry.getQuantityLocked() : BigDecimal.ZERO;

            // quota% is a waste/scrap buffer applied only to the FREE stock (onHand - locked).
            // freeStock             = max(0, onHand - locked)
            // deductible            = freeStock × (1 - quota%/100)
            BigDecimal quotaPct = entry.getMaterialQuotaPercentage() != null
                    ? entry.getMaterialQuotaPercentage() : BigDecimal.ZERO;
            BigDecimal quotaFactor = quotaPct.divide(new BigDecimal("100"), java.math.MathContext.DECIMAL128);
            BigDecimal freeStock = onHand.subtract(locked).max(BigDecimal.ZERO);
            BigDecimal deductible = freeStock
                    .multiply(BigDecimal.ONE.subtract(quotaFactor))
                    .max(BigDecimal.ZERO);

            if (deductible.compareTo(BigDecimal.ZERO) <= 0) {
				continue;  // row fully reserved — skip
			}

            // How much we actually take from this row
            BigDecimal take = remaining.min(deductible);

            // Targeted update: only quantity_on_hand and updated_at are written
            inventoryRepository.updateQuantityOnHand(
                    entry.getId(),
                    onHand.subtract(take),
                    now);

            remaining = remaining.subtract(take);
        }
        // If remaining > 0 here, stock was insufficient — checkInventory should have caught this.
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

    /** Create an InventoryMovementEntity record.
     *  quantity must be the absolute (positive) amount moved.
     *  For stock-out types (CONSUMPTION, SALE) it is stored as negative automatically. */
    private void createInventoryMovement(Material material,
                                          com.ams.bomcore.domain.inventory.WarehouseEntity warehouse,
                                          BigDecimal quantity, String unit,
                                          String batchNo, String movementType, String reason,
                                          String createdBy, String referenceType, UUID referenceId,
                                          UUID tenantId, UUID companyId) {
        // Stock-out movement types are stored with a negative quantity
        boolean isStockOut = MVT_CONSUMPTION.equals(movementType) || MVT_SALE.equals(movementType)
                || MVT_ISSUE_TO_PRODUCTION.equals(movementType);
        BigDecimal storedQty = isStockOut ? quantity.negate() : quantity;

        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setId(UUID.randomUUID());
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setFromWarehouse(warehouse);
        movement.setQuantity(storedQty);
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

        // Capture the currently logged-in user
        String checkedBy = UserContext.getUsernameOrDefault();

        // Aggregate required qty per material across all orders
        Map<UUID, BigDecimal> requiredQtyByMaterial = new java.util.LinkedHashMap<>();
        Map<UUID, Material> materialById = new HashMap<>();

        for (UUID orderId : orderIds) {
            List<OrderConsumptionLogEntity> logs = consumptionLogRepository.findByOrderId(orderId);
            for (OrderConsumptionLogEntity log : logs) {
                if ("CANCELLED".equals(log.getStatus())) {
					continue;
				}
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

            // Fetch inventory rows for this material to get quota% and compute
            // quota-adjusted available: each row contributes max(0, (onHand - locked) × (1 − quota%/100))
            // Using per-row quotaPct — quota% only bites into the FREE stock, not the locked portion.
            List<InventoryEntity> invRows = inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)
                    .stream().filter(e -> e.getMaterial() != null && e.getMaterial().getId().equals(matId)).toList();

            // available = sum over rows of max(0, (onHand - locked) × (1 − quota%/100))
            BigDecimal available = invRows.stream().map(e -> {
                BigDecimal oh  = e.getQuantityOnHand()          == null ? BigDecimal.ZERO : e.getQuantityOnHand();
                BigDecimal lk  = e.getQuantityLocked()          == null ? BigDecimal.ZERO : e.getQuantityLocked();
                BigDecimal qp  = e.getMaterialQuotaPercentage() == null ? BigDecimal.ZERO : e.getMaterialQuotaPercentage();
                BigDecimal qf  = qp.divide(new BigDecimal("100"), java.math.MathContext.DECIMAL128);
                BigDecimal free = oh.subtract(lk).max(BigDecimal.ZERO);
                return free.multiply(BigDecimal.ONE.subtract(qf)).max(BigDecimal.ZERO);
            }).reduce(BigDecimal.ZERO, BigDecimal::add);

            // Use quota% of first row as representative for display/adjustedQty only
            BigDecimal quotaPct = invRows.stream()
                    .filter(e -> e.getMaterialQuotaPercentage() != null)
                    .map(InventoryEntity::getMaterialQuotaPercentage)
                    .findFirst().orElse(BigDecimal.ZERO);
            BigDecimal quotaFactor = quotaPct.divide(new BigDecimal("100"), java.math.MathContext.DECIMAL128);

            boolean sufficient = available.compareTo(required) >= 0;
            if (!sufficient) {
				allSufficient = false;
			}

            Material mat = materialById.get(matId);
            rows.add(new CheckInventoryResult.MaterialCheckRow(
                    matId,
                    mat != null ? mat.getMaterialCode() : "",
                    mat != null ? mat.getMaterialName() : "",
                    required, available, sufficient));

            // Persist per-order consumption records.
            // adjustedQty: if available >= required, will pull full planned qty.
            // Otherwise, distribute available proportionally across each log's planned qty.
            // This preserves precision using BigDecimal (no flooring/truncation).
            for (UUID orderId : orderIds) {
                List<OrderConsumptionLogEntity> orderLogs = consumptionLogRepository.findByOrderId(orderId);
                for (OrderConsumptionLogEntity log : orderLogs) {
                    if (!"CANCELLED".equals(log.getStatus()) && log.getMaterial().getId().equals(matId)) {
                        OrderConsumption oc = new OrderConsumption();
                        oc.setOrderId(orderId);
                        oc.setMaterial(mat);
                        oc.setPlannedQty(log.getEffectivePlannedQty());

                        // adjustedQty = what will actually be pulled from stock
                        // If sufficient stock, pull full planned qty.
                        // If insufficient, distribute available proportionally.
                        BigDecimal adjusted;
                        if (available.compareTo(required) >= 0) {
                            // Stock is sufficient - can pull full amount
                            adjusted = log.getEffectivePlannedQty();
                        } else if (required.compareTo(BigDecimal.ZERO) > 0) {
                            // Stock is insufficient - distribute available proportionally
                            // adjustedQty = plannedQty × (available / required)
                            adjusted = log.getEffectivePlannedQty()
                                    .multiply(available)
                                    .divide(required, java.math.MathContext.DECIMAL128);
                        } else {
                            adjusted = BigDecimal.ZERO;
                        }

                        oc.setAdjustedQty(adjusted);
                        oc.setAvailableQty(available);
                        oc.setCheckResult(sufficient ? "SUFFICIENT" : "INSUFFICIENT");
                        oc.setTenantId(tenantId);
                        oc.setCompanyId(companyId);
                        oc.setUpdatedBy(checkedBy);
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
    public List<OrderResponseDto> moveToProduction(List<UUID> orderIds, Instant deliveryDateTime, String issuedBy, UUID tenantId, UUID companyId) {
        // Resolve issuedBy: prefer explicit param, fall back to UserContext
        String resolvedIssuedBy = (issuedBy != null && !issuedBy.isBlank())
                ? issuedBy : UserContext.getUsernameOrDefault();
        // 1. Verify stock
        CheckInventoryResult check = checkInventory(orderIds, tenantId, companyId);
        if (!check.isSufficient()) {
            List<String> shortages = check.getRows().stream()
                    .filter(r -> !r.isSufficient())
                    .map(r -> r.getMaterialCode() + " need=" + r.getRequiredQty() + " avail=" + r.getAvailableQty())
                    .toList();
            throw new InsufficientStockException(String.join("; ", shortages), 0, 0);
        }

        // 2. Aggregate required qty per material with FEFO deduction.
        // Load ALL logs upfront — avoids repeated DB/cache round-trips inside the deduction loop
        // and ensures we work from a clean snapshot AFTER checkInventory's bulk-delete has flushed.
        Map<UUID, List<OrderConsumptionLogEntity>> logsByOrderId = new HashMap<>();
        for (UUID orderId : orderIds) {
            logsByOrderId.put(orderId, consumptionLogRepository.findByOrderId(orderId));
        }

        Map<UUID, BigDecimal> requiredByMaterial = new java.util.LinkedHashMap<>();
        Map<UUID, Material> materialById = new HashMap<>();
        for (UUID orderId : orderIds) {
            for (OrderConsumptionLogEntity log : logsByOrderId.get(orderId)) {
                if ("CANCELLED".equals(log.getStatus())) {
					continue;
				}
                UUID matId = log.getMaterial().getId();
                materialById.put(matId, log.getMaterial());
                requiredByMaterial.merge(matId, log.getEffectivePlannedQty(), BigDecimal::add);
            }
        }

        // 3. Deduct per material, create ISSUE_TO_PRODUCTION movements.
        //    Only quantityOnHand is touched — quantityTotal is NEVER modified here.
        //
        //    Two-group strategy:
        //      Group 1 — orderToDeduction non-null/non-empty : sort by orderToDeduction A→Z, then materialCode A→Z
        //      Group 2 — orderToDeduction null/blank         : sort by materialCode A→Z
        //    Group 1 is processed first, then Group 2.
        for (Map.Entry<UUID, BigDecimal> entry : requiredByMaterial.entrySet()) {
            UUID matId = entry.getKey();
            BigDecimal remaining = entry.getValue();

            // Base filter: visible, not locked, belongs to this material
            java.util.function.Predicate<InventoryEntity> baseFilter = e ->
                    e.getMaterial() != null && e.getMaterial().getId().equals(matId)
                    && Boolean.TRUE.equals(e.getVisible())
                    && !Boolean.TRUE.equals(e.getLocked());

            // Shared secondary comparator: materialCode A→Z
            java.util.Comparator<InventoryEntity> byMaterialCode = java.util.Comparator.comparing(
                    e -> e.getMaterial() != null && e.getMaterial().getMaterialCode() != null
                            ? e.getMaterial().getMaterialCode() : "",
                    String.CASE_INSENSITIVE_ORDER);

            // Group 1: tagged rows — sort by orderToDeduction A→Z, then materialCode A→Z
            List<InventoryEntity> taggedRows = inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)
                    .stream()
                    .filter(baseFilter)
                    .filter(e -> e.getOrderToDeduction() != null && !e.getOrderToDeduction().isBlank())
                    .sorted(java.util.Comparator
                            .<InventoryEntity, String>comparing(
                                    e -> e.getOrderToDeduction().trim(), String.CASE_INSENSITIVE_ORDER)
                            .thenComparing(byMaterialCode))
                    .toList();

            // Group 2: untagged rows — sort by materialCode A→Z
            List<InventoryEntity> untaggedRows = inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)
                    .stream()
                    .filter(baseFilter)
                    .filter(e -> e.getOrderToDeduction() == null || e.getOrderToDeduction().isBlank())
                    .sorted(byMaterialCode)
                    .toList();

            // Merge: Group 1 first, Group 2 last
            List<InventoryEntity> invRows = new java.util.ArrayList<>();
            invRows.addAll(taggedRows);
            invRows.addAll(untaggedRows);

            for (InventoryEntity inv : invRows) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
					break;
				}

                BigDecimal onHand = inv.getQuantityOnHand() == null ? BigDecimal.ZERO : inv.getQuantityOnHand();
                BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();

                // quota% is a waste/scrap buffer applied only to FREE stock (onHand - locked).
                // freeStock            = max(0, onHand - locked)
                // availableForDeduction = freeStock × (1 - quota%/100)
                BigDecimal quotaPct = inv.getMaterialQuotaPercentage() != null
                        ? inv.getMaterialQuotaPercentage() : BigDecimal.ZERO;
                BigDecimal quotaFactor = quotaPct.divide(new BigDecimal("100"), java.math.MathContext.DECIMAL128);
                BigDecimal freeStock = onHand.subtract(locked).max(BigDecimal.ZERO);
                BigDecimal availableForDeduction = freeStock
                        .multiply(BigDecimal.ONE.subtract(quotaFactor))
                        .max(BigDecimal.ZERO);

                BigDecimal couldBeDeducted = remaining.min(availableForDeduction);

                // Soft-reserve the waste buffer portion that stays in the warehouse.
                // lockedAdd = couldBeDeducted × quota% / (1 - quota%)
                BigDecimal lockedAdd = (quotaFactor.compareTo(BigDecimal.ZERO) > 0
                        && quotaFactor.compareTo(BigDecimal.ONE) < 0)
                        ? couldBeDeducted.multiply(quotaFactor)
                                .divide(BigDecimal.ONE.subtract(quotaFactor), java.math.MathContext.DECIMAL128)
                        : BigDecimal.ZERO;

                System.out.println("[MTP-DEDUCT] ─────────────────────────────────────────────────");
                System.out.println("[MTP-DEDUCT] inventoryId       = " + inv.getId());
                System.out.println("[MTP-DEDUCT] materialCode      = " + (inv.getMaterial() != null ? inv.getMaterial().getMaterialCode() : "null"));
                System.out.println("[MTP-DEDUCT] orderToDeduction  = " + inv.getOrderToDeduction());
                System.out.println("[MTP-DEDUCT] group             = " + (inv.getOrderToDeduction() != null && !inv.getOrderToDeduction().isBlank() ? "TAGGED" : "UNTAGGED"));
                System.out.println("[MTP-DEDUCT] onHand            = " + onHand);
                System.out.println("[MTP-DEDUCT] locked            = " + locked);
                System.out.println("[MTP-DEDUCT] freeStock         = " + freeStock);
                System.out.println("[MTP-DEDUCT] quotaPct          = " + quotaPct + "%");
                System.out.println("[MTP-DEDUCT] quotaFactor       = " + quotaFactor);
                System.out.println("[MTP-DEDUCT] availableForDeduct= " + availableForDeduction);
                System.out.println("[MTP-DEDUCT] remainingDemand   = " + remaining);
                System.out.println("[MTP-DEDUCT] couldBeDeducted   = " + couldBeDeducted);
                System.out.println("[MTP-DEDUCT] lockedAdd         = " + lockedAdd);
                System.out.println("[MTP-DEDUCT] onHandAfter       = " + onHand.subtract(couldBeDeducted));
                System.out.println("[MTP-DEDUCT] lockedAfter       = " + locked.add(lockedAdd));
                System.out.println("[MTP-DEDUCT] skip?             = " + (availableForDeduction.compareTo(BigDecimal.ZERO) <= 0 || couldBeDeducted.compareTo(BigDecimal.ZERO) <= 0));

                if ((availableForDeduction.compareTo(BigDecimal.ZERO) <= 0) || (couldBeDeducted.compareTo(BigDecimal.ZERO) <= 0)) {
					continue;
				}

                // Apply updates — only quantityOnHand (and optionally quantityLocked) touched
                inventoryRepository.updateQuantityOnHand(inv.getId(), onHand.subtract(couldBeDeducted), Instant.now());
                if (lockedAdd.compareTo(BigDecimal.ZERO) > 0) {
                    inventoryRepository.updateQuantityLocked(inv.getId(), locked.add(lockedAdd), Instant.now());
                }

                // Distribute this row's deduction across orders that need this material
                BigDecimal rowRemaining = couldBeDeducted;

                for (UUID orderId : orderIds) {
                    if (rowRemaining.compareTo(BigDecimal.ZERO) <= 0) {
						break;
					}

                    List<OrderConsumptionLogEntity> orderMatLogs = logsByOrderId.get(orderId)
                            .stream()
                            .filter(l -> !"CANCELLED".equals(l.getStatus())
                                    && l.getMaterial().getId().equals(matId))
                            .toList();

                    BigDecimal orderNeed = orderMatLogs.stream()
                            .map(OrderConsumptionLogEntity::getEffectivePlannedQty)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    if (orderNeed.compareTo(BigDecimal.ZERO) <= 0) {
						continue;
					}

                    BigDecimal forOrder = rowRemaining.min(orderNeed);
                    if (forOrder.compareTo(BigDecimal.ZERO) <= 0) {
						continue;
					}

                    Material mat = materialById.get(matId);
                    InventoryMovementEntity mvt = new InventoryMovementEntity();
                    mvt.setId(UUID.randomUUID());
                    mvt.setTenantId(tenantId);
                    mvt.setCompanyId(companyId);
                    mvt.setMaterial(mat);
                    mvt.setFromWarehouse(inv.getWarehouse());
                    mvt.setQuantity(forOrder.negate()); // negative — stock leaving inventory to production
                    mvt.setUnit(mat != null && mat.getUnit() != null ? mat.getUnit() : "pcs");
                    mvt.setMovementType(MVT_ISSUE_TO_PRODUCTION);
                    mvt.setReason("Move to production: order batch");
                    mvt.setReferenceType(REF_ORDER);
                    mvt.setReferenceId(orderId);
                    mvt.setInventoryId(inv.getId());
                    mvt.setBatchNo(inv.getBatchNo());
                    mvt.setCreatedBy(resolvedIssuedBy);
                    mvt.setStatus("COMPLETED");
                    movementRepository.save(mvt);

                    // Stamp deducted_inventory_id on every consumption log for this order+material
                    for (OrderConsumptionLogEntity cLog : orderMatLogs) {
                        cLog.setDeductedInventoryId(inv.getId());
                        consumptionLogRepository.save(cLog);
                    }

                    rowRemaining = rowRemaining.subtract(forOrder);
                }

                remaining = remaining.subtract(couldBeDeducted);
            }
        }

        // 4. Update order status → MATERIAL_READY and set deliveryDateTime
        List<OrderResponseDto> results = new ArrayList<>();
        for (UUID orderId : orderIds) {
            OrderHeader header = orderHeaderRepository.findByIdAndTenantIdAndCompanyId(orderId, tenantId, companyId)
                    .orElseThrow(() -> new OrderNotFoundException(orderId));
            header.setStatus(OrderHeader.STATUS_MATERIAL_READY);
            if (deliveryDateTime != null) {
				header.setDeliveryDateTime(deliveryDateTime);
			}
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
        dto.setDestinationWarehouseId(header.getDestinationWarehouseId());

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

    // ═════════════════════════════════════════════════════════════════
    // SORT HELPERS — numeric-aware orderToDeduction comparator
    // ═════════════════════════════════════════════════════════════════

    /**
     * Primary sort key: if the label is a pure integer return its int value (0-based),
     * so "2" < "3" < "10" < "64" numerically.
     * Non-numeric labels and null/blank get Integer.MAX_VALUE (sorted last after all numbers).
     */
    private static int orderToDeductionSortKey(String label) {
        if (label == null || label.isBlank()) {
			return Integer.MAX_VALUE;
		}
        try {
            return Integer.parseInt(label.trim());
        } catch (NumberFormatException e) {
            return Integer.MAX_VALUE; // non-numeric → goes after all numeric labels
        }
    }

    /**
     * Secondary sort key: for non-numeric (or null/blank) labels fall back to
     * case-insensitive string order. Numeric labels all return "" so they stay
     * grouped together and ranked only by {@link #orderToDeductionSortKey}.
     */
    private static String orderToDeductionStrKey(String label) {
        if (label == null || label.isBlank()) {
			return "\uFFFF";
		}
        try {
            Integer.parseInt(label.trim());
            return ""; // numeric — primary key already handles ordering
        } catch (NumberFormatException e) {
            return label.trim().toUpperCase();
        }
    }
}