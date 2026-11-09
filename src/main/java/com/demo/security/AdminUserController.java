package com.demo.security;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;
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

import jakarta.validation.Valid;

@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
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

    // Always return an actionable JSON body, never just the HTTP title
    // "Conflict" or a raw PostgreSQL stack trace.
    private static ResponseEntity<Map<String,Object>> failure(HttpStatus status,
            String code, String message, String field) {
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("status",status.value());
        body.put("code",code);
        body.put("message",message);
        if(field!=null)body.put("field",field);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,Object>> adminUserConflict(ResponseStatusException error) {
        String message=error.getReason()==null?"Không thể lưu tài khoản.":error.getReason();
        HttpStatus status=HttpStatus.resolve(error.getStatusCode().value());
        if(status==null)status=HttpStatus.BAD_REQUEST;
        return failure(status,status==HttpStatus.CONFLICT?"ADMIN_USER_CONFLICT":"ADMIN_USER_ERROR",
                message,message.contains("Email")?"email":null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String,Object>> adminUserDatabaseConflict(DataIntegrityViolationException error) {
        String details="";
        for(Throwable cause=error;cause!=null;cause=cause.getCause()) {
            if(cause.getMessage()!=null)details+=cause.getMessage()+" ";
        }
        if(details.contains("usertb_email_key"))
            return failure(HttpStatus.CONFLICT,"ADMIN_USER_EMAIL_DUPLICATE",
                    "Email này đã tồn tại trên một tài khoản khác. Hãy chọn email khác hoặc sửa tài khoản hiện có.","email");
        if(details.contains("usertb_username_key")||details.contains("uk_usertb_username"))
            return failure(HttpStatus.CONFLICT,"ADMIN_USER_USERNAME_DUPLICATE",
                    "Tên đăng nhập đã tồn tại. Hãy chọn tên khác.","username");
        return failure(HttpStatus.CONFLICT,"ADMIN_USER_DB_CONFLICT",
                "Không lưu được tài khoản vì dữ liệu đã tồn tại hoặc bị ràng buộc. Hãy tải lại danh sách và kiểm tra thông tin.",null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> adminUserInvalidData(IllegalArgumentException error) {
        return failure(HttpStatus.BAD_REQUEST,"ADMIN_USER_VALIDATION",
                error.getMessage()==null?"Thông tin tài khoản không hợp lệ.":error.getMessage(),null);
    }

    public record AssignTenantRequest(String tenantId) {}
}
