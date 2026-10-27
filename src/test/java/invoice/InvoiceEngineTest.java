package invoice;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
class InvoiceEngineTest {
 @Test void retainsMaterialCodesAndHandlesOcrArtifacts(){
  assertEquals("A05.0104.000001",ItemCodes.materialCode("a05 . 01 04 . 000001"));
  assertEquals("A05.02.04.000079",ItemCodes.materialCode("NVL CA05.02.04.000079)"));
  assertEquals("",ItemCodes.materialCode("A05.0104.0000019"));
  Invoice invoice=new Invoice();invoice.items.add(new LinkedHashMap<>(Map.of("description","A05.0104.000001","materialCode","MANUAL")));ItemCodes.fill(invoice);assertEquals("MANUAL",invoice.items.get(0).get("materialCode"));
 }
 @Test void scannedPageNeedsOcrAndTotalsAreValidated(){
  assertTrue(Engine.needsOcr("scanner watermark"));assertFalse(Engine.needsOcr("readable text ".repeat(20)));
  Invoice invoice=new Invoice();invoice.put("subtotal","100");invoice.put("vat","10");invoice.put("total","120");Parser.validate(invoice);assertTrue(invoice.warnings.contains("Check: subtotal + VAT differs from total"));
 }
}
