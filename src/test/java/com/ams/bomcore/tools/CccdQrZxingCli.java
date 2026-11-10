package com.ams.bomcore.tools;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.ReaderException;
import com.google.zxing.Result;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.LuminanceSource;
import com.google.zxing.common.GlobalHistogramBinarizer;
import com.google.zxing.common.HybridBinarizer;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Run locally using just ZXing CORE 3.5.3 + Java 17:
 *
 *   javac -cp "$ZXING_JAR" -d /tmp/zxing-test \
 *      src/test/java/com/ams/bomcore/tools/CccdQrZxingCli.java
 *   java -cp "$ZXING_JAR:/tmp/zxing-test" \
 *      com.ams.bomcore.tools.CccdQrZxingCli /private/path/cccd-qr.jpg
 *
 * Does NOT print decoded ID, name, address or raw QR. Does NOT send photos
 * anywhere. A successful 7-field parse is a FORMAT check, not authentication.
 */
public final class CccdQrZxingCli {
    private CccdQrZxingCli() {}

    private static final Map<DecodeHintType, Object> HINTS =
            new EnumMap<>(DecodeHintType.class);
    static {
        HINTS.put(DecodeHintType.POSSIBLE_FORMATS, List.of(BarcodeFormat.QR_CODE));
        HINTS.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        HINTS.put(DecodeHintType.CHARACTER_SET, "UTF-8");
    }

    private static final class Decoded {
        final String text, method;
        Decoded(String text, String method) {
            this.text = text;
            this.method = method;
        }
    }

    private static Decoded decode(BufferedImage img, String name) {
        int width = img.getWidth(), height = img.getHeight();
        int[] pixels = new int[width * height];
        img.getRGB(0, 0, width, height, pixels, 0, width);
        LuminanceSource source = new RGBLuminanceSource(width, height, pixels);
        for (int inversion = 0; inversion < 2; inversion++) {
            LuminanceSource luminance = inversion == 0 ? source : source.invert();
            for (int algorithm = 0; algorithm < 2; algorithm++) {
                try {
                    BinaryBitmap bitmap = new BinaryBitmap(algorithm == 0
                            ? new HybridBinarizer(luminance)
                            : new GlobalHistogramBinarizer(luminance));
                    Result decoded = new MultiFormatReader().decode(bitmap, HINTS);
                    return new Decoded(decoded.getText(),
                            name + "/" + (inversion == 0 ? "normal" : "inverted")
                                    + "/" + (algorithm == 0 ? "hybrid" : "global"));
                } catch (ReaderException ignored) {
                    // Different thresholding may recover a low-contrast QR.
                }
            }
        }
        return null;
    }

    private static BufferedImage crop(BufferedImage image, double centerY,
                                       double fraction) {
        int size = Math.max(1, (int) (Math.min(image.getWidth(), image.getHeight())
                * fraction));
        int x = Math.max(0, Math.min(image.getWidth() - size,
                (image.getWidth() - size) / 2));
        int y = Math.max(0, Math.min(image.getHeight() - size,
                (int) (image.getHeight() * centerY - size / 2.0)));
        // White margin helps QR finder-pattern detection.
        int pad = 28;
        BufferedImage result = new BufferedImage(size + pad * 2,
                size + pad * 2, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = result.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, result.getWidth(), result.getHeight());
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.drawImage(image, pad, pad, pad + size, pad + size,
                    x, y, x + size, y + size, null);
        } finally {
            graphics.dispose();
        }
        return result;
    }

    private static BufferedImage enhance(BufferedImage source, boolean redChannel,
                                          boolean adaptive) {
        int width = source.getWidth(), height = source.getHeight();
        int[] pixels = source.getRGB(0, 0, width, height, null, 0, width);
        int[] tones = new int[pixels.length], histogram = new int[256];
        for (int i = 0; i < pixels.length; i++) {
            int rgb = pixels[i], r = (rgb >>> 16) & 255;
            int g = (rgb >>> 8) & 255, b = rgb & 255;
            int v = redChannel ? r : (r * 30 + g * 59 + b * 11) / 100;
            tones[i] = v;
            histogram[v]++;
        }
        int low = 0, high = 255, total = 0, percentile = tones.length / 33;
        for (int i = 0; i < 256; i++) {
            total += histogram[i];
            if (total >= percentile) { low = i; break; }
        }
        total = 0;
        for (int i = 255; i >= 0; i--) {
            total += histogram[i];
            if (total >= percentile) { high = i; break; }
        }
        // Integral image permits efficient local thresholds for uneven light.
        long[] sums = null;
        if (adaptive) {
            sums = new long[(width + 1) * (height + 1)];
            for (int y = 1; y <= height; y++) {
                long row = 0;
                for (int x = 1; x <= width; x++) {
                    row += tones[(y - 1) * width + (x - 1)];
                    sums[y * (width + 1) + x] =
                            sums[(y - 1) * (width + 1) + x] + row;
                }
            }
        }
        int scaleDenominator = Math.max(20, high - low);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int i = y * width + x;
                int v;
                if (adaptive) {
                    int radius = 16;
                    int x0 = Math.max(0, x - radius), x1 = Math.min(width, x + radius + 1);
                    int y0 = Math.max(0, y - radius), y1 = Math.min(height, y + radius + 1);
                    long mean = (sums[y1 * (width + 1) + x1]
                            - sums[y1 * (width + 1) + x0]
                            - sums[y0 * (width + 1) + x1]
                            + sums[y0 * (width + 1) + x0])
                            / ((x1 - x0) * (y1 - y0));
                    v = tones[i] < mean - 9 ? 0 : 255;
                } else {
                    v = Math.max(0, Math.min(255,
                            (tones[i] - low) * 255 / scaleDenominator));
                }
                pixels[i] = 0xff000000 | (v << 16) | (v << 8) | v;
            }
        }
        BufferedImage enhanced = new BufferedImage(width, height,
                BufferedImage.TYPE_INT_RGB);
        enhanced.setRGB(0, 0, width, height, pixels, 0, width);
        return enhanced;
    }

    private static boolean validCccdFormat(String qr) {
        if (qr == null) return false;
        String[] values = qr.split("\\|", -1);
        return values.length == 7
                && values[0].matches("[0-9]{12}")
                && (values[1].isBlank() || values[1].matches("[0-9]{9,12}"))
                && !values[2].isBlank() && !values[5].isBlank();
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            System.err.println("Usage: CccdQrZxingCli /private/path/cccd-qr.jpg");
            System.exit(2);
        }
        Path path = Path.of(args[0]);
        if (!Files.isRegularFile(path)) {
            System.err.println("Image not found: " + path);
            System.exit(2);
        }
        BufferedImage original = ImageIO.read(path.toFile());
        if (original == null) {
            System.err.println("Unsupported image format. Use JPG/PNG.");
            System.exit(2);
        }
        System.out.println("Photo: " + original.getWidth() + "x"
                + original.getHeight() + ", local ZXing QR test");
        int attempts = 0;
        BufferedImage[] regions = {
                original, crop(original, 0.35, 0.65),
                crop(original, 0.35, 0.85),
                crop(original, 0.50, 0.80)
        };
        for (int i = 0; i < regions.length; i++) {
            BufferedImage region = regions[i];
            for (int variant = 0; variant < 4; variant++) {
                BufferedImage candidate = variant == 0 ? region
                        : enhance(region, variant != 3, variant == 2);
                attempts++;
                Decoded result = decode(candidate, "region-" + i + "/variant-" + variant);
                if (result != null) {
                    System.out.println("QR: DECODED via " + result.method);
                    System.out.println("Fields: " + result.text.split("\\|", -1).length);
                    System.out.println("CCCD 7-field layout: "
                            + (validCccdFormat(result.text) ? "YES" : "NO"));
                    // No personal data goes to terminal logs.
                    return;
                }
            }
        }
        System.out.println("QR: NOT_DECODED (" + attempts
                + " variants, Hybrid/Global + inversion tried).");
        System.out.println("Use a sharper photo or the original QR text; "
                + "do not guess personal data from undecodable pixels.");
        System.exit(1);
    }
}
