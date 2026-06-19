-- Add discount / voucher / customer link to shop_order
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS voucher_code    varchar(50);
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS customer_id     uuid;

-- Customer loyalty table
CREATE TABLE IF NOT EXISTS shop_customer (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL,
    company_id  uuid NOT NULL,
    name        varchar(100) NOT NULL,
    phone       varchar(30),
    email       varchar(100),
    points      integer NOT NULL DEFAULT 0,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_customer_scope ON shop_customer(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_shop_customer_phone ON shop_customer(phone);
