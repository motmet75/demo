package com.demo.security;

import java.util.List;
import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/authorities")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAuthorityController {

    private final AdminUserService adminUserService;

    public AdminAuthorityController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping("/{username}")
    public Map<String, Object> getAuthorities(@PathVariable String username) {
        return Map.of(
                "username", username,
                "authorities", adminUserService.getAuthorities(username));
    }

    @PutMapping("/{username}")
    public Map<String, Object> replaceAuthorities(@PathVariable String username, @RequestBody List<String> authorities) {
        return Map.of(
                "username", username,
                "authorities", adminUserService.replaceAuthorities(username, authorities));
    }
}
