DO $$
DECLARE
    fk_name text;
BEGIN
    FOR fk_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_schema = kcu.constraint_schema
         AND tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_schema = ccu.constraint_schema
         AND tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = current_schema()
          AND tc.table_name = 'shop_bill_item'
          AND kcu.column_name = 'order_item_id'
          AND ccu.table_name = 'shop_order_item'
          AND ccu.column_name = 'id'
    LOOP
        EXECUTE format('ALTER TABLE shop_bill_item DROP CONSTRAINT %I', fk_name);
    END LOOP;
END $$;

ALTER TABLE shop_bill_item
    ADD CONSTRAINT fk_shop_bill_item_order_item
    FOREIGN KEY (order_item_id) REFERENCES shop_order_item(id) ON DELETE CASCADE;