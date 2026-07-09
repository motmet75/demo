ALTER TABLE shop_access_token
    ADD COLUMN IF NOT EXISTS max_orders INTEGER;

ALTER TABLE shop_access_token
    ADD COLUMN IF NOT EXISTS counter_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE shop_access_token
    ADD COLUMN IF NOT EXISTS counter_locked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE shop_access_token
    ADD COLUMN IF NOT EXISTS counter_locked_by VARCHAR(120);