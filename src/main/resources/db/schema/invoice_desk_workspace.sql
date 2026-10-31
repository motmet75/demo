-- Additive, repeatable upgrade. Review and back up before applying to production.
ALTER TABLE invoice_desk_document ADD COLUMN IF NOT EXISTS ocr_cache text NOT NULL DEFAULT '{}';
ALTER TABLE invoice_desk_document ADD COLUMN IF NOT EXISTS extracted_payload text;
ALTER TABLE invoice_desk_document ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoice_desk_document ADD COLUMN IF NOT EXISTS updated_by text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS invoice_desk_revision (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id),
 document_id uuid NOT NULL REFERENCES invoice_desk_document(id), version bigint NOT NULL,
 payload text NOT NULL, changed_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(document_id,version)
);
CREATE TABLE IF NOT EXISTS invoice_desk_session (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id),
 username text NOT NULL, name varchar(160) NOT NULL, document_ids text NOT NULL,
 version bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,username,name)
);
CREATE TABLE IF NOT EXISTS invoice_desk_password_reset (
 username text PRIMARY KEY, initial_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invoice_desk_gdt_report (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id), company_id uuid NOT NULL,
 tax_id varchar(13) NOT NULL, period_from date NOT NULL, period_to date NOT NULL, complete boolean NOT NULL,
 purchases integer NOT NULL, sales integer NOT NULL, documents integer NOT NULL, failures integer NOT NULL,
 coverage varchar(500) NOT NULL DEFAULT '', manifest text NOT NULL, workbook bytea NOT NULL, package bytea NOT NULL,
 sha256 varchar(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by text NOT NULL,
 UNIQUE(tenant_id,company_id,tax_id,period_from,period_to)
);
CREATE INDEX IF NOT EXISTS invoice_desk_gdt_report_scope ON invoice_desk_gdt_report(tenant_id,company_id,period_to,tax_id);
CREATE TABLE IF NOT EXISTS invoice_desk_desktop_pairing (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id), company_id uuid NOT NULL,
 username text NOT NULL, token_hash varchar(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invoice_desk_desktop_session (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id), company_id uuid NOT NULL,
 username text NOT NULL, token_hash varchar(64) NOT NULL UNIQUE, client_nonce varchar(100) NOT NULL,
 app_version varchar(40) NOT NULL, expires_at timestamptz NOT NULL, last_seen timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS invoice_desk_desktop_session_expiry ON invoice_desk_desktop_session(expires_at);
