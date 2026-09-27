-- Table-map loading only needs open orders. Keep that lookup bounded as order history grows.
CREATE INDEX IF NOT EXISTS idx_shop_order_active_company_table
 ON shop_order(tenant_id, company_id, table_id, created_at DESC)
 WHERE status IN ('PENDING','CONFIRMED','PREPARING','READY');
