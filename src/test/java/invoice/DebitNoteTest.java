package invoice;
import java.nio.file.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;

class DebitNoteTest {
 @TempDir Path temp;
 @Test void parsesChargesAndExpandsLongestPhraseWithoutLosingNotes()throws Exception{
  String text="DEBIT NOTE\nKính gửi : Khách hàng\nNgày : 27/10/2026\n1 VC CL - Điểm đến Cont 1 4,100,000 4,100,000 HPPU2002523/50H86361\n2 Phí Hải quan BL TEST Cont 2 1,000,000 2,000,000\nTổng 1 6,100,000\nVAT ( 8% ) 488,000\nTổng (2) 6,588,000\nNgười thụ hưởng: Đơn vị vận tải\n";
  var invoice=new Parser().parse(text);TransportFields.apply(invoice,new Settings(temp));
  assertEquals("DEBIT_NOTE",invoice.type);assertEquals(2,invoice.items.size());assertEquals("2026-10-27",invoice.get("date"));assertEquals("6588000",invoice.get("total"));
  var item=invoice.items.get(0);assertEquals("vận chuyển Cát Lái - Điểm đến",item.get("description"));assertEquals("VC CL - Điểm đến",item.get("originalDescription"));assertEquals("50H86361",item.get("truckPlate"));assertEquals("HPPU2002523/50H86361",item.get("notes"));assertEquals("",invoice.items.get(1).get("truckPlate"));
  assertFalse(invoice.warnings.stream().anyMatch(w->w.startsWith("Missing ")||w.startsWith("Check:")),invoice.warnings.toString());
  Path output=temp.resolve("debit.xlsx");Excel.write(output,List.of(invoice),false);
  try(var book=new XSSFWorkbook(Files.newInputStream(output))){assertEquals(2,book.getSheet("Debit items").getLastRowNum());assertEquals("Biển số xe",book.getSheet("Debit items").getRow(0).getCell(12).getStringCellValue());assertEquals("50H86361",book.getSheet("Debit items").getRow(1).getCell(12).getStringCellValue());assertEquals(1,book.getSheet("Debit notes").getLastRowNum());assertEquals(0,book.getSheet("Invoices").getLastRowNum());}
 }
 @Test void respectsWordBoundariesAndNeverTreatsContainerAsPlate()throws Exception{
  var invoice=new Invoice();invoice.items.add(new LinkedHashMap<>(Map.of("description","SERVICE VC - Depot", "notes","HPPU2002523 / 50H-863.61")));
  invoice.items.add(new LinkedHashMap<>(Map.of("description","SVC CL container", "notes","EGHU3215725")));
  TransportFields.apply(invoice,new Settings(temp));assertEquals("SERVICE vận chuyển - Depot",invoice.items.get(0).get("description"));assertEquals("50H86361",invoice.items.get(0).get("truckPlate"));assertEquals("SVC CL container",invoice.items.get(1).get("description"));assertEquals("",invoice.items.get(1).get("truckPlate"));
 }
 @Test void loadsCustomPreconfiguredPhrases()throws Exception{
  var settings=new Settings(temp);Path rules=temp.resolve("phrases.json");Files.writeString(rules,"[{\"from\":\"VC\",\"to\":\"custom transport\"}]");settings.p.setProperty("phrase.rules",rules.toString());
  var invoice=new Invoice();invoice.items.add(new LinkedHashMap<>(Map.of("description","VC Depot")));TransportFields.apply(invoice,settings);assertEquals("custom transport Depot",invoice.items.get(0).get("description"));
 }
}
