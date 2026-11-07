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
import java.util.ArrayList;
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
 * Extracts suggested name and residence from one or two sides of a Vietnamese ID card.
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

    public record NameResult(String fullName, String buyerAddress, boolean recognized) {}

    public NameResult read(MultipartFile image) {
        return read(image == null ? List.of() : List.of(image));
    }

    /**
     * Read both sides in one Google Vision request. Do not attach or store ID photos
     * as invoice documents. Buyer must review the extracted fields before issuing.
     */
    public NameResult read(List<MultipartFile> images) {
        if (images == null || images.isEmpty() || images.size() > 2)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn 1 hoặc 2 ảnh mặt trước/mặt sau CCCD.");
        long total = 0;
        for (MultipartFile image : images) {
            if (image == null || image.isEmpty())
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ảnh CCCD không được để trống.");
            if (image.getSize() > MAX_IMAGE_BYTES)
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Mỗi ảnh không được lớn hơn 5 MB.");
            total += image.getSize();
            String mediaType = image.getContentType();
            if (mediaType == null || !List.of("image/jpeg", "image/png", "image/webp").contains(mediaType.toLowerCase(Locale.ROOT)))
                throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
        }
        if (total > 2 * MAX_IMAGE_BYTES)
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Tổng dung lượng 2 ảnh không được quá 10 MB.");
        if (credentialsFile.isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa cấu hình Google Vision OCR.");
        Path credentials = Path.of(credentialsFile).toAbsolutePath().normalize();
        if (!Files.isRegularFile(credentials) || !Files.isReadable(credentials))
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Không đọc được tệp Google Vision credentials.");
        try {
            var requests = new ArrayList<Map<String, Object>>();
            for (MultipartFile image : images) {
                requests.add(Map.of(
                        "image", Map.of("content", Base64.getEncoder().encodeToString(image.getBytes())),
                        "features", List.of(Map.of("type", "DOCUMENT_TEXT_DETECTION"))));
            }
            var req = HttpRequest.newBuilder(GOOGLE_VISION)
                    .timeout(Duration.ofSeconds(50))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + googleAuth.token(credentials))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(Map.of("requests", requests))))
                    .build();
            HttpResponse<String> response = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200)
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Vision OCR HTTP " + response.statusCode());
            JsonNode results = mapper.readTree(response.body()).path("responses");
            String name = null;
            String residence = null;
            for (JsonNode result : results) {
                if (result.has("error"))
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Vision không xử lý được một trong các ảnh.");
                String text = result.path("fullTextAnnotation").path("text").asText("");
                if (text.isBlank()) text = result.path("textAnnotations").path(0).path("description").asText("");
                String foundName = extractFullName(text);
                if (foundName != null) {
                    if (name != null && !fold(name).equals(fold(foundName)))
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Hai ảnh có họ tên khác nhau. Vui lòng chỉ tải 2 mặt của cùng một CCCD.");
                    name = foundName;
                }
                String foundAddress = extractResidence(text);
                if (foundAddress != null && (residence == null || foundAddress.length() > residence.length()))
                    residence = foundAddress;
            }
            return new NameResult(name == null ? "" : name, residence == null ? "" : residence,
                    name != null || residence != null);
        } catch (ResponseStatusException error) {
            throw error;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Vision OCR bị gián đoạn.");
        } catch (Exception error) {
            // Never log or expose the uploaded ID image, ID number, raw OCR text or credentials.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Không thể nhận dạng ảnh CCCD. Kiểm tra Google Vision OCR.");
        }
    }

    /**
     * Nơi thường trú / Nơi cư trú can be on either side of an ID card.
     * The value often starts on the label line and continues over a second line.
     * Never confuse it with Quê quán / Place of origin.
     */
    static String extractResidence(String text) {
        if (text == null || text.isBlank()) return null;
        String[] lines = text.replace("\r", "").split("\n");
        String best = null;
        for (int i = 0; i < lines.length; i++) {
            if (!isResidenceLabel(fold(lines[i]))) continue;
            List<String> parts = new ArrayList<>();
            String initial = stripResidenceLabel(lines[i]);
            if (looksLikeAddressSegment(initial)) parts.add(initial);
            for (int j = i + 1; j < Math.min(lines.length, i + 5) && parts.size() < 3; j++) {
                String candidate = lines[j].trim();
                if (candidate.isBlank()) continue;
                String folded = fold(candidate);
                if (isResidenceLabel(folded)) {
                    candidate = stripResidenceLabel(candidate);
                    if (candidate.isBlank()) continue; // Bilingual label on separate OCR line.
                } else if (isAddressFieldBoundary(folded)) {
                    break;
                }
                if (!looksLikeAddressSegment(candidate)) break;
                parts.add(candidate.replaceAll("\\s+", " ").trim());
            }
            if (!parts.isEmpty()) {
                String value = String.join(", ", parts).replaceAll(",\\s*,", ",").trim();
                // A longer labeled address normally has the second locality line.
                if (best == null || value.length() > best.length()) best = value;
            }
        }
        return best;
    }

    private static String stripResidenceLabel(String line) {
        String value = line.trim()
                .replaceFirst("(?iu)^.*?(?:nơi\\s+thường\\s+trú|nơi\\s+cư\\s+trú|place\\s+of\\s+residence)\\s*[/\\s:：-]*", "")
                .replaceFirst("(?iu)^place\\s+of\\s+residence\\s*[:：-]?\\s*", "")
                .replaceFirst("(?iu)^nơi\\s+(?:thường\\s+trú|cư\\s+trú)\\s*[:：-]?\\s*", "");
        return value.replaceAll("\\s+", " ").trim();
    }

    private static boolean isResidenceLabel(String key) {
        return key.contains("NOI THUONG TRU") || key.contains("NOI CU TRU")
                || key.contains("PLACE OF RESIDENCE");
    }

    private static boolean isAddressFieldBoundary(String key) {
        return key.contains("QUE QUAN") || key.contains("PLACE OF ORIGIN")
                || key.contains("DATE OF ISSUE") || key.contains("NGAY CAP")
                || key.contains("DATE OF EXPIRY") || key.contains("NGAY HET HAN")
                || key.contains("CO GIA TRI DEN") || key.contains("DATE OF BIRTH")
                || key.contains("NGAY SINH") || key.contains("GIOI TINH")
                || key.contains("QUOC TICH") || key.contains("NATIONALITY")
                || key.contains("BO CONG AN") || key.contains("MINISTRY OF PUBLIC SECURITY")
                || key.contains("NOI DANG KY KHAI SINH") || key.contains("PLACE OF BIRTH")
                || key.contains("HO VA TEN") || key.contains("FULL NAME")
                || key.contains("DINH DANH CA NHAN");
    }

    private static boolean looksLikeAddressSegment(String text) {
        if (text == null || text.isBlank()) return false;
        String key = fold(text);
        if (key.isBlank() || isAddressFieldBoundary(key) || isResidenceLabel(key)) return false;
        if (text.indexOf('<') >= 0 || key.startsWith("IDVNM") || key.matches("[0-9 ]+")) return false;
        return text.codePoints().filter(Character::isLetter).count() >= 3;
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
