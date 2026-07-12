package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopTableDrawing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopTableDrawingRepository extends JpaRepository<ShopTableDrawing, UUID> {
    List<ShopTableDrawing> findAllByTenantIdAndCompanyIdOrderByCreatedAtAsc(UUID tenantId, UUID companyId);
    Optional<ShopTableDrawing> findByIdAndTenantIdAndCompanyId(UUID id, UUID tenantId, UUID companyId);
}
