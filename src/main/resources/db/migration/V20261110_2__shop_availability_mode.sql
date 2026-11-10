-- Two availability strategies for selling shop menu items:
-- DAILY: manual "left today" cap, resets sold counter by business date.
-- WAREHOUSE_TOTAL: real stock minus locked/reserved/open shop demand,
-- with a required BOM linking the menu item to stock materials.
ALTER TABLE public.model
    ADD COLUMN IF NOT EXISTS shop_availability_mode varchar(24)
        NOT NULL DEFAULT 'DAILY';
