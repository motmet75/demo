package com.ams.bomcore.service.portalcontent;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;

/** Resolves an approved Portal website tenant to its server-side datasource file. */
@Component
public class PortalTenantDataSourceRegistry {
    private final List<Path> configDirectories;

    @Autowired
    public PortalTenantDataSourceRegistry(
            @Value("${portal-content.tenant-config-dirs:./tenants/atRuntime,../portal/tenants/atRuntime}") String directories) {
        this.configDirectories = parseDirectories(directories);
    }

    PortalTenantDataSourceRegistry(List<Path> directories) {
        this.configDirectories = directories.stream().map(path -> path.toAbsolutePath().normalize()).toList();
    }

    public List<String> tenantIds() {
        return new ArrayList<>(loadConfigs().keySet()).stream().sorted().toList();
    }

    public DataSource dataSource(String tenantId) {
        String normalized = normalizeTenantId(tenantId);
        TenantDatabase config = loadConfigs().get(normalized);
        if (config == null) throw new IllegalArgumentException("Unknown Portal tenant: " + normalized);
        DriverManagerDataSource source = new DriverManagerDataSource();
        source.setDriverClassName("org.postgresql.Driver");
        source.setUrl(config.url());
        source.setUsername(config.username());
        source.setPassword(config.password());
        return source;
    }

    private Map<String, TenantDatabase> loadConfigs() {
        Map<String, TenantDatabase> result = new LinkedHashMap<>();
        for (Path directory : configDirectories) {
            if (!Files.isDirectory(directory)) continue;
            try (var files = Files.list(directory)) {
                files.filter(Files::isRegularFile)
                        .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".properties"))
                        .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                        .forEach(path -> read(path, result));
            } catch (IOException exception) {
                throw new IllegalStateException("Could not read Portal tenant configuration directory", exception);
            }
        }
        return result;
    }

    private void read(Path path, Map<String, TenantDatabase> result) {
        Properties values = new Properties();
        try (InputStream input = Files.newInputStream(path)) {
            values.load(input);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read Portal tenant configuration", exception);
        }
        String id = optional(values, "id");
        String url = optional(values, "url");
        String username = optional(values, "username");
        String password = values.getProperty("password", "");
        if (id == null || url == null || username == null || !url.startsWith("jdbc:postgresql:")) return;
        String normalized = normalizeTenantId(id);
        result.putIfAbsent(normalized, new TenantDatabase(url, username, password));
    }

    static String normalizeTenantId(String tenantId) {
        String value = tenantId == null ? "" : tenantId.trim().toLowerCase(Locale.ROOT);
        if (!value.matches("^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$"))
            throw new IllegalArgumentException("Invalid Portal tenant");
        return value;
    }

    private static String optional(Properties values, String key) {
        String value = values.getProperty(key);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static List<Path> parseDirectories(String directories) {
        if (directories == null || directories.isBlank()) return List.of();
        return java.util.Arrays.stream(directories.split(","))
                .map(String::trim).filter(value -> !value.isBlank())
                .map(Path::of).map(path -> path.toAbsolutePath().normalize()).toList();
    }

    private record TenantDatabase(String url, String username, String password) {}
}
