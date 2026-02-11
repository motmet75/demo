# Contract API Changes - Migration Guide

## API Endpoint Changes

### Before (Old API)
```
GET  /bom/api/contracts?tenantId={uuid}&purchasingCompanyId={uuid}
POST /bom/api/contracts?tenantId={uuid}&purchasingCompanyId={uuid}
PUT  /bom/api/contracts/{id}?tenantId={uuid}&purchasingCompanyId={uuid}
DELETE /bom/api/contracts/{id}
POST /bom/api/contracts/import?tenantId={uuid}&purchasingCompanyId={uuid}
```

### After (New API)
```
GET  /bom/api/contracts?tenantId={uuid}&companyId={uuid}
POST /bom/api/contracts?tenantId={uuid}&companyId={uuid}
PUT  /bom/api/contracts/{id}?tenantId={uuid}&companyId={uuid}
DELETE /bom/api/contracts/{id}
POST /bom/api/contracts/import?tenantId={uuid}&companyId={uuid}
```

## Request/Response Changes

### GET /bom/api/contracts

**Request:**
```
GET /bom/api/contracts?tenantId=123e4567-e89b-12d3-a456-426614174000&companyId=223e4567-e89b-12d3-a456-426614174000
Headers:
  X-Tenant-Id: 123e4567-e89b-12d3-a456-426614174000
  X-Company-Id: 223e4567-e89b-12d3-a456-426614174000
```

**Response:** (No change - returns same ContractDTO structure)
```json
[
  {
    "id": "323e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "contractNumber": "CNT-2025-001",
    "title": "Purchase Agreement for Materials",
    "supplierCompany": {
      "id": "423e4567-e89b-12d3-a456-426614174000",
      "companyCode": "SUP001",
      "companyName": "Supplier Company Ltd"
    },
    "purchasingCompany": {
      "id": "223e4567-e89b-12d3-a456-426614174000",
      "companyCode": "PUR001",
      "companyName": "Purchasing Company Ltd"
    },
    "status": "ACTIVE",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2026-01-01T00:00:00Z",
    "totalValue": 100000.00,
    "currency": "USD"
  }
]
```

### POST /bom/api/contracts (Create)

**Request:**
```
POST /bom/api/contracts?tenantId=123e4567-e89b-12d3-a456-426614174000&companyId=223e4567-e89b-12d3-a456-426614174000

Body:
{
  "contractNumber": "CNT-2025-002",
  "title": "New Purchase Agreement",
  "supplierCompany": {
    "id": "423e4567-e89b-12d3-a456-426614174000"
  },
  "purchasingCompany": {
    "id": "223e4567-e89b-12d3-a456-426614174000"
  },
  "status": "DRAFT",
  "startDate": "2025-02-01T00:00:00Z",
  "endDate": "2026-02-01T00:00:00Z",
  "totalValue": 150000.00,
  "currency": "USD",
  "contractType": "Purchasing"
}
```

**Important Notes:**
- The `companyId` in the query string determines which company owns/scopes this contract
- The `supplierCompany.id` in the body sets the supplier company reference
- The `purchasingCompany.id` in the body sets the purchasing company reference
- Typically, `companyId` equals `purchasingCompany.id`, but they can be different

### PUT /bom/api/contracts/{id} (Update)

**Request:**
```
PUT /bom/api/contracts/323e4567-e89b-12d3-a456-426614174000?tenantId=123e4567-e89b-12d3-a456-426614174000&companyId=223e4567-e89b-12d3-a456-426614174000

Body:
{
  "id": "323e4567-e89b-12d3-a456-426614174000",
  "contractNumber": "CNT-2025-001",
  "title": "Updated Purchase Agreement",
  "supplierCompany": {
    "id": "423e4567-e89b-12d3-a456-426614174000"
  },
  "purchasingCompany": {
    "id": "223e4567-e89b-12d3-a456-426614174000"
  },
  "status": "ACTIVE",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2026-01-01T00:00:00Z",
  "totalValue": 120000.00,
  "currency": "USD"
}
```

## Frontend Code Migration

### Old Code (contractApi.js)
```javascript
export async function updateContract(id, payload) {
  const url = buildUrl(`/bom/api/contracts/${id}`, { 
    tenantId: payload.tenantId, 
    purchasingCompanyId: payload.purchasingCompanyId 
  })
  const body = { ...payload }
  delete body.tenantId
  delete body.purchasingCompanyId
  // ... rest of code
}
```

### New Code (contractApi.js)
```javascript
export async function updateContract(id, payload) {
  const url = buildUrl(`/bom/api/contracts/${id}`, { 
    tenantId: payload.tenantId, 
    companyId: payload.companyId 
  })
  const body = { ...payload }
  delete body.tenantId
  delete body.companyId
  delete body.supplierCompanyId
  delete body.purchasingCompanyId
  // ... rest of code
}
```

### Frontend Usage Example

```javascript
import { useAppContext } from '../../context/AppContext'
import { createContract, updateContract } from '../../api/contractApi'

function MyComponent() {
  const { tenantId, companyId } = useAppContext()

  const handleCreate = async (formData) => {
    const payload = {
      ...formData,
      tenantId,
      companyId,  // <-- Changed from purchasingCompanyId
      supplierCompany: { id: formData.supplierCompanyId },
      purchasingCompany: { id: formData.purchasingCompanyId }
    }
    
    const result = await createContract(payload)
    // handle result
  }
}
```

## Database Schema Changes

### Migration Required
Execute the migration script before deploying:
```sql
-- File: /opt/tuonghoa/demo/src/main/resources/db/migration/add_company_id_to_contract.sql

ALTER TABLE contract ADD COLUMN IF NOT EXISTS company_id uuid;
UPDATE contract SET company_id = purchasing_company_id WHERE company_id IS NULL;
ALTER TABLE contract ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_company_id ON contract(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_tenant_company ON contract(tenant_id, company_id);
```

### Table Structure After Migration
```sql
CREATE TABLE contract (
    id                      uuid PRIMARY KEY,
    contract_number         VARCHAR(50) NOT NULL,
    title                   VARCHAR(200) NOT NULL,
    
    -- FK columns
    supplier_company_id     uuid NOT NULL,      -- supplier
    purchasing_company_id   uuid NOT NULL,      -- buyer
    company_id              uuid NOT NULL,      -- owner (NEW!)
    tenant_id               uuid,               -- tenant
    
    -- other columns...
);
```

## Breaking Changes Summary

1. **Query Parameter Renamed**: `purchasingCompanyId` → `companyId`
2. **Header Parameter Renamed**: Still `X-Company-Id` (no change)
3. **URL Structure**: Same, only parameter name changed
4. **Request Body**: No structural changes, but frontend must pass `companyId`
5. **Response Body**: No changes
6. **Database**: New `company_id` column added

## Backward Compatibility

The following are still supported for backward compatibility:
- `ContractService.findAllByPurchasingCompany()` method
- `ContractRepository.findAllByPurchasingCompany()` method

However, the API endpoints **do not** support `purchasingCompanyId` parameter anymore. You must use `companyId`.

## Testing with cURL

### Create a contract
```bash
curl -X POST "http://localhost:8080/bom/api/contracts?tenantId=123e4567-e89b-12d3-a456-426614174000&companyId=223e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "contractNumber": "CNT-2025-003",
    "title": "Test Contract",
    "supplierCompany": {"id": "423e4567-e89b-12d3-a456-426614174000"},
    "purchasingCompany": {"id": "223e4567-e89b-12d3-a456-426614174000"},
    "status": "DRAFT",
    "startDate": "2025-02-01T00:00:00Z",
    "endDate": "2026-02-01T00:00:00Z",
    "totalValue": 50000.00,
    "currency": "USD",
    "contractType": "Purchasing"
  }'
```

### List contracts
```bash
curl "http://localhost:8080/bom/api/contracts?tenantId=123e4567-e89b-12d3-a456-426614174000&companyId=223e4567-e89b-12d3-a456-426614174000"
```

## Rollback Plan

If issues occur:
1. Revert backend code changes
2. Frontend will need to use old `purchasingCompanyId` parameter
3. Database `company_id` column can remain (won't break anything)
4. Or drop column: `ALTER TABLE contract DROP COLUMN company_id;`

## Support

For questions or issues, refer to:
- `/opt/tuonghoa/demo/CONTRACT_REFACTORING_SUMMARY.md` - Full technical summary
- `/opt/tuonghoa/demo/src/main/resources/db/migration/add_company_id_to_contract.sql` - Migration script
