package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.contract.Contract;
import com.ams.bomcore.domain.company.Company;

@Repository
public interface ContractRepository extends JpaRepository<Contract, UUID> {

    Optional<Contract> findByContractNumber(String contractNumber);

    // Find all contracts belonging to a company
    List<Contract> findAllByCompany(Company company);

    // Find by contract number within a company to enforce uniqueness per company
    Optional<Contract> findByContractNumberAndCompany(String contractNumber, Company company);

    // Keep purchasing company query for backwards compatibility or specific use cases
    List<Contract> findAllByPurchasingCompany(Company purchasingCompany);
}