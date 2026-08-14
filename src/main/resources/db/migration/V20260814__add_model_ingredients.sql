ALTER TABLE model ADD COLUMN IF NOT EXISTS ingredients TEXT;

COMMENT ON COLUMN model.ingredients IS
    'Customer-facing ingredient or cuisine composition shown on the ordering menu.';
