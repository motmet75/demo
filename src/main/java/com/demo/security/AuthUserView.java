package com.demo.security;

import java.util.List;

public record AuthUserView(
        Integer id,
        String username,
        String firstName,
        String lastName,
        String email,
        boolean enabled,
        List<String> authorities,
        String lastTenantId,
        String lastCompanyId,
        String assignedTenantId,
        String assignedCompanyId
) {
}
