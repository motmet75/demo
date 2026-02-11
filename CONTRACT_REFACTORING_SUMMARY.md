# Contract System Refactoring Summary

## Overview
Refactored the Contract entity and CRUD operations to follow the MaterialController pattern, adding a `company_id` field for proper multi-company scoping while keeping `supplierCompany` and `purchasingCompany` as normal properties.

## Changes Made

### 1. Backend - Database Schema

**File: `/opt/tuonghoa/demo/src/main/resources/db/schema/bom_core_schema.sql`**
- Added `company_id` column to the `contract` table
- This column references the owning company for multi-company scoping

**File: `/opt/tuonghoa/demo/src/main/resources/db/migration/add_company_id_to_contract.sql`** (NEW)
- Migration script to add `company_id` to existing contract tables
- Sets default values for existing records (uses `purchasing_company_id`)
- Adds performance indexes on `company_id` and `(tenant_id, company_id)`

### 2. Backend - Domain Entity

**File: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/domain/contract/Contract.java`**
- Added `company` field as `@ManyToOne` relationship to `Company`
- Added `@JoinColumn(name = "company_id", nullable = false)`
- Added getter and setter for `company` field
- Kept `supplierCompany` and `purchasingCompany` as normal properties

### 3. Backend - Repository

**File: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/repository/ContractRepository.java`**
- Added `findAllByCompany(Company company)` - finds all contracts for a company
- Added `findByContractNumberAndCompany(String contractNumber, Company company)` - for uniqueness checks
- Kept `findAllByPurchasingCompany` for backwards compatibility

### 4. Backend - Service

**File: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/service/contract/ContractService.java`**
- Updated `createForCompany` to set `company` field instead of just `purchasingCompany`
- Updated `updateForCompany` to set `company` field
- Added `findAllByCompany(Company company)` method
- Kept `findAllByPurchasingCompany` for backwards compatibility

### 5. Backend - Controller

**File: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/controller/contract/ContractController.java`**

**Changed parameter from `purchasingCompanyId` to `companyId` in all methods:**

#### GET /bom/api/contracts
- Now requires `tenantId` and `companyId` parameters
- Returns contracts scoped to the specified company
- Validates that company belongs to tenant

#### POST /bom/api/contracts
- Now requires `tenantId` and `companyId` parameters
- Creates contract scoped to the company
- Uniqueness check: `contract_number` must be unique per company
- Sets both `company` (for scoping) and `supplierCompany`/`purchasingCompany` (from payload)

#### PUT /bom/api/contracts/{id}
- Now requires `tenantId` and `companyId` parameters
- Updates contract ensuring it stays scoped to the company
- Validates company belongs to tenant

#### POST /bom/api/contracts/import
- Now requires `tenantId` and `companyId` parameters
- Imports contracts into the specified company
- Uniqueness check per company

### 6. Frontend - API Client

**File: `/opt/tuonghoa/demo/bom-frontend/src/api/contractApi.js`**
- Changed `buildUrl` function to use `companyId` instead of `purchasingCompanyId`
- Updated `updateContract` to pass `companyId` in URL and remove it from body
- Updated `createContract` to pass `companyId` in URL and remove it from body
- Cleans up transient IDs: `tenantId`, `companyId`, `supplierCompanyId`, `purchasingCompanyId`

### 7. Frontend - Edit Modal

**File: `/opt/tuonghoa/demo/bom-frontend/src/features/contract/ContractEditModal.jsx`**
- Updated `submit` function to add `tenantId` and `companyId` from context
- Still supports `supplierCompanyId` and `purchasingCompanyId` for setting the respective companies
- Fixed form initialization to prevent spreading contract object (previous fix)
- Added null check before rendering (previous fix)

### 8. Frontend - Grid

**File: `/opt/tuonghoa/demo/bom-frontend/src/features/contract/ContractGrid.jsx`**
- Added null/undefined checks in valueGetter functions (previous fix)
- Added null check in getActions function (previous fix)
- Grid now safely handles company name display

## Data Flow Pattern (Following MaterialController)

### Create Flow:
1. Frontend sends: `{ ...contractData, supplierCompany: {id: ...}, purchasingCompany: {id: ...} }`
2. Frontend adds query params: `?tenantId=...&companyId=...`
3. Backend controller validates tenant and company
4. Backend service sets:
   - `contract.company = company` (for scoping)
   - `contract.tenant = tenant`
   - `contract.supplierCompany` (from payload)
   - `contract.purchasingCompany` (from payload)
5. Contract is saved and returned

### List Flow:
1. Frontend calls: `fetchContracts()` (gets tenantId/companyId from context)
2. Backend receives: `?tenantId=...&companyId=...`
3. Backend returns: All contracts where `contract.company.id = companyId`

### Update Flow:
1. Same as create flow but uses PUT method
2. Ensures contract stays scoped to the company

## Key Differences from Previous Implementation

| Aspect | Before | After |
|--------|--------|-------|
| Main scoping field | `purchasingCompanyId` | `companyId` |
| Query parameter | `purchasingCompanyId` | `companyId` |
| Contract entity | Only had tenant, supplier, purchasing | Now has company, tenant, supplier, purchasing |
| Uniqueness | Per tenant + purchasing company | Per company |
| Pattern | Custom | Follows MaterialController pattern |

## Benefits

1. **Consistency**: Follows the same pattern as Material, Inventory, and other entities
2. **Multi-company support**: Proper company scoping for multi-tenant systems
3. **Flexibility**: `supplierCompany` and `purchasingCompany` remain as normal properties
4. **Backward compatibility**: Old query methods still available
5. **Clear ownership**: Each contract belongs to a company

## Migration Steps for Existing Deployments

1. Run the migration script: `/opt/tuonghoa/demo/src/main/resources/db/migration/add_company_id_to_contract.sql`
2. Deploy backend changes (will automatically map the new field)
3. Deploy frontend changes (uses new `companyId` parameter)
4. Verify existing contracts now have `company_id` populated

## Testing Checklist

- [ ] Create new contract - should set company_id from context
- [ ] Edit existing contract - should preserve company_id
- [ ] List contracts - should filter by company_id
- [ ] Delete contract - should work as before
- [ ] Import contracts - should scope to company_id
- [ ] Supplier/Purchasing company dropdowns - should work correctly
- [ ] Company names display in grid - should show both supplier and purchasing
- [ ] Uniqueness validation - contract_number unique per company

## Notes

- The `supplierCompany` and `purchasingCompany` fields are still fully functional
- The `company` field is used for ownership/scoping (which company owns this contract)
- Typically `company` would equal `purchasingCompany` but can be different
- Frontend passes both company IDs for flexibility in the contract relationship
