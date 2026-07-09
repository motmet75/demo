package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopCustomer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopCustomerRepository extends JpaRepository<ShopCustomer, UUID> {

    List<ShopCustomer> findAllByTenantIdAndCompanyIdOrderByNameAsc(UUID tenantId, UUID companyId);

    @Query("SELECT c FROM ShopCustomer c WHERE c.tenantId = :tenantId AND c.companyId = :companyId " +
           "AND (LOWER(c.name) LIKE LOWER(CONCAT('%', :q, '%')) OR c.phone LIKE CONCAT('%', :q, '%') " +
           "OR LOWER(c.customerCode) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<ShopCustomer> search(@Param("tenantId") UUID tenantId,
                              @Param("companyId") UUID companyId,
                              @Param("q") String q);

    Optional<ShopCustomer> findByTenantIdAndCompanyIdAndCustomerCodeIgnoreCase(UUID tenantId, UUID companyId, String customerCode);
}
