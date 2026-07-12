package com.ams.bomcore.service.shop;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class ShopTableDrawingSchemaInitializer {

    private final JdbcTemplate jdbcTemplate;

    public ShopTableDrawingSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void ensureSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS shop_table_drawing (
                    id uuid PRIMARY KEY,
                    tenant_id uuid NOT NULL,
                    company_id uuid NOT NULL,
                    drawing_name varchar(120) NOT NULL,
                    layout_json TEXT NOT NULL,
                    created_at timestamp with time zone,
                    updated_at timestamp with time zone
                )
                """);
        jdbcTemplate.execute("ALTER TABLE shop_table_drawing ADD COLUMN IF NOT EXISTS layout_json TEXT");
        jdbcTemplate.execute("ALTER TABLE shop_table_drawing ALTER COLUMN layout_json TYPE TEXT USING layout_json::TEXT");
        jdbcTemplate.execute("ALTER TABLE shop_table_drawing ALTER COLUMN layout_json SET NOT NULL");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_shop_table_drawing_scope ON shop_table_drawing (tenant_id, company_id)");
    }
}