CREATE TABLE IF NOT EXISTS vin_hoadon_company_config (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenant(id),
    company_id uuid NOT NULL REFERENCES company(id),
    enabled boolean NOT NULL DEFAULT false,
    tax_code varchar(14) NOT NULL,
    api_username varchar(255) NOT NULL,
    encrypted_api_password text NOT NULL,
    invoice_template_code varchar(11) NOT NULL,
    invoice_series varchar(8) NOT NULL,
    default_vat_rate integer NOT NULL DEFAULT 8,
    prices_include_vat boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vin_hoadon_config_company UNIQUE (tenant_id, company_id),
    CONSTRAINT ck_vin_hoadon_default_vat CHECK (default_vat_rate IN (-2, -1, 0, 5, 8, 10))
);

CREATE TABLE IF NOT EXISTS vin_hoadon_shop_invoice (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenant(id),
    company_id uuid NOT NULL REFERENCES company(id),
    external_invoice_id varchar(50) NOT NULL,
    status varchar(20) NOT NULL,
    buyer_tax_code varchar(14),
    buyer_organization_name varchar(255),
    buyer_name varchar(255),
    buyer_address varchar(255),
    buyer_phone varchar(20),
    buyer_email varchar(100),
    payment_method integer NOT NULL,
    vat_rate integer NOT NULL,
    subtotal numeric(18,6) NOT NULL,
    tax_amount numeric(18,6) NOT NULL,
    total_amount numeric(18,6) NOT NULL,
    vendor_result_code varchar(100),
    vendor_result_message text,
    vendor_transaction_id varchar(255),
    invoice_template_code varchar(11),
    invoice_series varchar(8),
    invoice_number varchar(100),
    request_payload jsonb,
    response_payload jsonb,
    created_by varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    issued_at timestamptz,
    last_attempt_at timestamptz,
    last_synced_at timestamptz,
    tax_authority_status varchar(20),
    attempt_count integer NOT NULL DEFAULT 0,
    CONSTRAINT uq_vin_hoadon_external_id UNIQUE (external_invoice_id),
    CONSTRAINT ck_vin_hoadon_status CHECK (status IN ('ISSUING', 'PENDING', 'ISSUED', 'FAILED', 'RECONCILE')),
    CONSTRAINT ck_vin_hoadon_vat CHECK (vat_rate IN (-2, -1, 0, 5, 8, 10)),
    CONSTRAINT ck_vin_hoadon_payment CHECK (payment_method BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS vin_hoadon_shop_invoice_order (
    id uuid PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES vin_hoadon_shop_invoice(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES shop_order(id),
    tenant_id uuid NOT NULL REFERENCES tenant(id),
    company_id uuid NOT NULL REFERENCES company(id),
    CONSTRAINT uq_vin_hoadon_invoiced_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_vin_hoadon_invoice_scope_time
    ON vin_hoadon_shop_invoice(tenant_id, company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vin_hoadon_invoice_order_invoice
    ON vin_hoadon_shop_invoice_order(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vin_hoadon_invoice_order_scope
    ON vin_hoadon_shop_invoice_order(tenant_id, company_id, order_id);

-- The audit framework predates these tables, so attach its trigger explicitly.
DO $$
DECLARE table_name text;
BEGIN
    IF to_regprocedure('app_audit_capture()') IS NOT NULL THEN
        FOREACH table_name IN ARRAY ARRAY[
            'vin_hoadon_company_config',
            'vin_hoadon_shop_invoice',
            'vin_hoadon_shop_invoice_order'
        ] LOOP
            EXECUTE format('DROP TRIGGER IF EXISTS app_record_audit_trigger ON public.%I', table_name);
            EXECUTE format(
                'CREATE TRIGGER app_record_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_audit_capture()',
                table_name
            );
        END LOOP;
    END IF;
END $$;
