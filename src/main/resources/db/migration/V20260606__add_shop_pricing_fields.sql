ALTER TABLE model ADD COLUMN IF NOT EXISTS selling_price numeric;
ALTER TABLE model ADD COLUMN IF NOT EXISTS category varchar(50);
ALTER TABLE model ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE company ADD COLUMN IF NOT EXISTS bank_bin varchar(20);
ALTER TABLE company ADD COLUMN IF NOT EXISTS bank_account_number varchar(50);
ALTER TABLE company ADD COLUMN IF NOT EXISTS bank_account_name varchar(100);
