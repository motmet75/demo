# Inventory Import - Quick Start Guide

## For Developers

### 1. Run Database Migration (REQUIRED FIRST)
```bash
cd /opt/tuonghoa/demo
psql -U your_username -d your_database -f INVENTORY_ALTER_TABLE_QUERIES.sql
```

### 2. Build Backend
```bash
cd /opt/tuonghoa/demo
./mvnw clean package -DskipTests
```

### 3. Build Frontend
```bash
cd /opt/tuonghoa/demo/bom-frontend
npm install
npm run build
```

### 4. Test the Import

#### Prepare Test Data
Use the provided template:
```bash
cp inventory_import_template.csv my_test_import.csv
```

Edit `my_test_import.csv` and ensure:
- Material codes exist in your system
- Warehouse codes exist in your system
- Batch numbers are unique or match existing for updates

#### Test via API
```bash
curl -X POST http://localhost:8080/bom/api/inventory/import \
  -H "X-Tenant-Id: YOUR_TENANT_UUID" \
  -H "X-Company-Id: YOUR_COMPANY_UUID" \
  -F "file=@my_test_import.csv"
```

Expected successful response:
```json
{
  "success": true,
  "message": "Import completed: 3 created, 0 updated, 0 errors",
  "created": 3,
  "updated": 0,
  "errors": [],
  "missingMaterials": [],
  "missingWarehouses": []
}
```

#### Test via UI
1. Start backend: `java -jar target/your-app.jar`
2. Start frontend dev server: `cd bom-frontend && npm run dev`
3. Open browser: http://localhost:5173
4. Navigate to Inventory page
5. Click Import button
6. Select CSV file
7. Review results

## For Users

### Quick Import Steps
1. **Prepare your CSV file**
   - Download template: `inventory_import_template.csv`
   - Fill in your data
   - Required columns: `material_code`, `warehouse_code`, `batch_no`, `quantity_on_hand`

2. **Verify Prerequisites**
   - All materials must exist in system (create them first if needed)
   - All warehouses must exist in system (create them first if needed)

3. **Import**
   - Go to Inventory page
   - Click "Import" button
   - Select your CSV file
   - Click "Upload"

4. **Review Results**
   - ✅ Green = Success
   - ❌ Red = Failed (check missing materials/warehouses)
   - See created/updated counts
   - Fix errors and retry if needed

### Common Issues

#### "Missing materials in system"
**Problem**: CSV contains material codes that don't exist in database.  
**Solution**: Create the materials first, then re-import.

#### "Missing warehouses in system"
**Problem**: CSV contains warehouse codes that don't exist.  
**Solution**: Create the warehouses first, then re-import.

#### "Line X: material_code is required"
**Problem**: CSV row missing required field.  
**Solution**: Check CSV format, ensure all required columns have values.

#### "Line X: Invalid date format"
**Problem**: Date field not in correct format.  
**Solution**: Use ISO format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`

### Tips
- Test with small file first (5-10 rows)
- Keep original CSV for audit trail
- Export existing data before large imports
- Import can update existing records (by material+warehouse+batch)

## CSV Format Reference

### Minimal CSV (only required fields)
```csv
material_code,warehouse_code,batch_no,quantity_on_hand
MAT001,WH001,BATCH001,1000
MAT002,WH001,BATCH002,500
```

### Full CSV (all fields)
```csv
material_code,warehouse_code,batch_no,quantity_on_hand,contract_code,unit,unit_price,currency,hs_code,origin_type,origin_country,xform_no,cds_no,purchase_no,order_to_deduction,quantity_reserved,quantity_locked,material_quota,material_quota_percentage,user_name,xform_date,purchase_date_time,cds_date_time,production_date_time,expiration_date_time,visible,approved,locked
MAT001,WH001,BATCH001,1000,CTR001,pcs,10.50,USD,8471.30.00,Manufactured,CN,XF001,CDS001,PO001,SO001,100,0,5000,0.20,admin,2026-02-01,2026-02-01T10:00:00Z,2026-02-01T11:00:00Z,2026-01-15T08:00:00Z,2027-02-01T00:00:00Z,true,false,false
```

## Support

- Full documentation: `INVENTORY_IMPORT_GUIDE.md`
- Summary of changes: `INVENTORY_ENHANCEMENT_SUMMARY.md`
- SQL scripts: `INVENTORY_ALTER_TABLE_QUERIES.sql`
- Sample data: `inventory_import_template.csv`

## Success Checklist
- [x] Database migrated with ALTER TABLE queries
- [x] Backend compiled without errors
- [x] Frontend built successfully
- [x] Test materials created in system
- [x] Test warehouses created in system
- [x] Sample CSV import works
- [x] UI displays new fields correctly
- [x] Export includes new fields
