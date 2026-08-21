CREATE TABLE IF NOT EXISTS shop_table (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    company_id  UUID NOT NULL,
    table_name  VARCHAR(100) NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_order (
    id                   UUID PRIMARY KEY,
    tenant_id            UUID NOT NULL,
    company_id           UUID NOT NULL,
    order_code           VARCHAR(50) NOT NULL,
    order_number         INTEGER,
    table_id             UUID REFERENCES shop_table(id),
    fulfillment_type     VARCHAR(20),
    status               VARCHAR(20) DEFAULT 'PENDING',
    customer_name        VARCHAR(100),
    customer_phone       VARCHAR(30),
    delivery_provider    VARCHAR(30),
    delivery_address     TEXT,
    delivery_fee         NUMERIC,
    total_raw_cost       NUMERIC,
    total_amount         NUMERIC,
    payment_method       VARCHAR(20),
    payment_status       VARCHAR(20) DEFAULT 'UNPAID',
    payment_qr           TEXT,
    split_cash_amount    NUMERIC,
    notes                TEXT,
    source_token         VARCHAR(100),
    staff_name           VARCHAR(100),
    cancel_reason        TEXT,
    customer_cancelled   BOOLEAN DEFAULT FALSE,
    customer_cancel_note TEXT,
    customer_editing     BOOLEAN DEFAULT FALSE,
    pickup_scanned_at    TIMESTAMP WITH TIME ZONE,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at         TIMESTAMP WITH TIME ZONE,
    ready_at             TIMESTAMP WITH TIME ZONE,
    completed_at         TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_shop_order_tenant_company ON shop_order(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_status         ON shop_order(status);
CREATE INDEX IF NOT EXISTS idx_shop_order_created_at     ON shop_order(created_at);

CREATE TABLE IF NOT EXISTS shop_order_item (
    id              UUID PRIMARY KEY,
    order_id        UUID NOT NULL REFERENCES shop_order(id) ON DELETE CASCADE,
    model_id        UUID NOT NULL,
    model_name      TEXT,
    quantity        NUMERIC NOT NULL,
    unit_price      NUMERIC,
    unit_raw_cost   NUMERIC,
    line_total      NUMERIC,
    selected_options TEXT,
    option_add_on   NUMERIC NOT NULL DEFAULT 0,
    item_notes      TEXT,
    parent_item_id  UUID REFERENCES shop_order_item(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_order_item_order ON shop_order_item(order_id);
