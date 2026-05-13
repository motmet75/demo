-- Migration script to add company_id column to contract table
-- This adds the company_id field for multi-company scoping similar to material table

-- Add the company_id column (nullable initially to allow existing data)
ALTER TABLE contract ADD COLUMN IF NOT EXISTS company_id uuid;

-- For existing contracts, set company_id to match purchasing_company_id
-- This maintains backward compatibility
UPDATE contract SET company_id = purchasing_company_id WHERE company_id IS NULL;

-- Now make it NOT NULL since all rows should have a value
ALTER TABLE contract ALTER COLUMN company_id SET NOT NULL;

-- Add index for performance on company_id queries
CREATE INDEX IF NOT EXISTS idx_contract_company_id ON contract(company_id);

-- Add index for composite queries (tenant + company)
CREATE INDEX IF NOT EXISTS idx_contract_tenant_company ON contract(tenant_id, company_id);

-- Optional: Add foreign key constraint if you want referential integrity
-- ALTER TABLE contract ADD CONSTRAINT fk_contract_company 
--     FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;

COMMENT ON COLUMN contract.company_id IS 'The owning company for this contract (for multi-company scoping)';

--2026-05-12
ALTER TABLE order_header DROP CONSTRAINT order_header_order_number_key;
