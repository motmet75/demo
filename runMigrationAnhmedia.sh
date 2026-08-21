#!/bin/sh

# PostgreSQL connection info
PG_USER="postgres"
PG_PASSWORD="295hAhVyG5Manager"
PG_HOST="localhost"
PG_PORT="5432"
DB="anhmedia"

SQL_DIR="src/main/resources/db/migration"

SQL_FILES="
V20260630__add_voucher_redeemed_customer.sql
V20260630_2__create_shop_bill_tables.sql
V20260630_3__add_shop_staff_call.sql
V20260630_4__add_order_fields_to_shop_staff_call.sql
V20260630_5__add_reply_to_shop_staff_call.sql
V20260707__add_shop_material_audit.sql
V20260709__add_shop_counter_public_ip.sql
V20260709_2__add_shop_token_order_limits.sql
V20260709_3__add_customer_code_loyalty_discount.sql
V20260710__add_shop_allow_all_networks.sql
V20260710_2__add_shop_counter_network_rules.sql
V20260710_3__cascade_shop_bill_item_order_item_fk.sql
"

export PGPASSWORD=$PG_PASSWORD

for file in $SQL_FILES; do
    path="$SQL_DIR/$file"
    if [ -f "$path" ]; then
        echo "Running $file on $DB ..."
        psql -v ON_ERROR_STOP=1 -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -d "$DB" -f "$path" || {
            echo "ERROR: failed on $file — stopping."
            unset PGPASSWORD
            exit 1
        }
        echo "Done: $file"
    else
        echo "WARNING: $path not found, skipping."
    fi
done

unset PGPASSWORD
echo "All migrations applied to $DB."
