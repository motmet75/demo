CREATE TABLE IF NOT EXISTS invoice_desk_company (
 tenant_id uuid PRIMARY KEY REFERENCES tenant(id),
 company_id uuid NOT NULL UNIQUE REFERENCES company(id)
);
CREATE TABLE IF NOT EXISTS invoice_desk_document (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id),
 filename text NOT NULL, sha256 varchar(64) NOT NULL, source bytea NOT NULL,
 payload text NOT NULL, version bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id, sha256)
);
CREATE TABLE IF NOT EXISTS invoice_desk_supplier (
 tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id), tax_id varchar(13) NOT NULL,
 name text NOT NULL, rules text NOT NULL, notes text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,tax_id)
);
CREATE TABLE IF NOT EXISTS invoice_desk_learning (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES invoice_desk_company(tenant_id),
 document_id uuid NOT NULL REFERENCES invoice_desk_document(id), tax_id varchar(13) NOT NULL,
 sha256 varchar(64) NOT NULL, before_payload text NOT NULL, approved_payload text NOT NULL,
 reviewed_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE invoice_desk_learning ADD COLUMN IF NOT EXISTS serial varchar(80) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS invoice_desk_learning_source ON invoice_desk_learning(tenant_id,sha256,created_at);
CREATE INDEX IF NOT EXISTS invoice_desk_learning_key ON invoice_desk_learning(tenant_id,tax_id,serial,created_at);
