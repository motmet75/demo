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
