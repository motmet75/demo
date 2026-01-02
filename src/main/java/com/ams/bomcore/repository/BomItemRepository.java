package com.ams.bomcore.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;

@Repository
public interface BomItemRepository extends JpaRepository<BomItemEntity, UUID> {

    List<BomItemEntity> findByBom(BomEntity bom);

}
