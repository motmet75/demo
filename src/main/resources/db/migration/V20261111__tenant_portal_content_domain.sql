ALTER TABLE tenant
    ADD COLUMN IF NOT EXISTS portal_content_tenant VARCHAR(255);

CREATE INDEX IF NOT EXISTS tenant_portal_content_tenant_idx
    ON tenant (lower(portal_content_tenant))
    WHERE portal_content_tenant IS NOT NULL;
