package com.ams.bomcore.service.inventory;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.WarehouseRepository;
import com.ams.bomcore.service.material.MaterialService;
import com.demo.invoicedesk.InvoiceDeskService.Scope;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.*;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Audited customs declaration stock postings. Upload only PREVIEWS lines;
 * transactions are posted exactly once by explicit reviewed confirmation.
 */
@Service
public class CustomsDeclarationStockService {
    public record Line(int lineIndex, UUID materialId, String newMaterialCode,
                       String newMaterialName, String newMaterialUnit,
                       UUID warehouseId, UUID inventoryId, String batchNo,
                       BigDecimal conversionRatio, BigDecimal vatRate) {}
    public record Confirm(UUID documentId, String direction, String declarationNumber,
                          LocalDate declarationDate, String currency, List<Line> lines) {}

    private final CustomsDeclarationExcelParser parser;
    private final JdbcTemplate jdbc;
    // Spring Boot 4 may auto-configure Jackson 3 but not the Jackson 2
    // com.fasterxml.jackson.databind.ObjectMapper used for this legacy JSON.
    // Keep the customs document mapper local; no global Jackson changes.
    private final ObjectMapper mapper = new ObjectMapper();
    private final MaterialRepository materialRepo;
    private final MaterialService materialService;
    private final CompanyRepository companies;
    private final TenantRepository tenants;
    private final WarehouseRepository warehouses;
    private final InventoryRepository inventoryRepo;
    private final InventoryService inventoryService;
    private final InventoryMovementService movements;
    private final InventoryMovementRepository movementRepo;

    public CustomsDeclarationStockService(CustomsDeclarationExcelParser parser,
            JdbcTemplate jdbc,MaterialRepository materialRepo,
            MaterialService materialService,CompanyRepository companies,TenantRepository tenants,
            WarehouseRepository warehouses,InventoryRepository inventoryRepo,
            InventoryService inventoryService,InventoryMovementService movements,
            InventoryMovementRepository movementRepo) {
        this.parser=parser;this.jdbc=jdbc;this.materialRepo=materialRepo;
        this.materialService=materialService;this.companies=companies;this.tenants=tenants;
        this.warehouses=warehouses;this.inventoryRepo=inventoryRepo;this.inventoryService=inventoryService;
        this.movements=movements;this.movementRepo=movementRepo;
    }
    private static ResponseStatusException fail(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);
    }
    private static String required(String value,String name,int max) {
        String text=Objects.toString(value,"").trim();
        if(text.isBlank()||text.length()>max)throw fail(name+" không hợp lệ.");
        return text;
    }
    private static BigDecimal decimal(BigDecimal value,String name,int scale) {
        if(value==null||value.signum()<=0||value.scale()>scale
                ||value.compareTo(new BigDecimal("1000000000"))>0)throw fail(name+" không hợp lệ.");
        return value;
    }
    private CustomsDeclarationExcelParser.Parsed decode(String json) {
        try{return mapper.readValue(json,CustomsDeclarationExcelParser.Parsed.class);}
        catch(Exception ex){throw new IllegalStateException("Không đọc được tờ khai đã lưu",ex);}
    }
    private String encode(Object data) {
        try{return mapper.writeValueAsString(data);}
        catch(Exception e){throw new IllegalStateException("Lỗi JSON tờ khai",e);}
    }

    public Map<String,Object> upload(Scope scope,MultipartFile file)throws Exception {
        if(file==null||file.isEmpty()||file.getSize()>10_000_000)throw fail("Tờ khai Excel phải dưới 10MB.");
        String filename=Objects.toString(file.getOriginalFilename(),"tokhai.xlsx")
                .replace('\\','/');
        filename=filename.substring(filename.lastIndexOf('/')+1);
        byte[] bytes=file.getBytes();
        var parsed=parser.parse(bytes,filename);
        String sha=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        var matches=jdbc.queryForList("""
            SELECT id FROM public.inventory_customs_declaration
            WHERE tenant_id=? AND company_id=? AND sha256=?
            """,scope.tenantId(),scope.companyId(),sha);
        if(!matches.isEmpty()) {
            UUID existingId=(UUID)matches.get(0).get("id");
            // This exact file may have been uploaded before the XLS reader
            // learned to parse the original customs duty/VAT columns.
            // Refresh only an unposted draft; never rewrite posted evidence.
            refreshUnpostedSource(scope,existingId,sha,parsed);
            return document(scope,existingId);
        }
        UUID id=UUID.randomUUID();
        try{
            jdbc.update("""
                INSERT INTO public.inventory_customs_declaration
                  (id,tenant_id,company_id,file_name,sha256,declaration_number,source_json)
                VALUES (?,?,?,?,?,?,?::jsonb)
                """,id,scope.tenantId(),scope.companyId(),filename,sha,
                    parsed.declarationNumber(),encode(parsed));
        } catch(org.springframework.dao.DuplicateKeyException duplicate){
            var existing=jdbc.queryForList("""
                SELECT id FROM public.inventory_customs_declaration
                WHERE tenant_id=? AND company_id=? AND sha256=?
                """,scope.tenantId(),scope.companyId(),sha);
            if(existing.isEmpty())throw duplicate;
            id=(UUID)existing.get(0).get("id");
            refreshUnpostedSource(scope,id,sha,parsed);
        }
        return document(scope,id);
    }

    private void refreshUnpostedSource(Scope scope,UUID id,String sha,
            CustomsDeclarationExcelParser.Parsed parsed) {
        jdbc.update("""
            UPDATE public.inventory_customs_declaration SET source_json=?::jsonb
            WHERE id=? AND tenant_id=? AND company_id=? AND sha256=?
              AND status <> 'POSTED'
            """,encode(parsed),id,scope.tenantId(),scope.companyId(),sha);
    }
    public Map<String,Object> document(Scope scope,UUID id) {
        var result=jdbc.queryForList("""
            SELECT id,file_name,sha256,declaration_number,declaration_date,
                   status,direction,source_json::text AS source
            FROM public.inventory_customs_declaration
            WHERE id=? AND tenant_id=? AND company_id=?
            """,id,scope.tenantId(),scope.companyId());
        if(result.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy tờ khai.");
        Map<String,Object> row=result.get(0);
        var parsed=decode((String)row.get("source"));
        Map<String,Object> response=new LinkedHashMap<>();
        response.put("id",row.get("id"));response.put("fileName",row.get("file_name"));
        response.put("sha256",row.get("sha256"));response.put("declarationNumber",
                Objects.toString(row.get("declaration_number"),parsed.declarationNumber()));
        response.put("declarationDate",row.get("declaration_date"));
        response.put("dateHint",parsed.declarationDate());
        response.put("status",row.get("status"));
        // DRAFT rows have no posted direction yet; use the XLS <IMP>/<EXP>
        // marker to preselect the correct stock transaction in the browser.
        response.put("direction",row.get("direction")!=null?
                row.get("direction"):parsed.direction());
        response.put("items",parsed.items());
        return response;
    }
    public List<Map<String,Object>> history(Scope scope) {
        return jdbc.queryForList("""
            SELECT id,declaration_number AS "declarationNumber",direction,
                   declaration_date AS "declarationDate",file_name AS "fileName",
                   status,confirmed_by AS "confirmedBy",confirmed_at AS "confirmedAt",
                   declared_subtotal AS "subtotal",vat_amount AS "vatAmount",
                   declared_total_after_vat AS "totalAfterVat"
            FROM public.inventory_customs_declaration WHERE tenant_id=? AND company_id=?
            ORDER BY uploaded_at DESC LIMIT 100
            """,scope.tenantId(),scope.companyId());
    }

    @Transactional(rollbackFor=Exception.class)
    public Map<String,Object> confirm(Scope scope,Confirm req) {
        if(req==null||req.documentId()==null)throw fail("Chọn tờ khai để xác nhận.");
        String direction=required(req.direction(),"Chiều nhập/xuất",8).toUpperCase(Locale.ROOT);
        if(!Set.of("IN","OUT").contains(direction))throw fail("Chọn Nhập kho hoặc Xuất kho.");
        String number=required(req.declarationNumber(),"Số tờ khai",80);
        LocalDate date=req.declarationDate();
        if(date==null||date.isAfter(LocalDate.now()))throw fail("Ngày tờ khai không hợp lệ.");
        String currency=Objects.toString(req.currency(),"VND").trim().toUpperCase(Locale.ROOT);
        if(currency.isBlank())currency="VND";
        if(!Set.of("VND","USD","EUR","JPY","CNY").contains(currency))
            throw fail("Chọn loại tiền hợp lệ.");
        List<Map<String,Object>> rows=jdbc.queryForList("""
            SELECT source_json::text AS payload,status,
                   declaration_number, direction, confirmed_by, confirmed_at
            FROM public.inventory_customs_declaration
            WHERE id=? AND tenant_id=? AND company_id=? FOR UPDATE
            """,req.documentId(),scope.tenantId(),scope.companyId());
        if(rows.size()!=1)throw fail("Tờ khai không tồn tại trong công ty.");
        if("POSTED".equals(rows.get(0).get("status"))) {
            var posted = rows.get(0);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Tờ khai số " + Objects.toString(posted.get("declaration_number"),number) +
                " đã xác nhận " + ("OUT".equals(posted.get("direction"))?"XUẤT":"NHẬP") +
                " kho" + (posted.get("confirmed_by")==null?"":(" bởi " + posted.get("confirmed_by"))) +
                (posted.get("confirmed_at")==null?"":(" lúc " + posted.get("confirmed_at"))) +
                ". Không thể ghi kho hai lần; kiểm tra lịch sử tờ khai.");
        }
        var parsed=decode((String)rows.get(0).get("payload"));
        if(parsed.direction()!=null&&!parsed.direction().equals(direction))
            throw fail("Tờ khai Excel có dấu <" +
                ("OUT".equals(parsed.direction())?"EXP":"IMP") +
                ">, chỉ được xác nhận " +
                ("OUT".equals(parsed.direction())?"XUẤT":"NHẬP") +
                " kho. Không thể đổi chiều giao dịch.");
        if(req.lines()==null||req.lines().size()!=parsed.items().size())
            throw fail("Đối chiếu từng dòng hàng trên tờ khai trước khi xác nhận.");

        Company company=companies.findById(scope.companyId()).orElseThrow(()->fail("Không tìm thấy công ty."));
        if(company.getTenant()==null||!scope.tenantId().equals(company.getTenant().getId()))
            throw fail("Công ty không thuộc tenant.");
        Tenant tenant=tenants.findById(scope.tenantId()).orElseThrow(()->fail("Tenant không tồn tại."));
        Map<Integer,Line> selected=new TreeMap<>();
        Map<Integer,Material> existingMaterials=new TreeMap<>();
        Map<Integer,InventoryEntity> inventories=new TreeMap<>();
        Map<String,Material> createdMaterials=new HashMap<>();
        Map<Integer,String> resolvedNewCodes=new HashMap<>();
        Map<String,Line> newDefinitions=new HashMap<>();
        Map<String,String> canonicalCodes=new HashMap<>();
        Set<String> reservedCodes=new HashSet<>();
        Map<Integer,WarehouseEntity> selectedWarehouses=new TreeMap<>();
        Map<UUID,BigDecimal> outQuantities=new TreeMap<>();
        Map<UUID,List<Integer>> outLineNumbers=new HashMap<>();
        Map<Integer,BigDecimal> taxAmountByLine=new HashMap<>();
        BigDecimal declaredSubtotal=BigDecimal.ZERO;
        BigDecimal declaredVat=BigDecimal.ZERO;
        boolean allLinesPriced=true;

        for(Line line:req.lines()) {
            if(line==null||line.lineIndex()<0||line.lineIndex()>=parsed.items().size()
                ||selected.putIfAbsent(line.lineIndex(),line)!=null)
                throw fail("Dòng tờ khai số " + (line==null?"không xác định":line.lineIndex()+1) +
                    " bị thiếu, trùng hoặc nằm ngoài phạm vi tờ khai. Hãy tải lại và đối chiếu các dòng.");
            var item=parsed.items().get(line.lineIndex());
            String lineCurrency=Objects.toString(item.currency(),"").trim().toUpperCase(Locale.ROOT);
            if(!lineCurrency.isBlank()&&!lineCurrency.equals(currency))
                throw fail("Tiền tệ dòng "+(line.lineIndex()+1)+" ("+lineCurrency+
                    ") không khớp "+currency+". Chọn đúng tiền tệ trước khi xác nhận.");
            BigDecimal qty=decimal(item.quantity(),"Số lượng tờ khai",6);
            BigDecimal ratio=decimal(line.conversionRatio(),"Hệ số quy đổi",8);
            BigDecimal bomQty=qty.multiply(ratio);
            decimal(bomQty,"Số lượng kho",6);
            // VAT is reviewed by the operator, never inferred from customs duty.
            BigDecimal taxRate=line.vatRate()==null?BigDecimal.ZERO:line.vatRate();
            if(taxRate.signum()<0||taxRate.compareTo(new BigDecimal("100"))>0
                ||taxRate.stripTrailingZeros().scale()>3)
                throw fail("VAT phải từ 0 đến 100%, tối đa 3 chữ số thập phân.");
            if(item.unitPrice()!=null){
                BigDecimal base=item.unitPrice().multiply(qty).setScale(4,RoundingMode.HALF_UP);
                BigDecimal lineTax=base.multiply(taxRate)
                    .divide(new BigDecimal("100"),4,RoundingMode.HALF_UP);
                declaredSubtotal=declaredSubtotal.add(base);
                declaredVat=declaredVat.add(lineTax);
                taxAmountByLine.put(line.lineIndex(),lineTax);
            } else {
                // Do not save an apparently complete total without line prices.
                allLinesPriced=false;
            }
            if(line.warehouseId()==null)throw fail("Chưa chọn kho dòng "+(line.lineIndex()+1));
            WarehouseEntity warehouse=warehouses.findById(line.warehouseId())
                .orElseThrow(()->fail("Không tìm thấy kho."));
            if(!scope.companyId().equals(warehouse.getCompanyId())
                ||!scope.tenantId().equals(warehouse.getTenantId()))throw fail("Kho thuộc công ty khác.");
            selectedWarehouses.put(line.lineIndex(),warehouse);
            if("OUT".equals(direction)){
                if(line.inventoryId()==null)throw fail("Xuất kho phải chọn lô tồn kho ở dòng "+(line.lineIndex()+1));
                InventoryEntity inventory=inventoryRepo.findById(line.inventoryId())
                    .orElseThrow(()->fail("Không có lô tồn kho."));
                if(!scope.tenantId().equals(inventory.getTenantId())
                    ||!scope.companyId().equals(inventory.getCompanyId()))
                    throw fail("Lô tồn kho thuộc công ty khác.");
                if(!inventory.getWarehouse().getId().equals(line.warehouseId()))
                    throw fail("Kho của lô hàng không khớp.");
                if(line.materialId()!=null&&!inventory.getMaterial().getId().equals(line.materialId()))
                    throw fail("Mã vật tư không khớp tồn kho.");
                inventories.put(line.lineIndex(),inventory);
                outQuantities.merge(line.inventoryId(),bomQty,BigDecimal::add);
                outLineNumbers.computeIfAbsent(line.inventoryId(),unused->new ArrayList<>())
                    .add(line.lineIndex()+1);
                existingMaterials.put(line.lineIndex(),inventory.getMaterial());
            } else if(line.materialId()!=null) {
                Material m=materialRepo.findById(line.materialId())
                    .orElseThrow(()->fail("Không có mã nguyên vật liệu."));
                if(m.getTenant()==null||m.getCompany()==null
                    ||!scope.companyId().equals(m.getCompany().getId())
                    ||!scope.tenantId().equals(m.getTenant().getId()))throw fail("Mã vật tư khác công ty.");
                existingMaterials.put(line.lineIndex(),m);
            } else {
                String name=required(line.newMaterialName(),"Tên vật tư mới",500);
                String unit=required(line.newMaterialUnit(),"Đơn vị vật tư mới",20);
                String submitted=Objects.toString(line.newMaterialCode(),"").trim();
                String code=submitted.isEmpty()
                    ? materialService.generateAvailableMaterialCode(
                        scope.tenantId(),scope.companyId(),reservedCodes)
                    : required(submitted,"Mã vật tư mới",50);
                String normalized=code.toUpperCase(Locale.ROOT);
                Line first=newDefinitions.get(normalized);
                if(first!=null) {
                    if(!name.equals(first.newMaterialName().trim())
                        ||!unit.equals(first.newMaterialUnit().trim()))
                        throw fail("Dòng " + (line.lineIndex()+1) + ": mã vật tư " + code +
                            " đang dùng đồng thời ở dòng " + (first.lineIndex()+1) +
                            " nhưng tên hoặc đơn vị khác nhau. Chọn cùng mã và cùng đơn vị, hoặc tạo mã mới.");
                    code=canonicalCodes.get(normalized);
                } else {
                    if(materialRepo.existsByMaterialCodeIgnoreCaseAndTenantIdAndCompanyId(
                           code,scope.tenantId(),scope.companyId()))
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Dòng " + (line.lineIndex()+1) + " (" + item.description() +
                            "): mã vật tư " + code + " đã tồn tại trong Materials. " +
                            "Hãy chọn mã có sẵn hoặc bật Tự sinh mã để tạo mã khác.");
                    newDefinitions.put(normalized,line);
                    canonicalCodes.put(normalized,code);
                    reservedCodes.add(code);
                }
                resolvedNewCodes.put(line.lineIndex(),code);
            }
        }
        for(int i=0;i<parsed.items().size();i++)if(!selected.containsKey(i))
            throw fail("Thiếu đối chiếu dòng tờ khai "+(i+1));

        // Ordered row locks, checked against all lines combined, prevent
        // over-deducting a batch even when concurrent customs orders post.
        if("OUT".equals(direction)){
            for(var e:outQuantities.entrySet()) {
                var inv=jdbc.queryForList("""
                    SELECT quantity_on_hand,quantity_reserved,quantity_locked,locked
                    FROM public.inventory
                    WHERE id=? AND tenant_id=? AND company_id=? FOR UPDATE
                    """,e.getKey(),scope.tenantId(),scope.companyId());
                if(inv.size()!=1)throw fail("Lô hàng không tồn tại.");
                var row=inv.get(0);
                if(Boolean.TRUE.equals(row.get("locked")))throw fail("Lô tồn kho đã khóa.");
                BigDecimal available=((BigDecimal)row.get("quantity_on_hand"))
                    .subtract(Objects.requireNonNullElse((BigDecimal)row.get("quantity_reserved"),BigDecimal.ZERO))
                    .subtract(Objects.requireNonNullElse((BigDecimal)row.get("quantity_locked"),BigDecimal.ZERO));
                if(available.compareTo(e.getValue())<0) {
                    InventoryEntity inventory = inventories.values().stream()
                        .filter(record->record.getId().equals(e.getKey()))
                        .findFirst().orElse(null);
                    String batch = inventory==null?e.getKey().toString():inventory.getBatchNo();
                    String code = inventory==null?"":inventory.getMaterial().getMaterialCode();
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Dòng " + outLineNumbers.get(e.getKey()) + ": không đủ tồn kho cho vật tư " +
                        code + ", lô " + batch + ". Tổng cần xuất " + e.getValue() +
                        ", khả dụng " + available +
                        ". Hãy giảm số lượng hoặc chọn lô khác.");
                }
            }
        }
        // Concurrency-safe number+direction unique check. The DRAFT itself is
        // locked; the unique index blocks posting the same declaration from
        // a second upload regardless of filename.
        var clashes=jdbc.queryForList("""
            SELECT id,file_name,confirmed_by,confirmed_at
            FROM public.inventory_customs_declaration
            WHERE tenant_id=? AND company_id=? AND declaration_number=?
                AND direction=? AND status='POSTED'
            ORDER BY confirmed_at DESC LIMIT 1
            """,scope.tenantId(),scope.companyId(),number,direction);
        if(!clashes.isEmpty()){
            var previous=clashes.get(0);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Số tờ khai " + number + " đã được xác nhận " +
                ("OUT".equals(direction)?"XUẤT":"NHẬP") + " kho từ file " +
                Objects.toString(previous.get("file_name"),"khác") +
                (previous.get("confirmed_by")==null?"":(" bởi " + previous.get("confirmed_by"))) +
                (previous.get("confirmed_at")==null?"":(" lúc " + previous.get("confirmed_at"))) +
                ". Không nhập/xuất trùng; kiểm tra lịch sử tờ khai trước khi tiếp tục.");
        }
        int updated=jdbc.update("""
            UPDATE public.inventory_customs_declaration SET status='POSTED',direction=?,
               declaration_number=?,declaration_date=?,confirmed_by=?,confirmed_at=now(),
               declared_subtotal=?,vat_amount=?,declared_total_after_vat=?
            WHERE id=? AND tenant_id=? AND company_id=? AND status='DRAFT'
            """,direction,number,date,scope.username(),
            allLinesPriced?declaredSubtotal:null,
            allLinesPriced?declaredVat:null,
            allLinesPriced?declaredSubtotal.add(declaredVat):null,
            req.documentId(),scope.tenantId(),scope.companyId());
        if(updated!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Trạng thái tờ khai " + number +
            " đã thay đổi hoặc người khác đã xác nhận. Tải lại lịch sử và chọn chứng từ chưa ghi kho.");

        List<Map<String,Object>> results=new ArrayList<>();
        for(var item:parsed.items()){
            Line line=selected.get(item.lineIndex());
            Material material=existingMaterials.get(item.lineIndex());
            if(material==null){
                String code=resolvedNewCodes.get(item.lineIndex());
                material=createdMaterials.get(code);
                if(material==null){
                    material=new Material();
                    material.setMaterialCode(code);material.setMaterialName(line.newMaterialName().trim());
                    material.setUnit(line.newMaterialUnit().trim());
                    material.setMaterialType("MATERIAL");
                    material.setIsActive(true);
                    try {
                        material=materialService.createForCompany(material,company,tenant);
                    } catch (DataIntegrityViolationException conflict) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Dòng " + (item.lineIndex()+1) + " (" + item.description() +
                            "): không tạo được vật tư mã " + code +
                            " vì mã đã bị trùng trong Materials. Tải lại và chọn mã có sẵn hoặc sinh mã mới.",
                            conflict);
                    }
                    createdMaterials.put(code,material);
                }
            }
            BigDecimal qty=item.quantity().multiply(line.conversionRatio());
            String batch="OUT".equals(direction)?inventories.get(item.lineIndex()).getBatchNo():
                    required(line.batchNo(),"Số lô nhập kho",50);
            UUID inventoryId;
            if("IN".equals(direction)) {
                // Customs-declared valuation is NOT the actual procurement
                // cost. Audit it in customs_declaration_line, but never
                // overwrite a material's existing inventory purchase price.
                var entry=inventoryService.addStockByIds(
                    material.getId(),line.warehouseId(),qty,batch,
                    null,null,null,null,null,null,scope.tenantId(),scope.companyId(),
                    "Nhập kho tờ khai HQ "+number,scope.username(),
                    "Tên tờ khai: "+item.description()+" | HS: "+item.hsCode(),
                    null,null,null,item.unit(),item.quantity(),line.conversionRatio(),null,
                    "CUSTOMS_DECLARATION",req.documentId());
                inventoryId=entry.getId();
            }else{
                InventoryEntity inv=inventories.get(item.lineIndex());
                InventoryMovementEntity movement=movements.recordOutMovement(material.getId(),
                    line.warehouseId(),qty,inv.getUnit(),batch,
                    "Xuất kho tờ khai HQ "+number,scope.username(),
                    "CUSTOMS_DECLARATION",req.documentId(),inv.getId(),
                    "Tên tờ khai: "+item.description()+" | HS: "+item.hsCode(),
                    scope.tenantId(),scope.companyId());
                inventoryId=inv.getId();
            }
            jdbc.update("""
                INSERT INTO public.inventory_customs_declaration_line
                  (id,declaration_id,line_index,hs_code,declared_description,material_id,
                   original_material_name,warehouse_id,inventory_id,batch_no,direction,
                   quantity_declared,quantity_stock,conversion_ratio,unit_declared,unit_stock,
                   unit_price,currency,country_of_origin,vat_rate,vat_amount)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,UUID.randomUUID(),req.documentId(),item.lineIndex(),item.hsCode(),
                item.description(),material.getId(),material.getMaterialName(),line.warehouseId(),
                inventoryId,batch,direction,item.quantity(),qty,line.conversionRatio(),
                item.unit(),material.getUnit(),item.unitPrice(),currency,item.originCountry(),
                line.vatRate()==null?BigDecimal.ZERO:line.vatRate(),
                taxAmountByLine.get(item.lineIndex()));
            results.add(Map.of("lineIndex",item.lineIndex(),"inventoryId",inventoryId,
                    "materialId",material.getId(),"nameOnDeclaration",item.description()));
        }
        return Map.of("id",req.documentId(),"direction",direction,"declarationNumber",number,
                "postedLines",results);
    }
}
