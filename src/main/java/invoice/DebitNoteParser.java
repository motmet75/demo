package invoice;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;

/** Debit-note charge rows with a notes column after the monetary columns. */
public final class DebitNoteParser {
 public static boolean accepts(String text){return Pattern.compile("(?im)^\\s*DEBIT\\s+NOTE\\b").matcher(text).find();}
 private static String amount(String value){return new BigDecimal(value.replace(",","")).toPlainString();}
 public static Invoice parse(String text){
  Invoice invoice=new Invoice();invoice.type="DEBIT_NOTE";invoice.profile="logistics-debit-v1";invoice.text=text;invoice.put("currency","VND");
  Pattern row=Pattern.compile("^(\\d+)\\s+(.+?)\\s+(Cont|Chuyến|Trip|Container)\\s+(\\d+(?:\\.\\d+)?)\\s+([\\d,]+)\\s+([\\d,]+)(?:\\s+(.*))?$",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
  for(String raw:Normalizer.normalize(text,Normalizer.Form.NFC).split("\\R")){
   String line=raw.trim(),fold=Parser.fold(line);
   if(fold.startsWith("kinh gui"))invoice.put("buyer",line.substring(line.indexOf(':')+1));
   if(fold.startsWith("nguoi thu huong:"))invoice.put("seller",line.substring(line.indexOf(':')+1));
   if(fold.startsWith("ngay")){
    var date=Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{4})").matcher(line);
    if(date.find())try{invoice.put("date",LocalDate.of(Integer.parseInt(date.group(3)),Integer.parseInt(date.group(2)),Integer.parseInt(date.group(1))).toString());}catch(Exception e){invoice.warnings.add("Check: invalid debit-note date");}
   }
   var total=Pattern.compile("(?i)^(tong\\s*(?:\\(?([12])\\)?)?|vat\\s*\\([^)]*\\))\\s+([\\d,]+)$").matcher(fold);
   if(total.matches())invoice.put(fold.startsWith("vat")?"vat":"2".equals(total.group(2))?"total":"subtotal",amount(total.group(3)));
   var match=row.matcher(line);if(!match.matches())continue;
   Map<String,String> item=new LinkedHashMap<>();item.put("line",match.group(1));item.put("description",match.group(2));item.put("unit",match.group(3));item.put("quantity",match.group(4));item.put("unitPrice",amount(match.group(5)));item.put("amount",amount(match.group(6)));item.put("notes",Objects.toString(match.group(7),""));invoice.items.add(item);
  }
  invoice.warnings.add("Debit note; not a VAT invoice. Tax IDs and invoice serial are not inferred.");
  Parser.validate(invoice);return invoice;
 }
}
