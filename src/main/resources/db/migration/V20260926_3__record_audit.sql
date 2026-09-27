CREATE TABLE IF NOT EXISTS app_record_audit (
 id bigserial PRIMARY KEY,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor text NOT NULL,
 request_path text,
 table_name text NOT NULL,
 record_id text,
 operation varchar(10) NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
 tenant_id text,
 company_id text,
 changed_fields text[] NOT NULL,
 before_data jsonb,
 after_data jsonb
);
CREATE INDEX IF NOT EXISTS app_audit_scope_time ON app_record_audit(tenant_id,company_id,id DESC);
CREATE INDEX IF NOT EXISTS app_audit_actor_time ON app_record_audit(actor,id DESC);

-- Recursively redact credentials, payment secrets and binary content before storing snapshots.
CREATE OR REPLACE FUNCTION app_audit_redact(value jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result jsonb; item record;
BEGIN
 IF value IS NULL THEN RETURN NULL; END IF;
 IF jsonb_typeof(value)='object' THEN
  result='{}'::jsonb;
  FOR item IN SELECT * FROM jsonb_each(value) LOOP
   IF (item.key ~* '(value|setting|content)' AND COALESCE(value->>'key',value->>'name',value->>'config_key',value->>'property_name','') ~* '(password|secret|token|otp|api.?key|private.?key)') OR item.key ~* '(password|passwd|secret|token|credential|otp|totp|api.?key|private.?key|authorization|cookie|qr|base64|image|avatar|avarta|thumbnail)' THEN
    result=result || jsonb_build_object(item.key,'[REDACTED]');
   ELSE result=result || jsonb_build_object(item.key,app_audit_redact(item.value)); END IF;
  END LOOP;
  RETURN result;
 ELSIF jsonb_typeof(value)='array' THEN
  SELECT COALESCE(jsonb_agg(app_audit_redact(element)),'[]'::jsonb) INTO result FROM jsonb_array_elements(value) AS a(element);
  RETURN result;
 ELSE RETURN value; END IF;
END $$;

CREATE OR REPLACE FUNCTION app_audit_capture() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_row jsonb; new_row jsonb; row_data jsonb; fields text[]; tenant text; company text;
BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
 IF TG_OP<>'INSERT' THEN old_row=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN new_row=to_jsonb(NEW); END IF;
 SELECT array_agg(key ORDER BY key) INTO fields FROM (
  SELECT key FROM jsonb_object_keys(COALESCE(old_row,'{}'::jsonb)||COALESCE(new_row,'{}'::jsonb)) AS k(key)
  WHERE old_row->key IS DISTINCT FROM new_row->key
 ) changed;
 row_data=COALESCE(new_row,old_row);
 tenant=COALESCE(row_data->>'tenant_id',NULLIF(current_setting('app.audit_tenant',true),''));
 company=COALESCE(row_data->>'company_id',NULLIF(current_setting('app.audit_company',true),''));
 IF TG_TABLE_NAME='company' THEN company=row_data->>'id'; END IF;
 IF TG_TABLE_NAME='tenant' THEN tenant=row_data->>'id'; company=NULL; END IF;
 INSERT INTO app_record_audit(actor,request_path,table_name,record_id,operation,tenant_id,company_id,changed_fields,before_data,after_data)
 VALUES(COALESCE(NULLIF(current_setting('app.audit_user',true),''),'database:'||session_user),NULLIF(current_setting('app.audit_path',true),''),
 TG_TABLE_NAME,COALESCE(row_data->>'id',row_data->>'username',row_data->>'key'),TG_OP,tenant,company,COALESCE(fields,ARRAY[]::text[]),app_audit_redact(old_row),app_audit_redact(new_row));
 RETURN NULL;
END $$;

-- All current application tables: captures JPA, JdbcTemplate, imports and bulk updates alike.
-- Infrastructure/session data is excluded; new business tables must add this same trigger.
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  AND tablename NOT IN ('app_record_audit','flyway_schema_history','databasechangelog','databasechangeloglock')
  AND tablename NOT LIKE 'spring_session%' AND tablename NOT LIKE 'qrtz_%'
 LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS app_record_audit_trigger ON public.%I',item.tablename);
  EXECUTE format('CREATE TRIGGER app_record_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_audit_capture()',item.tablename);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION app_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records cannot be modified or deleted'; END $$;
DROP TRIGGER IF EXISTS app_audit_no_change ON app_record_audit;
CREATE TRIGGER app_audit_no_change BEFORE UPDATE OR DELETE OR TRUNCATE ON app_record_audit
 FOR EACH STATEMENT EXECUTE FUNCTION app_audit_immutable();
