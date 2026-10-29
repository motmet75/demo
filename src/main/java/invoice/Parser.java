package invoice;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.*;
import java.nio.file.*;
import com.fasterxml.jackson.databind.*;
public class Parser {
 public static String fold(String s){return Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}","").replace('đ','d').replace('Đ','D').toLowerCase(Locale.ROOT);}
 static String match(String text,String regex){var m=Pattern.compile(regex,Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE|Pattern.MULTILINE).matcher(text);return m.find()?m.group(1).trim():"";}
 public static BigDecimal money(String s){
  s=s.replaceAll("[\\s\\u00a0]","");
  if(!s.matches("-?\\d+(?:[.,]\\d+)*"))throw new IllegalArgumentException("Invalid amount: "+s);
  if(s.contains(","))s=s.replace(".","").replace(',','.');
  else if(s.matches("-?\\d{1,3}(?:\\.\\d{3})+"))s=s.replace(".","");
  return new BigDecimal(s);
 }
 static BigDecimal number(String s,String document){
  boolean english=Pattern.compile("\\d{1,3}(?:,\\d{3}){2,}(?![.,\\d])").matcher(document).find()&&!Pattern.compile("\\d{1,3}(?:\\.\\d{3}){2,}").matcher(document).find();
  return english?new BigDecimal(s.replace(",","")):money(s);
 }
 public Invoice parse(String text){
  if(DebitNoteParser.accepts(text))return DebitNoteParser.parse(text);
  Invoice r=new Invoice(); r.text=text; String t=fold(text);
  if(!t.contains("hoa don")&&!t.contains("vat invoice")){r.type=t.contains("phu luc")||t.contains("cptpp")?"APPENDIX":"UNKNOWN";r.warnings.add("Not identified as an invoice; inspect source");return r;}
  r.put("serial",match(text,"Ký hiệu[^:\\n]*:[ \\t]*([A-Z0-9]+)"));
  if(r.get("serial").isBlank())r.put("serial",match(text,"Ký hiệu[ \\t]+([A-Z0-9]+)"));
  r.put("number",match(text,"(?:^|\\s)Số(?:[ \\t]*\\([^\\n)]*\\))?[ \\t]*:[ \\t]*(\\d+)"));
  if(r.get("number").isBlank())r.put("number",match(text,"^Số[ \\t]+(\\d+)"));
  var d=Pattern.compile("ngay[^\\d\\n]*(\\d{1,2})[^\\d\\n]+(\\d{1,2})[^\\d\\n]+(\\d{4})").matcher(t);
  if(d.find())try{r.put("date",LocalDate.of(Integer.parseInt(d.group(3)),Integer.parseInt(d.group(2)),Integer.parseInt(d.group(1))).toString());}catch(Exception e){r.warnings.add("Invalid invoice date");}
  String seller=match(text,"(?:Đơn vị bán hàng|Tên đơn vị[ \\t]*\\(Seller\\))[^:\\n]*:[ \\t]*(.+)");
  if(seller.isBlank())seller=match(text,"^(CÔNG TY[^\\n]+)");
  if(seller.isBlank())seller=match(text,"Đơn vị bán hàng[ \\t]+(CÔNG TY[^\\n]+)");
  seller=seller.replaceAll("(?iu)[ \\t]+Họ tên người mua hàng.*$","");r.put("seller",seller);
  r.put("buyer",match(text,"Tên đơn vị(?![ \\t]*\\(Seller\\))[^:\\n]*:[ \\t]*(.+)"));
  if(r.get("buyer").isBlank())r.put("buyer",match(text,"Tên đơn vị[ \\t]+(CÔNG TY[^\\n]+)"));
  var tax=Pattern.compile("(?iu)Mã số thuế[^:\\n]*:[ \\t]*([0-9][0-9 \\t-]*)").matcher(text);
  LinkedHashSet<String> ids=new LinkedHashSet<>();while(tax.find())ids.add(tax.group(1).replaceAll("\\s", ""));
  var idList=new ArrayList<>(ids);if(!idList.isEmpty())r.put("sellerTaxId",idList.get(0));if(idList.size()>1)r.put("buyerTaxId",idList.get(1));
  if(idList.isEmpty()){var plain=Pattern.compile("(?iu)Mã số thuế[ \\t]+([0-9-]+)").matcher(text);if(plain.find())r.put("sellerTaxId",plain.group(1));if(plain.find())r.put("buyerTaxId",plain.group(1));}
  r.put("currency",match(text,"(?:Currency unit|Đồng tiền thanh toán|Đơn vị tiền tệ)[^:\\n]*:[ \\t]*([A-Z]{3})"));
  if(r.get("currency").isBlank()&&(t.contains("dong")||t.contains("vnd")))r.put("currency","VND");
  r.put("subtotal",amount(t,"cong tien hang")); r.put("vat",amount(t,"tien thue (?:gtgt|gia tri gia tang)"));
  r.put("total",amount(t,"tong\\s*(?:cong)?\\s*tien thanh toan"));
  readItems(r);
  return r;
 }
 static String amount(String t,String label){
  var m=Pattern.compile(label+"[ \\t]*(?:\\([^\\n)]*\\))?[ \\t]*:?[ \\t]*([\\d][\\d.,]*)").matcher(t);String found="";
  while(m.find())try{found=number(m.group(1),t).toPlainString();}catch(Exception ignored){}return found;
 }
 static void readItems(Invoice r){
  String n="(-?\\d[\\d.,]*)";
  Pattern row=Pattern.compile("^(\\d{1,4})\\s+(?:(.*?)\\s+)?(\\S+)\\s+"+n+"\\s+"+n+"\\s+"+n+"$");
  boolean table=false;String pending="",prefix="";Map<String,String> last=null;
  for(String raw:r.text.split("\\R")){
   String l=raw.trim(),f=fold(l);
   if(f.startsWith("stt")){table=true;pending="";prefix="";last=null;continue;}
   if(f.contains("cong tien hang")||f.matches("^(tong cong|tong tien|thue suat|tien thue|so tien viet|nguoi mua|nguoi ban|ky boi|tra cuu|tiep theo|trang |don vi cung cap|hoa don).*$")){table=false;pending="";prefix="";last=null;}
   if(!table||l.isEmpty()||l.matches("[\\d\\s= xA-Fa-f]+")||l.startsWith("(No")||l.startsWith("(1)")||f.matches("^(vi tinh|don vi tinh|\\(unit.*|\\(description.*|\\(quantity.*)$"))continue;
   String candidate=pending.isEmpty()?l:pending+" "+l;
   var m=row.matcher(candidate);
   if(m.matches()){
    try{Map<String,String> item=new LinkedHashMap<>();item.put("line",m.group(1));String desc=(prefix+" "+Objects.toString(m.group(2),"")).trim();item.put("description",desc.isEmpty()?"[Wrapped description - check source]":desc);item.put("unit",m.group(3));item.put("quantity",number(m.group(4),r.text).toPlainString());item.put("unitPrice",number(m.group(5),r.text).toPlainString());item.put("amount",number(m.group(6),r.text).toPlainString());r.items.add(item);last=item;}catch(Exception ignored){}pending="";prefix="";
   }else if(l.matches("^\\d{1,4}\\s+.*"))pending=l;
   else if(!pending.isEmpty()&&pending.length()<1200)pending=candidate;
   else if(last==null&&l.matches(".*\\p{L}.*")){prefix=(prefix+" "+l).trim();}
   else if(f.matches("(?iu)^(?:[AB]\\d{2}\\.\\d{2}\\.|khung suon\\b|FRAMESET\\b).*")||!prefix.isEmpty()){prefix=(prefix+" "+l).trim();}
   else if(last!=null&&l.matches(".*\\p{L}.*")){String before=last.get("description");if(before.startsWith("[Wrapped"))before="";last.put("description",(before+" "+l).trim());}
  }
 }
 public void profiles(Invoice r,Settings settings)throws Exception{
  JsonNode profiles;
  Path custom=settings.home.resolve("seller-profiles.json");
  if(Files.exists(custom))profiles=SecureFiles.readTree(custom.toFile());
  else try(var in=Parser.class.getResourceAsStream("/seller-profiles.json")){profiles=Engine.JSON.readTree(in);}
  for(JsonNode p:profiles){
   String tax=p.path("taxId").asText(),name=p.path("nameContains").asText();
   if((!tax.isBlank()&&tax.equals(r.get("sellerTaxId")))||(!name.isBlank()&&fold(r.get("seller")).contains(fold(name)))){
    r.profile=p.path("id").asText();
    var fields=p.path("fields").fields();while(fields.hasNext()){var f=fields.next();if(Invoice.KEYS.contains(f.getKey())){String v=match(r.text,f.getValue().asText());if(!v.isBlank())r.put(f.getKey(),v);}}
    break;
   }
  }
 }
 public static void validate(Invoice r){
  r.warnings.removeIf(w->w.startsWith("Missing ")||w.startsWith("Check: "));
  if(!List.of("INVOICE","APPENDIX","DEBIT_NOTE").contains(r.type))return;
  for(String k:r.type.equals("DEBIT_NOTE")?List.of("seller","buyer","date","currency","subtotal","vat","total"):r.type.equals("APPENDIX")?List.of("seller","sellerTaxId","number","serial","date","currency","subtotal"):List.of("seller","sellerTaxId","number","serial","date","currency","subtotal","vat","total"))if(r.get(k).isBlank())r.warnings.add("Missing "+k);
  for(String k:List.of("subtotal","vat","total"))if(!r.get(k).isBlank())try{new BigDecimal(r.get(k));}catch(Exception e){r.warnings.add("Check: invalid "+k+" (use decimal point, no grouping)");}
  try{if(new BigDecimal(r.get("subtotal")).add(new BigDecimal(r.get("vat"))).subtract(new BigDecimal(r.get("total"))).abs().compareTo(BigDecimal.ONE)>0)r.warnings.add("Check: subtotal + VAT differs from total");}catch(Exception ignored){}
  try{LocalDate.parse(r.get("date"));}catch(Exception e){if(!r.get("date").isBlank())r.warnings.add("Check: date must be YYYY-MM-DD");}
  if(!r.get("sellerTaxId").isBlank()&&!r.get("sellerTaxId").matches("\\d{10}(?:-?\\d{3})?"))r.warnings.add("Check: seller tax ID format");
  if(r.items.isEmpty())r.warnings.add("Check: line items not extracted");
  else try{BigDecimal sum=BigDecimal.ZERO;for(var i:r.items)sum=sum.add(new BigDecimal(i.get("amount")));if(sum.subtract(new BigDecimal(r.get("subtotal"))).abs().compareTo(BigDecimal.ONE)>0)r.warnings.add("Check: extracted line items do not sum to subtotal");}catch(Exception ignored){}
  if(r.items.stream().anyMatch(i->i.getOrDefault("description","").contains("[Wrapped")))r.warnings.add("Check: wrapped item descriptions need source review");
  for(var item:r.items){
   for(String k:r.type.equals("APPENDIX")?List.of("quantity","amount"):List.of("quantity","unitPrice","amount"))try{new BigDecimal(item.getOrDefault(k,""));}catch(Exception e){r.warnings.add("Check: invalid item "+item.getOrDefault("line","?")+" "+k);}
   try{if(new BigDecimal(item.get("quantity")).multiply(new BigDecimal(item.get("unitPrice"))).subtract(new BigDecimal(item.get("amount"))).abs().compareTo(BigDecimal.ONE)>0)r.warnings.add("Check: item "+item.get("line")+" quantity × price differs from amount");}catch(Exception ignored){}
  }
 }
}
