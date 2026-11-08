package com.ams.bomcore.service.inventory;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.invoice.InvoiceEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.WarehouseRepository;
import com.ams.bomcore.service.invoice.InvoiceService;
import com.ams.bomcore.service.material.MaterialService;
import com.demo.invoicedesk.InvoiceDeskService;
import com.demo.invoicedesk.InvoiceDeskService.Scope;
import invoice.Invoice;
import invoice.Parser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Posts a fully reviewed PDF purchase invoice and all IN movements atomically.
 * No stock or material is added until Confirm is submitted and validated.
 * Retains the original OCR line name separately from the internal material name.
 */
@Service
public class InvoicePdfReceivingService {
    public record Line(int invoiceLineIndex, UUID materialId, String newMaterialCode,
                       String newMaterialName, String newMaterialUnit, String newMaterialType,
                       UUID warehouseId, String batchNo, BigDecimal quantity,
                       String invoiceUnit, BigDecimal bomUnitPerInvoiceUnit,
                       BigDecimal unitPrice, BigDecimal vatRate) {}
    public record Confirm(UUID documentId, LocalDate invoiceDate, String invoiceSerial,
                          String invoiceNumber, String supplierName, String supplierTaxId,
                          String currency, boolean acknowledgeMismatch, List<Line> lines) {}

    private final InvoiceDeskService desk;
    private final InvoiceService invoiceService;
    private final InventoryService inventoryService;
    private final MaterialRepository materials;
    private final MaterialService materialService;
    private final CompanyRepository companies;
    private final TenantRepository tenants;
    private final WarehouseRepository warehouses;
    private final JdbcTemplate jdbc;

    public InvoicePdfReceivingService(InvoiceDeskService desk, InvoiceService invoiceService,
            InventoryService inventoryService, MaterialRepository materials, MaterialService materialService,
            CompanyRepository companies, TenantRepository tenants,
            WarehouseRepository warehouses, JdbcTemplate jdbc) {
        this.desk=desk;
        this.invoiceService=invoiceService;
        this.inventoryService=inventoryService;
        this.materials=materials;
        this.materialService=materialService;
        this.companies=companies;
        this.tenants=tenants;
        this.warehouses=warehouses;
        this.jdbc=jdbc;
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);
    }
    private static String required(String value,String label,int max) {
        String s=Objects.toString(value,"").trim();
        if(s.isBlank()||s.length()>max)throw invalid(label+" không hợp lệ (tối đa "+max+" ký tự).");
        return s;
    }
    private static BigDecimal positive(BigDecimal value,String label) {
        if(value==null||value.signum()<=0||value.compareTo(new BigDecimal("1000000000"))>0)
            throw invalid(label+" phải lớn hơn 0 và không vượt giới hạn.");
        return value;
    }
    private static BigDecimal nonNegative(BigDecimal value,String label) {
        if(value==null||value.signum()<0||value.compareTo(new BigDecimal("1000000000000"))>0)
            throw invalid(label+" không hợp lệ.");
        return value;
    }
    private static BigDecimal ocrNumber(String raw) {
        try{return Parser.money(raw);}catch(Exception e){return null;}
    }
    public List<Map<String,Object>> history(Scope scope) {
        return jdbc.queryForList("""
            SELECT r.id,r.document_id AS "documentId",r.purchase_invoice_id AS "invoiceId",
                   r.invoice_date AS "invoiceDate",r.invoice_serial AS "invoiceSerial",
                   r.invoice_number AS "invoiceNumber",r.supplier_name AS "supplierName",
                   r.currency,r.confirmed_at AS "confirmedAt",
                   (SELECT count(*) FROM public.inventory_invoice_pdf_receipt_line l
                      WHERE l.receipt_id=r.id) AS "itemCount"
            FROM public.inventory_invoice_pdf_receipt r
            WHERE r.tenant_id=? AND r.company_id=?
            ORDER BY r.confirmed_at DESC LIMIT 200
            """,scope.tenantId(),scope.companyId());
    }

    @Transactional(rollbackFor=Exception.class)
    public Map<String,Object> confirm(Scope scope,Confirm req) {
        if(req==null||req.documentId()==null)throw invalid("Hãy chọn hóa đơn PDF.");
        Invoice doc=desk.document(scope,req.documentId()).invoice();
        if(!"INVOICE".equals(doc.type)||doc.items.isEmpty())
            throw invalid("Invoice Desk chưa đọc được các dòng hàng; hãy sửa hóa đơn trước.");
        LocalDate invoiceDate=req.invoiceDate();
        if(invoiceDate==null||invoiceDate.isAfter(LocalDate.now()))
            throw invalid("Ngày hóa đơn không hợp lệ.");
        String serial=required(req.invoiceSerial(),"Ký hiệu hóa đơn",80);
        String number=required(req.invoiceNumber(),"Số hóa đơn",80);
        String supplier=required(req.supplierName(),"Nhà cung cấp",500);
        String currency=required(req.currency(),"Tiền tệ",3).toUpperCase(Locale.ROOT);
        if(!Set.of("VND","USD","EUR","JPY","CNY").contains(currency))
            throw invalid("Tiền tệ phải là VND, USD, EUR, JPY hoặc CNY.");
        String taxId=Objects.toString(req.supplierTaxId(),"").trim();
        if(taxId.length()>32)throw invalid("MST nhà cung cấp quá dài.");
        if(req.lines()==null||req.lines().size()!=doc.items.size()||req.lines().size()>200)
            throw invalid("Phải đối chiếu và chọn vật tư cho tất cả dòng trên PDF.");

        Company company=companies.findById(scope.companyId()).orElseThrow(()->invalid("Công ty không tồn tại."));
        if(company.getTenant()==null||!scope.tenantId().equals(company.getTenant().getId()))
            throw invalid("Công ty không thuộc tenant đang đăng nhập.");
        Tenant tenant=tenants.findById(scope.tenantId()).orElseThrow(()->invalid("Tenant không tồn tại."));
        Map<Integer,Line> lineMap=new TreeMap<>();
        Map<String,Material> newlyCreated=new HashMap<>();
        Map<Integer,Material> materialMap=new LinkedHashMap<>();
        Map<Integer,WarehouseEntity> warehouseMap=new LinkedHashMap<>();
        BigDecimal subtotal=BigDecimal.ZERO;
        BigDecimal vatTotal=BigDecimal.ZERO;

        // First pass: validate ALL rows and reconcile with saved OCR before
        // writing anything. Per-company material and warehouse checks prevent
        // stock from being credited into a different company.
        for(Line l:req.lines()) {
            if(l==null||l.invoiceLineIndex()<0||l.invoiceLineIndex()>=doc.items.size()
                    ||lineMap.putIfAbsent(l.invoiceLineIndex(),l)!=null)
                throw invalid("Dòng hóa đơn bị thiếu, trùng hoặc sai thứ tự.");
            BigDecimal qty=positive(l.quantity(),"Số lượng dòng "+(l.invoiceLineIndex()+1));
            if(qty.scale()>6)throw invalid("Số lượng không quá 6 chữ số thập phân.");
            BigDecimal ratio=positive(l.bomUnitPerInvoiceUnit(),"Hệ số quy đổi");
            if(ratio.scale()>8)throw invalid("Hệ số quy đổi không quá 8 chữ số thập phân.");
            BigDecimal bomQty=qty.multiply(ratio);
            if(bomQty.scale()>6)throw invalid("SL quy đổi không quá 6 chữ số thập phân.");
            BigDecimal price=nonNegative(l.unitPrice(),"Giá nhập");
            if(price.scale()>4)throw invalid("Giá nhập không quá 4 chữ số thập phân.");
            BigDecimal tax=nonNegative(l.vatRate(),"VAT");
            if(tax.compareTo(new BigDecimal("100"))>0)throw invalid("VAT vượt 100%.");
            String unit=required(l.invoiceUnit(),"Đơn vị theo PDF",20);
            String batch=required(l.batchNo(),"Số lô",50);
            String ocrDescription=Objects.toString(doc.items.get(l.invoiceLineIndex()).get("description"),"").trim();
            if(ocrDescription.isBlank())throw invalid("Dòng PDF thiếu tên hàng: "+(l.invoiceLineIndex()+1));
            BigDecimal ocrQty=ocrNumber(doc.items.get(l.invoiceLineIndex()).get("quantity"));
            if(ocrQty==null||ocrQty.compareTo(qty)!=0)
                throw invalid("Số lượng dòng "+(l.invoiceLineIndex()+1)+" không trùng PDF. Sửa trong Invoice Desk trước.");
            if(l.materialId()==null) {
                String code=required(l.newMaterialCode(),"Mã vật tư mới",50);
                required(l.newMaterialName(),"Tên vật tư gốc",500);
                required(l.newMaterialUnit(),"Đơn vị vật tư",20);
                required(l.newMaterialType(),"Loại vật tư",30);
                if(materials.findByMaterialCodeAndTenantIdAndCompanyId(code,scope.tenantId(),scope.companyId()).isPresent())
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Mã "+code+" đã tồn tại. Hãy chọn vật tư có sẵn.");
                // Repeated new codes in this invoice must define the same material.
                for(Line earlier:lineMap.values())if(earlier!=l && earlier.materialId()==null
                    && code.equals(earlier.newMaterialCode())
                    && (!Objects.equals(l.newMaterialName(),earlier.newMaterialName())
                     ||!Objects.equals(l.newMaterialUnit(),earlier.newMaterialUnit())))
                    throw invalid("Mã vật tư mới "+code+" có tên hoặc đơn vị không thống nhất.");
            } else {
                Material material=materials.findById(l.materialId())
                    .orElseThrow(()->invalid("Vật tư không tồn tại: "+l.materialId()));
                if(material.getTenant()==null||material.getCompany()==null
                    ||!scope.tenantId().equals(material.getTenant().getId())
                    ||!scope.companyId().equals(material.getCompany().getId()))
                    throw invalid("Vật tư thuộc công ty khác.");
                materialMap.put(l.invoiceLineIndex(),material);
            }
            if(l.warehouseId()==null)throw invalid("Chưa chọn kho cho dòng "+(l.invoiceLineIndex()+1));
            WarehouseEntity warehouse=warehouses.findById(l.warehouseId())
                    .orElseThrow(()->invalid("Kho không tồn tại."));
            if(!scope.tenantId().equals(warehouse.getTenantId())
                 ||!scope.companyId().equals(warehouse.getCompanyId()))
                throw invalid("Kho không thuộc công ty đang chọn.");
            warehouseMap.put(l.invoiceLineIndex(),warehouse);
            BigDecimal base=price.multiply(qty).setScale(4,RoundingMode.HALF_UP);
            subtotal=subtotal.add(base);
            vatTotal=vatTotal.add(base.multiply(tax).divide(new BigDecimal("100"),4,RoundingMode.HALF_UP));
            // unit and batch are stored as reviewed values, not silently mapped from OCR
            if(unit.isEmpty()||batch.isEmpty())throw invalid("Đơn vị hoặc lô còn trống.");
        }
        for(int i=0;i<doc.items.size();i++)if(!lineMap.containsKey(i))
            throw invalid("Chưa đối chiếu dòng PDF số "+(i+1));
        boolean mismatch=false;
        BigDecimal ocrSubtotal=ocrNumber(doc.get("subtotal"));
        BigDecimal ocrVat=ocrNumber(doc.get("vat"));
        BigDecimal ocrGross=ocrNumber(doc.get("total"));
        if(ocrSubtotal!=null&&subtotal.subtract(ocrSubtotal).abs().compareTo(BigDecimal.ONE)>0)mismatch=true;
        if(ocrVat!=null&&vatTotal.subtract(ocrVat).abs().compareTo(BigDecimal.ONE)>0)mismatch=true;
        if(ocrGross!=null&&subtotal.add(vatTotal).subtract(ocrGross).abs().compareTo(BigDecimal.ONE)>0)mismatch=true;
        if(mismatch&&!req.acknowledgeMismatch())
            throw invalid("Thành tiền hoặc VAT không trùng PDF. Cần xác nhận chênh lệch.");

        Integer duplicates=jdbc.queryForObject("""
            SELECT count(*) FROM public.inventory_invoice_pdf_receipt
             WHERE tenant_id=? AND company_id=?
               AND (document_id=? OR (invoice_serial=? AND invoice_number=?))
            """,Integer.class,scope.tenantId(),scope.companyId(),req.documentId(),serial,number);
        if(duplicates!=null&&duplicates>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Hóa đơn này đã nhập kho; không được cộng kho lần hai.");

        String invoiceKey=serial+"/"+number;
        if(invoiceKey.length()>80)throw invalid("Ký hiệu + số hóa đơn quá dài.");
        UUID receiptId=UUID.randomUUID();
        // Insert unique receipt record first to serialize concurrent confirms.
        // One transaction spans this insert, any new materials, the purchase
        // invoice and ALL inventory IN movements. Any failure rolls all back.
        // Invoice id is generated below, and must be recorded before lines.
        Map<String,Object> invoiceBody=new LinkedHashMap<>();
        invoiceBody.put("invoiceType","PURCHASE");
        invoiceBody.put("invoiceNumber",invoiceKey);
        invoiceBody.put("partyName",supplier);
        invoiceBody.put("invoiceDate",invoiceDate.toString());
        invoiceBody.put("currency",currency);
        invoiceBody.put("subtotal",subtotal);
        invoiceBody.put("taxAmount",vatTotal);
        invoiceBody.put("totalAmount",subtotal.add(vatTotal));
        invoiceBody.put("notes","PDF Invoice Desk "+req.documentId()+"; MST NCC: "+taxId
                +"; ngày nhập kho thực tế: "+LocalDate.now());
        InvoiceEntity purchase=invoiceService.create(invoiceBody,scope.tenantId(),scope.companyId());
        jdbc.update("""
            INSERT INTO public.inventory_invoice_pdf_receipt
                (id,tenant_id,company_id,document_id,purchase_invoice_id,
                 invoice_serial,invoice_number,invoice_date,supplier_name,
                 supplier_tax_id,currency,pdf_sha256,confirmed_by)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,receiptId,scope.tenantId(),scope.companyId(),req.documentId(),purchase.getId(),
            serial,number,invoiceDate,supplier,taxId,currency,doc.sha256,scope.username());

        List<Map<String,Object>> postedLines=new ArrayList<>();
        for(int i=0;i<doc.items.size();i++) {
            Line line=lineMap.get(i);
            Material material=materialMap.get(i);
            boolean created=false;
            if(material==null) {
                String code=line.newMaterialCode().trim();
                material=newlyCreated.get(code);
                if(material==null){
                    material=new Material();
                    material.setMaterialCode(code);
                    material.setMaterialName(line.newMaterialName().trim());
                    material.setUnit(line.newMaterialUnit().trim());
                    material.setMaterialType(line.newMaterialType().trim());
                    material.setIsActive(true);
                    material=materialService.createForCompany(material,company,tenant);
                    newlyCreated.put(code,material);
                    created=true;
                }
            }
            BigDecimal bomQty=line.quantity().multiply(line.bomUnitPerInvoiceUnit());
            BigDecimal costPerBom=line.unitPrice()
                .divide(line.bomUnitPerInvoiceUnit(),10,RoundingMode.HALF_UP);
            String original=doc.items.get(i).get("description").trim();
            // Notes carry invoice description for movement history. Immutable
            // comparison also stored in receipt_line (not in material master).
            String note="Tên theo HĐ: "+original+" | Mã gốc: "+material.getMaterialCode()
                +" | Tên gốc: "+material.getMaterialName();
            InventoryEntity added=inventoryService.addStockByIds(
                material.getId(),line.warehouseId(),bomQty,line.batchNo().trim(),
                null,null,null,null,null,null,scope.tenantId(),scope.companyId(),
                "Nhập từ hóa đơn PDF "+invoiceKey,scope.username(),note,purchase.getId(),
                costPerBom,currency,line.invoiceUnit(),line.quantity(),
                line.bomUnitPerInvoiceUnit(),line.unitPrice());
            jdbc.update("""
                INSERT INTO public.inventory_invoice_pdf_receipt_line
                 (id,receipt_id,invoice_line_index,invoice_item_name,material_id,
                  material_code,material_name,material_created,warehouse_id,inventory_id,
                  batch_no,invoice_quantity,invoice_unit,bom_unit_per_invoice_unit,
                  bom_quantity,purchase_unit_price,vat_rate)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,UUID.randomUUID(),receiptId,i,original,material.getId(),
                material.getMaterialCode(),material.getMaterialName(),created,
                line.warehouseId(),added.getId(),line.batchNo().trim(),
                line.quantity(),line.invoiceUnit(),line.bomUnitPerInvoiceUnit(),
                bomQty,line.unitPrice(),line.vatRate());
            postedLines.add(Map.of("invoiceLineIndex",i,"inventoryId",added.getId(),
                "materialId",material.getId(),"materialCode",material.getMaterialCode(),
                "originalInvoiceName",original,"originalMaterialName",material.getMaterialName()));
        }
        return Map.of("receiptId",receiptId,"invoiceId",purchase.getId(),
            "invoiceNumber",invoiceKey,"lines",postedLines);
    }
}
