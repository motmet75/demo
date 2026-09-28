package com.ams.bomcore.controller.shop;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/shop/staff/order-templates")
public class ShopOrderTemplateController {
    private final JdbcTemplate db;
    private final ObjectMapper json = new ObjectMapper();

    public ShopOrderTemplateController(JdbcTemplate db) {
        this.db = db;
    }

    private void scope(UUID tenantId, UUID companyId) {
        Boolean valid = db.queryForObject("SELECT EXISTS(SELECT 1 FROM company WHERE id=? AND tenant_id=?)",
                Boolean.class, companyId, tenantId);
        if (!Boolean.TRUE.equals(valid)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cửa hàng không hợp lệ");
    }

    private String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private String encode(Object value) {
        try { return json.writeValueAsString(value); }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dữ liệu món trong mẫu không hợp lệ"); }
    }
    private Object decode(Object value) {
        try { return json.readValue(String.valueOf(value), Object.class); }
        catch (Exception e) { return List.of(); }
    }

    @GetMapping
    public List<Map<String,Object>> list(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                         @RequestHeader("X-Company-Id") UUID companyId) {
        scope(tenantId, companyId);
        var rows = db.queryForList("""
                SELECT id,template_name,customer_name,customer_phone,order_notes,items::text items_json,
                       created_by,updated_by,created_at,updated_at
                FROM shop_order_template WHERE tenant_id=? AND company_id=?
                ORDER BY updated_at DESC,template_name
                """, tenantId, companyId);
        rows.forEach(row -> {
            row.put("items", decode(row.remove("items_json")));
            row.put("templateName", row.remove("template_name"));
            row.put("customerName", row.remove("customer_name"));
            row.put("customerPhone", row.remove("customer_phone"));
            row.put("orderNotes", row.remove("order_notes"));
        });
        return rows;
    }

    @PostMapping
    @Transactional
    public Map<String,Object> save(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                   @RequestHeader("X-Company-Id") UUID companyId,
                                   Authentication authentication,
                                   @RequestBody Map<String,Object> body) {
        scope(tenantId, companyId);
        db.queryForList("SELECT id FROM company WHERE id=? AND tenant_id=? FOR UPDATE", companyId, tenantId);
        String name = text(body.get("templateName"));
        if (name.isEmpty() || name.length() > 160) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên mẫu là bắt buộc và tối đa 160 ký tự");
        if (!(body.get("items") instanceof List<?> items) || items.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mẫu cần ít nhất một món");
        String username = authentication == null ? "system" : authentication.getName();
        var existing = db.queryForList("SELECT id FROM shop_order_template WHERE tenant_id=? AND company_id=? AND lower(template_name)=lower(?)",
                tenantId, companyId, name);
        UUID id;
        if (existing.isEmpty()) {
            id = UUID.randomUUID();
            db.update("""
                    INSERT INTO shop_order_template
                    (id,tenant_id,company_id,template_name,customer_name,customer_phone,order_notes,items,created_by,updated_by)
                    VALUES(?,?,?,?,?,?,?,?::jsonb,?,?)
                    """, id, tenantId, companyId, name, text(body.get("customerName")), text(body.get("customerPhone")),
                    text(body.get("orderNotes")), encode(items), username, username);
        } else {
            id = (UUID) existing.get(0).get("id");
            db.update("""
                    UPDATE shop_order_template SET template_name=?,customer_name=?,customer_phone=?,order_notes=?,
                    items=?::jsonb,updated_by=?,updated_at=now() WHERE id=? AND tenant_id=? AND company_id=?
                    """, name, text(body.get("customerName")), text(body.get("customerPhone")), text(body.get("orderNotes")),
                    encode(items), username, id, tenantId, companyId);
        }
        return Map.of("id", id, "templateName", name, "saved", true);
    }

    @DeleteMapping("/{id}")
    public Map<String,Object> delete(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                     @RequestHeader("X-Company-Id") UUID companyId,
                                     @PathVariable UUID id) {
        scope(tenantId, companyId);
        int deleted = db.update("DELETE FROM shop_order_template WHERE id=? AND tenant_id=? AND company_id=?", id, tenantId, companyId);
        if (deleted == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mẫu");
        return Map.of("deleted", true);
    }
}
