CREATE TABLE IF NOT EXISTS quick_login_token (
    id UUID PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    session_hours INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_quick_login_token_expiry
    ON quick_login_token (expires_at);
