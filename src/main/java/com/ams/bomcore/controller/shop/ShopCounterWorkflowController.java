package com.ams.bomcore.controller.shop;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** Counter writes are append-only, tenant scoped and serialized against shift closure. */
@RestController
@RequestMapping("/shop/staff/counter/workflow")
public class ShopCounterWorkflowController {
    private final JdbcTemplate db;
    private final ShopCounterOpsController reports;
    private final ObjectMapper json = new ObjectMapper();
    public ShopCounterWorkflowController(JdbcTemplate db, ShopCounterOpsController reports) { this.db=db; this.reports=reports; }
    @ExceptionHandler(ResponseStatusException.class)
    public org.springframework.http.ResponseEntity<?> validation(ResponseStatusException e) {
        return org.springframework.http.ResponseEntity.status(e.getStatusCode()).body(Map.of("message",Objects.requireNonNullElse(e.getReason(),"Dữ liệu không hợp lệ")));
    }
    private void require(boolean ok, String message) { if (!ok) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private BigDecimal n(Object v) { try { return new BigDecimal(String.valueOf(v)); } catch(Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số không hợp lệ"); } }
    private String s(Object v) { return v == null ? "" : v.toString().trim(); }
    private String encode(Object v) { try { return json.writeValueAsString(v); } catch(Exception e) { throw new IllegalArgumentException(e); } }
    private void scope(UUID t, UUID c) {
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.getPrincipal() instanceof com.ams.bomcore.domain.user.User user && auth.getAuthorities().stream().noneMatch(a->a.getAuthority().equals("ROLE_SUPER_ADMIN"))) {
            require(t.toString().equals(user.getAssignedTenantId()),"Không có quyền truy cập tenant");
            require(user.getAssignedCompanyId()==null || user.getAssignedCompanyId().isBlank() || c.toString().equals(user.getAssignedCompanyId()),"Không có quyền truy cập cửa hàng");
        }
        require(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM company WHERE id=? AND tenant_id=?)", Boolean.class,c,t)), "Cửa hàng không hợp lệ"); }
    private void lock(UUID t, UUID c) { scope(t,c); db.queryForList("SELECT id FROM company WHERE id=? AND tenant_id=? FOR UPDATE",c,t); }
    private List<Map<String,Object>> active(UUID t, UUID c) { return db.queryForList("SELECT * FROM shop_counter_shift WHERE tenant_id=? AND company_id=? AND status='OPEN'",t,c); }
    private Map<String,Object> opened(UUID t, UUID c) { var a=active(t,c); require(!a.isEmpty(), "Cần mở ca trước khi ghi nhận"); return a.get(0); }
    private Object previousCash(UUID t, UUID c) {
        var rows=db.queryForList("SELECT actual_cash FROM shop_counter_shift WHERE tenant_id=? AND company_id=? AND status='CLOSED' ORDER BY closed_at DESC LIMIT 1",t,c);
        if(rows.isEmpty()) rows=db.queryForList("SELECT actual_cash FROM shop_shift_handover WHERE tenant_id=? AND company_id=? ORDER BY closed_at DESC NULLS LAST, created_at DESC LIMIT 1",t,c);
        return rows.isEmpty()?null:rows.get(0).get("actual_cash");
    }
    private Object previousBank(UUID t, UUID c) {
        var rows=db.queryForList("SELECT actual_bank FROM shop_counter_shift WHERE tenant_id=? AND company_id=? AND status='CLOSED' ORDER BY closed_at DESC LIMIT 1",t,c);
        return rows.isEmpty()?null:rows.get(0).get("actual_bank");
    }
    private String nextHandoverUser(UUID t, UUID c) {
        var rows=db.queryForList("SELECT handover_to FROM shop_counter_shift WHERE tenant_id=? AND company_id=? AND status='CLOSED' ORDER BY closed_at DESC LIMIT 1",t,c);
        return rows.isEmpty()?"":s(rows.get(0).get("handover_to"));
    }
    private LocalDate operationalShiftDate(ZonedDateTime now) {
        return now.getHour() >= 22 ? now.toLocalDate().plusDays(1) : now.toLocalDate();
    }
    @GetMapping
    public Map<String,Object> state(@RequestHeader("X-Tenant-Id") UUID t, @RequestHeader("X-Company-Id") UUID c, Authentication auth) {
        scope(t,c); var result=new LinkedHashMap<String,Object>(); var a=active(t,c);
        result.put("active",a.isEmpty()?null:a.get(0)); result.put("previousCash",previousCash(t,c)); result.put("previousBank",previousBank(t,c));
        var now=ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        var shiftDate=operationalShiftDate(now);
        String handoverUser=nextHandoverUser(t,c);
        result.put("shiftDate",shiftDate.toString());
        result.put("suggestedShift",now.getHour()>=22 || now.getHour()<14?1:2);
        result.put("nextHandoverTo",handoverUser);
        result.put("canOpen",handoverUser.isEmpty() || (auth!=null && handoverUser.equalsIgnoreCase(auth.getName())));
        result.put("schedule",List.of(Map.of("number",1,"name","Ca 1 · 06:00–14:00"),Map.of("number",2,"name","Ca 2 · 14:00–22:00")));
        result.put("usedShifts",db.queryForList("SELECT shift_number FROM shop_counter_shift WHERE tenant_id=? AND company_id=? AND shift_date=? AND shift_number IS NOT NULL",Integer.class,t,c,java.sql.Date.valueOf(shiftDate)));
        var history=db.queryForList("SELECT * FROM shop_counter_shift WHERE tenant_id=? AND company_id=? ORDER BY opened_at DESC LIMIT 20",t,c);
        for(var h:history) for(String key:List.of("summary","inventory_counts")) {
            if(h.get(key)!=null) try { h.put(key,json.readValue(h.get(key).toString(),Object.class)); } catch(Exception e) { throw new IllegalStateException("Cannot read saved handover",e); }
        }
        result.put("history",history);
        return result;
    }
    @GetMapping("/users")
    public List<Map<String,Object>> handoverUsers(@RequestHeader("X-Tenant-Id") UUID t,
                                                   @RequestHeader("X-Company-Id") UUID c,
                                                   Authentication auth) {
        scope(t,c);
        var rows=db.queryForList("""
                SELECT username, firstname, lastname, email
                FROM usertb
                WHERE isenabled=true
                  AND assigned_tenant_id=? AND assigned_company_id=?
                  AND EXISTS (SELECT 1 FROM authorities a WHERE upper(a.username)=upper(usertb.username)
                              AND a.authority='ROLE_COUNTER')
                ORDER BY firstname,lastname,username
                """,t.toString(),c.toString());
        return rows.stream().map(row -> {
            Map<String,Object> user=new LinkedHashMap<>();
            user.put("username",row.get("username"));
            user.put("firstName",row.get("firstname"));
            user.put("lastName",row.get("lastname"));
            user.put("email",row.get("email"));
            return user;
        }).toList();
    }
    @PostMapping("/open") @Transactional
    public Map<String,Object> open(@RequestHeader("X-Tenant-Id") UUID t, @RequestHeader("X-Company-Id") UUID c, Authentication auth, @RequestBody Map<String,Object> body) {
        lock(t,c); require(active(t,c).isEmpty(),"Đã có ca đang mở");
        var today=operationalShiftDate(ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        require(today.toString().equals(s(body.get("shiftDate"))),"Ngày làm việc đã thay đổi, tải lại trước khi mở ca");
        String handoverUser=nextHandoverUser(t,c);
        require(handoverUser.isEmpty() || handoverUser.equalsIgnoreCase(auth.getName()),"Ca đã bàn giao cho "+handoverUser+"; tài khoản này phải đăng nhập để mở ca tiếp theo");
        String slot=s(body.get("shiftNumber"));
        require(slot.equals("1") || slot.equals("2"),"Chọn ca 1 (06:00–14:00) hoặc ca 2 (14:00–22:00)");
        int shiftNumber=Integer.parseInt(slot);
        require(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM shop_counter_shift WHERE tenant_id=? AND company_id=? AND shift_date=? AND shift_number=?)",Boolean.class,t,c,java.sql.Date.valueOf(today),shiftNumber)),"Ca này đã được mở trong ngày; không thể mở lại ca đã khóa");
        BigDecimal cash=n(body.get("openingCash")); require(cash.signum()>=0,"Tiền đầu ca không được âm");
        BigDecimal bank=n(body.get("openingBank")); require(bank.signum()>=0,"Số dư ngân hàng đầu ca không được âm");
        Object prev=previousCash(t,c), prevBank=previousBank(t,c); String reason=s(body.get("reason"));
        if(prev==null || prevBank==null || cash.compareTo(n(prev))!=0 || bank.compareTo(n(prevBank))!=0) require(!reason.isEmpty() && Boolean.TRUE.equals(body.get("confirmed")),"Nhập lý do và xác nhận lại số dư đầu ca khác bàn giao / khởi tạo lần đầu");
        UUID id=UUID.randomUUID();
        db.update("INSERT INTO shop_counter_shift(id,tenant_id,company_id,shift_date,shift_number,shift_name,opened_by,previous_cash,opening_cash,previous_bank,opening_bank,opening_reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",id,t,c,java.sql.Date.valueOf(today),shiftNumber,shiftNumber==1?"Ca 1 · 06:00–14:00":"Ca 2 · 14:00–22:00",auth.getName(),prev,cash,prevBank,bank,reason);
        return state(t,c,auth);
    }
    @GetMapping("/stock")
    public List<Map<String,Object>> stock(@RequestHeader("X-Tenant-Id") UUID t, @RequestHeader("X-Company-Id") UUID c) {
        scope(t,c);
        return db.queryForList("""
            SELECT i.id, i.material_id, i.warehouse_id, i.batch_no, i.quantity_on_hand, i.quantity_reserved,
             i.quantity_locked, i.unit, i.unit_price, i.warehouse_import_unit, i.bom_unit_per_warehouse_unit,
             i.warehouse_import_unit_price, i.updated_at, m.material_code, m.material_name, m.thumbnail_url,
             m.manual_shift_consumption, w.code warehouse_code, w.name warehouse_name
            FROM inventory i JOIN material m ON m.id=i.material_id JOIN warehouse w ON w.id=i.warehouse_id
            WHERE i.tenant_id=? AND i.company_id=? AND COALESCE(i.locked,false)=false
            ORDER BY m.material_code, w.code, i.batch_no
            """,t,c);
    }
    @PostMapping("/movement") @Transactional
    public Map<String,Object> movement(@RequestHeader("X-Tenant-Id") UUID t, @RequestHeader("X-Company-Id") UUID c, Authentication auth, @RequestBody Map<String,Object> body) {
        lock(t,c);
        var shift=opened(t,c);
        require(s(shift.get("id")).equals(s(body.get("shiftId"))),"Ca đã thay đổi, tải lại trước khi ghi nhận");
        return applyMovement(t, c, auth, shift, body);
    }

    @PostMapping("/movements") @Transactional
    public Map<String,Object> movements(@RequestHeader("X-Tenant-Id") UUID t,
                                        @RequestHeader("X-Company-Id") UUID c,
                                        Authentication auth,
                                        @RequestBody Map<String,Object> body) {
        lock(t,c);
        var shift=opened(t,c);
        require(s(shift.get("id")).equals(s(body.get("shiftId"))),"Ca đã thay đổi, tải lại trước khi ghi nhận");
        require(body.get("rows") instanceof List<?>, "Danh sách dòng nhập / xuất là bắt buộc");
        List<?> rows = (List<?>) body.get("rows");
        require(!rows.isEmpty() && rows.size() <= 100, "Nhập từ 1 đến 100 dòng mỗi phiếu");
        String type = s(body.get("type"));
        require(Set.of("IN","OUT","ADJUSTMENT").contains(type),"Loại phiếu không hợp lệ");
        List<Map<String,Object>> saved = new ArrayList<>();
        for (Object raw : rows) {
            require(raw instanceof Map<?,?>, "Dòng nhập / xuất không hợp lệ");
            Map<String,Object> row = new LinkedHashMap<>();
            ((Map<?,?>) raw).forEach((key, value) -> row.put(String.valueOf(key), value));
            row.put("type", type);
            row.put("shiftId", shift.get("id"));
            saved.add(applyMovement(t, c, auth, shift, row));
        }
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("saved", saved.size());
        result.put("rows", saved);
        if (body.get("financialNote") instanceof Map<?,?> rawNote) {
            Map<String,Object> note = new LinkedHashMap<>();
            rawNote.forEach((key, value) -> note.put(String.valueOf(key), value));
            result.put("financialNote", createMovementFinancialNote(t, c, auth, type, saved, note));
        }
        return result;
    }

    private Map<String,Object> createMovementFinancialNote(UUID t, UUID c, Authentication auth,
                                                            String movementType, List<Map<String,Object>> movements,
                                                            Map<String,Object> body) {
        String noteType = s(body.get("noteType")).toUpperCase(Locale.ROOT);
        String expectedType = movementType.equals("IN") ? "EXPENSE" : movementType.equals("OUT") ? "RECEIPT" : "";
        require(!expectedType.isEmpty() && expectedType.equals(noteType),
                "Phiếu nhập chỉ tạo phiếu chi; phiếu xuất chỉ tạo phiếu thu");
        String method = s(body.get("paymentMethod")).toUpperCase(Locale.ROOT);
        require(Set.of("CASH", "BANK_QR", "UNPAID", "BANK_LATER").contains(method), "Chọn hình thức thanh toán hợp lệ");
        BigDecimal amount = n(body.get("amount"));
        require(amount.signum() > 0, "Số tiền phiếu thu / chi phải lớn hơn 0");
        String reason = s(body.get("reason"));
        require(!reason.isEmpty(), "Nhập nội dung phiếu thu / chi");
        require(reason.length() <= 500, "Nội dung phiếu thu / chi tối đa 500 ký tự");

        UUID movementId = UUID.fromString(s(movements.get(0).get("id")));
        var existing = db.queryForList("""
                SELECT id,note_number,note_type,amount FROM shop_payment_note
                WHERE tenant_id=? AND company_id=? AND inventory_movement_id=?
                """, t, c, movementId);
        if (!existing.isEmpty()) {
            var row = existing.get(0);
            return Map.of("id", row.get("id"), "noteNumber", row.get("note_number"),
                    "noteType", row.get("note_type"), "amount", row.get("amount"));
        }
        Long count = db.queryForObject("""
                SELECT COUNT(*) FROM shop_payment_note
                WHERE tenant_id=? AND company_id=? AND COALESCE(note_type, 'EXPENSE')=?
                """, Long.class, t, c, noteType);
        String prefix = noteType.equals("RECEIPT") ? "PT" : "PC";
        String number = prefix + String.format("%06d", (count == null ? 0 : count) + 1);
        UUID id = UUID.randomUUID();
        db.update("""
                INSERT INTO shop_payment_note
                (id,tenant_id,company_id,note_number,note_date,object_name,recipient_name,reason,amount,
                 payment_method,note_type,inventory_movement_id,created_by,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,now(),now())
                """, id, t, c, number, java.sql.Date.valueOf(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))),
                s(body.get("objectName")), s(body.get("recipientName")), reason, amount, method, noteType,
                movementId, auth.getName());
        return Map.of("id", id, "noteNumber", number, "noteType", noteType, "amount", amount);
    }

    private Map<String,Object> applyMovement(UUID t, UUID c, Authentication auth,
                                             Map<String,Object> shift, Map<String,Object> body) {
        UUID requestId=UUID.fromString(s(body.get("requestId")));
        var duplicate=db.queryForList("SELECT id FROM inventory_movement WHERE id=? AND tenant_id=? AND company_id=?",requestId,t,c);
        if(!duplicate.isEmpty()) return Map.of("id",requestId,"alreadySaved",true);
        String type=s(body.get("type")); require(Set.of("IN","OUT","ADJUSTMENT").contains(type),"Loại phiếu không hợp lệ");
        boolean createBatch=type.equals("IN") && Boolean.TRUE.equals(body.get("createBatch"));
        UUID inventoryId;
        boolean createdBatch=false;
        if(createBatch) {
            UUID templateInventoryId=UUID.fromString(s(body.get("inventoryId")));
            UUID materialId=UUID.fromString(s(body.get("materialId")));
            UUID warehouseId=UUID.fromString(s(body.get("warehouseId")));
            String batchNo=s(body.get("batchNo"));
            require(!batchNo.isEmpty(),"Nhập số lô mới");
            require(batchNo.length()<=255,"Số lô tối đa 255 ký tự");
            var existing=db.queryForList("""
                SELECT id FROM inventory
                WHERE tenant_id=? AND company_id=? AND material_id=? AND warehouse_id=? AND batch_no=?
                FOR UPDATE
                """,t,c,materialId,warehouseId,batchNo);
            if(!existing.isEmpty()) {
                inventoryId=(UUID)existing.get(0).get("id");
            } else {
                inventoryId=UUID.randomUUID();
                int inserted=db.update("""
                    INSERT INTO inventory
                    (id,tenant_id,company_id,material_id,warehouse_id,material_code,warehouse_code,batch_no,
                     user_name,unit,unit_price,currency,warehouse_import_unit,warehouse_import_quantity,
                     bom_unit_per_warehouse_unit,warehouse_import_unit_price,quantity_on_hand,quantity_total,
                     quantity_reserved,quantity_locked,visible,approved,locked,created_at,updated_at)
                    SELECT ?,?,?,source.material_id,?,source.material_code,w.code,?,?,source.unit,
                           source.unit_price,source.currency,source.warehouse_import_unit,0,
                           source.bom_unit_per_warehouse_unit,source.warehouse_import_unit_price,
                           0,0,0,0,true,false,false,now(),now()
                    FROM inventory source
                    JOIN warehouse w ON w.id=? AND w.tenant_id=? AND w.company_id=?
                    WHERE source.id=? AND source.tenant_id=? AND source.company_id=? AND source.material_id=?
                    """,inventoryId,t,c,warehouseId,batchNo,auth.getName(),warehouseId,t,c,
                    templateInventoryId,t,c,materialId);
                require(inserted==1,"Không thể tạo lô mới từ cấu hình vật tư đã chọn");
                createdBatch=true;
            }
        } else {
            inventoryId=UUID.fromString(s(body.get("inventoryId")));
        }
        var rows=db.queryForList("SELECT * FROM inventory WHERE id=? AND tenant_id=? AND company_id=? FOR UPDATE",inventoryId,t,c);
        require(rows.size()==1,"Không tìm thấy tồn kho"); var inv=rows.get(0);
        require(!Boolean.TRUE.equals(inv.get("locked")),"Tồn kho đã khóa");
        String reason=s(body.get("reason")); require(reason.length()<=100,"Lý do tối đa 100 ký tự");
        if(type.equals("ADJUSTMENT")) require(!reason.isEmpty(),"Điều chỉnh bắt buộc có lý do");
        BigDecimal quantity=n(body.get("quantity")); require(type.equals("ADJUSTMENT")?quantity.signum()!=0:quantity.signum()>0,"Số lượng không hợp lệ");
        String unit=s(body.get("unit")); BigDecimal factor=BigDecimal.ONE;
        if(!unit.equals(s(inv.get("unit")))) {
            require(unit.equals(s(inv.get("warehouse_import_unit"))),"Chọn đơn vị kho hoặc đơn vị quy đổi đã cấu hình");
            factor=n(inv.get("bom_unit_per_warehouse_unit")); require(factor.signum()>0,"Chưa cấu hình quy đổi đơn vị");
        }
        BigDecimal price=n(body.get("unitPrice")); require(price.signum()>=0,"Đơn giá không được âm");
        BigDecimal delta=quantity.multiply(factor); if(type.equals("OUT")) delta=delta.negate();
        BigDecimal next=n(inv.get("quantity_on_hand")).add(delta);
        BigDecimal protectedQty=n(inv.getOrDefault("quantity_reserved",BigDecimal.ZERO)==null?0:inv.get("quantity_reserved")).add(n(inv.get("quantity_locked")==null?0:inv.get("quantity_locked")));
        require(next.signum()>=0 && (delta.signum()>0 || next.compareTo(protectedQty)>=0),"Không đủ tồn khả dụng");
        if(createdBatch) {
            db.update("UPDATE inventory SET quantity_on_hand=?, quantity_total=?, warehouse_import_quantity=?, updated_at=now() WHERE id=?",
                    next,next,unit.equals(s(inv.get("warehouse_import_unit")))?quantity:null,inventoryId);
        } else {
            db.update("UPDATE inventory SET quantity_on_hand=?, updated_at=now() WHERE id=?",next,inventoryId);
        }
        UUID id=requestId;
        db.update("""
            INSERT INTO inventory_movement(id,tenant_id,company_id,material_id,from_warehouse_id,to_warehouse_id,
            quantity,unit,movement_type,reason,inventory_id,batch_no,status,created_at,created_by,unit_price,entered_quantity,entered_unit,shift_id)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'COMPLETED',now(),?,?,?,?,?)
            """,id,t,c,inv.get("material_id"),delta.signum()<0?inv.get("warehouse_id"):null,delta.signum()>0?inv.get("warehouse_id"):null,
            delta,inv.get("unit"),type,reason,inventoryId,inv.get("batch_no"),auth.getName(),price,quantity,unit,shift.get("id"));
        return Map.of("id",id,"quantityOnHand",next,"createdBatch",createdBatch,"batchNo",s(inv.get("batch_no")));
    }
    @PostMapping("/close") @Transactional
    public Map<String,Object> close(@RequestHeader("X-Tenant-Id") UUID t, @RequestHeader("X-Company-Id") UUID c, Authentication auth, @RequestBody Map<String,Object> body) {
        lock(t,c); var shift=opened(t,c);
        require(s(shift.get("id")).equals(s(body.get("shiftId"))),"Ca đã thay đổi, vui lòng tải lại");
        require(Boolean.TRUE.equals(body.get("confirmed")),"Xác nhận trách nhiệm tiền mặt, QR và tồn kho");
        BigDecimal cash=n(body.get("actualCash")), bank=n(body.get("actualBank")); require(cash.signum()>=0 && bank.signum()>=0,"Tiền thực tế không được âm");
        String handoverTo=s(body.get("handoverTo"));
        require(!handoverTo.isEmpty(),"Chọn người nhận bàn giao");
        require(Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM usertb u JOIN authorities a ON upper(a.username)=upper(u.username)
                WHERE upper(u.username)=upper(?) AND u.isenabled=true AND u.assigned_tenant_id=?
                  AND u.assigned_company_id=? AND a.authority='ROLE_COUNTER')
                """,Boolean.class,handoverTo,t.toString(),c.toString())),"Người nhận bàn giao phải có vai trò Thu ngân / Bàn giao ca");
        Instant end=Instant.now(), start=((Timestamp)shift.get("opened_at")).toInstant();
        var summary=(Map<String,Object>) reports.shiftSummary(t,c,null,null,start,end).getBody();
        BigDecimal expected=n(shift.get("opening_cash")).add(n(summary.get("cashIn")))
                .add(n(summary.get("receiptNoteCashTotal"))).subtract(n(summary.get("paymentNoteTotal")));
        BigDecimal expectedBank=n(shift.get("opening_bank")).add(n(summary.get("bankingIn")))
                .add(n(summary.get("receiptNoteBankTotal"))).subtract(n(summary.get("bankPaymentNoteTotal")));
        boolean different=cash.compareTo(expected)!=0 || bank.compareTo(expectedBank)!=0;
        require(!different || !s(body.get("reason")).isEmpty(),"Chênh lệch tiền mặt / QR cần lý do");
        require(body.get("counts") instanceof List<?>,"Cần kiểm đếm toàn bộ tồn kho");
        Map<String,Map<?,?>> counts=new HashMap<>();
        for(Object raw:(List<?>)body.get("counts")) { require(raw instanceof Map<?,?>,"Dòng kiểm đếm không hợp lệ"); var row=(Map<?,?>)raw; require(counts.put(s(row.get("id")),row)==null,"Trùng dòng kiểm đếm"); }
        db.queryForList("SELECT id FROM inventory WHERE tenant_id=? AND company_id=? ORDER BY id FOR UPDATE",t,c);
        var stock=stock(t,c); var saved=new ArrayList<Map<String,Object>>();
        require(counts.size()==stock.size(),"Kiểm đếm đủ các dòng tồn kho trước khi đóng ca");
        for(var inv:stock) {
            var row=counts.get(s(inv.get("id"))); require(row!=null,"Thiếu dòng kiểm đếm");
            BigDecimal actual=n(row.get("actual")); require(actual.signum()>=0,"Tồn thực tế không được âm");
            require(n(row.get("expected")).compareTo(n(inv.get("quantity_on_hand")))==0,"Tồn kho vừa thay đổi; tải lại và kiểm đếm lại");
            BigDecimal diff=actual.subtract(n(inv.get("quantity_on_hand")));
            require(diff.signum()==0 || !s(row.get("reason")).isEmpty(),"Chênh lệch tồn kho cần lý do: "+inv.get("material_code"));
            var item=new LinkedHashMap<String,Object>(inv); item.put("actual",actual); item.put("difference",diff); item.put("reason",s(row.get("reason"))); saved.add(item);
        }
        summary.put("expectedCash",expected); summary.put("expectedBank",expectedBank); summary.put("differenceCash",cash.subtract(expected)); summary.put("differenceBank",bank.subtract(expectedBank));
        db.update("UPDATE shop_counter_shift SET status='CLOSED',closed_at=?,closed_by=?,actual_cash=?,actual_bank=?,closing_reason=?,handover_to=?,summary=?::jsonb,inventory_counts=?::jsonb WHERE id=?",Timestamp.from(end),auth.getName(),cash,bank,s(body.get("reason")),handoverTo,encode(summary),encode(saved),shift.get("id"));
        return state(t,c,auth);
    }
}
