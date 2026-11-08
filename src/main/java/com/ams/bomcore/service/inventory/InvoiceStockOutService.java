package com.ams.bomcore.service.inventory;

import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.demo.invoicedesk.InvoiceDeskService;
import com.demo.invoicedesk.InvoiceDeskService.Document;
import com.demo.invoicedesk.InvoiceDeskService.Scope;
import invoice.Invoice;
import invoice.Parser;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Manual, reviewed invoice -> stock OUT. OCR never changes stock by itself.
 * Invoice Desk keeps the original PDF. The invoice date is the movement's
 * accounting date; confirmed_at separately records when it was actually posted.
 */
@Service
public class InvoiceStockOutService {
    private static final ZoneId ACCOUNTING_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> EXPORT_TYPES = Set.of("SALE","WARRANTY","GIFT","OTHER");
    private static final Set<String> BUYER_TYPES = Set.of("PERSONAL","COMPANY");
    private static final Pattern ADDRESS_LABEL = Pattern.compile(
            "(?im)^\\s*(?:Địa chỉ|Dia chi)\\s*(?:\\(Address\\))?\\s*:\\s*(.+?)\\s*$");
    private final InvoiceDeskService desk;
    private final InventoryMovementService movements;
    private final InventoryMovementRepository movementRepo;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();

    public record Line(int invoiceLineIndex, UUID inventoryId, BigDecimal quantity,
                       BigDecimal unitPrice, BigDecimal vatRate) {}
    public record Confirm(UUID documentId, LocalDate invoiceDate,
                          String invoiceSerial, String invoiceNumber,
                          String buyerType, String buyerName, String buyerTaxId,
                          String buyerAddress, String exportType,
                          BigDecimal vatRate, boolean acknowledgeHistoricalDate,
                          boolean acknowledgeMismatch, List<Line> lines) {}

    public InvoiceStockOutService(InvoiceDeskService desk, InventoryMovementService movements,
                                  InventoryMovementRepository movementRepo, JdbcTemplate jdbc) {
        this.desk = desk;
        this.movements = movements;
        this.movementRepo = movementRepo;
        this.jdbc = jdbc;
    }

    public Scope scope(Authentication authentication, UUID tenantId, UUID companyId) {
        Scope scope = desk.scope(authentication);
        if (!tenantId.equals(scope.tenantId()) || !companyId.equals(scope.companyId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tài khoản Invoice Desk không thuộc tenant/công ty đang chọn.");
        return scope;
    }

    public List<Map<String,Object>> documents(Scope scope) {
        return desk.documents(scope).stream().filter(d -> "INVOICE".equals(d.invoice().type))
                .map(this::preview).toList();
    }
    public Map<String,Object> document(Scope scope, UUID id) {
        return preview(desk.document(scope,id));
    }
    public Document upload(Scope scope, org.springframework.web.multipart.MultipartFile file) throws Exception {
        return com.demo.invoicedesk.InvoiceDeskTasks.run(
                scope,UUID.randomUUID(),()->desk.upload(scope,file));
    }

    private Map<String,Object> preview(Document document) {
        Invoice inv = document.invoice();
        String buyer = inv.get("buyer");
        if (buyer.isBlank()) buyer = match(inv.text,
                "(?im)^\\s*Họ tên người mua hàng\\s*(?:\\([^\\n)]*\\))?\\s*:\\s*([^\\n]+)");
        String address = "";
        Matcher addresses = ADDRESS_LABEL.matcher(Objects.toString(inv.text,""));
        while (addresses.find()) address = addresses.group(1).trim(); // buyer address follows seller address
        Map<String,Object> out = new LinkedHashMap<>();
        out.put("id",document.id());
        out.put("source",inv.source);
        out.put("parserVersion",inv.parserVersion);
        out.put("date",inv.get("date"));
        out.put("serial",inv.get("serial"));
        out.put("number",inv.get("number"));
        out.put("seller",inv.get("seller"));
        out.put("sellerTaxId",inv.get("sellerTaxId"));
        out.put("buyer",buyer);
        out.put("buyerTaxId",inv.get("buyerTaxId"));
        out.put("buyerAddress",address);
        out.put("buyerType",inv.get("buyerTaxId").isBlank() ? "PERSONAL" : "COMPANY");
        out.put("subtotal",inv.get("subtotal"));
        out.put("vat",inv.get("vat"));
        out.put("total",inv.get("total"));
        out.put("vatRate",inv.get("taxRate"));
        out.put("currency",inv.get("currency"));
        out.put("warnings",inv.warnings);
        out.put("items",inv.items);
        out.put("approved",inv.approved);
        out.put("sha256",inv.sha256);
        return out;
    }
    private static String match(String text, String regex) {
        Matcher m = Pattern.compile(regex).matcher(Objects.toString(text,""));
        return m.find() ? m.group(1).trim() : "";
    }
    private static String required(String val, String title, int max) {
        String s = Objects.toString(val,"").trim();
        if (s.isEmpty() || s.length()>max || s.contains("<") || s.contains(">"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,title+" không hợp lệ.");
        return s;
    }
    private static BigDecimal validNonNegative(BigDecimal n, String label) {
        if (n==null || n.signum()<0 || n.compareTo(new BigDecimal("1000000000000"))>0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,label+" không hợp lệ.");
        return n;
    }
    private static BigDecimal vat(BigDecimal n) {
        validNonNegative(n,"Thuế suất");
        if (n.compareTo(new BigDecimal("100"))>0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Thuế suất vượt 100%.");
        return n;
    }
    private static BigDecimal optionalMoney(String val) {
        if (val==null || val.isBlank()) return null;
        try { return Parser.money(val); } catch (RuntimeException e) { return null; }
    }

    /**
     * Supplier provenance from receiving invoices, scoped to the same tenant
     * and company. Inventory rows can receive stock from multiple suppliers;
     * do not pretend that the batch has only one supplier.
     *
     * The receipt screen stores the supplier's name in invoice.party_name
     * and links each stock IN movement using reference_type=INVOICE.
     * Purchase prices deliberately are not returned by this lookup.
     */
    public List<Map<String,Object>> inventorySuppliers(Scope scope) {
        return jdbc.queryForList("""
            SELECT DISTINCT m.inventory_id AS "inventoryId",
                   COALESCE(NULLIF(BTRIM(p.party_name), ''), 'Chưa xác định') AS "supplierName",
                   p.id AS "purchaseInvoiceId",
                   p.invoice_number AS "purchaseInvoiceNumber",
                   p.invoice_date AS "purchaseInvoiceDate"
            FROM public.inventory_movement m
            JOIN public.invoice p ON p.id=m.reference_id
                 AND p.tenant_id=m.tenant_id AND p.company_id=m.company_id
                 AND p.invoice_type='PURCHASE'
            JOIN public.inventory inv ON inv.id=m.inventory_id
                 AND inv.tenant_id=m.tenant_id AND inv.company_id=m.company_id
            WHERE m.tenant_id=? AND m.company_id=?
              AND m.inventory_id IS NOT NULL AND m.movement_type='IN'
              AND m.reference_type='INVOICE'
            ORDER BY "supplierName", "inventoryId"
            """,scope.tenantId(),scope.companyId());
    }

    public List<Map<String,Object>> posted(Scope scope) {
        return jdbc.queryForList("""
             SELECT id,invoice_desk_document_id,invoice_date,invoice_serial,invoice_number,
                    buyer_type,buyer_name,buyer_tax_id,export_type,vat_rate,
                    invoice_total,confirmed_by,confirmed_at
             FROM public.inventory_invoice_stock_out
             WHERE tenant_id=? AND company_id=?
             ORDER BY confirmed_at DESC LIMIT 200
             """,scope.tenantId(),scope.companyId());
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String,Object> confirm(Scope scope, Confirm request) throws Exception {
        if (request==null || request.documentId()==null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Chưa chọn PDF hóa đơn.");
        Invoice doc = desk.document(scope,request.documentId()).invoice();
        if (!"INVOICE".equals(doc.type) || doc.items.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invoice Desk chưa nhận dạng được dòng hàng. Hãy sửa/duyệt trong Invoice Desk trước.");
        LocalDate date = request.invoiceDate();
        if (date==null || date.isAfter(LocalDate.now(ACCOUNTING_ZONE)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ngày hóa đơn không được ở tương lai.");
        if (!date.equals(LocalDate.now(ACCOUNTING_ZONE)) && !request.acknowledgeHistoricalDate())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Xuất kho hồi tố theo ngày hóa đơn cần được xác nhận rõ.");
        String serial=required(request.invoiceSerial(),"Ký hiệu hóa đơn",80);
        String number=required(request.invoiceNumber(),"Số hóa đơn",80);
        String buyerType=required(request.buyerType(),"Loại người mua",20).toUpperCase(Locale.ROOT);
        if (!BUYER_TYPES.contains(buyerType))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Loại người mua không hợp lệ.");
        String buyer=required(request.buyerName(),"Người mua",500);
        String exportType=required(request.exportType(),"Loại xuất kho",30).toUpperCase(Locale.ROOT);
        if (!EXPORT_TYPES.contains(exportType))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Loại xuất kho không hợp lệ.");
        BigDecimal defaultVat=vat(request.vatRate());
        String buyerTax=Objects.toString(request.buyerTaxId(),"").trim();
        if (buyerTax.length()>30) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"MST quá dài.");
        if ("COMPANY".equals(buyerType) && buyerTax.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Hóa đơn công ty cần mã số thuế.");
        String address=Objects.toString(request.buyerAddress(),"").trim();
        if (address.length()>1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Địa chỉ quá dài.");

        // The actual PDF is immutable in the Invoice Desk and uniquely linked.
        Integer already=jdbc.queryForObject("""
            SELECT count(*) FROM public.inventory_invoice_stock_out
            WHERE tenant_id=? AND company_id=? AND
                  (invoice_desk_document_id=? OR (invoice_serial=? AND invoice_number=?))
            """,Integer.class,scope.tenantId(),scope.companyId(),request.documentId(),serial,number);
        if (already!=null && already>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Hóa đơn này đã được xuất kho; không trừ kho hai lần.");

        if (request.lines()==null || request.lines().isEmpty() || request.lines().size()>200)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cần đối chiếu 1–200 dòng hàng trước khi xuất.");
        Map<Integer,BigDecimal> qtyByInvoiceLine = new TreeMap<>();
        Map<UUID,BigDecimal> qtyByInventory = new TreeMap<>();
        Set<String> uniqueAssignments=new HashSet<>();
        BigDecimal subtotal=BigDecimal.ZERO;
        BigDecimal calculatedVat=BigDecimal.ZERO;
        for (Line line : request.lines()) {
            if (line==null || line.inventoryId()==null || line.invoiceLineIndex()<0
                    || line.invoiceLineIndex()>=doc.items.size()
                    || line.quantity()==null || line.quantity().signum()<=0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Dòng hàng/ô tồn kho không hợp lệ.");
            if (!uniqueAssignments.add(line.invoiceLineIndex()+":"+line.inventoryId()))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Một lô kho bị lặp trong cùng dòng hóa đơn.");
            if (line.quantity().scale()>6 || line.quantity().compareTo(new BigDecimal("1000000000"))>0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Số lượng xuất không hợp lệ.");
            qtyByInvoiceLine.merge(line.invoiceLineIndex(),line.quantity(),BigDecimal::add);
            qtyByInventory.merge(line.inventoryId(),line.quantity(),BigDecimal::add);
            BigDecimal lineBase=validNonNegative(line.unitPrice(),"Đơn giá bán").multiply(line.quantity());
            subtotal=subtotal.add(lineBase);
            calculatedVat=calculatedVat.add(lineBase.multiply(vat(line.vatRate()))
                    .divide(new BigDecimal("100"),4,RoundingMode.HALF_UP));
        }
        // Every recognized invoice line must be paired with physical stock. A
        // line may be split across batches, but quantities must add up.
        if (qtyByInvoiceLine.size()!=doc.items.size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Còn dòng hàng trên hóa đơn chưa chọn tồn kho để đối chiếu.");
        for (int i=0;i<doc.items.size();i++) {
            BigDecimal ocrQty=optionalMoney(doc.items.get(i).get("quantity"));
            if (ocrQty==null || ocrQty.signum()<=0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Số lượng OCR không hợp lệ ở dòng "+(i+1)+". Vui lòng sửa trong Invoice Desk.");
            if (qtyByInvoiceLine.getOrDefault(i,BigDecimal.ZERO).compareTo(ocrQty)!=0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "SL xuất khác SL hóa đơn ở dòng "+(i+1)+".");
        }

        BigDecimal ocrSubtotal=optionalMoney(doc.get("subtotal"));
        BigDecimal ocrVat=optionalMoney(doc.get("vat"));
        BigDecimal ocrTotal=optionalMoney(doc.get("total"));
        // Compare sales amount AND VAT AND gross total, allowing a one-dong
        // tolerance for rounding in electronic invoice representations.
        boolean mismatch=(ocrSubtotal!=null && subtotal.subtract(ocrSubtotal).abs().compareTo(BigDecimal.ONE)>0)
                || (ocrVat!=null && calculatedVat.subtract(ocrVat).abs().compareTo(BigDecimal.ONE)>0)
                || (ocrTotal!=null && subtotal.add(calculatedVat).subtract(ocrTotal).abs().compareTo(BigDecimal.ONE)>0);
        if (mismatch && !request.acknowledgeMismatch())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Giá bán, thuế VAT hoặc tổng tiền khác PDF. Phải xác nhận chênh lệch trước khi xuất kho.");

        // Acquire row locks in deterministic order to prevent duplicate requests
        // from overdrawing the same batch. Locking before movement creation also
        // ensures this invoice is atomic across multiple inventory rows.
        Map<UUID,Map<String,Object>> inventories=new LinkedHashMap<>();
        for (UUID id:qtyByInventory.keySet()) {
            List<Map<String,Object>> rows=jdbc.queryForList("""
                SELECT id,material_id,warehouse_id,batch_no,unit,
                       quantity_on_hand,quantity_reserved,quantity_locked,locked
                FROM public.inventory
                WHERE id=? AND tenant_id=? AND company_id=? FOR UPDATE
                """,id,scope.tenantId(),scope.companyId());
            if (rows.size()!=1)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Không tìm thấy lô tồn kho trong công ty: "+id);
            Map<String,Object> inv=rows.get(0);
            if (Boolean.TRUE.equals(inv.get("locked")))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Lô tồn kho đang khóa: "+id);
            BigDecimal onHand=(BigDecimal)inv.getOrDefault("quantity_on_hand",BigDecimal.ZERO);
            BigDecimal reserved=(BigDecimal)inv.get("quantity_reserved");
            BigDecimal locked=(BigDecimal)inv.get("quantity_locked");
            BigDecimal available=onHand.subtract(reserved==null?BigDecimal.ZERO:reserved)
                .subtract(locked==null?BigDecimal.ZERO:locked);
            if (available.compareTo(qtyByInventory.get(id))<0)
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Không đủ hàng ở lô "+id+": khả dụng "+available+"; yêu cầu "+qtyByInventory.get(id));
            inventories.put(id,inv);
        }

        UUID dispatchId=UUID.randomUUID();
        String summary;
        try {
            summary=json.writeValueAsString(Map.of("documentId",request.documentId(),
                    "lines",request.lines(),"ocrItems",doc.items,
                    "ocrWarnings",doc.warnings));
        } catch (Exception e) { throw new IllegalArgumentException("Không ghi được dữ liệu đối chiếu",e); }
        jdbc.update("""
            INSERT INTO public.inventory_invoice_stock_out
             (id,tenant_id,company_id,invoice_desk_document_id,invoice_date,
              invoice_serial,invoice_number,buyer_type,buyer_name,buyer_tax_id,
              buyer_address,export_type,vat_rate,invoice_subtotal,invoice_vat,
              invoice_total,source_sha256,reviewed_snapshot,confirmed_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?)
            """,dispatchId,scope.tenantId(),scope.companyId(),request.documentId(),date,
            serial,number,buyerType,buyer,buyerTax,address,exportType,defaultVat,
            optionalMoney(doc.get("subtotal")),optionalMoney(doc.get("vat")),optionalMoney(doc.get("total")),
            doc.sha256,summary,scope.username());

        List<UUID> postedMovements=new ArrayList<>();
        for(Line line:request.lines()) {
            Map<String,Object> inv=inventories.get(line.inventoryId());
            UUID material=(UUID)inv.get("material_id");
            UUID warehouse=(UUID)inv.get("warehouse_id");
            String batch=(String)inv.get("batch_no");
            String unit=(String)inv.get("unit");
            String description=Objects.toString(doc.items.get(line.invoiceLineIndex()).get("description"),"").trim();
            InventoryMovementEntity move=movements.recordOutMovement(material,warehouse,line.quantity(),
                    unit,batch,"Xuất kho theo HĐ "+serial+" / "+number,scope.username(),
                    "INVOICE_STOCK_OUT",dispatchId,line.inventoryId(),
                    "Dòng "+(line.invoiceLineIndex()+1)+": "+description,scope.tenantId(),scope.companyId());
            // Invoice business date is distinct from confirmed_at/posting time.
            move.setCreatedAt(date.atTime(12,0).atZone(ACCOUNTING_ZONE).toInstant());
            movementRepo.saveAndFlush(move);
            jdbc.update("""
                INSERT INTO public.inventory_invoice_stock_out_line
                  (id,stock_out_id,invoice_line_index,invoice_description,
                   inventory_id,material_id,warehouse_id,quantity,unit,sale_unit_price,
                   vat_rate,line_subtotal,movement_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,UUID.randomUUID(),dispatchId,line.invoiceLineIndex(),description,
                line.inventoryId(),material,warehouse,line.quantity(),unit,line.unitPrice(),
                line.vatRate(),line.unitPrice().multiply(line.quantity()).setScale(4,RoundingMode.HALF_UP),
                move.getId());
            postedMovements.add(move.getId());
        }
        return Map.of("id",dispatchId,"invoiceSerial",serial,"invoiceNumber",number,
                "invoiceDate",date,"movements",postedMovements,"lineCount",request.lines().size());
    }
}
