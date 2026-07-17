ALTER TABLE model
    ADD COLUMN IF NOT EXISTS model_name_translations TEXT,
    ADD COLUMN IF NOT EXISTS category_translations TEXT;

ALTER TABLE model_menu_option
    ADD COLUMN IF NOT EXISTS group_name_translations TEXT;
