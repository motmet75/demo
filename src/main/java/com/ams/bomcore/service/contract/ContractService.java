package com.ams.bomcore.service.contract;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.contract.Contract;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.ContractRepository;

@Service
public class ContractService {

    private final ContractRepository contractRepository;

    public ContractService(ContractRepository contractRepository) {
        this.contractRepository = contractRepository;
    }

    /**
     * Create a contract scoped to a company and tenant.
     * The supplierCompany and purchasingCompany are set from the contract object itself.
     */
    public Contract createForCompany(Contract contract, Company company, Tenant tenant) {
        contract.setCompany(company);
        contract.setTenant(tenant);
        return contractRepository.save(contract);
    }

    /**
     * Update an existing contract ensuring it is scoped to the provided company and tenant.
     */
    public Contract updateForCompany(Contract contract, Company company, Tenant tenant) {
        contract.setCompany(company);
        contract.setTenant(tenant);
        return contractRepository.save(contract);
    }

    public Optional<Contract> findById(UUID id) {
        return contractRepository.findById(id);
    }

    public List<Contract> findAllByCompany(Company company) {
        return contractRepository.findAllByCompany(company);
    }

    // Keep for backwards compatibility
    public List<Contract> findAllByPurchasingCompany(Company company) {
        return contractRepository.findAllByPurchasingCompany(company);
    }

    public void delete(UUID id) {
        contractRepository.deleteById(id);
    }
}