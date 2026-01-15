package com.ams.bomcore.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.model.Model;

/**
 * Spring Data JPA repository for Model entities.
 */
@Repository
public interface ModelRepository extends JpaRepository<Model, UUID> {

    Optional<Model> findByModelCode(String modelCode);

}
