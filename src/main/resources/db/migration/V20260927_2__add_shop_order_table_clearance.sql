ALTER TABLE shop_order
    ADD COLUMN IF NOT EXISTS table_cleared_at timestamptz;

-- Orders finished before this feature were already treated as cleared.
UPDATE shop_order
SET table_cleared_at = COALESCE(completed_at, created_at, NOW())
WHERE table_id IS NOT NULL
  AND status IN ('COMPLETED', 'PICKED_UP')
  AND table_cleared_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shop_order_uncleared_table
    ON shop_order(tenant_id, company_id, table_id, created_at DESC)
    WHERE table_id IS NOT NULL
      AND table_cleared_at IS NULL
      AND status IN ('COMPLETED', 'PICKED_UP');
