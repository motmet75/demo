package com.demo.invoicedesk;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import invoice.GoogleAuth;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GdtOnlineOcrService {
 private final GoogleAuth auth=new GoogleAuth();private final ObjectMapper json=new ObjectMapper();
 private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
 @Value("${invoice-desk.google-credentials:${GOOGLE_APPLICATION_CREDENTIALS:L:/invoiceToExcel/portal-backup-22907-8ebb196a9572.json}}") private String credentials;
 public record Result(String text,String rawText){}
 public Result read(byte[] source)throws Exception{
  if(source==null||source.length==0||source.length>2*1024*1024)throw new IOException("CAPTCHA image must be 1 byte to 2 MiB.");
  var requests=new ArrayList<Map<String,Object>>();for(byte[] image:variants(source))requests.add(Map.of("image",Map.of("content",Base64.getEncoder().encodeToString(image)),"features",List.of(Map.of("type","TEXT_DETECTION"))));
  byte[] body=json.writeValueAsBytes(Map.of("requests",requests));String token=auth.token(Path.of(credentials));
  var request=HttpRequest.newBuilder(URI.create("https://vision.googleapis.com/v1/images:annotate")).timeout(Duration.ofSeconds(45)).header("Authorization","Bearer "+token).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
  var response=http.send(request,HttpResponse.BodyHandlers.ofByteArray());JsonNode root=json.readTree(response.body());if(response.statusCode()!=200)throw new IOException("Google Vision HTTP "+response.statusCode()+": "+root.path("error").path("message").asText("request failed"));
  String best="";int score=Integer.MIN_VALUE;for(JsonNode result:root.path("responses")){if(result.has("error"))throw new IOException("Google Vision: "+result.path("error").path("message").asText("request failed"));String raw=result.path("textAnnotations").path(0).path("description").asText("").trim();int current=score(raw);if(current>score){score=current;best=raw;}}
  return new Result(best.replaceAll("[^A-Za-z0-9]",""),best);
 }
 private static int score(String raw){String clean=raw.replaceAll("[^A-Za-z0-9]","");int value=clean.equals(raw.replaceAll("\\s+",""))?20:0;if(clean.length()>=4&&clean.length()<=8)value+=100;else if(!clean.isEmpty()&&clean.length()<=12)value+=40;return value-Math.abs(6-clean.length())*3;}
 private static List<byte[]> variants(byte[] source)throws IOException{BufferedImage input=ImageIO.read(new ByteArrayInputStream(source));if(input==null||input.getWidth()<2||input.getHeight()<2)throw new IOException("Invalid CAPTCHA image.");BufferedImage color=scale(input),gray=gray(color);return List.of(png(color),png(gray),png(threshold(gray,175)),png(threshold(gray,210)));}
 private static BufferedImage scale(BufferedImage source){BufferedImage out=new BufferedImage(source.getWidth()*5,source.getHeight()*5,BufferedImage.TYPE_INT_RGB);Graphics2D g=out.createGraphics();try{g.setColor(Color.WHITE);g.fillRect(0,0,out.getWidth(),out.getHeight());g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);g.drawImage(source,0,0,out.getWidth(),out.getHeight(),null);}finally{g.dispose();}return out;}
 private static BufferedImage gray(BufferedImage source){BufferedImage out=new BufferedImage(source.getWidth(),source.getHeight(),BufferedImage.TYPE_BYTE_GRAY);Graphics2D g=out.createGraphics();try{g.drawImage(source,0,0,null);}finally{g.dispose();}return out;}
 private static BufferedImage threshold(BufferedImage source,int cutoff){BufferedImage out=new BufferedImage(source.getWidth(),source.getHeight(),BufferedImage.TYPE_BYTE_BINARY);for(int y=0;y<source.getHeight();y++)for(int x=0;x<source.getWidth();x++)out.getRaster().setSample(x,y,0,source.getRaster().getSample(x,y,0)<cutoff?0:1);return out;}
 private static byte[] png(BufferedImage image)throws IOException{var out=new ByteArrayOutputStream();ImageIO.write(image,"png",out);return out.toByteArray();}
}
