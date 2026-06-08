package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopAccessToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopAccessTokenRepository extends JpaRepository<ShopAccessToken, UUID> {
    Optional<ShopAccessToken> findByToken(String token);
    List<ShopAccessToken> findAllByTableIdAndTokenType(UUID tableId, String tokenType);
    List<ShopAccessToken> findAllByTenantIdAndCompanyId(UUID tenantId, UUID companyId);
}
