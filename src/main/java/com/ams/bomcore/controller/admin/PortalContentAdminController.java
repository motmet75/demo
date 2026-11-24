package com.ams.bomcore.controller.admin;

import com.ams.bomcore.service.portalcontent.PortalContentService;
import com.ams.bomcore.service.portalcontent.PortalContentAccessService;
import com.ams.bomcore.service.portalcontent.PortalScheduleService;
import com.ams.bomcore.service.portalcontent.PortalFacebookGroupService;
import com.ams.bomcore.service.portalcontent.PortalGroupPostService;
import com.ams.bomcore.service.portalcontent.PortalLazyCreateService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
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
    private final PortalScheduleService schedules;
    private final PortalGroupPostService groupPosts;
    private final PortalLazyCreateService lazyCreate;
    private final PortalFacebookGroupService facebookGroups;

    public PortalContentAdminController(PortalContentService service, PortalContentAccessService access,
                                        PortalScheduleService schedules, PortalGroupPostService groupPosts,
                                        PortalLazyCreateService lazyCreate, PortalFacebookGroupService facebookGroups) {
        this.service = service; this.access = access; this.schedules = schedules; this.groupPosts = groupPosts;
        this.lazyCreate = lazyCreate; this.facebookGroups = facebookGroups;
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

    @GetMapping("/{tenantId}/brands")
    public List<PortalContentService.CodeName> brands(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return service.brands(tenantId);
    }

    @GetMapping("/{tenantId}/catalogs")
    public List<PortalContentService.CodeName> catalogs(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return service.catalogs(tenantId);
    }

    @GetMapping("/{tenantId}/groups")
    public List<PortalContentService.CodeName> groups(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return service.groups(tenantId);
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

    // ---- media (social post) schedules; posted by the legacy Portal dispatcher ----

    @GetMapping("/{tenantId}/schedules")
    public List<PortalScheduleService.ScheduleView> schedules(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return schedules.schedules(tenantId);
    }

    @GetMapping("/{tenantId}/facebook-pages")
    public List<PortalScheduleService.FacebookPage> facebookPages(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return schedules.facebookPages(tenantId);
    }

    @PostMapping("/{tenantId}/schedules")
    public ResponseEntity<List<PortalScheduleService.ScheduleView>> createSchedule(@PathVariable String tenantId,
            @RequestBody PortalScheduleService.ScheduleRequest request, Authentication authentication) {
        access.require(authentication, tenantId);
        String actor = authentication == null ? "admin" : authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED).body(schedules.create(tenantId, request, actor));
    }

    @PostMapping("/{tenantId}/schedules/{id}/cancel")
    public ResponseEntity<Void> cancelSchedule(@PathVariable String tenantId, @PathVariable long id, Authentication authentication) {
        access.require(authentication, tenantId);
        schedules.cancel(tenantId, id);
        return ResponseEntity.noContent().build();
    }

    // ---- Facebook group post campaigns; picked up by the Chrome add-on via legacy /api/ext/queue ----

    @GetMapping("/{tenantId}/group-post/options")
    public PortalGroupPostService.Options groupPostOptions(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return groupPosts.options(tenantId);
    }

    @GetMapping("/{tenantId}/group-post/members")
    public List<PortalGroupPostService.Member> groupPostMembers(@PathVariable String tenantId,
            @RequestParam(value = "groups", required = false) List<String> groups, Authentication authentication) {
        access.require(authentication, tenantId);
        return groupPosts.members(tenantId, groups);
    }

    @PostMapping("/{tenantId}/group-post/preview")
    public List<PortalGroupPostService.PreviewRow> groupPostPreview(@PathVariable String tenantId,
            @RequestBody PortalGroupPostService.PreviewRequest request, Authentication authentication) {
        access.require(authentication, tenantId);
        return groupPosts.preview(tenantId, request);
    }

    /** Store Facebook groups from pasted links (one per line) into a marketing group. */
    @PostMapping("/{tenantId}/group-post/facebook-groups")
    public PortalFacebookGroupService.AddResult groupPostAddFacebookGroups(@PathVariable String tenantId,
            @RequestBody PortalFacebookGroupService.AddRequest request, Authentication authentication) {
        access.require(authentication, tenantId);
        return facebookGroups.add(tenantId, request);
    }

    @GetMapping("/{tenantId}/group-posts")
    public List<PortalGroupPostService.GroupPostView> groupPostList(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return groupPosts.recent(tenantId);
    }

    @PostMapping("/{tenantId}/group-posts")
    public ResponseEntity<PortalGroupPostService.SaveResult> groupPostSave(@PathVariable String tenantId,
            @RequestBody PortalGroupPostService.SaveRequest request, Authentication authentication) {
        access.require(authentication, tenantId);
        String actor = authentication == null ? "admin" : authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED).body(groupPosts.save(tenantId, request, actor));
    }

    @PostMapping("/{tenantId}/group-posts/{id}/cancel")
    public ResponseEntity<Void> groupPostCancel(@PathVariable String tenantId, @PathVariable long id, Authentication authentication) {
        access.require(authentication, tenantId);
        groupPosts.cancel(tenantId, id);
        return ResponseEntity.noContent().build();
    }

    // ---- lazy create: new product + its social posts in one submission (legacy schedule-product page) ----

    /** Next free product code for a name or typed code: checked against existing product codes and links. */
    @GetMapping("/{tenantId}/lazy-create/code")
    public PortalContentService.CodeSuggestion lazyCreateCode(@PathVariable String tenantId,
            @RequestParam("text") String text, Authentication authentication) {
        access.require(authentication, tenantId);
        return service.suggestProductCode(tenantId, text);
    }

    /** TikTok / YouTube / LinkedIn accounts the website has connected in Portal (names only). */
    @GetMapping("/{tenantId}/lazy-create/channels")
    public java.util.Map<String, Object> lazyCreateChannels(@PathVariable String tenantId, Authentication authentication) {
        access.require(authentication, tenantId);
        return lazyCreate.channels(tenantId);
    }

    @PostMapping(value = "/{tenantId}/lazy-create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PortalLazyCreateService.Result> lazyCreate(@PathVariable String tenantId,
            @RequestPart("form") PortalLazyCreateService.Form form,
            @RequestPart(value = "images", required = false) List<MultipartFile> images,
            @RequestPart(value = "thumbnail", required = false) MultipartFile thumbnail,
            @RequestPart(value = "video", required = false) MultipartFile video,
            Authentication authentication) {
        access.require(authentication, tenantId);
        String actor = authentication == null ? "admin" : authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(lazyCreate.create(tenantId, form, images, thumbnail, video, actor));
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
