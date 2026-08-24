ALTER TABLE company
    ADD COLUMN IF NOT EXISTS new_order_notification_emails TEXT,
    ADD COLUMN IF NOT EXISTS new_order_notification_enabled BOOLEAN DEFAULT FALSE;

UPDATE company
SET new_order_notification_enabled = FALSE
WHERE new_order_notification_enabled IS NULL;
