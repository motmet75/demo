package com.ams.bomcore.audit;

import java.util.*;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.ams.bomcore.domain.user.User;

@RestController
@RequestMapping("/bom/audit")
public class AuditHistoryController {
    private final JdbcTemplate db;
    public AuditHistoryController(JdbcTemplate db) { this.db=db; }
    @GetMapping
    public Map<String,Object> list(Authentication auth,
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            @RequestParam(defaultValue="") String actor,
            @RequestParam(defaultValue="") String table,
            @RequestParam(defaultValue="") String record,
            @RequestParam(required=false) Instant from,
            @RequestParam(required=false) Instant to,
            @RequestParam(required=false) Long before,
            @RequestParam(defaultValue="false") boolean global) {
        boolean superAdmin=auth!=null && auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        boolean admin=auth!=null && auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN"));
        if (!superAdmin && (!admin || !(auth.getPrincipal() instanceof User user)
                || !tenant.toString().equals(user.getAssignedTenantId())
                || (user.getAssignedCompanyId()!=null && !user.getAssignedCompanyId().isBlank() && !company.toString().equals(user.getAssignedCompanyId())))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền xem nhật ký cửa hàng");
        }
        if (global && !superAdmin) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        if (!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM company WHERE id=? AND tenant_id=?)",Boolean.class,company,tenant))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var params=new ArrayList<Object>();
        String scope="(tenant_id=? AND (company_id=? OR company_id IS NULL))";
        params.add(tenant.toString()); params.add(company.toString());
        if(global) scope="("+scope+" OR (tenant_id IS NULL AND company_id IS NULL))";
        var sql=new StringBuilder("SELECT * FROM app_record_audit WHERE "+scope);
        if(!actor.isBlank()) { sql.append(" AND actor=?"); params.add(actor.trim()); }
        if(!table.isBlank()) { sql.append(" AND table_name=?"); params.add(table.trim()); }
        if(!record.isBlank()) { sql.append(" AND record_id=?"); params.add(record.trim()); }
        if(from!=null) { sql.append(" AND occurred_at>=?"); params.add(java.sql.Timestamp.from(from)); }
        if(to!=null) { sql.append(" AND occurred_at<?"); params.add(java.sql.Timestamp.from(to)); }
        if(before!=null) { sql.append(" AND id<?"); params.add(before); }
        sql.append(" ORDER BY id DESC LIMIT 101");
        var rows=db.queryForList(sql.toString(),params.toArray());
        boolean more=rows.size()>100;
        if(more) rows=new ArrayList<>(rows.subList(0,100));
        // JDBC jsonb/array objects are converted explicitly for a stable response.
        for(var row:rows) {
            for(String key:List.of("before_data","after_data")) if(row.get(key)!=null) row.put(key,row.get(key).toString());
            Object fields=row.get("changed_fields");
            if(fields instanceof java.sql.Array array) try { row.put("changed_fields",array.getArray()); } catch(java.sql.SQLException e) { throw new IllegalStateException(e); }
        }
        var result=new LinkedHashMap<String,Object>();result.put("rows",rows);result.put("hasMore",more);
        result.put("nextBefore",more?rows.get(rows.size()-1).get("id"):null);
        return result;
    }
}
