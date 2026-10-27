package com.demo.invoicedesk;
import invoice.Invoice;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SupplierRulesTest {
 @Test void normalizesBranchTaxIds(){assertEquals("1234567890001",SupplierRules.taxId("1234567890-001"));assertThrows(IllegalArgumentException.class,()->SupplierRules.taxId(""));}
 @Test void extractsAndRequiresFields(){
  Invoice invoice=new Invoice();invoice.text="Invoice no: INV-109";
  SupplierRules.apply(invoice,List.of(new SupplierRules.Rule("number","Invoice no: (\\S+)","",true),new SupplierRules.Rule("currency","","VND",true),new SupplierRules.Rule("buyer","","",true)));
  assertEquals("INV-109",invoice.get("number"));assertEquals("VND",invoice.get("currency"));assertTrue(invoice.warnings.contains("Missing supplier field buyer"));
 }
 @Test void rejectsUnsafeOrInvalidConfiguration(){
  assertThrows(IllegalArgumentException.class,()->SupplierRules.validate(List.of(new SupplierRules.Rule("sellerTaxId","","1234567890",true))));
  assertThrows(IllegalArgumentException.class,()->SupplierRules.validate(List.of(new SupplierRules.Rule("number","no-capture","",true))));
  assertThrows(IllegalArgumentException.class,()->SupplierRules.validate(List.of(new SupplierRules.Rule("number","(?<=number)(.*)","",true))));
 }
}
