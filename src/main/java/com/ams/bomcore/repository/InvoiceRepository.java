package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.invoice.InvoiceEntity;

@Repository
public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID> {

    List<InvoiceEntity> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    Optional<InvoiceEntity> findByIdAndTenantIdAndCompanyId(UUID id, UUID tenantId, UUID companyId);

    Optional<InvoiceEntity> findByInvoiceNumberAndTenantIdAndCompanyId(String invoiceNumber, UUID tenantId, UUID companyId);

    boolean existsByInvoiceNumberAndTenantIdAndCompanyId(String invoiceNumber, UUID tenantId, UUID companyId);

    @Query("""
            SELECT i FROM InvoiceEntity i
            WHERE i.tenantId = :tenantId
              AND i.companyId = :companyId
              AND (:invoiceType IS NULL OR i.invoiceType = :invoiceType)
              AND (:status IS NULL OR i.status = :status)
            ORDER BY i.createdAt DESC
            """)
    Page<InvoiceEntity> findByFilters(
            @Param("tenantId") UUID tenantId,
            @Param("companyId") UUID companyId,
            @Param("invoiceType") String invoiceType,
            @Param("status") String status,
            Pageable pageable);
}
