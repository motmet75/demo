CREATE TABLE IF NOT EXISTS shop_order_template (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    template_name varchar(160) NOT NULL,
    customer_name varchar(180),
    customer_phone varchar(80),
    order_notes text,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by varchar(120),
    updated_by varchar(120),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_order_template_name
    ON shop_order_template (tenant_id, company_id, lower(template_name));

CREATE INDEX IF NOT EXISTS idx_shop_order_template_scope_updated
    ON shop_order_template (tenant_id, company_id, updated_at DESC);
