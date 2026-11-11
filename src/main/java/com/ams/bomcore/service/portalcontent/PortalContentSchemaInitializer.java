package com.ams.bomcore.service.portalcontent;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Keeps the shared admin database compatible when Flyway is not enabled. */
@Component
public class PortalContentSchemaInitializer {
    private final JdbcTemplate database;

    public PortalContentSchemaInitializer(JdbcTemplate database) { this.database = database; }

    @PostConstruct
    public void ensureSchema() {
        database.execute("ALTER TABLE tenant ADD COLUMN IF NOT EXISTS portal_content_tenant VARCHAR(255)");
        database.execute("""
                CREATE INDEX IF NOT EXISTS tenant_portal_content_tenant_idx
                    ON tenant (lower(portal_content_tenant))
                    WHERE portal_content_tenant IS NOT NULL
                """);
    }
}
