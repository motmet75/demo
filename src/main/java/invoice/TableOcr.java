package invoice;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;
/** Reuse full-page OCR first; refine only deficient table regions, with separate caches. */
public final class TableOcr {
 @FunctionalInterface public interface VisionCall{JsonNode read(BufferedImage crop)throws Exception;}
 public record Extraction(TableGrid.Result result,List<String> warnings){}
 static Path cache(Settings settings,String hash,int page,Rectangle crop){return settings.home.resolve("ocr-cache").resolve(hash+"-"+page+"-table-"+TableGrid.VERSION+"-"+crop.x+"-"+crop.y+"-"+crop.width+"-"+crop.height+".json");}
 static boolean reliable(TableGrid.Result result){if(!result.complete())return false;for(var item:result.items())if(!item.getOrDefault("unitPrice","").isBlank())try{if(new BigDecimal(item.get("quantity")).multiply(new BigDecimal(item.get("unitPrice"))).subtract(new BigDecimal(item.get("amount"))).abs().compareTo(BigDecimal.ONE)>0)return false;}catch(Exception e){return false;}return true;}
 public static boolean imageTable(TableGrid.Grid grid,List<TableGrid.Box> words){int body=grid.y().get(Math.min(2,grid.y().size()-2));var bounds=grid.bounds();return words.stream().filter(w->w.cx()>bounds.x&&w.cx()<bounds.x+bounds.width&&w.cy()>body&&w.cy()<bounds.y+bounds.height).count()<12;}
 public static List<Rectangle> required(BufferedImage image,JsonNode full,Settings settings,String hash,int page)throws Exception{
  String text=Engine.visionText(full);if(AppendixParser.accepts(text))return List.of();List<Rectangle> missing=new ArrayList<>();var words=TableGrid.visionWords(full,image.getWidth(),image.getHeight(),0,0);
  for(var grid:TableGrid.detect(image)){var result=TableGrid.extract(List.of(grid),words,text,page,image.getWidth(),image.getHeight());Rectangle crop=TableGrid.crop(grid,image);if(!reliable(result)&&!Files.exists(cache(settings,hash,page,crop)))missing.add(crop);}return missing;
 }
 public static Extraction extract(BufferedImage image,JsonNode full,Settings settings,String hash,int page,boolean allowGoogle,VisionCall vision,java.util.function.Consumer<String> progress)throws Exception{
  return extractPositioned(image,TableGrid.visionWords(full,image.getWidth(),image.getHeight(),0,0),Engine.visionText(full),settings,hash,page,allowGoogle,vision,progress,false);
 }
 public static Extraction extractPositioned(BufferedImage image,List<TableGrid.Box> words,String text,Settings settings,String hash,int page,boolean allowGoogle,VisionCall vision,java.util.function.Consumer<String> progress,boolean pdfText)throws Exception{
  List<Map<String,String>> items=new ArrayList<>();List<Map<String,Object>> evidence=new ArrayList<>();List<String> warnings=new ArrayList<>();boolean complete=true;int region=0;
  for(var grid:TableGrid.detect(image)){region++;var result=TableGrid.extract(List.of(grid),words,text,page,image.getWidth(),image.getHeight());Rectangle crop=TableGrid.crop(grid,image);Path cache=cache(settings,hash,page,crop);
   if(!reliable(result)&&(!pdfText||imageTable(grid,words))){
    JsonNode refined=null;if(Files.exists(cache)){progress.accept("Reading cached table region "+region+" on page "+page);refined=SecureFiles.readTree(cache.toFile());}
    else if(!allowGoogle){warnings.add("OCR required for table region "+region+" on page "+page);}
    else if(allowGoogle){progress.accept("Google Vision: table region "+region+" on page "+page);refined=vision.read(image.getSubimage(crop.x,crop.y,crop.width,crop.height));Engine.visionText(refined);settings.writeOcrCache(cache,refined);}
    if(refined!=null){var refinedWords=TableGrid.visionWords(refined,crop.width,crop.height,crop.x,crop.y);var refinedResult=TableGrid.extract(List.of(grid),refinedWords,text,page,image.getWidth(),image.getHeight());if(refinedResult.items().size()>=result.items().size()||reliable(refinedResult))result=refinedResult;}
   }
   if(!reliable(result)){complete=false;warnings.add("Check: table region "+region+" on page "+page+" needs source review");}
   items.addAll(result.items());for(var table:result.evidence()){table.put("textSource",Files.exists(cache)?"google-table-crop":pdfText?"pdf-text":"google-full-page");table.put("crop",List.of(crop.x,crop.y,crop.width,crop.height));evidence.add(table);}
  }return new Extraction(new TableGrid.Result(items,evidence,complete&&!items.isEmpty()),warnings);
 }
 public static boolean worthRendering(String text){String folded=Parser.fold(text);return (folded.contains("stt")||folded.contains("description"))&&(folded.contains("so luong")||folded.contains("quantity"));}
 public static void apply(Invoice invoice,List<TableGrid.Result> pages){
  if(!invoice.type.equals("INVOICE"))return;List<Map<String,String>> rows=new ArrayList<>();List<Map<String,Object>> evidence=new ArrayList<>();boolean complete=true;for(var page:pages){if(!page.items().isEmpty()){rows.addAll(page.items());evidence.addAll(page.evidence());complete&=page.complete();}}
  if(rows.isEmpty())return;boolean balances=TableGrid.amountsMatch(rows,invoice.get("subtotal")),oldBalances=TableGrid.amountsMatch(invoice.items,invoice.get("subtotal"));
  if(complete&&(balances||!oldBalances&&rows.size()>=invoice.items.size())){invoice.items=rows;invoice.tableEvidence=evidence;invoice.method+=" + border/header table mapping";if(!balances&&!invoice.get("subtotal").isBlank())invoice.warnings.add("Check: bordered table amounts require reconciliation");}
  else if(!oldBalances){invoice.items=rows;invoice.tableEvidence=evidence;invoice.warnings.add("Check: bordered table extraction is incomplete; inspect source cells");}
 }
}
