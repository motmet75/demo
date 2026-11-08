-- Protect generated and manually entered codes against concurrent duplicates.
-- Existing uniqueness is (tenant_id, company_id, material_code), case sensitive
-- in some installations. This index also rejects MAT-ABC and mat-abc.
--
-- If existing codes conflict, the migration intentionally fails without
-- changing any material. Resolve the duplicate legacy codes first:
-- SELECT tenant_id, company_id, upper(btrim(material_code)) code,
--        count(*), array_agg(id)
-- FROM public.material
-- GROUP BY 1,2,3 HAVING count(*)>1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_tenant_company_code_ci
    ON public.material(tenant_id,company_id,upper(btrim(material_code)));
