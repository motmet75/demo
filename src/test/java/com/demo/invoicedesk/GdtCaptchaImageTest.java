package com.demo.invoicedesk;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GdtCaptchaImageTest {
 @Test void highlightsLongInterferenceAndSplitsExpectedGlyphs()throws Exception{
  var image=new BufferedImage(180,55,BufferedImage.TYPE_INT_RGB);Graphics2D g=image.createGraphics();try{g.setColor(Color.WHITE);g.fillRect(0,0,180,55);g.setColor(Color.BLACK);g.setFont(new Font(Font.MONOSPACED,Font.BOLD,34));g.drawString("A7b9Q2",12,42);g.drawLine(2,18,177,35);g.drawLine(3,40,176,12);}finally{g.dispose();}var bytes=new ByteArrayOutputStream();ImageIO.write(image,"png",bytes);
  var result=GdtCaptchaImage.analyze(bytes.toByteArray(),6);assertEquals(6,result.glyphs().size());assertTrue(result.glyphs().get(0).image().getWidth()>0);assertEquals(768,result.glyphs().get(0).fingerprint().length());
  assertEquals(result.glyphs().get(0).fingerprint(),GdtCaptchaImage.template(GdtCaptchaImage.png(result.glyphs().get(0).image())).fingerprint(),"saved crop must reproduce the same matcher fingerprint");
  boolean changed=false;for(int y=0;y<image.getHeight()&&!changed;y++)for(int x=0;x<image.getWidth();x++)if(result.review().getRGB(x,y)!=image.getRGB(x,y)){changed=true;break;}assertTrue(changed,"review image should highlight detected lines");
 }
 @Test void similarityBalancesInkAndBackgroundAndRejectsDifferentLengths(){assertEquals(1,GdtCaptchaImage.similarity("0101","0101"));assertEquals(7d/12,GdtCaptchaImage.similarity("0101","0001"),.0001);assertEquals(0,GdtCaptchaImage.similarity("0","00"));}
 @Test void transparentBackgroundIsCompositedToWhiteBeforeLineDetection()throws Exception{
  var image=new BufferedImage(180,55,BufferedImage.TYPE_INT_ARGB);Graphics2D g=image.createGraphics();try{g.setColor(new Color(35,35,35,255));g.setFont(new Font(Font.MONOSPACED,Font.BOLD,34));g.drawString("A7b9Q2",12,42);g.drawLine(2,18,177,35);g.drawLine(3,40,176,12);}finally{g.dispose();}var bytes=new ByteArrayOutputStream();ImageIO.write(image,"png",bytes);
  var result=GdtCaptchaImage.analyze(bytes.toByteArray(),6);assertEquals(6,result.glyphs().size());long ink=0;for(var glyph:result.glyphs())ink+=glyph.fingerprint().chars().filter(value->value=='1').count();assertTrue(ink>100,"transparent CAPTCHA glyphs must not be erased as background");
 }
 @Test void uploadedTemplatePreservesCropResolutionButUsesNormalizedFingerprint()throws Exception{var image=new BufferedImage(80,100,BufferedImage.TYPE_INT_ARGB);Graphics2D g=image.createGraphics();try{g.setColor(Color.BLACK);g.setFont(new Font(Font.SANS_SERIF,Font.BOLD,72));g.drawString("J",22,78);}finally{g.dispose();}var bytes=new ByteArrayOutputStream();ImageIO.write(image,"png",bytes);var glyph=GdtCaptchaImage.template(bytes.toByteArray());assertTrue(glyph.image().getHeight()>32);assertEquals(768,glyph.fingerprint().length());assertTrue(glyph.fingerprint().contains("1"));}
 @Test void removesHorizontalLineButPreservesCharacterIntersection()throws Exception{var image=new BufferedImage(180,55,BufferedImage.TYPE_INT_RGB);Graphics2D g=image.createGraphics();try{g.setColor(Color.WHITE);g.fillRect(0,0,180,55);g.setColor(Color.BLACK);g.setStroke(new BasicStroke(2));g.drawLine(90,7,90,48);g.drawLine(2,27,177,27);}finally{g.dispose();}var bytes=new ByteArrayOutputStream();ImageIO.write(image,"png",bytes);var result=GdtCaptchaImage.analyze(bytes.toByteArray(),6);assertTrue(new Color(result.cleaned().getRGB(90,27)).getRed()<200,"character/line intersection should remain connected");assertTrue(new Color(result.cleaned().getRGB(20,27)).getRed()>240,"line-only pixels should be removed");}
}
