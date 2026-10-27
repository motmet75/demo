package invoice;
import java.util.*;
public class Invoice {
 public String source="",sha256="",type="INVOICE",method="PDF text",profile="generic-v1",text="";
 public LinkedHashMap<String,String> fields=new LinkedHashMap<>();
 public List<Map<String,String>> items=new ArrayList<>();
 public List<String> warnings=new ArrayList<>();
 public boolean approved=false;
 public String approvalMode="";
 public String parserVersion="2026.10-border-grid-v2";
 public List<Map<String,Object>> tableEvidence=new ArrayList<>();
 public String linkedInvoice="",reconciliation="";
 public static final List<String> KEYS=List.of("seller","sellerTaxId","buyer","buyerTaxId","serial","number","date","currency","subtotal","vat","total");
 public Invoice(){KEYS.forEach(k->fields.put(k,""));}
 public String get(String key){return fields.getOrDefault(key,"");}
 public void put(String key,String value){fields.put(key,value==null?"":value.trim());}
}
