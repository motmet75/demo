-- Feature 1: track when customer started editing (for 15-min timeout display)
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS customer_editing_since timestamptz;

-- Feature 2: points / loyalty programme config on company
ALTER TABLE company ADD COLUMN IF NOT EXISTS points_conversion_rate int NOT NULL DEFAULT 10000;
ALTER TABLE company ADD COLUMN IF NOT EXISTS points_round_up boolean NOT NULL DEFAULT false;

-- Feature 3: voucher management
ALTER TABLE company ADD COLUMN IF NOT EXISTS voucher_secret varchar(100);

CREATE TABLE IF NOT EXISTS shop_voucher (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid         NOT NULL,
    company_id     uuid         NOT NULL,
    code           varchar(20)  NOT NULL,
    face_value     numeric      NOT NULL,
    sale_price     numeric,
    status         varchar(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | USED | EXPIRED | CANCELLED
    customer_id    uuid,
    issued_order_id  uuid,
    redeemed_order_id uuid,
    redeemed_at    timestamptz,
    expiry_date    date,
    notes          text,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_shop_voucher_scope  ON shop_voucher(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_shop_voucher_status ON shop_voucher(tenant_id, company_id, status);
