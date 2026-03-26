package com.demo.security;

import java.util.List;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AdminUserRequest(
        @NotBlank String username,
        String password,
        @NotBlank String firstName,
        @NotBlank String lastName,
        @Email String email,
        Boolean enabled,
        List<String> authorities,
        String assignedTenantId,
        String assignedCompanyId
) {
}
