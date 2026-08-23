package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopLocalizedLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ShopLocalizedLabelRepository extends JpaRepository<ShopLocalizedLabel, UUID> {

    @Query("""
            select l
            from ShopLocalizedLabel l
            where l.isActive = true
              and (
                (l.tenantId is null and l.companyId is null)
                or (l.tenantId = :tenantId and l.companyId = :companyId)
              )
            order by
              case when l.tenantId is null and l.companyId is null then 0 else 1 end,
              l.labelNamespace,
              l.displayOrder,
              l.labelKey
            """)
    List<ShopLocalizedLabel> findActiveForScope(@Param("tenantId") UUID tenantId,
                                                @Param("companyId") UUID companyId);
}
