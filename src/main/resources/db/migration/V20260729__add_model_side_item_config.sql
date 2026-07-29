ALTER TABLE model ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE model ADD COLUMN IF NOT EXISTS allowed_side_ids TEXT;

COMMENT ON COLUMN model.image_url IS
    'Customer-facing image URL used by main menu items and side/topping thumbnails.';
COMMENT ON COLUMN model.allowed_side_ids IS
    'JSON side/topping links: [{"modelId":"uuid","maxQty":5}].';
