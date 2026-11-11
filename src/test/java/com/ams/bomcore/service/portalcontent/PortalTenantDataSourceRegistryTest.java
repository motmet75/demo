package com.ams.bomcore.service.portalcontent;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PortalTenantDataSourceRegistryTest {
    @TempDir Path directory;

    @Test
    void exposesOnlyValidConfiguredPostgresTenants() throws Exception {
        Files.writeString(directory.resolve("migi.properties"), """
                id=migiatruyen.vn
                url=jdbc:postgresql://localhost:5432/migi
                username=portal
                password=secret
                """);
        Files.writeString(directory.resolve("ignored.properties"), "id=bad\nurl=jdbc:mysql://localhost/bad\nusername=x\n");
        var registry = new PortalTenantDataSourceRegistry(List.of(directory));
        assertEquals(List.of("migiatruyen.vn"), registry.tenantIds());
    }

    @Test
    void rejectsPathTraversalAsTenantId() {
        assertThrows(IllegalArgumentException.class,
                () -> PortalTenantDataSourceRegistry.normalizeTenantId("../migiatruyen.vn"));
    }
}
