package com.ams.bomcore.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.material.Material;

/**
 * Spring Data JPA repository for Material entities.
 */
@Repository
public interface MaterialRepository extends JpaRepository<Material, UUID> {

    Optional<Material> findByMaterialCode(String materialCode);

}
