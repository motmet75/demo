CREATE TABLE IF NOT EXISTS shop_staff_call (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    table_id uuid REFERENCES shop_table(id) ON DELETE SET NULL,
    table_name varchar(100),
    reason varchar(40) NOT NULL,
    note text,
    token varchar(100),
    status varchar(20) NOT NULL DEFAULT 'OPEN',
    created_at timestamptz NOT NULL DEFAULT now(),
    dismissed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shop_staff_call_scope_status ON shop_staff_call(tenant_id, company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_staff_call_table ON shop_staff_call(table_id);