CREATE TABLE IF NOT EXISTS model_menu_option (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    model_id UUID NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    choices TEXT NOT NULL,
    required BOOLEAN DEFAULT FALSE,
    multi_select BOOLEAN DEFAULT FALSE,
    default_value VARCHAR(200),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mmo_model ON model_menu_option(model_id);

ALTER TABLE shop_order_item ADD COLUMN IF NOT EXISTS selected_options TEXT;
ALTER TABLE shop_order_item ADD COLUMN IF NOT EXISTS item_notes TEXT;
