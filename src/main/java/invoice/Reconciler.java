package invoice;
import java.util.*;
import java.math.BigDecimal;
public class Reconciler {
 static String identity(Invoice r){return r.get("sellerTaxId")+"/"+r.get("serial")+"/"+r.get("number").replaceFirst("^0+(?!$)","");}
 public static void reconcile(List<Invoice> records){
  Map<String,List<Invoice>> invoices=new HashMap<>();for(Invoice r:records)if(r.type.equals("INVOICE"))invoices.computeIfAbsent(identity(r),k->new ArrayList<>()).add(r);
  for(Invoice r:records){if(!r.type.equals("APPENDIX"))continue;r.warnings.removeIf(w->w.startsWith("Reconciliation:"));r.linkedInvoice="";r.reconciliation="No matching VAT invoice imported";
   List<Invoice> matches=invoices.getOrDefault(identity(r),List.of());if(matches.size()!=1){if(matches.size()>1)r.reconciliation="Multiple matching VAT invoices; resolve duplicates";continue;}
   Invoice invoice=matches.get(0);r.linkedInvoice=invoice.source;List<String> conflicts=new ArrayList<>();
   if(!r.get("date").equals(invoice.get("date")))conflicts.add("date");if(!r.get("currency").equals(invoice.get("currency")))conflicts.add("currency");
   for(String field:List.of("subtotal","vat","total"))if(!r.get(field).isBlank()&&!invoice.get(field).isBlank())try{if(new BigDecimal(r.get(field)).compareTo(new BigDecimal(invoice.get(field)))!=0)conflicts.add(field);}catch(Exception e){conflicts.add(field);}
   if(!conflicts.isEmpty()){r.reconciliation="Mismatch: "+String.join(", ",conflicts);r.warnings.add("Reconciliation: "+r.reconciliation);r.approved=false;}
   else r.reconciliation=r.get("total").isBlank()?"Goods subtotal matches VAT invoice; appendix does not state VAT/final total":"Stated amounts match VAT invoice";
  }
 }
}
