package com.ams.bomcore.controller.inventory;

import com.ams.bomcore.service.inventory.CustomsDeclarationStockService;
import com.ams.bomcore.service.inventory.InvoiceStockOutService;
import com.demo.invoicedesk.InvoiceDeskService.Scope;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/bom/inventory/customs-declaration")
public class CustomsDeclarationStockController {
    private final CustomsDeclarationStockService customs;
    private final InvoiceStockOutService scopeService;
    public CustomsDeclarationStockController(CustomsDeclarationStockService customs,
                                             InvoiceStockOutService scopeService) {
        this.customs=customs;this.scopeService=scopeService;
    }
    private Scope allowed(UUID tenant,UUID company,Authentication auth) {
        if(auth==null||!auth.isAuthenticated()||auth.getAuthorities().stream()
                .noneMatch(a->List.of("ROLE_ADMIN","ROLE_SUPER_ADMIN","ROLE_USER")
                    .contains(a.getAuthority())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền quản lý kho HQ.");
        return scopeService.scope(auth,tenant,company);
    }
    @PostMapping(value="/upload",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> upload(@RequestParam("file") MultipartFile file,
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth)throws Exception {
        return customs.upload(allowed(tenant,company,auth),file);
    }
    @GetMapping("/{id}")
    public Map<String,Object> document(@PathVariable UUID id,
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth) {
        return customs.document(allowed(tenant,company,auth),id);
    }
    @GetMapping("/history")
    public List<Map<String,Object>> history(
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth) {
        return customs.history(allowed(tenant,company,auth));
    }
    @PostMapping(value="/confirm",consumes=MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> confirm(@RequestBody CustomsDeclarationStockService.Confirm request,
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth) {
        return customs.confirm(allowed(tenant,company,auth),request);
    }

    // Spring may otherwise serialize a 409 with only a generic "Conflict" title.
    // Keep the Vietnamese explanation visible to the customs confirmation screen.
    private static ResponseEntity<Map<String,Object>> failure(HttpStatusCode status,
            String code, String detail) {
        Map<String,Object> body = new LinkedHashMap<>();
        body.put("status", status.value());
        body.put("code", code);
        body.put("error", code);
        body.put("message", detail);
        body.put("detail", detail);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,Object>> explainStatus(ResponseStatusException error) {
        String reason = error.getReason();
        if (reason == null || reason.isBlank()) {
            reason = "Không thể xử lý tờ khai; kiểm tra dữ liệu và tải lại chứng từ.";
        }
        String code = error.getStatusCode().value() == 409
                ? "CUSTOMS_CONFLICT" : "CUSTOMS_VALIDATION";
        return failure(error.getStatusCode(), code, reason);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> explainInvalidInput(IllegalArgumentException error) {
        return failure(HttpStatus.BAD_REQUEST, "CUSTOMS_VALIDATION",
                error.getMessage() == null ? "Dữ liệu tờ khai không hợp lệ." : error.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String,Object>> explainDbConflict(DataIntegrityViolationException error) {
        String constraint = constraintName(error);
        String detail;
        if ("inventory_customs_declaration_posted_uniq".equals(constraint)) {
            detail = "Số tờ khai này đã được xác nhận nhập/xuất kho trong công ty. " +
                    "Mở lịch sử tờ khai để kiểm tra chứng từ đã ghi; không ghi kho lần thứ hai.";
        } else if ("uq_material_tenant_company_code_ci".equals(constraint)
                || (constraint != null && constraint.contains("material") && constraint.contains("code"))) {
            detail = "Mã nguyên vật liệu mới bị trùng (không phân biệt chữ hoa/thường) với " +
                    "Materials hiện có. Tải lại danh sách, chọn mã có sẵn hoặc sinh mã mới rồi xác nhận.";
        } else if (constraint != null && constraint.contains("inventory_customs_declaration_line")
                && (constraint.contains("line_index") || constraint.contains("key"))) {
            detail = "Một dòng tờ khai đã được ghi nhận trước đó. " +
                    "Tải lại lịch sử tờ khai và kiểm tra trạng thái đã ghi kho.";
        } else if (constraint != null && constraint.startsWith("inventory_")
                && (constraint.contains("batch") || constraint.contains("warehouse"))) {
            detail = "Xung đột tồn kho: mã vật tư, kho và số lô đang có bản ghi khác. " +
                    "Tải lại tồn kho và kiểm tra lô trước khi xác nhận.";
        } else if (constraint != null && constraint.endsWith("_fkey")) {
            detail = "Dữ liệu tham chiếu không còn hợp lệ (vật tư, kho hoặc lô tồn kho có thể đã thay đổi). " +
                    "Tải lại dữ liệu và chọn lại dòng tương ứng.";
        } else {
            detail = "Xung đột dữ liệu khi ghi tờ khai. Không ghi kho được. " +
                    "Hãy tải lại dữ liệu và kiểm tra các mã vật tư, kho, số lô.";
            if (constraint != null) detail += " Mã ràng buộc: " + constraint + ".";
        }
        return failure(HttpStatus.CONFLICT, "CUSTOMS_DB_CONFLICT", detail);
    }

    private static String constraintName(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            String message = cause.getMessage();
            if (message == null) continue;
            int start = message.indexOf("constraint \\"");
            if (start < 0) continue;
            start += "constraint \\"".length();
            int end = message.indexOf('"', start);
            if (end > start) return message.substring(start, end);
        }
        return null;
    }

}
