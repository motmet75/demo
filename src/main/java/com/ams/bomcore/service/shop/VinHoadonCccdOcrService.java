package com.ams.bomcore.service.shop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import invoice.GoogleAuth;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Extracts only a suggested buyer name from the front of a Vietnamese ID card.
 * The image and full OCR text are processed in memory, never persisted or logged.
 */
@Service
public class VinHoadonCccdOcrService {
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final URI GOOGLE_VISION = URI.create("https://vision.googleapis.com/v1/images:annotate");

    private final GoogleAuth googleAuth = new GoogleAuth();
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final String credentialsFile;

    public VinHoadonCccdOcrService(
            @Value("${invoice-desk.google-credentials:${GOOGLE_APPLICATION_CREDENTIALS:}}") String credentialsFile) {
        this.credentialsFile = credentialsFile == null ? "" : credentialsFile.trim();
    }

    public record NameResult(String fullName, boolean recognized) {}

    public NameResult read(MultipartFile image) {
        if (image == null || image.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ảnh mặt trước CCCD/Căn cước.");
        if (image.getSize() > MAX_IMAGE_BYTES)
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Ảnh không được lớn hơn 5 MB.");
        String mediaType = image.getContentType();
        if (mediaType == null || !List.of("image/jpeg", "image/png", "image/webp").contains(mediaType.toLowerCase(Locale.ROOT)))
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
        if (credentialsFile.isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa cấu hình Google Vision OCR.");
        Path credentials = Path.of(credentialsFile).toAbsolutePath().normalize();
        if (!Files.isRegularFile(credentials) || !Files.isReadable(credentials))
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Không đọc được tệp Google Vision credentials.");
        try {
            var payload = Map.of("requests", List.of(Map.of(
                    "image", Map.of("content", Base64.getEncoder().encodeToString(image.getBytes())),
                    "features", List.of(Map.of("type", "DOCUMENT_TEXT_DETECTION")))));
            var req = HttpRequest.newBuilder(GOOGLE_VISION)
                    .timeout(Duration.ofSeconds(50))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + googleAuth.token(credentials))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(payload)))
                    .build();
            HttpResponse<String> response = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200)
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Vision OCR HTTP " + response.statusCode());
            JsonNode result = mapper.readTree(response.body()).path("responses").path(0);
            if (!result.path("error").isMissingNode())
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Vision không xử lý được ảnh.");
            String text = result.path("fullTextAnnotation").path("text").asText("");
            if (text.isBlank()) text = result.path("textAnnotations").path(0).path("description").asText("");
            String name = extractFullName(text);
            return new NameResult(name == null ? "" : name, name != null);
        } catch (ResponseStatusException error) {
            throw error;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Vision OCR bị gián đoạn.");
        } catch (Exception error) {
            // Do not expose any request payload, token, full OCR text or credentials.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Không thể nhận dạng ảnh CCCD. Kiểm tra Google Vision OCR.");
        }
    }

    static String extractFullName(String text) {
        if (text == null || text.isBlank()) return null;
        String[] lines = text.replace("\r", "").split("\n");
        for (int i = 0; i < lines.length; i++) {
            String folded = fold(lines[i]);
            if (!isNameLabel(folded)) continue;
            String inline = lines[i].replaceFirst("(?iu)^.*(?:full\\s*name|họ\\s*(?:và\\s*)?tên|tên\\s*khai\\s*sinh)\\s*[:：-]?\\s*", "").trim();
            if (looksLikeName(inline)) return normalizeName(inline);
            for (int j = i + 1; j < Math.min(lines.length, i + 5); j++) {
                String possible = normalizeName(lines[j]);
                if (isNameLabel(fold(possible))) continue;
                if (looksLikeName(possible)) return possible;
                if (fold(possible).contains("DATE OF BIRTH") || fold(possible).contains("NGAY SINH")
                        || fold(possible).contains("GIOI TINH")) break;
            }
        }
        return null;
    }

    private static boolean isNameLabel(String folded) {
        return folded.contains("FULL NAME") || folded.contains("HO VA TEN")
                || folded.contains("HO CHU DEM VA TEN") || folded.contains("TEN KHAI SINH");
    }

    private static String normalizeName(String value) {
        return value.replaceAll("^[\\s:：-]+", "").replaceAll("[\\s:：-]+$", "")
                .replaceAll("\\s+", " ").trim();
    }

    private static boolean looksLikeName(String candidate) {
        String s = normalizeName(candidate);
        if (s.length() < 4 || s.length() > 80 || !s.matches("[\\p{L} .'-]+")) return false;
        int words = s.split("\\s+").length;
        if (words < 2 || words > 7) return false;
        String f = fold(s);
        return !f.contains("FULL NAME") && !f.contains("HO VA TEN")
                && !f.contains("DATE OF BIRTH") && !f.contains("GIOI TINH")
                && !f.contains("QUOC TICH") && !f.contains("VIET NAM")
                && !f.contains("REPUBLIC") && !f.contains("NOI THUONG TRU")
                && !f.contains("CAN CUOC") && !f.contains("IDENTITY CARD");
    }

    private static String fold(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('Đ', 'D').replace('đ', 'd')
                .toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", " ").trim();
    }
}
