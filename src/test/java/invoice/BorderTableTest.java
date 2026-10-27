package invoice;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;
import java.util.List;
import javax.imageio.ImageIO;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
public class BorderTableTest {
 static BufferedImage image(){BufferedImage image=new BufferedImage(900,320,BufferedImage.TYPE_INT_RGB);Graphics2D g=image.createGraphics();g.setColor(Color.WHITE);g.fillRect(0,0,900,320);g.setColor(new Color(0,70,120));for(int x:new int[]{20,70,400,500,600,720,860})g.drawLine(x,50,x,225);for(int y:new int[]{50,100,225})g.drawLine(20,y,860,y);g.setStroke(new BasicStroke(1,BasicStroke.CAP_BUTT,BasicStroke.JOIN_MITER,10,new float[]{2,2},0));g.drawLine(20,160,860,160);g.dispose();return image;}
 static JsonNode response(String text,List<TableGrid.Box> boxes,int width,int height,int offsetX,int offsetY){List<Map<String,Object>> words=new ArrayList<>();words.add(Map.of("description",text));for(var box:boxes){int x=(int)box.x()-offsetX,y=(int)box.y()-offsetY,w=(int)box.width(),h=(int)box.height();words.add(Map.of("description",box.text(),"boundingPoly",Map.of("vertices",List.of(Map.of("x",x,"y",y),Map.of("x",x+w,"y",y),Map.of("x",x+w,"y",y+h),Map.of("x",x,"y",y+h)))));}return Engine.JSON.valueToTree(Map.of("responses",List.of(Map.of("textAnnotations",words,"fullTextAnnotation",Map.of("text",text,"pages",List.of(Map.of("width",width,"height",height)))))));}
 static List<TableGrid.Box> words(){List<TableGrid.Box> out=new ArrayList<>();String[][] rows={{"STT","Description","Unit","Quantity","Unit Price","Amount"},{"1","Metal frame","PCS","2","1.000","2.000"},{"2","Tube","PCS","3","500","1.500"}};int[] xs={30,90,420,520,620,740},ys={65,115,180};for(int r=0;r<rows.length;r++)for(int c=0;c<rows[r].length;c++)out.add(new TableGrid.Box(rows[r][c],xs[c],ys[r],Math.min(95,rows[r][c].length()*6),12,false));out.add(new TableGrid.Box("Note: size M",90,140,100,12,false));return out;}
 @org.junit.jupiter.api.Test void preservesWrappedRows(){
  var result=TableGrid.extract(TableGrid.detect(image()),words(),"3.500",1,900,320);
  org.junit.jupiter.api.Assertions.assertEquals(2,result.items().size());
  org.junit.jupiter.api.Assertions.assertEquals("Metal frame Note: size M",result.items().get(0).get("description"));
  org.junit.jupiter.api.Assertions.assertTrue(result.complete());
 }
}