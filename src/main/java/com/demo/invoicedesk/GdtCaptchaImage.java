package com.demo.invoicedesk;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import java.util.List;
import javax.imageio.ImageIO;

/** Deterministic CAPTCHA cleanup/segmentation. No native OCR dependency is required. */
final class GdtCaptchaImage {
 static final int NORMAL_WIDTH=24,NORMAL_HEIGHT=32;
 record Box(int x,int y,int width,int height){}
 record Glyph(Box box,BufferedImage image,String fingerprint){}
 record Analysis(BufferedImage cleaned,BufferedImage review,List<Glyph> glyphs){}

 static Analysis analyze(byte[] png,int expectedCharacters)throws IOException{
  BufferedImage source=ImageIO.read(new ByteArrayInputStream(png));
  if(source==null||source.getWidth()<8||source.getHeight()<8)throw new IOException("Invalid CAPTCHA image.");
  BufferedImage cleaned=rgb(source),review=rgb(source);boolean[][] characterInk=ink(cleaned),lineInk=ink(cleaned,230),line=longLines(lineInk);
  Graphics2D marker=review.createGraphics();marker.setColor(new Color(255,0,170,190));
  try{for(int y=0;y<source.getHeight();y++)for(int x=0;x<source.getWidth();x++)if(line[y][x]){if(!characterJunction(characterInk,line,x,y))cleaned.setRGB(x,y,Color.WHITE.getRGB());marker.fillRect(x,y,1,1);}}finally{marker.dispose();}
  List<Box> boxes=segments(cleaned,expectedCharacters);List<Glyph> glyphs=new ArrayList<>();
  for(Box box:boxes){BufferedImage normalized=normalize(cleaned,contentBox(cleaned,box));glyphs.add(new Glyph(box,crop(cleaned,box),fingerprint(normalized)));}
  return new Analysis(cleaned,review,List.copyOf(glyphs));
 }
 static Glyph template(byte[] png)throws IOException{BufferedImage decoded=ImageIO.read(new ByteArrayInputStream(png));if(decoded==null||decoded.getWidth()<2||decoded.getHeight()<2||decoded.getWidth()>1000||decoded.getHeight()>1000)throw new IOException("Invalid learned character image.");BufferedImage source=rgb(decoded);boolean[][] bits=ink(source);int left=source.getWidth(),right=-1,top=source.getHeight(),bottom=-1;for(int y=0;y<source.getHeight();y++)for(int x=0;x<source.getWidth();x++)if(bits[y][x]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(right<left||bottom<top)throw new IOException("Learned character image has no visible ink.");var box=new Box(left,top,right-left+1,bottom-top+1);var normalized=normalize(source,box);return new Glyph(box,crop(source,box),fingerprint(normalized));}
 static byte[] png(BufferedImage image)throws IOException{var out=new ByteArrayOutputStream();if(!ImageIO.write(image,"png",out))throw new IOException("Cannot encode CAPTCHA image.");return out.toByteArray();}
 private static BufferedImage rgb(BufferedImage source){var out=new BufferedImage(source.getWidth(),source.getHeight(),BufferedImage.TYPE_INT_RGB);Graphics2D g=out.createGraphics();try{g.setColor(Color.WHITE);g.fillRect(0,0,out.getWidth(),out.getHeight());g.drawImage(source,0,0,null);}finally{g.dispose();}return out;}
 private static boolean[][] ink(BufferedImage image){return ink(image,190);}
 private static boolean[][] ink(BufferedImage image,int threshold){boolean[][] out=new boolean[image.getHeight()][image.getWidth()];for(int y=0;y<image.getHeight();y++)for(int x=0;x<image.getWidth();x++){Color c=new Color(image.getRGB(x,y));int gray=(c.getRed()*30+c.getGreen()*59+c.getBlue()*11)/100;out[y][x]=gray<threshold;}return out;}
 private static boolean[][] longLines(boolean[][] ink){int h=ink.length,w=ink[0].length;boolean[][] result=new boolean[h][w];int min=Math.max(12,(int)(w*.52));
  // GDT interference strokes are long and near-horizontal. Scan several slopes,
  // then mark only runs long enough that ordinary character strokes cannot qualify.
  for(double slope:new double[]{-.40,-.30,-.20,-.10,0,.10,.20,.30,.40})for(int intercept=-h;intercept<h*2;intercept++){
   int run=0,start=0,lastDark=-1;for(int x=0;x<w;x++){int y=(int)Math.round(intercept+slope*x);boolean dark=false;for(int dy=-1;dy<=1&&!dark;dy++)dark=y+dy>=0&&y+dy<h&&ink[y+dy][x];if(dark){if(run==0)start=x;run=x-start+1;lastDark=x;}else if(run>0&&x-lastDark<=2)run=x-start+1;else{if(lastDark-start+1>=min)mark(result,intercept,slope,start,lastDark);run=0;lastDark=-1;}}if(lastDark>=start&&lastDark-start+1>=min)mark(result,intercept,slope,start,lastDark);
  }return result;
 }
 private static void mark(boolean[][] out,int intercept,double slope,int from,int to){for(int x=from;x<=to;x++){int y=(int)Math.round(intercept+slope*x);for(int dy=-1;dy<=1;dy++)if(y+dy>=0&&y+dy<out.length)out[y+dy][x]=true;}}
 private static boolean characterJunction(boolean[][] ink,boolean[][] line,int x,int y){boolean above=false,below=false;for(int distance=2;distance<=8&&!(above&&below);distance++)for(int dx=-2;dx<=2;dx++){int px=x+dx,up=y-distance,down=y+distance;if(px<0||px>=ink[0].length)continue;if(up>=0&&ink[up][px]&&!line[up][px])above=true;if(down<ink.length&&ink[down][px]&&!line[down][px])below=true;}return above&&below;}
 private static List<Box> segments(BufferedImage image,int expected){boolean[][] bits=ink(image);int h=image.getHeight(),w=image.getWidth();int[] projection=new int[w];for(int x=0;x<w;x++)for(int y=0;y<h;y++)if(bits[y][x])projection[x]++;
  int left=0,right=w-1;while(left<right&&projection[left]==0)left++;while(right>left&&projection[right]==0)right--;
  int count=Math.max(1,Math.min(32,expected));if(expected<=0){count=0;boolean active=false;for(int x=left;x<=right;x++){if(projection[x]>0&&!active){count++;active=true;}else if(projection[x]==0)active=false;}count=Math.max(1,count);}
  int[] cuts=new int[count+1];cuts[0]=left;cuts[count]=right+1;for(int i=1;i<count;i++){int ideal=left+(right-left+1)*i/count,radius=Math.max(2,(right-left+1)/(count*3)),best=ideal;for(int x=Math.max(cuts[i-1]+1,ideal-radius);x<=Math.min(right,ideal+radius);x++)if(projection[x]<projection[best])best=x;cuts[i]=best;}
  List<Box> out=new ArrayList<>();for(int i=0;i<count;i++){int x1=cuts[i],x2=Math.max(x1+1,cuts[i+1]);int top=h,bottom=-1;for(int x=x1;x<x2;x++)for(int y=0;y<h;y++)if(bits[y][x]){top=Math.min(top,y);bottom=Math.max(bottom,y);}if(bottom<top){top=0;bottom=h-1;}out.add(new Box(x1,top,x2-x1,bottom-top+1));}return out;
 }
 private static BufferedImage normalize(BufferedImage source,Box box){var crop=new BufferedImage(box.width,box.height,BufferedImage.TYPE_BYTE_BINARY);boolean[][] bits=ink(source);for(int y=0;y<box.height;y++)for(int x=0;x<box.width;x++)crop.setRGB(x,y,bits[box.y+y][box.x+x]?Color.BLACK.getRGB():Color.WHITE.getRGB());var out=new BufferedImage(NORMAL_WIDTH,NORMAL_HEIGHT,BufferedImage.TYPE_BYTE_BINARY);Graphics2D g=out.createGraphics();try{g.setColor(Color.WHITE);g.fillRect(0,0,NORMAL_WIDTH,NORMAL_HEIGHT);double scale=Math.min(20.0/Math.max(1,box.width),28.0/Math.max(1,box.height));int width=Math.max(1,(int)Math.round(box.width*scale)),height=Math.max(1,(int)Math.round(box.height*scale));g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);g.drawImage(crop,(NORMAL_WIDTH-width)/2,(NORMAL_HEIGHT-height)/2,width,height,null);}finally{g.dispose();}return out;}
 private static BufferedImage crop(BufferedImage source,Box box){var out=new BufferedImage(box.width,box.height,BufferedImage.TYPE_INT_RGB);Graphics2D g=out.createGraphics();try{g.setColor(Color.WHITE);g.fillRect(0,0,out.getWidth(),out.getHeight());g.drawImage(source,0,0,box.width,box.height,box.x,box.y,box.x+box.width,box.y+box.height,null);}finally{g.dispose();}return out;}
 private static Box contentBox(BufferedImage source,Box limit){boolean[][] bits=ink(source);int left=limit.x+limit.width,right=limit.x-1,top=limit.y+limit.height,bottom=limit.y-1;for(int y=limit.y;y<limit.y+limit.height;y++)for(int x=limit.x;x<limit.x+limit.width;x++)if(bits[y][x]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right<left||bottom<top?limit:new Box(left,top,right-left+1,bottom-top+1);}
 private static String fingerprint(BufferedImage image){StringBuilder value=new StringBuilder(NORMAL_WIDTH*NORMAL_HEIGHT);boolean[][] bits=ink(image);for(int y=0;y<NORMAL_HEIGHT;y++)for(int x=0;x<NORMAL_WIDTH;x++)value.append(bits[y][x]?'1':'0');return value.toString();}
 static double similarity(String a,String b){if(a==null||b==null||a.length()!=b.length()||a.isEmpty())return 0;int inkIntersection=0,inkUnion=0,paperIntersection=0,paperUnion=0;for(int i=0;i<a.length();i++){boolean ai=a.charAt(i)=='1',bi=b.charAt(i)=='1';if(ai&&bi)inkIntersection++;if(ai||bi)inkUnion++;if(!ai&&!bi)paperIntersection++;if(!ai||!bi)paperUnion++;}double ink=inkUnion==0?1:inkIntersection/(double)inkUnion,paper=paperUnion==0?1:paperIntersection/(double)paperUnion;return (ink+paper)/2;}
}
