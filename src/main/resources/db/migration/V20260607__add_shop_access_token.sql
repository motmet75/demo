CREATE TABLE IF NOT EXISTS shop_access_token (
    id UUID PRIMARY KEY,
    token VARCHAR(100) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    table_id UUID,
    token_type VARCHAR(50),
    description TEXT,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_shop_access_token_token ON shop_access_token(token);
CREATE INDEX IF NOT EXISTS idx_shop_access_token_table ON shop_access_token(table_id);
