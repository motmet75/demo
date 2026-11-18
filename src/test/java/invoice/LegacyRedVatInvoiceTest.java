package invoice;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Regression coverage for legacy red VAT invoices supplied as scanned images. */
class LegacyRedVatInvoiceTest {
 @Test void parsesVisibleAmountsAndKeepsAbsentSellerTaxIdUnverified(){
  String ocr = """
   HÓA ĐƠN GIÁ TRỊ GIA TĂNG
   Liên 2: Giao cho người mua
   Ngày 16 tháng 01 năm 2017
   Ký hiệu: AB/17T
   Số: 0000007
   Đơn vị bán hàng: Công ty Cổ phần ABC
   Mã số thuế:
   Tên đơn vị: Công ty TNHH Bảo Oanh
   Hình thức thanh toán: TM/CK
   STT Mã hàng Tên hàng hóa, dịch vụ Đơn vị tính Số lượng Đơn giá Thành tiền
   A B C D 1 2 3=1x2
   1 DELLXPS13 Máy tính xách tay Dell XPS 13 Chiếc 2,00 15.899.000,00 31.798.000
   Cộng tiền hàng:
   31.798.000
   Thuế suất GTGT: 10% Tiền thuế GTGT:
   3.179.800
   Tổng tiền thanh toán:
   34.977.800
   """;
  Invoice invoice=new Parser().parse(ocr);
  Parser.validate(invoice);
  assertEquals("INVOICE",invoice.type);
  assertEquals("AB/17T",invoice.get("serial"));
  assertEquals("0000007",invoice.get("number"));
  assertEquals("2017-01-16",invoice.get("date"));
  assertEquals("31798000",invoice.get("subtotal"));
  assertEquals("3179800",invoice.get("vat"));
  assertEquals("34977800",invoice.get("total"));
  assertEquals(1,invoice.items.size());
  assertEquals("2.00",invoice.items.get(0).get("quantity"));
  assertEquals("15899000.00",invoice.items.get(0).get("unitPrice"));
  assertEquals("31798000",invoice.items.get(0).get("amount"));
  assertTrue(invoice.warnings.contains("Missing sellerTaxId"));
  assertTrue(invoice.warnings.stream().noneMatch(w->w.startsWith("Check:")),invoice.warnings.toString());
 }
 @Test void supportsBothMoneyConventions(){
  assertEquals("15899000.00",Parser.money("15.899.000,00").toPlainString());
  assertEquals("15899000.00",Parser.money("15,899,000.00").toPlainString());
  assertEquals("31798000",Parser.money("31.798.000").toPlainString());
 }
 @Test void borderedGridDoesNotTreatPrintedAbcLegendAsProduct(){
  List<TableGrid.Box> words=new ArrayList<>();
  String[] headers={"STT","Description","Unit","Quantity","Unit Price","Amount"};
  String[] markers={"A","B","C","D","1","3"};
  String[] product={"1","Máy tính xách tay","Chiếc","2,00","15.899.000,00","31.798.000"};
  int[] x={30,90,420,520,620,740};
  for(int col=0;col<6;col++){
   words.add(new TableGrid.Box(headers[col],x[col],60,Math.min(100,headers[col].length()*6),12,false));
   words.add(new TableGrid.Box(markers[col],x[col],110,12,12,false));
   words.add(new TableGrid.Box(product[col],x[col],155,Math.min(120,product[col].length()*6),12,false));
  }
  var grid=new TableGrid.Grid(List.of(20,70,400,500,600,720,860),List.of(50,100,135,205));
  var result=TableGrid.extract(List.of(grid),words,"31.798.000",1,900,320);
  assertEquals(1,result.items().size(),result.items().toString());
  assertEquals("1",result.items().get(0).get("line"));
  assertEquals("31798000",result.items().get(0).get("amount"));
 }
}
