package com.ams.bomcore.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.supplier.SupplierIssueEntity;

@Repository
public interface SupplierIssueRepository extends JpaRepository<SupplierIssueEntity, UUID> {

    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END FROM SupplierIssueEntity s WHERE s.supplier.id = :supplierId")
    boolean existsBySupplierId(@Param("supplierId") UUID supplierId);

}
