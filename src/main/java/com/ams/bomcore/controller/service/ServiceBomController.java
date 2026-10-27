package com.ams.bomcore.controller.service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.ams.bomcore.domain.service.ServiceBom;
import com.ams.bomcore.domain.service.ServiceBomItem;
import com.ams.bomcore.repository.ServiceBomItemRepository;
import com.ams.bomcore.repository.ServiceBomRepository;

@RestController
@RequestMapping("/bom/service-boms")
@CrossOrigin(origins = "http://localhost:5173")
public class ServiceBomController {
    private final ServiceBomRepository boms;
    private final ServiceBomItemRepository items;
    public ServiceBomController(ServiceBomRepository boms, ServiceBomItemRepository items){this.boms=boms;this.items=items;}
    private UUID id(UUID value, String header){try{return header!=null&&!header.isBlank()?UUID.fromString(header):value;}catch(Exception e){return value;}}
    private UUID tenant(UUID t,String h){return id(t,h);} private UUID company(UUID c,String h){return id(c,h);}
    private ResponseEntity<?> scope(UUID t, UUID c){return t==null||c==null?ResponseEntity.badRequest().body(Map.of("error","tenantId and companyId are required")):null;}

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required=false) UUID tenantId,@RequestParam(required=false) UUID companyId,
      @RequestHeader(value="X-Tenant-Id",required=false) String ht,@RequestHeader(value="X-Company-Id",required=false) String hc){
        tenantId=tenant(tenantId,ht);companyId=company(companyId,hc);ResponseEntity<?> missing=scope(tenantId,companyId);if(missing!=null)return missing;
        return ResponseEntity.ok(boms.findAllByTenantIdAndCompanyIdOrderByServiceCode(tenantId,companyId).stream().map(this::dto).toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String,Object> body,@RequestParam(required=false) UUID tenantId,@RequestParam(required=false) UUID companyId,
      @RequestHeader(value="X-Tenant-Id",required=false) String ht,@RequestHeader(value="X-Company-Id",required=false) String hc){
        tenantId=tenant(tenantId,ht);companyId=company(companyId,hc);ResponseEntity<?> missing=scope(tenantId,companyId);if(missing!=null)return missing;
        ServiceBom b=new ServiceBom();b.setTenantId(tenantId);b.setCompanyId(companyId);b.setServiceCode(text(body,"serviceCode"));b.setServiceName(text(body,"serviceName"));
        b.setServiceType(body.get("serviceType")==null?"CAMERA_INSTALLATION":text(body,"serviceType"));b.setNotes(text(body,"notes"));b.setActive(body.get("active")==null||Boolean.parseBoolean(String.valueOf(body.get("active"))));
        if(b.getServiceCode()==null||b.getServiceName()==null)return ResponseEntity.badRequest().body(Map.of("error","serviceCode and serviceName are required"));
        return ResponseEntity.ok(dto(boms.save(b)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id,@RequestParam(required=false) UUID tenantId,@RequestParam(required=false) UUID companyId,
      @RequestHeader(value="X-Tenant-Id",required=false) String ht,@RequestHeader(value="X-Company-Id",required=false) String hc){
        tenantId=tenant(tenantId,ht);companyId=company(companyId,hc);ResponseEntity<?> missing=scope(tenantId,companyId);if(missing!=null)return missing;
        return boms.findByIdAndTenantIdAndCompanyId(id,tenantId,companyId).map(b->ResponseEntity.ok(dto(b))).orElseGet(()->ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<?> addItem(@PathVariable UUID id,@RequestBody Map<String,Object> body,@RequestParam(required=false) UUID tenantId,@RequestParam(required=false) UUID companyId,
      @RequestHeader(value="X-Tenant-Id",required=false) String ht,@RequestHeader(value="X-Company-Id",required=false) String hc){
        tenantId=tenant(tenantId,ht);companyId=company(companyId,hc);ResponseEntity<?> missing=scope(tenantId,companyId);if(missing!=null)return missing;
        Optional<ServiceBom> found=boms.findByIdAndTenantIdAndCompanyId(id,tenantId,companyId);if(found.isEmpty())return ResponseEntity.notFound().build();
        ServiceBomItem i=new ServiceBomItem();i.setServiceBom(found.get());i.setCostType(text(body,"costType"));i.setDescription(text(body,"description"));i.setUnit(body.get("unit")==null?"job":text(body,"unit"));
        i.setQuantity(decimal(body,"quantity",BigDecimal.ONE));i.setUnitCost(decimal(body,"unitCost",BigDecimal.ZERO));i.setMaterialId(uuid(body,"materialId"));i.setOptional(Boolean.parseBoolean(String.valueOf(body.getOrDefault("optional",false))));
        if(i.getCostType()==null||i.getDescription()==null)return ResponseEntity.badRequest().body(Map.of("error","costType and description are required"));
        return ResponseEntity.ok(itemDto(items.save(i)));
    }
    @GetMapping("/{id}/items")
    public ResponseEntity<?> listItems(@PathVariable UUID id,@RequestParam(required=false) UUID tenantId,@RequestParam(required=false) UUID companyId,
      @RequestHeader(value="X-Tenant-Id",required=false) String ht,@RequestHeader(value="X-Company-Id",required=false) String hc){
        tenantId=tenant(tenantId,ht);companyId=company(companyId,hc);ResponseEntity<?> missing=scope(tenantId,companyId);if(missing!=null)return missing;
        if(boms.findByIdAndTenantIdAndCompanyId(id,tenantId,companyId).isEmpty())return ResponseEntity.notFound().build();
        return ResponseEntity.ok(items.findAllByServiceBomIdOrderByCostType(id).stream().map(this::itemDto).toList());
    }
    private Map<String,Object> dto(ServiceBom b){Map<String,Object> m=new LinkedHashMap<>();m.put("id",b.getId());m.put("tenantId",b.getTenantId());m.put("companyId",b.getCompanyId());m.put("serviceCode",b.getServiceCode());m.put("serviceName",b.getServiceName());m.put("serviceType",b.getServiceType());m.put("active",b.getActive());m.put("notes",b.getNotes());m.put("items",items.findAllByServiceBomIdOrderByCostType(b.getId()).stream().map(this::itemDto).toList());return m;}
    private Map<String,Object> itemDto(ServiceBomItem i){return Map.of("id",i.getId(),"serviceBomId",i.getServiceBom().getId(),"costType",i.getCostType(),"description",i.getDescription(),"quantity",i.getQuantity(),"unit",i.getUnit(),"unitCost",i.getUnitCost(),"materialId",i.getMaterialId(),"optional",i.getOptional());}
    private static String text(Map<String,Object> m,String k){return m.get(k)==null?null:String.valueOf(m.get(k));}
    private static UUID uuid(Map<String,Object> m,String k){try{return m.get(k)==null?null:UUID.fromString(String.valueOf(m.get(k)));}catch(Exception e){return null;}}
    private static BigDecimal decimal(Map<String,Object> m,String k,BigDecimal d){try{return m.get(k)==null?d:new BigDecimal(String.valueOf(m.get(k)));}catch(Exception e){return d;}}
}
