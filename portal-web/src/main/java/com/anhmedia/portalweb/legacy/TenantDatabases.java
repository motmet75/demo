package com.anhmedia.portalweb.legacy;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tenant id -> read-only JDBC access. The JDBC URL comes from the legacy
 * Portal tenant files (only "id" and "url" are read: their superuser
 * passwords are never loaded). Every connection uses the SELECT-only role
 * portal_web_ro, whose sessions are also default_transaction_read_only.
 */
@Component
public class TenantDatabases {
    private static final Logger log = LoggerFactory.getLogger(TenantDatabases.class);

    private final Path configDir;
    private final String username;
    private final String password;
    private final Map<String, JdbcTemplate> templates = new ConcurrentHashMap<>();
    private final Map<String, HikariDataSource> pools = new ConcurrentHashMap<>();

    public TenantDatabases(@Value("${portal.web.tenant-config-dir:/opt/tuonghoa/portal/tenants/atRuntime}") String configDir,
                           @Value("${portal.web.db.username:}") String username,
                           @Value("${portal.web.db.password:}") String password) {
        this.configDir = Path.of(configDir).toAbsolutePath().normalize();
        this.username = username == null ? "" : username.trim();
        this.password = password == null ? "" : password;
    }

    public boolean enabled() {
        return !username.isEmpty() && !password.isEmpty();
    }

    /** Empty when the tenant has no database file, or direct access is not configured. */
    public Optional<JdbcTemplate> forTenant(String tenantId) {
        if (!enabled() || tenantId == null || tenantId.isBlank()) return Optional.empty();
        String tenant = tenantId.trim().toLowerCase(Locale.ROOT);
        JdbcTemplate existing = templates.get(tenant);
        if (existing != null) return Optional.of(existing);
        Optional<String> url = urlFor(tenant);
        if (url.isEmpty()) return Optional.empty();
        return Optional.of(templates.computeIfAbsent(tenant, t -> new JdbcTemplate(pool(t, url.get()))));
    }

    private HikariDataSource pool(String tenant, String url) {
        HikariConfig config = new HikariConfig();
        config.setPoolName("pw-" + tenant);
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setReadOnly(true);
        config.setMaximumPoolSize(3);
        config.setMinimumIdle(0);
        config.setIdleTimeout(120_000);
        config.setConnectionTimeout(5_000);
        config.setMaxLifetime(1_800_000);
        HikariDataSource source = new HikariDataSource(config);
        pools.put(tenant, source);
        log.info("Read-only tenant pool opened: tenant={} db={}", tenant, url.replaceAll("\\?.*", ""));
        return source;
    }

    private Optional<String> urlFor(String tenant) {
        if (!Files.isDirectory(configDir)) {
            log.error("Tenant config directory missing: {}", configDir);
            return Optional.empty();
        }
        try (var files = Files.list(configDir)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".properties"))
                    .sorted(Comparator.comparing(Path::toString)).toList()) {
                Properties values = new Properties();
                try (InputStream in = Files.newInputStream(file)) {
                    values.load(in);
                }
                String id = values.getProperty("id", "").trim().toLowerCase(Locale.ROOT);
                String url = values.getProperty("url", "").trim();
                if (tenant.equals(id) && url.startsWith("jdbc:postgresql:")) return Optional.of(url);
            }
        } catch (IOException e) {
            log.error("Cannot read tenant configuration: {}", e.toString());
        }
        return Optional.empty();
    }

    @PreDestroy
    void close() {
        pools.values().forEach(HikariDataSource::close);
    }
}
