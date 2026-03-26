package com.demo.security;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public List<AuthUserView> listUsers() {
        return adminUserService.findAllUsers();
    }

    @PostMapping
    public ResponseEntity<AuthUserView> createUser(@Valid @RequestBody AdminUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminUserService.createUser(request));
    }

    @PutMapping("/{id}")
    public AuthUserView updateUser(@PathVariable Integer id, @Valid @RequestBody AdminUserRequest request) {
        return adminUserService.updateUser(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Integer id) {
        adminUserService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    /** Assign (or clear) a tenant for a user. Pass null/blank tenantId to unassign. */
    @PatchMapping("/{id}/tenant")
    public AuthUserView assignTenant(@PathVariable Integer id, @RequestBody AssignTenantRequest request) {
        return adminUserService.assignTenant(id, request.tenantId());
    }

    public record AssignTenantRequest(String tenantId) {}
}
