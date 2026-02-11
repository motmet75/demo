# Contract System Refactoring - Deployment Checklist

## Pre-Deployment Checklist

### Database Preparation
- [ ] Backup the production database
- [ ] Review the migration script: `/opt/tuonghoa/demo/src/main/resources/db/migration/add_company_id_to_contract.sql`
- [ ] Test migration on a staging database first
- [ ] Verify existing contracts have data in `purchasing_company_id` column

### Code Review
- [ ] Review all changed files:
  - [ ] `Contract.java` - Entity updated with company field
  - [ ] `ContractRepository.java` - New query methods added
  - [ ] `ContractService.java` - Updated to use company field
  - [ ] `ContractController.java` - Changed from purchasingCompanyId to companyId
  - [ ] `contractApi.js` - Updated API calls
  - [ ] `ContractEditModal.jsx` - Updated to pass companyId
  - [ ] `ContractGrid.jsx` - Fixed null handling
- [ ] All unit tests pass (if available)
- [ ] Backend compiles successfully: ✅ BUILD SUCCESS
- [ ] Frontend lints without contract errors: ✅ No errors

### Integration Testing
- [ ] Test on staging environment first
- [ ] Verify contract creation with new companyId parameter
- [ ] Verify contract listing filters by companyId
- [ ] Verify contract update maintains companyId
- [ ] Verify supplier and purchasing company dropdowns work
- [ ] Verify company names display in grid columns
- [ ] Verify import functionality with new companyId
- [ ] Test with multiple companies in same tenant

## Deployment Steps

### Step 1: Database Migration (Do First!)
```bash
# Connect to your database
psql -h localhost -U your_user -d your_database

# Run the migration script
\i /opt/tuonghoa/demo/src/main/resources/db/migration/add_company_id_to_contract.sql

# Verify the column exists
\d contract

# Check data migrated correctly
SELECT id, contract_number, company_id, purchasing_company_id 
FROM contract 
LIMIT 5;

# Verify all contracts have company_id
SELECT COUNT(*) FROM contract WHERE company_id IS NULL;
-- Should return 0
```

### Step 2: Deploy Backend
```bash
cd /opt/tuonghoa/demo

# Build the backend
mvn clean package -DskipTests

# Stop the current backend
# (use your deployment method: systemctl, docker, etc.)

# Deploy the new JAR
# Copy target/demo-0.0.1-SNAPSHOT.jar to deployment location

# Start the backend
# (use your deployment method)

# Check logs for startup errors
tail -f /var/log/your-app.log
```

### Step 3: Deploy Frontend
```bash
cd /opt/tuonghoa/demo/bom-frontend

# Build the frontend
npm run build

# Deploy the build files
# Copy dist/ folder to your web server

# Or if using Docker:
# docker build -t bom-frontend:latest .
# docker stop bom-frontend-container
# docker run -d --name bom-frontend-container -p 5173:80 bom-frontend:latest
```

### Step 4: Smoke Testing
```bash
# Test 1: List contracts
curl "http://your-server/bom/api/contracts?tenantId=YOUR_TENANT_ID&companyId=YOUR_COMPANY_ID"

# Test 2: Create a test contract
curl -X POST "http://your-server/bom/api/contracts?tenantId=YOUR_TENANT_ID&companyId=YOUR_COMPANY_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "contractNumber": "TEST-001",
    "title": "Test Contract",
    "supplierCompany": {"id": "SUPPLIER_COMPANY_ID"},
    "purchasingCompany": {"id": "PURCHASING_COMPANY_ID"},
    "status": "DRAFT",
    "startDate": "2026-02-01T00:00:00Z",
    "endDate": "2027-02-01T00:00:00Z",
    "contractType": "Purchasing"
  }'

# Test 3: Verify in UI
# - Open browser to your application
# - Navigate to Contracts page
# - Verify contracts are listed
# - Click "Add Contract" and verify form works
# - Edit a contract and verify it saves
# - Verify supplier and purchasing company dropdowns populate
# - Verify company names display in grid columns
```

## Post-Deployment Verification

### Functional Tests
- [ ] Create new contract - saves successfully with companyId
- [ ] Edit existing contract - updates without errors
- [ ] Delete contract - removes successfully
- [ ] List contracts - shows only contracts for current company
- [ ] Company dropdowns - populate correctly
- [ ] Company names in grid - display correctly
- [ ] Contract import - works with companyId
- [ ] Multi-company isolation - contracts don't leak between companies

### Performance Checks
- [ ] Check new indexes are being used:
  ```sql
  EXPLAIN ANALYZE 
  SELECT * FROM contract 
  WHERE company_id = 'some-uuid';
  ```
- [ ] Verify query performance hasn't degraded
- [ ] Check database size increase (should be minimal)

### Monitoring
- [ ] Watch application logs for errors
- [ ] Monitor database query performance
- [ ] Check error rates in APM tools (if available)
- [ ] Monitor API response times

## Rollback Plan

### If Issues Are Found

#### Option 1: Quick Rollback (Recommended if critical issues)
```bash
# 1. Restore previous backend version
# 2. Restore previous frontend version
# 3. Database column can remain (won't break old code)
```

#### Option 2: Full Rollback (If database issues)
```sql
-- Remove the column (only if necessary)
ALTER TABLE contract DROP COLUMN company_id;

-- Remove indexes
DROP INDEX IF EXISTS idx_contract_company_id;
DROP INDEX IF EXISTS idx_contract_tenant_company;
```

Then restore previous application versions.

## Common Issues & Solutions

### Issue 1: "tenantId and companyId are required"
**Cause:** Frontend not passing companyId parameter
**Solution:** Check AppContext provides companyId, verify contractApi.js updated

### Issue 2: "company does not belong to tenant"
**Cause:** CompanyId and tenantId mismatch
**Solution:** Verify user's context has correct company for their tenant

### Issue 3: Grid shows empty company columns
**Cause:** Backend not returning company objects in DTO
**Solution:** Verify ContractDTO.fromEntity() properly maps company fields

### Issue 4: "contract_number already exists"
**Cause:** Uniqueness now per company, not per tenant
**Solution:** Expected behavior - contract numbers must be unique per company

### Issue 5: Old contracts missing company_id
**Cause:** Migration didn't run or failed
**Solution:** Run migration script manually, check for null values:
```sql
SELECT COUNT(*) FROM contract WHERE company_id IS NULL;
UPDATE contract SET company_id = purchasing_company_id WHERE company_id IS NULL;
```

## Success Criteria

✅ All contracts have company_id populated
✅ Users can create/edit/delete contracts normally
✅ Company names display in grid columns
✅ No errors in application logs
✅ API response times normal
✅ Multi-company isolation working
✅ Supplier and purchasing company selectors working

## Documentation Updated

- [x] Technical summary: `CONTRACT_REFACTORING_SUMMARY.md`
- [x] API migration guide: `CONTRACT_API_MIGRATION_GUIDE.md`
- [x] Deployment checklist: `CONTRACT_DEPLOYMENT_CHECKLIST.md` (this file)
- [x] Database migration script: `add_company_id_to_contract.sql`

## Support Contacts

- **Developer:** [Your Name]
- **Database Admin:** [DBA Name]
- **DevOps:** [DevOps Contact]
- **Documentation:** See files in `/opt/tuonghoa/demo/`

## Notes

- Migration is **forward-compatible** - old data will work with new code
- The `purchasing_company_id` column is **not removed** - it remains as a normal property
- The `company_id` is the **new scoping field** following MaterialController pattern
- Existing contracts will have `company_id = purchasing_company_id` after migration

---

**Last Updated:** 2026-02-08
**Status:** Ready for Deployment
