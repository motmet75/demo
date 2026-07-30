CREATE TABLE IF NOT EXISTS trusted_login_device (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    last_ip VARCHAR(64),
    user_agent VARCHAR(220),
    last_used_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_trusted_login_device_user_fingerprint UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_login_device_expiry
    ON trusted_login_device (user_id, expires_at);
