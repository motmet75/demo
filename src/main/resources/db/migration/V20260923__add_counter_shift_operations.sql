CREATE TABLE IF NOT EXISTS shop_payment_note (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    note_number varchar(40) NOT NULL,
    note_date date NOT NULL,
    object_name varchar(180),
    recipient_name varchar(180),
    address text,
    reason text NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    created_by varchar(120),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_payment_note_scope_date
    ON shop_payment_note (tenant_id, company_id, note_date, created_at);

CREATE TABLE IF NOT EXISTS shop_inventory_reconciliation (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    check_date date NOT NULL,
    inventory_id uuid,
    material_id uuid,
    material_code varchar(80),
    material_name text,
    warehouse_id uuid,
    warehouse_code varchar(80),
    warehouse_name text,
    batch_no varchar(255),
    unit varchar(30),
    system_qty numeric NOT NULL DEFAULT 0,
    actual_qty numeric NOT NULL DEFAULT 0,
    difference_qty numeric NOT NULL DEFAULT 0,
    reason text,
    created_by varchar(120),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_inventory_reconciliation_scope_date
    ON shop_inventory_reconciliation (tenant_id, company_id, check_date, created_at);

CREATE TABLE IF NOT EXISTS shop_shift_handover (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    shift_date date NOT NULL,
    shift_name varchar(120),
    opened_at timestamptz,
    closed_at timestamptz,
    handover_by varchar(180),
    handover_to varchar(180),
    opening_cash numeric NOT NULL DEFAULT 0,
    cash_sales numeric NOT NULL DEFAULT 0,
    bank_sales numeric NOT NULL DEFAULT 0,
    debt_amount numeric NOT NULL DEFAULT 0,
    other_amount numeric NOT NULL DEFAULT 0,
    payment_note_total numeric NOT NULL DEFAULT 0,
    expected_cash numeric NOT NULL DEFAULT 0,
    actual_cash numeric NOT NULL DEFAULT 0,
    difference_cash numeric NOT NULL DEFAULT 0,
    order_count integer NOT NULL DEFAULT 0,
    card_slip_count integer NOT NULL DEFAULT 0,
    unpaid_order_count integer NOT NULL DEFAULT 0,
    cash_denominations jsonb,
    notes text,
    created_by varchar(120),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_shift_handover_scope_date
    ON shop_shift_handover (tenant_id, company_id, shift_date, created_at);
