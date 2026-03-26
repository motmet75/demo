-- Migration: Add max_companies column to public.tenant
-- Date: 2026-03-26
-- The Tenant entity defines max_companies (INTEGER, NOT NULL, default 1)
-- but the existing schema DDL does not include this column.

ALTER TABLE public.tenant
    ADD COLUMN IF NOT EXISTS max_companies INTEGER NOT NULL DEFAULT 1;

-- Optional: update specific tenants to allow more companies
-- UPDATE public.tenant SET max_companies = 5 WHERE tenant_code = 'your_tenant_code';
