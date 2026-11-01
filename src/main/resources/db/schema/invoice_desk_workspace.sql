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

CREATE TABLE IF NOT EXISTS invoice_desk_gdt_defaults (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 trial_days integer NOT NULL DEFAULT 30 CHECK(trial_days BETWEEN 1 AND 3650),
 monthly_invoice_limit integer NOT NULL DEFAULT 100 CHECK(monthly_invoice_limit >= 0),
 monthly_ocr_limit integer NOT NULL DEFAULT 50 CHECK(monthly_ocr_limit >= 0),
 daily_ocr_limit integer NOT NULL DEFAULT 20 CHECK(daily_ocr_limit >= 0),
 max_invoices_per_job integer NOT NULL DEFAULT 100 CHECK(max_invoices_per_job >= 1),
 max_devices integer NOT NULL DEFAULT 2 CHECK(max_devices >= 1),
 local_ocr_enabled boolean NOT NULL DEFAULT true,
 online_ocr_enabled boolean NOT NULL DEFAULT true,
 telemetry_retention_days integer NOT NULL DEFAULT 90 CHECK(telemetry_retention_days BETWEEN 1 AND 730),
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by text NOT NULL DEFAULT 'system'
);
ALTER TABLE invoice_desk_gdt_defaults ADD COLUMN IF NOT EXISTS invoice_quota_mode varchar(16) NOT NULL DEFAULT 'RUN';
ALTER TABLE invoice_desk_gdt_defaults ALTER COLUMN invoice_quota_mode SET DEFAULT 'RUN';
ALTER TABLE invoice_desk_gdt_defaults ADD COLUMN IF NOT EXISTS monthly_run_limit integer NOT NULL DEFAULT 3;
INSERT INTO invoice_desk_gdt_defaults(singleton) VALUES (true) ON CONFLICT(singleton) DO NOTHING;
UPDATE invoice_desk_gdt_defaults SET invoice_quota_mode='RUN',monthly_run_limit=3,updated_at=CURRENT_TIMESTAMP
WHERE singleton=true AND updated_by='system';

CREATE TABLE IF NOT EXISTS invoice_desk_gdt_policy (
 tenant_id uuid PRIMARY KEY REFERENCES tenant(id),
 trial_started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 trial_ends_at timestamptz,
 monthly_invoice_limit integer CHECK(monthly_invoice_limit >= 0),
 monthly_ocr_limit integer CHECK(monthly_ocr_limit >= 0),
 daily_ocr_limit integer CHECK(daily_ocr_limit >= 0),
 max_invoices_per_job integer CHECK(max_invoices_per_job >= 1),
 max_devices integer CHECK(max_devices >= 1),
 local_ocr_enabled boolean,
 online_ocr_enabled boolean,
 suspended boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by text NOT NULL DEFAULT ''
);
ALTER TABLE invoice_desk_gdt_policy ADD COLUMN IF NOT EXISTS invoice_quota_mode varchar(16);
ALTER TABLE invoice_desk_gdt_policy ADD COLUMN IF NOT EXISTS monthly_run_limit integer;

CREATE TABLE IF NOT EXISTS invoice_desk_gdt_usage (
 tenant_id uuid NOT NULL REFERENCES tenant(id), usage_month date NOT NULL,
 ocr_attempts integer NOT NULL DEFAULT 0, ocr_successes integer NOT NULL DEFAULT 0,
 invoice_downloads integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,usage_month)
);
ALTER TABLE invoice_desk_gdt_usage ADD COLUMN IF NOT EXISTS report_runs integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS invoice_desk_gdt_daily_usage (
 tenant_id uuid NOT NULL REFERENCES tenant(id), usage_day date NOT NULL,
 ocr_attempts integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,usage_day)
);
CREATE TABLE IF NOT EXISTS invoice_desk_gdt_invoice_charge (
 tenant_id uuid NOT NULL REFERENCES tenant(id), invoice_hash varchar(64) NOT NULL,
 reservation_id uuid NOT NULL, state varchar(16) NOT NULL CHECK(state IN ('RESERVED','COMPLETED')),
 charged_month date NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,invoice_hash)
);
CREATE INDEX IF NOT EXISTS invoice_desk_gdt_invoice_reservation ON invoice_desk_gdt_invoice_charge(reservation_id,state);
CREATE TABLE IF NOT EXISTS invoice_desk_gdt_run_reservation (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), charged_month date NOT NULL,
 state varchar(16) NOT NULL CHECK(state IN ('RESERVED','COMPLETED')),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_desk_gdt_login_guard (
 tenant_id uuid NOT NULL REFERENCES tenant(id), account_hash varchar(64) NOT NULL,
 consecutive_failures integer NOT NULL DEFAULT 0, blocked_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id,account_hash)
);

CREATE TABLE IF NOT EXISTS invoice_desk_gdt_event (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenant(id), company_id uuid NOT NULL,
 event_type varchar(40) NOT NULL, stage varchar(60) NOT NULL, error_category varchar(60) NOT NULL DEFAULT '',
 http_status integer, correlation_id varchar(80) NOT NULL DEFAULT '', client_version varchar(40) NOT NULL DEFAULT '',
 detail varchar(500) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS invoice_desk_gdt_event_scope ON invoice_desk_gdt_event(tenant_id,company_id,created_at DESC);

-- ROLE_USER has Invoice Desk access. Normalize legacy OAuth casing and copy the
-- assignment columns used by older deployments into the columns used by JPA now.
DELETE FROM authorities legacy
WHERE upper(legacy.authority)='ROLE_USER' AND legacy.authority<>'ROLE_USER'
  AND EXISTS (SELECT 1 FROM authorities current
              WHERE lower(current.username)=lower(legacy.username) AND current.authority='ROLE_USER');
UPDATE authorities SET authority='ROLE_USER',description=COALESCE(NULLIF(description,''),'ROLE_USER')
WHERE upper(authority)='ROLE_USER' AND authority<>'ROLE_USER';

UPDATE usertb u SET
 assignedtenantid=u.assigned_tenant_id,
 assignedcompanyid=u.assigned_company_id
WHERE EXISTS (SELECT 1 FROM authorities a WHERE lower(a.username)=lower(u.username) AND a.authority='ROLE_USER')
  AND (u.assignedtenantid IS NULL OR u.assignedtenantid='')
  AND (u.assignedcompanyid IS NULL OR u.assignedcompanyid='')
  AND u.assigned_tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.assigned_company_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM company c
              WHERE c.id=CASE WHEN u.assigned_company_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN u.assigned_company_id::uuid END
                AND c.tenant_id=CASE WHEN u.assigned_tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN u.assigned_tenant_id::uuid END);

UPDATE usertb u SET
 assigned_tenant_id=u.assignedtenantid,
 assigned_company_id=u.assignedcompanyid
WHERE EXISTS (SELECT 1 FROM authorities a WHERE lower(a.username)=lower(u.username) AND a.authority='ROLE_USER')
  AND (u.assigned_tenant_id IS NULL OR u.assigned_tenant_id='')
  AND (u.assigned_company_id IS NULL OR u.assigned_company_id='')
  AND u.assignedtenantid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.assignedcompanyid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM company c
              WHERE c.id=u.assignedcompanyid::uuid
                AND c.tenant_id=u.assignedtenantid::uuid);

INSERT INTO invoice_desk_company(tenant_id,company_id)
SELECT DISTINCT ids.tenant_id,ids.company_id
FROM usertb u
CROSS JOIN LATERAL (SELECT
 CASE WHEN COALESCE(NULLIF(u.assigned_tenant_id,''),NULLIF(u.assignedtenantid,'')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN COALESCE(NULLIF(u.assigned_tenant_id,''),NULLIF(u.assignedtenantid,''))::uuid END tenant_id,
 CASE WHEN COALESCE(NULLIF(u.assigned_company_id,''),NULLIF(u.assignedcompanyid,'')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN COALESCE(NULLIF(u.assigned_company_id,''),NULLIF(u.assignedcompanyid,''))::uuid END company_id
) ids
JOIN tenant t ON t.id=ids.tenant_id AND t.is_active=true
JOIN company c ON c.id=ids.company_id AND c.tenant_id=t.id
WHERE EXISTS (SELECT 1 FROM authorities a WHERE lower(a.username)=lower(u.username) AND a.authority='ROLE_USER')
ON CONFLICT DO NOTHING;
