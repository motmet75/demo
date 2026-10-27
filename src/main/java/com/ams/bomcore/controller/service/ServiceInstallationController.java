package com.ams.bomcore.controller.service;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/bom/service-installations")
@CrossOrigin(origins = "http://localhost:5173")
public class ServiceInstallationController {
    private final JdbcTemplate db;
    public ServiceInstallationController(JdbcTemplate db){this.db=db;}
    private UUID context(UUID v,String h){try{return h!=null&&!h.isBlank()?UUID.fromString(h):v;}catch(Exception e){return v;}}
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String,Object> body,@RequestParam(required=false) UUID tenantId,@RequestParam(required=false) UUID companyId,
      @RequestHeader(value="X-Tenant-Id",required=false) String ht,@RequestHeader(value="X-Company-Id",required=false) String hc){
        tenantId=context(tenantId,ht);companyId=context(companyId,hc);if(tenantId==null||companyId==null)return ResponseEntity.badRequest().body(Map.of("error","tenantId and companyId are required"));
        UUID orderId=uuid(body,"orderId"), bomId=uuid(body,"serviceBomId");String address=text(body,"deploymentAddress");if(orderId==null||bomId==null||address==null||address.isBlank())return ResponseEntity.badRequest().body(Map.of("error","orderId, serviceBomId and deploymentAddress are required"));
        UUID id=UUID.randomUUID();boolean overnight=Boolean.parseBoolean(String.valueOf(body.getOrDefault("overnight",false)));BigDecimal nights=decimal(body,"overnightNights",BigDecimal.ZERO);
        db.update("INSERT INTO service_installation(id,order_id,service_bom_id,tenant_id,company_id,deployment_address,contact_name,contact_phone,planned_start_date,planned_end_date,overnight,overnight_nights,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET service_bom_id=EXCLUDED.service_bom_id,deployment_address=EXCLUDED.deployment_address,contact_name=EXCLUDED.contact_name,contact_phone=EXCLUDED.contact_phone,planned_start_date=EXCLUDED.planned_start_date,planned_end_date=EXCLUDED.planned_end_date,overnight=EXCLUDED.overnight,overnight_nights=EXCLUDED.overnight_nights,notes=EXCLUDED.notes,updated_at=now()",id,orderId,bomId,tenantId,companyId,address,text(body,"contactName"),text(body,"contactPhone"),body.get("plannedStartDate"),body.get("plannedEndDate"),overnight,nights,text(body,"notes"));
        db.update("DELETE FROM service_installation_cost WHERE installation_id=?",id);
        List<?> raw=body.get("costs") instanceof List<?> ? (List<?>)body.get("costs") : List.of();BigDecimal total=BigDecimal.ZERO;
        for(Object x:raw){if(!(x instanceof Map<?,?> row))continue;String type=String.valueOf(row.get("costType")), desc=String.valueOf(row.get("description"));BigDecimal qty=decimal(row,"quantity",BigDecimal.ONE), price=decimal(row,"unitCost",BigDecimal.ZERO);Object unit=row.get("unit");db.update("INSERT INTO service_installation_cost(installation_id,cost_type,description,quantity,unit,unit_cost) VALUES(?,?,?,?,?,?)",id,type,desc,qty,unit==null?"job":String.valueOf(unit),price);total=total.add(qty.multiply(price));}
        db.update("UPDATE service_installation SET total_service_cost=?,updated_at=now() WHERE id=?",total,id);
        return ResponseEntity.ok(Map.of("id",id,"orderId",orderId,"totalServiceCost",total,"overnight",overnight,"overnightNights",nights));
    }
    @GetMapping("/order/{orderId}")
    public ResponseEntity<?> get(@PathVariable UUID orderId,@RequestParam(required=false) UUID tenantId,@RequestParam(required=false) UUID companyId,@RequestHeader(value="X-Tenant-Id",required=false) String ht,@RequestHeader(value="X-Company-Id",required=false) String hc){tenantId=context(tenantId,ht);companyId=context(companyId,hc);if(tenantId==null||companyId==null)return ResponseEntity.badRequest().body(Map.of("error","tenantId and companyId are required"));List<Map<String,Object>> rows=db.queryForList("SELECT * FROM service_installation WHERE order_id=? AND tenant_id=? AND company_id=?",orderId,tenantId,companyId);if(rows.isEmpty())return ResponseEntity.notFound().build();Map<String,Object> result=new LinkedHashMap<>(rows.get(0));result.put("costs",db.queryForList("SELECT * FROM service_installation_cost WHERE installation_id=? ORDER BY cost_type",result.get("id")));return ResponseEntity.ok(result);}
    private static String text(Map<String,Object> m,String k){return m.get(k)==null?null:String.valueOf(m.get(k));} private static UUID uuid(Map<String,Object> m,String k){try{return m.get(k)==null?null:UUID.fromString(String.valueOf(m.get(k)));}catch(Exception e){return null;}} private static BigDecimal decimal(Map<?,?> m,String k,BigDecimal d){try{return m.get(k)==null?d:new BigDecimal(String.valueOf(m.get(k)));}catch(Exception e){return d;}}
}
