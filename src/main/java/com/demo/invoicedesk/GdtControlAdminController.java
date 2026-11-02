package com.demo.invoicedesk;

import java.util.*;
import java.time.Instant;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/admin/gdt-control") @PreAuthorize("hasRole('SUPER_ADMIN')")
public class GdtControlAdminController {
 private final GdtControlService control;private final JdbcTemplate db;
 public GdtControlAdminController(GdtControlService control,JdbcTemplate db){this.control=control;this.db=db;}
 @GetMapping("/defaults") public Object defaults(){return control.defaults();}
 @PutMapping("/defaults") public Object defaults(@RequestBody GdtControlService.Defaults value,Authentication auth){return control.updateDefaults(value,auth.getName());}
 @GetMapping("/tenants/{tenantId}") public Object tenant(@PathVariable UUID tenantId){return control.policy(tenantId);}
 @GetMapping("/tenants/{tenantId}/usage") public Object usage(@PathVariable UUID tenantId){return control.usage(tenantId);}
 @PutMapping("/tenants/{tenantId}") public Object tenant(@PathVariable UUID tenantId,@RequestBody TenantPolicy value,Authentication auth){if(value==null)throw new IllegalArgumentException("Policy is required");if(value.invoiceQuotaMode()!=null&&!Set.of("INVOICE","RUN").contains(value.invoiceQuotaMode().toUpperCase(Locale.ROOT)))throw new IllegalArgumentException("Quota mode must be INVOICE or RUN");validate(value.monthlyRunLimit());validate(value.monthlyInvoiceLimit());validate(value.monthlyOcrLimit());validate(value.dailyOcrLimit());validatePositive(value.maxInvoicesPerJob());validatePositive(value.maxDevices());db.update("""
  INSERT INTO invoice_desk_gdt_policy(tenant_id,trial_ends_at,invoice_quota_mode,monthly_run_limit,monthly_invoice_limit,monthly_ocr_limit,daily_ocr_limit,max_invoices_per_job,max_devices,local_ocr_enabled,online_ocr_enabled,suspended,updated_by)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET trial_ends_at=EXCLUDED.trial_ends_at,invoice_quota_mode=EXCLUDED.invoice_quota_mode,monthly_run_limit=EXCLUDED.monthly_run_limit,monthly_invoice_limit=EXCLUDED.monthly_invoice_limit,
  monthly_ocr_limit=EXCLUDED.monthly_ocr_limit,daily_ocr_limit=EXCLUDED.daily_ocr_limit,max_invoices_per_job=EXCLUDED.max_invoices_per_job,max_devices=EXCLUDED.max_devices,
  local_ocr_enabled=EXCLUDED.local_ocr_enabled,online_ocr_enabled=EXCLUDED.online_ocr_enabled,suspended=EXCLUDED.suspended,updated_at=CURRENT_TIMESTAMP,updated_by=EXCLUDED.updated_by
  """,tenantId,value.trialEndsAt()==null?null:Timestamp.from(value.trialEndsAt()),value.invoiceQuotaMode()==null?null:value.invoiceQuotaMode().toUpperCase(Locale.ROOT),value.monthlyRunLimit(),value.monthlyInvoiceLimit(),value.monthlyOcrLimit(),value.dailyOcrLimit(),value.maxInvoicesPerJob(),value.maxDevices(),value.localOcrEnabled(),value.onlineOcrEnabled(),value.suspended(),auth.getName());return control.policy(tenantId);}
 @GetMapping("/events") public Object events(@RequestParam(required=false) UUID tenantId,@RequestParam(defaultValue="200") int limit){int size=Math.max(1,Math.min(limit,1000));String where=tenantId==null?"":" WHERE tenant_id=?";Object[] args=tenantId==null?new Object[]{size}:new Object[]{tenantId,size};return db.query("SELECT id,tenant_id,company_id,event_type,stage,error_category,http_status,correlation_id,client_version,detail,created_at FROM invoice_desk_gdt_event"+where+" ORDER BY created_at DESC LIMIT ?",(rs,n)->Map.ofEntries(Map.entry("id",rs.getObject(1)),Map.entry("tenantId",rs.getObject(2)),Map.entry("companyId",rs.getObject(3)),Map.entry("eventType",rs.getString(4)),Map.entry("stage",rs.getString(5)),Map.entry("category",rs.getString(6)),Map.entry("httpStatus",Objects.toString(rs.getObject(7),"")),Map.entry("correlationId",rs.getString(8)),Map.entry("clientVersion",rs.getString(9)),Map.entry("detail",rs.getString(10)),Map.entry("createdAt",rs.getObject(11).toString())),args);}
 public record TenantPolicy(Instant trialEndsAt,String invoiceQuotaMode,Integer monthlyRunLimit,Integer monthlyInvoiceLimit,Integer monthlyOcrLimit,Integer dailyOcrLimit,Integer maxInvoicesPerJob,Integer maxDevices,Boolean localOcrEnabled,Boolean onlineOcrEnabled,boolean suspended){}
 private static void validate(Integer value){if(value!=null&&value<0)throw new IllegalArgumentException("Limit cannot be negative");}
 private static void validatePositive(Integer value){if(value!=null&&value<1)throw new IllegalArgumentException("Limit must be positive");}
}
