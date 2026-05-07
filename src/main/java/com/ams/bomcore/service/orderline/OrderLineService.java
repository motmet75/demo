package com.ams.bomcore.service.orderline;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.controller.orderline.dto.OrderLineRequestDto;
import com.ams.bomcore.controller.orderline.dto.OrderLineResponseDto;
import com.ams.bomcore.domain.order.OrderHeader;
import com.ams.bomcore.domain.order.OrderLine;
import com.ams.bomcore.repository.OrderHeaderRepository;
import com.ams.bomcore.repository.OrderLineRepository;
import com.ams.bomcore.service.order.OrderService;
import com.ams.bomcore.service.order.exception.OrderNotFoundException;

/**
 * CRUD service for {@link OrderLine} entities.
 *
 * <p>Deliberately kept separate from the heavyweight {@link OrderService} that
 * owns the production lifecycle.  All mutations are tenant/company-scoped.
 *
 * <p>Endpoint summary (implemented in {@code OrderLineController}):
 * <pre>
 * GET    /api/order-lines              – list (filter by orderId, lineStatus, lineType)
 * GET    /api/order-lines/{id}         – get single line
 * POST   /api/order-lines              – create
 * PUT    /api/order-lines/{id}         – full update
 * PATCH  /api/order-lines/{id}/status  – status transition only
 * DELETE /api/order-lines/{id}         – delete (only PENDING / CANCELLED allowed)
 * </pre>
 */
@Service
public class OrderLineService {

    private final OrderLineRepository   orderLineRepository;
    private final OrderHeaderRepository orderHeaderRepository;

    public OrderLineService(OrderLineRepository orderLineRepository,
                            OrderHeaderRepository orderHeaderRepository) {
        this.orderLineRepository   = orderLineRepository;
        this.orderHeaderRepository = orderHeaderRepository;
    }

    // ═════════════════════════════════════════════════════════════════
    // LIST
    // ═════════════════════════════════════════════════════════════════

    /**
     * Return all order lines visible to the tenant/company.
     * Optional filters: orderId, lineStatus, lineType — all applied in-memory
     * on top of the tenant-scoped query (simple and avoids extra repository methods).
     */
    @Transactional(readOnly = true)
    public List<OrderLineResponseDto> listLines(UUID tenantId, UUID companyId,
                                                UUID orderId,
                                                String lineStatus,
                                                String lineType) {
        List<OrderLine> lines;

        if (orderId != null) {
            lines = orderLineRepository.findByOrder_IdAndTenantIdAndCompanyId(orderId, tenantId, companyId);
        } else {
            // Fetch all lines for this tenant/company via a derived query
            lines = orderLineRepository.findByTenantIdAndCompanyId(tenantId, companyId);
        }

        return lines.stream()
                .filter(l -> lineStatus == null || lineStatus.isBlank() || lineStatus.equalsIgnoreCase(l.getLineStatus()))
                .filter(l -> lineType   == null || lineType.isBlank()   || lineType.equalsIgnoreCase(l.getLineType()))
                .sorted((a, b) -> {
                    // Primary: order (by orderId string), secondary: lineNumber
                    int cmp = a.getOrder().getId().compareTo(b.getOrder().getId());
                    return cmp != 0 ? cmp : Integer.compare(
                            a.getLineNumber() == null ? 0 : a.getLineNumber(),
                            b.getLineNumber() == null ? 0 : b.getLineNumber());
                })
                .map(this::toDto)
                .toList();
    }

    // ═════════════════════════════════════════════════════════════════
    // GET BY ID
    // ═════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public OrderLineResponseDto getById(UUID id, UUID tenantId, UUID companyId) {
        return toDto(findOrThrow(id, tenantId, companyId));
    }

    // ═════════════════════════════════════════════════════════════════
    // CREATE
    // ═════════════════════════════════════════════════════════════════

    @Transactional(rollbackFor = Exception.class)
    public OrderLineResponseDto createLine(OrderLineRequestDto dto,
                                           UUID tenantId, UUID companyId) {

        // Validate lineType-specific fields
        validateLineTypeFields(dto);

        // Resolve parent order — must belong to same tenant/company
        if (dto.getOrderId() == null) {
            throw new IllegalArgumentException("orderId is required when creating an order line");
        }
        OrderHeader order = orderHeaderRepository
                .findByIdAndTenantIdAndCompanyId(dto.getOrderId(), tenantId, companyId)
                .orElseThrow(() -> new OrderNotFoundException(dto.getOrderId()));

        OrderLine line = new OrderLine();
        applyDto(dto, line, order, tenantId, companyId);

        return toDto(orderLineRepository.save(line));
    }

    // ═════════════════════════════════════════════════════════════════
    // UPDATE (full replace)
    // ═════════════════════════════════════════════════════════════════

    @Transactional(rollbackFor = Exception.class)
    public OrderLineResponseDto updateLine(UUID id,
                                           OrderLineRequestDto dto,
                                           UUID tenantId, UUID companyId) {

        validateLineTypeFields(dto);

        OrderLine line = findOrThrow(id, tenantId, companyId);

        // lineType is immutable after creation
        if (!line.getLineType().equals(dto.getLineType())) {
            throw new IllegalArgumentException(
                    "lineType cannot be changed after creation (current: " + line.getLineType() + ")");
        }

        applyDto(dto, line, line.getOrder(), tenantId, companyId);
        return toDto(orderLineRepository.save(line));
    }

    // ═════════════════════════════════════════════════════════════════
    // PATCH status only
    // ═════════════════════════════════════════════════════════════════

    @Transactional(rollbackFor = Exception.class)
    public OrderLineResponseDto updateStatus(UUID id, String newStatus,
                                             UUID tenantId, UUID companyId) {

        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("status is required");
        }
        if (!List.of(OrderLine.LINE_STATUS_PENDING,
                     OrderLine.LINE_STATUS_IN_PROGRESS,
                     OrderLine.LINE_STATUS_COMPLETED,
                     OrderLine.LINE_STATUS_CANCELLED).contains(newStatus)) {
            throw new IllegalArgumentException("Invalid status: " + newStatus);
        }

        OrderLine line = findOrThrow(id, tenantId, companyId);
        line.setLineStatus(newStatus);
        return toDto(orderLineRepository.save(line));
    }

    // ═════════════════════════════════════════════════════════════════
    // DELETE
    // ═════════════════════════════════════════════════════════════════

    @Transactional(rollbackFor = Exception.class)
    public void deleteLine(UUID id, UUID tenantId, UUID companyId) {
        OrderLine line = findOrThrow(id, tenantId, companyId);

        // Guard: only allow deletion of lines that haven't started production
        String status = line.getLineStatus();
        if (!OrderLine.LINE_STATUS_PENDING.equals(status)
                && !OrderLine.LINE_STATUS_CANCELLED.equals(status)) {
            throw new IllegalStateException(
                    "Cannot delete order line with status '" + status
                    + "'. Only PENDING or CANCELLED lines may be deleted.");
        }

        orderLineRepository.delete(line);
    }

    // ═════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═════════════════════════════════════════════════════════════════

    private OrderLine findOrThrow(UUID id, UUID tenantId, UUID companyId) {
        return orderLineRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Order line not found: " + id));
    }

    private void validateLineTypeFields(OrderLineRequestDto dto) {
        if (OrderLine.LINE_TYPE_MODEL.equals(dto.getLineType()) && dto.getModelId() == null) {
            throw new IllegalArgumentException("modelId is required when lineType is MODEL");
        }
        if (OrderLine.LINE_TYPE_MATERIAL.equals(dto.getLineType()) && dto.getMaterialId() == null) {
            throw new IllegalArgumentException("materialId is required when lineType is MATERIAL");
        }
    }

    /**
     * Copy all mutable fields from {@code dto} onto {@code line}.
     * The parent {@code order} is passed explicitly so it can be re-used
     * on both create and update paths.
     */
    private void applyDto(OrderLineRequestDto dto, OrderLine line,
                          OrderHeader order,
                          UUID tenantId, UUID companyId) {
        line.setOrder(order);
        line.setTenantId(tenantId);
        line.setCompanyId(companyId);
        line.setLineNumber(dto.getLineNumber());
        line.setLineType(dto.getLineType());
        line.setModelId(dto.getModelId());
        line.setMaterialId(dto.getMaterialId());
        line.setQuantityOrdered(dto.getQuantityOrdered());

        line.setQuantityProduced(
                dto.getQuantityProduced() != null ? dto.getQuantityProduced() : BigDecimal.ZERO);
        line.setQuantityDelivered(
                dto.getQuantityDelivered() != null ? dto.getQuantityDelivered() : BigDecimal.ZERO);
        line.setQuantityCancelled(
                dto.getQuantityCancelled() != null ? dto.getQuantityCancelled() : BigDecimal.ZERO);

        line.setUnit(dto.getUnit());
        line.setUnitPrice(dto.getUnitPrice());
        line.setBomCalculationId(dto.getBomCalculationId());
        line.setNotes(dto.getNotes());

        // Only update status if explicitly supplied (non-null)
        if (dto.getLineStatus() != null && !dto.getLineStatus().isBlank()) {
            line.setLineStatus(dto.getLineStatus());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Mapping
    // ─────────────────────────────────────────────────────────────────

    private OrderLineResponseDto toDto(OrderLine line) {
        OrderLineResponseDto dto = new OrderLineResponseDto();
        dto.setId(line.getId());
        dto.setOrderId(line.getOrder() != null ? line.getOrder().getId() : null);
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
        dto.setTenantId(line.getTenantId());
        dto.setCompanyId(line.getCompanyId());
        dto.setCreatedAt(line.getCreatedAt());
        dto.setUpdatedAt(line.getUpdatedAt());
        return dto;
    }
}
