CREATE TABLE IF NOT EXISTS shop_counter_shift (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, company_id uuid NOT NULL,
 shift_date date NOT NULL, shift_name text NOT NULL, status varchar(10) NOT NULL DEFAULT 'OPEN',
 opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 opened_by text NOT NULL, closed_by text, previous_cash numeric,
 opening_cash numeric NOT NULL CHECK (opening_cash >= 0), opening_reason text,
 actual_cash numeric, actual_bank numeric, closing_reason text, handover_to text,
 summary jsonb, inventory_counts jsonb,
 CHECK (status IN ('OPEN','CLOSED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_counter_one_open ON shop_counter_shift(tenant_id,company_id) WHERE status='OPEN';
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS entered_quantity numeric;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS entered_unit text;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shop_counter_shift(id);
ALTER TABLE material ADD COLUMN IF NOT EXISTS manual_shift_consumption boolean NOT NULL DEFAULT false;

ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS paid_at timestamptz;
