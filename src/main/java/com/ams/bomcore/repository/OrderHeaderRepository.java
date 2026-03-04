package com.ams.bomcore.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.order.OrderHeader;

@Repository
public interface OrderHeaderRepository extends JpaRepository<OrderHeader, UUID> {

    // ── Basic tenant-scoped finders ───────────────────────────────────

    List<OrderHeader> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    Optional<OrderHeader> findByIdAndTenantIdAndCompanyId(UUID id, UUID tenantId, UUID companyId);

    Optional<OrderHeader> findByOrderNumberAndTenantIdAndCompanyId(String orderNumber, UUID tenantId, UUID companyId);

    boolean existsByOrderNumberAndTenantIdAndCompanyId(String orderNumber, UUID tenantId, UUID companyId);

    // ── Paginated list with optional filters ──────────────────────────

    @Query("""
            SELECT o FROM OrderHeader o
            WHERE o.tenantId = :tenantId
              AND o.companyId = :companyId
              AND (:status IS NULL OR o.status = :status)
              AND (:orderType IS NULL OR o.orderType = :orderType)
              AND (cast(:fromDate as java.time.Instant) IS NULL OR o.createdAt >= :fromDate)
              AND (cast(:toDate as java.time.Instant) IS NULL OR o.createdAt <= :toDate)
            """)
    Page<OrderHeader> findByFilters(
            @Param("tenantId") UUID tenantId,
            @Param("companyId") UUID companyId,
            @Param("status") String status,
            @Param("orderType") String orderType,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate,
            Pageable pageable);

    // ── Status-specific queries ───────────────────────────────────────

    List<OrderHeader> findByTenantIdAndCompanyIdAndStatus(UUID tenantId, UUID companyId, String status);

    @Query("""
            SELECT o FROM OrderHeader o
            WHERE o.tenantId = :tenantId
              AND o.companyId = :companyId
              AND o.status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED')
            ORDER BY o.createdAt DESC
            """)
    List<OrderHeader> findActiveOrders(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);
}
