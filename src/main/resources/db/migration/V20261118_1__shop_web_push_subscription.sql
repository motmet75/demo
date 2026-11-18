-- Web Push subscriptions for staff devices, independent of email alerts.
-- Apply before enabling Web Push in the backend.
CREATE TABLE IF NOT EXISTS shop_web_push_subscription (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    username VARCHAR(255) NOT NULL,
    endpoint_sha256 VARCHAR(64) NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shop_web_push_scope_endpoint
        UNIQUE (tenant_id, company_id, endpoint_sha256),
    CONSTRAINT fk_shop_web_push_company
        FOREIGN KEY (company_id) REFERENCES company (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shop_web_push_company_enabled
    ON shop_web_push_subscription (tenant_id, company_id)
    WHERE enabled=TRUE;
