ALTER TABLE IF EXISTS shop_staff_call
    ADD COLUMN IF NOT EXISTS reply_message text,
    ADD COLUMN IF NOT EXISTS replied_at timestamptz;