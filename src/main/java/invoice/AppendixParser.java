package invoice;
import java.util.*;
import java.util.regex.*;
import java.time.*;
/** Conservative parser for the column-ordered Google OCR of PLX origin declarations. */
public class AppendixParser {
 public static boolean accepts(String text){String t=Parser.fold(text);return t.contains("phu luc")&&t.contains("xuat xu")&&t.contains("nha san xuat");}
 public static Invoice parse(String text){
  text=text.replace("\r\n","\n");
  Invoice r=new Invoice();r.type="APPENDIX";r.profile="plx-origin-google-v1";r.text=text;
  r.put("seller",Parser.match(text,"Tên nhà sản xuất\\s*:\\s*([^\\n]+)"));
  r.put("sellerTaxId",Parser.match(text,"Mã số Doanh nghiệp\\s*:\\s*([0-9 -]+)" ).replace(" ",""));
  r.put("buyer",Parser.match(text,"cho công ty\\s*:\\s*([^\\n]+)"));
  r.put("currency",text.contains("VND")?"VND":"");
  var refs=Pattern.compile("(\\d{2})/(\\d{2})/(\\d{4})\\s+(1?[A-Z]\\d{2}[A-Z]{3})\\s*-\\s*(\\d+)").matcher(text);
  List<String[]> references=new ArrayList<>();while(refs.find())references.add(new String[]{refs.group(4),refs.group(5),refs.group(3)+"-"+refs.group(2)+"-"+refs.group(1)});
  if(!references.isEmpty()){r.put("serial",references.get(0)[0]);r.put("number",references.get(0)[1]);r.put("date",references.get(0)[2]);}
  if(references.stream().anyMatch(a->!a[0].equals(r.get("serial"))||!a[1].equals(r.get("number"))))r.warnings.add("Missing single invoice reference: appendix contains multiple invoices");
  int descriptionStart=text.indexOf("Tên hàng\n"),quantityStart=text.indexOf("Số lượng\n",Math.max(0,descriptionStart)),summaryStart=text.indexOf("Cộng tiền hàng",Math.max(0,quantityStart));
  if(descriptionStart>=0&&quantityStart>descriptionStart&&summaryStart>quantityStart){
   String descriptions=text.substring(descriptionStart+"Tên hàng\n".length(),quantityStart).trim();String[] parts=descriptions.split("\\n(?=\\|)");
   Matcher numbers=Pattern.compile("(?m)^\\s*(\\d[\\d,.]*)\\s*$").matcher(text.substring(quantityStart,summaryStart));List<String> values=new ArrayList<>();while(numbers.find())values.add(numbers.group(1).replace(",",""));
   if(parts.length==references.size()&&values.size()==parts.length*2){for(int i=0;i<parts.length;i++){Map<String,String> item=new LinkedHashMap<>();item.put("line",String.valueOf(i+1));item.put("description",parts[i].replaceFirst("^\\|","").replace('\n',' ').trim());item.put("unit","");item.put("quantity",values.get(i*2));item.put("unitPrice","");item.put("amount",values.get(i*2+1));r.items.add(item);}}
  }
  if(summaryStart>=0){String tail=text.substring(summaryStart);int end=tail.indexOf("Xác nhận");if(end>0)tail=tail.substring(0,end);var nums=Pattern.compile("(?m)^\\s*(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?)\\s*$").matcher(tail);List<String> totals=new ArrayList<>();while(nums.find())totals.add(nums.group(1).replace(",",""));if(totals.size()==3){r.put("subtotal",totals.get(0));r.put("vat",totals.get(1));r.put("total",totals.get(2));}}
  Parser.validate(r);return r;
 }
 public static Invoice parse(String text,List<com.fasterxml.jackson.databind.JsonNode> pages){
  Invoice r=parse(text);r.warnings.clear();
  // Geometry takes precedence over column-ordered text; reset references and totals.
  if(!pages.isEmpty()){for(String k:List.of("serial","number","date","subtotal","vat","total"))r.put(k,"");VisionTable.extract(r,pages);}
  r.profile="plx-origin-geometry-v2/"+r.get("sellerTaxId");Parser.validate(r);return r;
 }
}
