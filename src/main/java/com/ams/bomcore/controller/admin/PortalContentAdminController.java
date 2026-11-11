package com.ams.bomcore.controller.admin;

import com.ams.bomcore.service.portalcontent.PortalContentService;
import com.ams.bomcore.service.portalcontent.PortalContentAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/portal-content")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
public class PortalContentAdminController {
    private final PortalContentService service;
    private final PortalContentAccessService access;

    public PortalContentAdminController(PortalContentService service, PortalContentAccessService access) {
        this.service = service; this.access = access;
    }

    @GetMapping("/tenants")
    public List<String> tenants(Authentication authentication) { return access.allowedTenants(authentication); }

    @GetMapping("/{tenantId}/articles")
    public List<PortalContentService.ArticleView> articles(@PathVariable String tenantId,
                                                           @RequestParam(defaultValue = "") String search,
                                                           Authentication authentication) {
        access.require(authentication, tenantId);
        return service.articles(tenantId, search);
    }

    @PostMapping("/{tenantId}/articles")
    public ResponseEntity<PortalContentService.ArticleView> createArticle(@PathVariable String tenantId,
            @RequestBody PortalContentService.ArticleWrite request, Authentication authentication) {
        access.require(authentication, tenantId);
        String actor = authentication == null ? "admin" : authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createArticle(tenantId, request, actor));
    }

    @PutMapping("/{tenantId}/articles/{id}")
    public PortalContentService.ArticleView updateArticle(@PathVariable String tenantId, @PathVariable int id,
            @RequestBody PortalContentService.ArticleWrite request, Authentication authentication) {
        access.require(authentication, tenantId);
        return service.updateArticle(tenantId, id, request);
    }

    @GetMapping("/{tenantId}/products")
    public List<PortalContentService.ProductView> products(@PathVariable String tenantId,
                                                           @RequestParam(defaultValue = "") String search,
                                                           Authentication authentication) {
        access.require(authentication, tenantId);
        return service.products(tenantId, search);
    }

    @PostMapping("/{tenantId}/products")
    public ResponseEntity<PortalContentService.ProductView> createProduct(@PathVariable String tenantId,
            @RequestBody PortalContentService.ProductWrite request, Authentication authentication) {
        access.require(authentication, tenantId);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createProduct(tenantId, request));
    }

    @PutMapping("/{tenantId}/products/{id}")
    public PortalContentService.ProductView updateProduct(@PathVariable String tenantId, @PathVariable int id,
            @RequestBody PortalContentService.ProductWrite request, Authentication authentication) {
        access.require(authentication, tenantId);
        return service.updateProduct(tenantId, id, request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, String>> unavailable(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", exception.getMessage()));
    }
}
