CREATE TABLE IF NOT EXISTS shop_bill (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    order_id uuid NOT NULL REFERENCES shop_order(id) ON DELETE CASCADE,
    bill_number int,
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    split_from_bill_id uuid REFERENCES shop_bill(id),
    merged_into_bill_id uuid REFERENCES shop_bill(id),
    merge_batch_id uuid,
    pre_merge_order_status varchar(20),
    pre_merge_cancel_reason text,
    total_amount numeric DEFAULT 0,
    total_raw_cost numeric DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    merged_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shop_bill_order ON shop_bill(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_bill_scope ON shop_bill(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_shop_bill_status ON shop_bill(tenant_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_bill_merged_into ON shop_bill(merged_into_bill_id);
CREATE INDEX IF NOT EXISTS idx_shop_bill_merge_batch ON shop_bill(merge_batch_id);

CREATE TABLE IF NOT EXISTS shop_bill_item (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES shop_bill(id) ON DELETE CASCADE,
    original_bill_id uuid NOT NULL REFERENCES shop_bill(id) ON DELETE CASCADE,
    order_item_id uuid NOT NULL REFERENCES shop_order_item(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT uq_shop_bill_item_order_item UNIQUE (order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_bill_item_bill ON shop_bill_item(bill_id);
CREATE INDEX IF NOT EXISTS idx_shop_bill_item_original ON shop_bill_item(original_bill_id);

INSERT INTO shop_bill (id, tenant_id, company_id, order_id, bill_number, status, total_amount, total_raw_cost, created_at, updated_at)
SELECT gen_random_uuid(), o.tenant_id, o.company_id, o.id, 1, 'ACTIVE', COALESCE(o.total_amount, 0), COALESCE(o.total_raw_cost, 0), COALESCE(o.created_at, now()), now()
FROM shop_order o
WHERE NOT EXISTS (SELECT 1 FROM shop_bill b WHERE b.order_id = o.id);

INSERT INTO shop_bill_item (id, bill_id, original_bill_id, order_item_id, created_at, updated_at)
SELECT gen_random_uuid(), b.id, b.id, i.id, now(), now()
FROM shop_order_item i
JOIN shop_bill b ON b.order_id = i.order_id AND b.bill_number = 1
WHERE NOT EXISTS (SELECT 1 FROM shop_bill_item bi WHERE bi.order_item_id = i.id);