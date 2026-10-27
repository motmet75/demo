package invoice;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import java.util.regex.*;
import java.time.LocalDate;
/** Reconstruct PLX tables from OCR coordinates; never infer missing amounts from invoices. */
public class VisionTable {
 record Word(String text,double x,double y,double left,double right,double height){}
 static final Pattern REF=Pattern.compile("(1?C\\s*\\d{2}\\s*[A-Z]{3})\\s*-\\s*(\\d+)");
 static final Pattern DATE=Pattern.compile("(\\d{1,2})\\s*/\\s*(\\d{1,2})\\s*/\\s*(\\d{4})");
 static List<Word> words(JsonNode response){List<Word> out=new ArrayList<>();var all=response.path("responses").path(0).path("textAnnotations");for(int i=1;i<all.size();i++){var n=all.get(i);double x=0,y=0,min=Double.MAX_VALUE,max=0,minY=Double.MAX_VALUE,maxY=0;var v=n.path("boundingPoly").path("vertices");for(var p:v){double px=p.path("x").asDouble(),py=p.path("y").asDouble();x+=px;y+=py;min=Math.min(min,px);max=Math.max(max,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}if(v.size()>0)out.add(new Word(n.path("description").asText(),x/v.size(),y/v.size(),min,max,maxY-minY));}return out;}
 static String line(List<Word> words){return words.stream().sorted(Comparator.comparingDouble(Word::x)).map(Word::text).reduce("",(a,b)->a.isEmpty()?b:a+" "+b);}
 static String description(List<Word> words){List<Word> sorted=words.stream().sorted(Comparator.comparingDouble(Word::y)).toList();StringBuilder out=new StringBuilder();List<Word> row=new ArrayList<>();double y=-999;for(Word w:sorted){if(!row.isEmpty()&&Math.abs(w.y-y)>Math.max(7,w.height*.55)){out.append(line(row)).append(' ');row.clear();}if(row.isEmpty())y=w.y;row.add(w);}out.append(line(row));return out.toString().replace("|","").trim();}
 public static void extract(Invoice invoice,List<JsonNode> pages){
  invoice.items.clear();Set<String> identities=new HashSet<>();int pageNo=0;
  for(JsonNode page:pages){pageNo++;List<Word> words=words(page);if(words.isEmpty())continue;
   double width=page.path("responses").path(0).path("fullTextAnnotation").path("pages").path(0).path("width").asDouble();
   List<Word> candidates=words.stream().filter(w->w.text.matches("\\d[\\d.,]*[.,]\\d")&&w.x>width*.35).toList();
   Word best=null;long count=0;for(Word c:candidates){long nearby=candidates.stream().filter(w->Math.abs(w.x-c.x)<width*.025).count();if(nearby>count){count=nearby;best=c;}}
   if(best==null)continue;double quantityX=best.x;
   List<Word> quantities=candidates.stream().filter(w->Math.abs(w.x-quantityX)<width*.025).sorted(Comparator.comparingDouble(Word::y)).toList();
   for(int i=0;i<quantities.size();i++){
    Word q=quantities.get(i);double prev=i>0?q.y-quantities.get(i-1).y:(i+1<quantities.size()?quantities.get(i+1).y-q.y:60);double next=i+1<quantities.size()?quantities.get(i+1).y-q.y:prev;
    double low=q.y-prev*.5,high=q.y+next*.5;double tolerance=Math.max(18,Math.min(prev,next)*.35);
    List<Word> left=words.stream().filter(w->w.x<q.left-10&&Math.abs(w.y-q.y)<tolerance).sorted(Comparator.comparingDouble(Word::x)).toList();String refLine=line(left);Matcher ref=REF.matcher(refLine),date=DATE.matcher(refLine);
    if(!ref.find()||!date.find())continue;
    String serial=ref.group(1).replaceAll("\\s", ""),number=ref.group(2),day;
    try{day=LocalDate.of(Integer.parseInt(date.group(3)),Integer.parseInt(date.group(2)),Integer.parseInt(date.group(1))).toString();}catch(Exception e){invoice.warnings.add("Check: invalid OCR table date on page "+pageNo);continue;}
    identities.add(serial+"/"+number);if(invoice.get("serial").isBlank()){invoice.put("serial",serial);invoice.put("number",number);invoice.put("date",day);}
    int length=0;double refEnd=0;for(Word w:left){length+=w.text.length()+1;if(length>=ref.end()){refEnd=w.right;break;}}
    final double descStart=refEnd;String desc=description(words.stream().filter(w->w.x>descStart+2&&w.x<q.left-10&&w.y>low&&w.y<high).toList());
    var amount=words.stream().filter(w->w.x>q.right+10&&Math.abs(w.y-q.y)<tolerance&&w.text.matches("\\d{1,3}(?:[.,]\\d{3})+")).min(Comparator.comparingDouble(w->Math.abs(w.y-q.y)));
    Map<String,String> item=new LinkedHashMap<>();String index=left.isEmpty()?"":left.get(0).text;item.put("line",index.matches("\\d{1,3}")?String.valueOf(Integer.parseInt(index)):String.valueOf(invoice.items.size()+1));item.put("description",desc);item.put("unit","");item.put("unitPrice","");item.put("quantity",(q.text.contains(",")?Parser.money(q.text):new java.math.BigDecimal(q.text)).toPlainString());item.put("amount",amount.map(w->w.text.replaceAll("[.,]","")).orElse(""));item.put("page",String.valueOf(pageNo));invoice.items.add(item);
   }
   for(Word amount:words){if(!amount.text.matches("\\d{1,3}(?:[.,]\\d{3})+")||amount.x<quantityX)continue;
    String label=Parser.fold(line(words.stream().filter(w->w.x<quantityX-30&&Math.abs(w.y-amount.y)<Math.max(36,amount.height*1.5)).toList()));
    String key=label.contains("thanh toan")?"total":label.contains("thue suat")?"vat":label.contains("cong tien hang")||label.contains("tong cong")?"subtotal":"";
    if(!key.isEmpty())invoice.put(key,amount.text.replaceAll("[.,]",""));
   }
  }
  if(identities.size()>1)invoice.warnings.add("Missing single invoice reference: appendix contains multiple invoices");
 }
}
