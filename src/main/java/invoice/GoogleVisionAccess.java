package invoice;
import java.nio.file.*;
import java.util.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
/** The code grants one import; it is not a Google credential or encryption key. */
public class GoogleVisionAccess {
 public static boolean accepts(String code){return "6666".equals(code);}
 public record Scan(boolean image,List<Integer> missing,int cached,String issue){
  public String label(Settings settings){if(!issue.isBlank())return issue;if(!missing.isEmpty())return switch(settings.get("ocr","off")){case "google"->"Google Vision needed";case "tesseract"->"Local OCR needed";default->"OCR needed (disabled)";};return cached>0?"Cached Google OCR":"PDF text";}
  public boolean needsGoogle(Settings settings){return !missing.isEmpty()&&settings.get("ocr","off").equals("google");}
  public String request(Path file){return file.getFileName()+(image?" (image / table regions)":" - pages / table regions "+missing);}
 }
 public static Scan inspect(Path file,Settings settings,java.util.function.BooleanSupplier cancelled)throws Exception{
  boolean image=!file.toString().toLowerCase(Locale.ROOT).endsWith(".pdf");List<Integer> missing=new ArrayList<>();int cached=0;
  if(Files.size(file)>100L*1024*1024)return new Scan(image,missing,0,"File exceeds 100 MB");
  if(cancelled.getAsBoolean())return new Scan(image,missing,0,"Cancelled");
  String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file)));
  if(image){Path cache=settings.home.resolve("ocr-cache").resolve(hash+"-1.json");if(Files.exists(cache)){cached++;if(settings.get("ocr","off").equals("google")){var pixels=javax.imageio.ImageIO.read(file.toFile());if(pixels!=null&&!TableOcr.required(pixels,SecureFiles.readTree(cache.toFile()),settings,hash,1).isEmpty())missing.add(1);}}else missing.add(1);}
  else try(var doc=Loader.loadPDF(file.toFile())){if(doc.getNumberOfPages()>100)return new Scan(false,missing,0,"PDF exceeds 100 pages");var stripper=new PDFTextStripper();stripper.setSortByPosition(true);var renderer=new org.apache.pdfbox.rendering.PDFRenderer(doc);for(int i=1;i<=doc.getNumberOfPages();i++){
   if(cancelled.getAsBoolean())return new Scan(false,missing,cached,"Cancelled");stripper.setStartPage(i);stripper.setEndPage(i);String text=stripper.getText(doc);
   if(Engine.needsOcr(text)){Path cache=settings.home.resolve("ocr-cache").resolve(hash+"-"+i+".json");if(Files.exists(cache)){cached++;if(settings.get("ocr","off").equals("google")){var full=SecureFiles.readTree(cache.toFile());if(!AppendixParser.accepts(Engine.visionText(full))&&!TableOcr.required(renderer.renderImageWithDPI(i-1,200),full,settings,hash,i).isEmpty())missing.add(i);}}else missing.add(i);}
   else if(settings.get("ocr","off").equals("google")&&!AppendixParser.accepts(text)&&doc.getPage(i-1).getRotation()==0){var pixels=renderer.renderImageWithDPI(i-1,144);var words=TableGrid.pdfWords(doc,i-1,pixels);for(var grid:TableGrid.detect(pixels))if(TableOcr.imageTable(grid,words)&&!Files.exists(TableOcr.cache(settings,hash,i,TableGrid.crop(grid,pixels)))){missing.add(i);break;}}
  }}
  catch(java.io.IOException e){return new Scan(false,missing,cached,"Cannot read PDF");}
  return new Scan(image,List.copyOf(missing),cached,"");
 }
 public static List<String> required(List<Path> files,Settings settings)throws Exception{return required(files,settings,()->false);}
 public static List<String> required(List<Path> files,Settings settings,java.util.function.BooleanSupplier cancelled)throws Exception{
  List<String> result=new ArrayList<>();if(!settings.get("ocr","off").equals("google"))return result;
  for(Path file:files){if(cancelled.getAsBoolean())break;Scan scan=inspect(file,settings,cancelled);if(scan.needsGoogle(settings))result.add(scan.request(file));}return result;
 }
}
