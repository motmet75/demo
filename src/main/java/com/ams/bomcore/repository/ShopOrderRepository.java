package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopOrderRepository extends JpaRepository<ShopOrder, UUID> {
    List<ShopOrder> findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(UUID tenantId, UUID companyId);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusOrderByCreatedAtDesc(UUID tenantId, UUID companyId, String status);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, Instant from, Instant to);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, Instant from);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndCreatedAtLessThanOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, Instant to);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, String status, Instant from, Instant to);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, String status, Instant from);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusAndCreatedAtLessThanOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, String status, Instant to);
    @Query("""
            SELECT o FROM ShopOrder o
            WHERE o.tenantId = :tenantId
              AND o.companyId = :companyId
              AND (:status IS NULL OR :status = '' OR o.status = :status)
              AND (:fromTime IS NULL OR o.createdAt >= :fromTime)
              AND (:toTime IS NULL OR o.createdAt < :toTime)
            ORDER BY o.createdAt DESC
            """)
    List<ShopOrder> searchStaffOrders(@Param("tenantId") UUID tenantId,
                                      @Param("companyId") UUID companyId,
                                      @Param("status") String status,
                                      @Param("fromTime") Instant fromTime,
                                      @Param("toTime") Instant toTime);
    Optional<ShopOrder> findByOrderCodeAndTenantIdAndCompanyId(String orderCode, UUID tenantId, UUID companyId);
    Optional<ShopOrder> findByOrderCode(String orderCode);
    List<ShopOrder> findAllBySourceTokenOrderByCreatedAtDesc(String sourceToken);
    @Query("""
        SELECT o FROM ShopOrder o
        WHERE o.sourceToken = :token
          AND (:fromTime IS NULL OR o.createdAt >= :fromTime)
          AND (:toTime IS NULL OR o.createdAt < :toTime)
        ORDER BY o.createdAt DESC
        """)
    List<ShopOrder> searchOrdersByToken(@Param("token") String token,
                                        @Param("fromTime") Instant fromTime,
                                        @Param("toTime") Instant toTime);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(UUID tenantId, UUID companyId, List<String> statuses);
    @Query("""
        SELECT o FROM ShopOrder o
        WHERE o.tenantId = :tenantId
          AND o.companyId = :companyId
          AND o.status IN :statuses
          AND (:fromTime IS NULL OR o.createdAt >= :fromTime)
          AND (:toTime IS NULL OR o.createdAt < :toTime)
        ORDER BY o.orderNumber ASC
        """)
    List<ShopOrder> searchActiveOrders(@Param("tenantId") UUID tenantId,
                                       @Param("companyId") UUID companyId,
                                       @Param("statuses") List<String> statuses,
                                       @Param("fromTime") Instant fromTime,
                                       @Param("toTime") Instant toTime);
    List<ShopOrder> findAllByTable_IdAndTenantIdAndCompanyIdAndStatusIn(UUID tableId, UUID tenantId, UUID companyId, List<String> statuses);
    Optional<ShopOrder> findTopByTenantIdAndCompanyIdAndPickupScannedAtAfterOrderByPickupScannedAtDesc(UUID tenantId, UUID companyId, Instant after);

    @Query("SELECT COUNT(o) FROM ShopOrder o WHERE o.companyId = :companyId AND o.createdAt >= :start AND o.createdAt < :end")
    long countOrdersInDay(@Param("companyId") UUID companyId, @Param("start") Instant start, @Param("end") Instant end);

    List<ShopOrder> findAllByCustomerIdAndTenantIdAndCompanyId(UUID customerId, UUID tenantId, UUID companyId);
}
