package com.ams.bomcore.service.shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class VinHoadonResidenceCropperTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void findsVietnameseLabelAndIncludesTwoLinesBelow() throws Exception {
        ObjectNode result = annotations(
                new String[]{"Nơi", "thường", "trú"},
                new int[]{100, 148, 225},
                145);
        Rectangle crop = VinHoadonResidenceCropper.residenceRectangle(result, 1000, 700);
        assertNotNull(crop);
        assertTrue(crop.y <= 145, "Crop starts at or above residence label");
        assertTrue(crop.y + crop.height >= 290, "Crop includes the next two lines");
        assertTrue(crop.height < 400, "Should not OCR the whole card again");
        assertTrue(crop.x <= 100);
    }

    @Test
    void recognizesEnglishLabelAndCommonOcrTypo() {
        for (String label : new String[]{"Place", "Pate", "Pace"}) {
            ObjectNode result = annotations(new String[]{label, "of", "residence"},
                    new int[]{120, 200, 240}, 180);
            assertNotNull(VinHoadonResidenceCropper.residenceRectangle(result, 900, 600));
        }
    }

    @Test
    void doesNotCropWithoutResidenceLabel() {
        ObjectNode result = annotations(
                new String[]{"Quê", "quán", "Gia", "Lai"},
                new int[]{100, 150, 200, 260}, 130);
        assertNull(VinHoadonResidenceCropper.residenceRectangle(result, 900, 600));
    }

    @Test
    void reocrCropUsesOriginalCoordinatesAndDoesNotWriteToDisk() throws Exception {
        BufferedImage image = new BufferedImage(1000, 700, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream original = new ByteArrayOutputStream();
        ImageIO.write(image, "png", original);
        ObjectNode result = annotations(
                new String[]{"Nơi", "cư", "trú"},
                new int[]{100, 153, 180}, 190);
        byte[] png = VinHoadonResidenceCropper.cropResidence(original.toByteArray(), result);
        assertNotNull(png);
        BufferedImage cropped = ImageIO.read(new java.io.ByteArrayInputStream(png));
        Rectangle region = VinHoadonResidenceCropper.residenceRectangle(result, 1000, 700);
        assertEquals(region.width, cropped.getWidth());
        assertEquals(region.height, cropped.getHeight());
        assertTrue(cropped.getWidth() < image.getWidth());
        assertTrue(cropped.getHeight() < image.getHeight());
    }

    @Test
    void fallsBackToFullTextWordBoxesWithoutTextAnnotations() {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode words = result.putObject("fullTextAnnotation").putArray("pages")
                .addObject().putArray("blocks")
                .addObject().putArray("paragraphs")
                .addObject().putArray("words");
        fullTextWord(words, "Place", 100, 180, 55);
        fullTextWord(words, "of", 162, 180, 20);
        fullTextWord(words, "residence", 190, 180, 94);
        assertNotNull(VinHoadonResidenceCropper.residenceRectangle(result, 800, 500));
    }

    private ObjectNode annotations(String[] words, int[] xs, int y) {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode items = result.putArray("textAnnotations");
        items.addObject().put("description", "Entire OCR text");
        for (int i = 0; i < words.length; i++) {
            ObjectNode annotation = items.addObject();
            annotation.put("description", words[i]);
            bounding(annotation.putObject("boundingPoly"), xs[i], y, 38, 19);
        }
        return result;
    }

    private void fullTextWord(ArrayNode words, String value, int x, int y, int w) {
        ObjectNode word = words.addObject();
        bounding(word.putObject("boundingBox"), x, y, w, 19);
        ArrayNode symbols = word.putArray("symbols");
        value.codePoints().forEach(cp -> symbols.addObject().put("text", new String(Character.toChars(cp))));
    }

    private void bounding(ObjectNode poly, int x, int y, int w, int h) {
        ArrayNode v = poly.putArray("vertices");
        vertex(v, x, y);
        vertex(v, x + w, y);
        vertex(v, x + w, y + h);
        vertex(v, x, y + h);
    }

    private void vertex(ArrayNode vertices, int x, int y) {
        ObjectNode p = vertices.addObject();
        p.put("x", x);
        p.put("y", y);
    }
}
