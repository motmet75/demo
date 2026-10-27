-- VTTCC camera-shop installation sample.
-- Run after the core BOM/order schemas and service_bom_and_installation.sql.
-- Rerunnable with stable IDs.
BEGIN;

INSERT INTO tenant (id, tenant_code, tenant_name, tenant_type, is_active, created_at)
VALUES ('0198f600-0000-7000-8000-000000000001','vttcc2026','VTTCC Camera & Security 2026','SERVICE',TRUE,NOW())
ON CONFLICT (tenant_code) DO UPDATE SET tenant_name=EXCLUDED.tenant_name,is_active=TRUE;

INSERT INTO company (id, tenant_id, company_code, company_name, created_at)
VALUES ('0198f600-0000-7000-8000-000000000002',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'VTTCC','VTTCC Camera Installation',NOW())
ON CONFLICT (id) DO UPDATE SET company_name=EXCLUDED.company_name,tenant_id=EXCLUDED.tenant_id;

INSERT INTO warehouse (id, tenant_id, company_id, code, name, is_active, location, created_at)
VALUES ('0198f600-0000-7000-8100-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','VTTCC-HCM','Camera installation stock - Ho Chi Minh',TRUE,'Ho Chi Minh City',NOW())
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,is_active=TRUE;

INSERT INTO model (id, tenant_id, company_id, model_code, model_name, is_active, category, selling_price, created_at)
VALUES ('0198f600-0000-7000-8200-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CAM-INSTALL-4CH','4-camera security installation package',TRUE,'Camera installation',8500000,NOW())
ON CONFLICT (id) DO UPDATE SET model_name=EXCLUDED.model_name,selling_price=EXCLUDED.selling_price,is_active=TRUE;

INSERT INTO material (id, tenant_id, company_id, material_code, material_name, unit, material_type, price, is_active, created_at)
VALUES
('0198f600-0000-7000-8300-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CAM-4MP','4MP outdoor IP camera','pcs','EQUIPMENT',1450000,TRUE,NOW()),
('0198f600-0000-7000-8300-000000000002',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','NVR-4CH','4 channel NVR','pcs','EQUIPMENT',2200000,TRUE,NOW()),
('0198f600-0000-7000-8300-000000000003',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CAT6-305','CAT6 cable box 305m','box','SUPPLY',1850000,TRUE,NOW()),
('0198f600-0000-7000-8300-000000000004',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','HDD-4TB','Surveillance HDD 4TB','pcs','EQUIPMENT',3100000,TRUE,NOW())
ON CONFLICT (id) DO UPDATE SET material_name=EXCLUDED.material_name,price=EXCLUDED.price,is_active=TRUE;

INSERT INTO inventory (id, material_id, warehouse_id, quantity_on_hand, quantity_locked, batch_no, tenant_id, company_id, material_code, material_name, warehouse_code, warehouse_name, quantity_reserved, created_at, updated_at)
SELECT ('0198f600-0000-7000-8400-'||RIGHT(m.id::text,12))::uuid, m.id, '0198f600-0000-7000-8100-000000000001', q.qty, 0, 'VTTCC-2026-OPEN', t.id, c.id, m.material_code, m.material_name, 'VTTCC-HCM', 'Camera installation stock - Ho Chi Minh', 0, NOW(), NOW()
FROM material m CROSS JOIN tenant t CROSS JOIN company c
JOIN (VALUES ('CAM-4MP',20::numeric),('NVR-4CH',8::numeric),('CAT6-305',5::numeric),('HDD-4TB',10::numeric)) q(code,qty) ON q.code=m.material_code
WHERE t.tenant_code='vttcc2026' AND c.company_code='VTTCC'
ON CONFLICT (id) DO UPDATE SET quantity_on_hand=EXCLUDED.quantity_on_hand,quantity=EXCLUDED.quantity_on_hand;

INSERT INTO model_bom (id, model_id, material_id, qty_per_unit, tenant_id, company_id)
VALUES
('0198f600-0000-7000-8500-000000000001','0198f600-0000-7000-8200-000000000001','0198f600-0000-7000-8300-000000000001',4,(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002'),
('0198f600-0000-7000-8500-000000000002','0198f600-0000-7000-8200-000000000001','0198f600-0000-7000-8300-000000000002',1,(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002'),
('0198f600-0000-7000-8500-000000000003','0198f600-0000-7000-8200-000000000001','0198f600-0000-7000-8300-000000000003',1,(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002'),
('0198f600-0000-7000-8500-000000000004','0198f600-0000-7000-8200-000000000001','0198f600-0000-7000-8300-000000000004',1,(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002')
ON CONFLICT (id) DO UPDATE SET qty_per_unit=EXCLUDED.qty_per_unit;

INSERT INTO bom (id, bom_name, version, status, created_at, tenant_id, model_id, company_id)
VALUES ('0198f600-0000-7000-8600-000000000001','4-camera installation BOM',1,'ACTIVE',NOW(),(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8200-000000000001','0198f600-0000-7000-8000-000000000002')
ON CONFLICT (id) DO UPDATE SET status='ACTIVE',bom_name=EXCLUDED.bom_name;

INSERT INTO service_bom (id,tenant_id,company_id,service_code,service_name,service_type,active,notes)
VALUES ('0198f600-0000-7000-8700-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CAM-INSTALL-STD','Standard camera installation visit','CAMERA_INSTALLATION',TRUE,'Billable field-service template. Overnight lodging is added only when overnight=true.')
ON CONFLICT (tenant_id,company_id,service_code) DO UPDATE SET service_name=EXCLUDED.service_name,active=TRUE;

INSERT INTO service_bom_item (id,service_bom_id,cost_type,description,quantity,unit,unit_cost,optional)
VALUES
('0198f600-0000-7000-8800-000000000001','0198f600-0000-7000-8700-000000000001','LABOUR','Technician installation labour',2,'technician-day',900000,FALSE),
('0198f600-0000-7000-8800-000000000002','0198f600-0000-7000-8700-000000000001','TRANSPORT','Van and tools to deployment site',1,'trip',650000,FALSE),
('0198f600-0000-7000-8800-000000000003','0198f600-0000-7000-8700-000000000001','FOOD','Technician meals',2,'person-day',180000,TRUE),
('0198f600-0000-7000-8800-000000000004','0198f600-0000-7000-8700-000000000001','ACCOMMODATION','Overnight hotel',1,'night',550000,TRUE)
ON CONFLICT (id) DO UPDATE SET quantity=EXCLUDED.quantity,unit_cost=EXCLUDED.unit_cost,optional=EXCLUDED.optional;

INSERT INTO order_header (id,order_number,order_type,status,customer_id,planned_start_date,planned_end_date,total_planned_qty,notes,tenant_id,company_id,created_at,created_by)
VALUES ('0198f600-0000-7000-8900-000000000001','VTTCC-2026-0001','SALES','DRAFT',NULL,CURRENT_DATE+1,CURRENT_DATE+2,1,'Camera installation sample order for VTTCC customer; service installation is attached below.',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002',NOW(),'vttcc2026')
ON CONFLICT (id) DO UPDATE SET notes=EXCLUDED.notes,status='DRAFT';

INSERT INTO order_line (id,order_id,line_number,line_type,model_id,quantity_ordered,unit,unit_price,line_status,tenant_id,company_id,created_at)
VALUES ('0198f600-0000-7000-8a00-000000000001','0198f600-0000-7000-8900-000000000001',1,'MODEL','0198f600-0000-7000-8200-000000000001',1,'package',8500000,'PENDING',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002',NOW())
ON CONFLICT (id) DO UPDATE SET quantity_ordered=1,unit_price=8500000;

INSERT INTO service_installation (id,order_id,service_bom_id,tenant_id,company_id,deployment_address,contact_name,contact_phone,planned_start_date,planned_end_date,overnight,overnight_nights,status,total_service_cost,notes)
VALUES ('0198f600-0000-7000-8b00-000000000001','0198f600-0000-7000-8900-000000000001','0198f600-0000-7000-8700-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','12 Nguyen Van Linh, District 7, Ho Chi Minh City','Nguyen Van A','0909000000',CURRENT_DATE+1,CURRENT_DATE+2,TRUE,1,'PLANNED',0,'Sample deployment with one overnight stay.')
ON CONFLICT (order_id) DO UPDATE SET deployment_address=EXCLUDED.deployment_address,overnight=TRUE,overnight_nights=1;

INSERT INTO service_installation_cost (id,installation_id,cost_type,description,quantity,unit,unit_cost)
VALUES
('0198f600-0000-7000-8c00-000000000001','0198f600-0000-7000-8b00-000000000001','LABOUR','Technician installation labour',2,'technician-day',900000),
('0198f600-0000-7000-8c00-000000000002','0198f600-0000-7000-8b00-000000000001','TRANSPORT','Van and tools to deployment site',1,'trip',650000),
('0198f600-0000-7000-8c00-000000000003','0198f600-0000-7000-8b00-000000000001','FOOD','Technician meals',2,'person-day',180000),
('0198f600-0000-7000-8c00-000000000004','0198f600-0000-7000-8b00-000000000001','ACCOMMODATION','Overnight hotel',1,'night',550000)
ON CONFLICT (id) DO NOTHING;
UPDATE service_installation SET total_service_cost=(SELECT COALESCE(SUM(total_cost),0) FROM service_installation_cost WHERE installation_id=service_installation.id) WHERE id='0198f600-0000-7000-8b00-000000000001';

COMMIT;
