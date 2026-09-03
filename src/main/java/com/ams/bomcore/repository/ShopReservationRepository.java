package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopReservationRepository extends JpaRepository<ShopReservation, UUID> {

    Optional<ShopReservation> findByTokenAndTenantIdAndCompanyId(String token, UUID tenantId, UUID companyId);

    List<ShopReservation> findAllByTenantIdAndCompanyIdOrderByReservationTimeAsc(UUID tenantId, UUID companyId);

    @Query("""
            SELECT r FROM ShopReservation r
            WHERE r.tenantId = :tenantId
              AND r.companyId = :companyId
              AND r.reservationTime >= :fromTime
              AND r.reservationTime < :toTime
            ORDER BY r.reservationTime ASC
            """)
    List<ShopReservation> searchByRange(@Param("tenantId") UUID tenantId,
                                        @Param("companyId") UUID companyId,
                                        @Param("fromTime") Instant fromTime,
                                        @Param("toTime") Instant toTime);

    @Query("""
            SELECT r FROM ShopReservation r
            WHERE r.tenantId = :tenantId
              AND r.companyId = :companyId
              AND r.status IN :statuses
              AND r.reservationTime < :windowEnd
              AND r.reservationTime >= :windowStart
            """)
    List<ShopReservation> findOverlapping(@Param("tenantId") UUID tenantId,
                                          @Param("companyId") UUID companyId,
                                          @Param("statuses") List<String> statuses,
                                          @Param("windowStart") Instant windowStart,
                                          @Param("windowEnd") Instant windowEnd);
}
