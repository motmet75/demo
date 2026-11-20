ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS buyer_identity_number varchar(12);
ALTER TABLE vin_hoadon_shop_invoice ADD COLUMN IF NOT EXISTS buyer_identity_number varchar(12);
