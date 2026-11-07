package com.ams.bomcore.service.shop;

import com.fasterxml.jackson.databind.JsonNode;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Iterator;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.util.Locale;
import javax.imageio.ImageIO;

/**
 * Finds the residence-label position in a Google Vision response and crops
 * the label and approximately two printed address lines beneath it.
 * Only image bytes are returned: nothing is written to disk or logged.
 */
final class VinHoadonResidenceCropper {
    private static final long MAX_DECODED_PIXELS = 16_000_000L;

    private VinHoadonResidenceCropper() {}

    private record Token(String text, Rectangle bounds) {}

    static byte[] cropResidence(byte[] original, JsonNode visionResponse) throws IOException {
        if (original == null || original.length == 0 || visionResponse == null) return null;
        // Check image dimensions BEFORE decoding. A small compressed image can
        // expand to hundreds of MB; a crop must never destabilize the server.
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(original))) {
            if (stream == null) return null;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) return null; // e.g. WebP without an ImageIO plugin.
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream, false, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > 100_000_000L) return null;
                Rectangle rect = residenceRectangle(visionResponse, width, height);
                if (rect == null || (long) rect.width * rect.height > MAX_DECODED_PIXELS) return null;
                // Decode ONLY the selected region, not the entire card.
                // This handles modern high-resolution phone images with less heap.
                ImageReadParam param = reader.getDefaultReadParam();
                param.setSourceRegion(rect);
                BufferedImage region = reader.read(0, param);
                if (region == null) return null;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                if (!ImageIO.write(region, "png", out)) return null;
                return out.toByteArray();
            } finally {
                reader.dispose();
            }
        }
    }

    private record LabelBox(Rectangle bounds, int wordHeight) {}

    /**
     * Construct a crop around the label and two lines below; retain a small
     * margin above because OCR sometimes reads the first address row first.
     */
    static Rectangle residenceRectangle(JsonNode response, int imageWidth, int imageHeight) {
        if (imageWidth <= 0 || imageHeight <= 0 || response == null) return null;
        LabelBox label = findLabel(wordsFromTextAnnotations(
                response.path("textAnnotations"), imageWidth, imageHeight), imageWidth);
        if (label == null) {
            label = findLabel(wordsFromFullText(
                    response.path("fullTextAnnotation"), imageWidth, imageHeight), imageWidth);
        }
        if (label == null) return null;
        Rectangle bounds = label.bounds();
        int padAbove = Math.max(label.wordHeight() * 2, (int) (imageHeight * 0.014));
        int extraBelow = Math.max(label.wordHeight() * 8, (int) (imageHeight * 0.18));
        extraBelow = Math.min(extraBelow, (int) (imageHeight * 0.43));

        // Address rows may start farther left than the printed label.
        int left = Math.min(Math.max(0, bounds.x - (int) (imageWidth * 0.12)), (int) (imageWidth * 0.05));
        int right = Math.min(imageWidth, imageWidth - (int) (imageWidth * 0.025));
        int top = Math.max(0, bounds.y - padAbove);
        int bottom = Math.min(imageHeight, bounds.y + bounds.height + extraBelow);
        if (right - left < 60 || bottom - top < 20) return null;
        return new Rectangle(left, top, right - left, bottom - top);
    }

    private static LabelBox findLabel(List<Token> words, int imageWidth) {
        Rectangle label = null;
        int maxWordHeight = 0;
        boolean vietnamese = false;
        for (int i = 0; i + 2 < words.size(); i++) {
            Token a = words.get(i), b = words.get(i + 1), c = words.get(i + 2);
            boolean vi = a.text().equals("NOI") && c.text().equals("TRU")
                    && (b.text().equals("THUONG") || b.text().equals("CU"));
            boolean en = (a.text().equals("PLACE") || a.text().equals("PATE") || a.text().equals("PACE"))
                    && b.text().equals("OF") && c.text().equals("RESIDENCE");
            if (!vi && !en) continue;
            Rectangle area = a.bounds().union(b.bounds()).union(c.bounds());
            int wordHeight = Math.max(1, Math.max(a.bounds().height, Math.max(b.bounds().height, c.bounds().height)));
            if (area.height > wordHeight * 4 || area.width > imageWidth * 0.86) continue;
            if (label == null || (vi && !vietnamese)
                    || (vi == vietnamese && area.y < label.y)) {
                label = area;
                maxWordHeight = wordHeight;
                vietnamese = vi;
            }
        }
        return label == null ? null : new LabelBox(label, maxWordHeight);
    }

    private static List<Token> wordsFromTextAnnotations(JsonNode annotations, int width, int height) {
        List<Token> words = new ArrayList<>();
        if (!annotations.isArray()) return words;
        // [0] is the entire recognized text, without a useful word-level box.
        for (int i = 1; i < annotations.size(); i++) {
            JsonNode item = annotations.get(i);
            Rectangle bounds = getBounds(item.path("boundingPoly"), width, height);
            if (bounds == null) continue;
            appendTokens(words, item.path("description").asText(""), bounds);
        }
        return words;
    }

    private static List<Token> wordsFromFullText(JsonNode full, int width, int height) {
        List<Token> words = new ArrayList<>();
        for (JsonNode page : full.path("pages")) {
            for (JsonNode block : page.path("blocks")) {
                for (JsonNode paragraph : block.path("paragraphs")) {
                    for (JsonNode word : paragraph.path("words")) {
                        StringBuilder value = new StringBuilder();
                        for (JsonNode symbol : word.path("symbols")) {
                            value.append(symbol.path("text").asText(""));
                        }
                        Rectangle bounds = getBounds(word.path("boundingBox"), width, height);
                        if (bounds != null) appendTokens(words, value.toString(), bounds);
                    }
                }
            }
        }
        return words;
    }

    private static void appendTokens(List<Token> words, String value, Rectangle box) {
        String normalized = fold(value);
        for (String part : normalized.split(" ")) {
            if (!part.isBlank()) words.add(new Token(part, box));
        }
    }

    private static Rectangle getBounds(JsonNode polygon, int width, int height) {
        JsonNode vertices = polygon.path("vertices");
        boolean normalized = false;
        if (!vertices.isArray() || vertices.isEmpty()) {
            vertices = polygon.path("normalizedVertices");
            normalized = true;
        }
        if (!vertices.isArray() || vertices.isEmpty()) return null;
        int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE;
        for (JsonNode vertex : vertices) {
            int x = normalized ? (int) Math.round(vertex.path("x").asDouble(0) * width) : vertex.path("x").asInt(0);
            int y = normalized ? (int) Math.round(vertex.path("y").asDouble(0) * height) : vertex.path("y").asInt(0);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        minX = Math.max(0, Math.min(minX, width));
        maxX = Math.max(0, Math.min(maxX, width));
        minY = Math.max(0, Math.min(minY, height));
        maxY = Math.max(0, Math.min(maxY, height));
        if (maxX <= minX || maxY <= minY) return null;
        return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }

    private static String fold(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('Đ', 'D').replace('đ', 'd')
                .toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", " ").trim();
    }
}
