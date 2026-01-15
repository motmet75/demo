package com.ams.bomcore.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.supplier.Supplier;

/**
 * Spring Data JPA repository for Supplier entities.
 */
@Repository
public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    Optional<Supplier> findBySupplierCode(String supplierCode);

    boolean existsBySupplierCode(String supplierCode);

}