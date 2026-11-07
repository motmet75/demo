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

    public record NameResult(String fullName, String buyerAddress, boolean recognized, boolean addressComplete) {}

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
            ResidenceMatch residence = new ResidenceMatch(null, 0, false);
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
                ResidenceMatch found = parseResidence(text);
                if (found.value() != null
                        && ((found.complete() && !residence.complete())
                        || (found.complete() == residence.complete() && found.segments() > residence.segments())
                        || (found.complete() == residence.complete() && found.segments() == residence.segments()
                            && (residence.value() == null || found.value().length() > residence.value().length()))))
                    residence = found;
            }
            return new NameResult(name == null ? "" : name,
                    residence.value() == null ? "" : residence.value(),
                    name != null || residence.value() != null,
                    residence.complete());
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
    /**
     * Address extraction is anchored to Nơi thường trú / Nơi cư trú, and
     * preferably ends at a verified Vietnamese province/city name. Vision's
     * OCR text order may interleave the expiry date or put a locality BEFORE
     * the bilingual label, so the parser must not assume adjacent lines.
     */
    static String extractResidence(String text) {
        return parseResidence(text).value();
    }

    private record ResidenceMatch(String value, int segments, boolean complete) {}

    private static ResidenceMatch parseResidence(String text) {
        ResidenceMatch empty = new ResidenceMatch(null, 0, false);
        if (text == null || text.isBlank()) return empty;
        String[] lines = text.replace("\r", "").split("\n");
        ResidenceMatch best = empty;
        for (int i = 0; i < lines.length; i++) {
            if (!isResidenceLabel(fold(lines[i]))) continue;
            List<String> parts = new ArrayList<>();
            String initial = cleanAddressValue(cutBeforeNextField(lines[i]));
            if (looksLikeAddressSegment(initial)) parts.add(initial);

            // OCR sometimes puts "Thôn ..." immediately BEFORE the label, with
            // the province line after it. Never pull in the preceding quê quán.
            if (parts.isEmpty() && i > 0) {
                String prior = cleanAddressValue(lines[i - 1]);
                String previousContext = i > 1 ? fold(lines[i - 2]) : "";
                if (looksLikeAddressSegment(prior) && !endsWithProvince(prior)
                        && !isOriginLabel(fold(lines[i - 1]))
                        && !isOriginLabel(previousContext)
                        && !isResidenceLabel(fold(lines[i - 1]))
                        && !NEXT_ID_FIELD.matcher(lines[i - 1]).find()
                        && looksLikeHamletOrStreet(prior)) {
                    parts.add(prior);
                }
            }

            // Trace FORWARD from the residence label until province/city or
            // the next real field. A few unrelated date lines may be interleaved.
            int skipped = 0;
            for (int j = i + 1; j < Math.min(lines.length, i + 10) && parts.size() < 3; j++) {
                String raw = lines[j].trim();
                if (raw.isBlank()) continue;
                String folded = fold(raw);
                if (isResidenceLabel(folded) && cleanAddressValue(raw).isBlank()) continue;
                java.util.regex.Matcher boundary = NEXT_ID_FIELD.matcher(raw);
                boolean stopsHere = boundary.find();
                // A date field may interrupt the address in Vision's reading
                // order, especially on old CCCDs with expiry beside the photo.
                // When a label is merged AFTER the address, keep its prefix.
                if (stopsHere && boundary.start() == 0) {
                    if (isDateOrExpiryField(folded) && ++skipped <= 3) continue;
                    break;
                }
                if (isDateOnly(raw)) {
                    if (++skipped <= 3) continue;
                    break;
                }
                if (isOriginLabel(folded) && !stopsHere) break;
                String segment = cleanAddressValue(stopsHere ? raw.substring(0, boundary.start()) : raw);
                if (!looksLikeAddressSegment(segment)) break;
                if (!parts.isEmpty() && fold(parts.get(parts.size() - 1)).equals(fold(segment))) continue;
                parts.add(segment);
                if (stopsHere || endsWithProvince(segment)) break;
            }

            // A province line can be emitted BEFORE the street/hamlet row
            // by OCR reading-order heuristics. Trace back to the residence
            // label, then look just after the province for a nearby hamlet
            // without crossing another labeled field.
            if (parts.size() == 1 && endsWithProvince(parts.get(0))) {
                for (int j = i + 1; j < Math.min(lines.length, i + 6); j++) {
                    String candidate = lines[j].trim();
                    String folded = fold(candidate);
                    if (isOriginLabel(folded)) break;
                    if (isDateOrExpiryField(folded) || isDateOnly(candidate)
                            || isResidenceLabel(folded)) continue;
                    if (NEXT_ID_FIELD.matcher(candidate).find()) break;
                    candidate = cleanAddressValue(candidate);
                    if (looksLikeHamletOrStreet(candidate) && looksLikeAddressSegment(candidate)
                            && !endsWithProvince(candidate) && !fold(candidate).equals(fold(parts.get(0)))) {
                        parts.add(0, candidate);
                        break;
                    }
                }
            }

            if (parts.isEmpty()) continue;
            String value = String.join(", ", parts).replaceAll(",\\s*,", ",").trim();
            boolean complete = endsWithProvince(parts.get(parts.size() - 1));
            ResidenceMatch current = new ResidenceMatch(value, parts.size(), complete);
            if ((current.complete() && !best.complete())
                    || (current.complete() == best.complete() && current.segments() > best.segments())
                    || (current.complete() == best.complete() && current.segments() == best.segments()
                        && (best.value() == null || current.value().length() > best.value().length()))) {
                best = current;
            }
        }
        return best;
    }

    // Both Vietnamese and English text can be OCR'd in either order.
    // The English label is occasionally read as "Pate/Pace of residence".
    private static final java.util.regex.Pattern RESIDENCE_LABEL_PATTERN =
            java.util.regex.Pattern.compile(
                    "(?:nơi\\s+(?:thường\\s+trú|cư\\s+trú)|(?:place|pate|pace)\\s+of\\s+residence)",
                    java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE);

    private static String cutBeforeNextField(String line) {
        java.util.regex.Matcher boundary = NEXT_ID_FIELD.matcher(line);
        // Only cut a following field; leave an address preceding it intact.
        return boundary.find() ? line.substring(0, boundary.start()) : line;
    }

    private static String cleanAddressValue(String value) {
        String cleaned = RESIDENCE_LABEL_PATTERN.matcher(value).replaceAll(" ");
        return cleaned.replaceAll("^[\\s/.:：,;-]+", "").replaceAll("[\\s/.:：,;-]+$", "")
                .replaceAll("\\s+", " ").trim();
    }

    private static boolean isResidenceLabel(String key) {
        return key.contains("NOI THUONG TRU") || key.contains("NOI CU TRU")
                || key.contains("PLACE OF RESIDENCE") || key.contains("PATE OF RESIDENCE")
                || key.contains("PACE OF RESIDENCE");
    }

    private static boolean isOriginLabel(String key) {
        return key.contains("QUE QUAN") || key.contains("PLACE OF ORIGIN")
                || key.contains("NOI DANG KY KHAI SINH") || key.contains("PLACE OF BIRTH");
    }

    private static boolean isDateOrExpiryField(String key) {
        return key.contains("CO GIA TRI DEN") || key.contains("DATE OF EXPIRY")
                || key.contains("NGAY HET HAN") || key.contains("NGAY CAP")
                || key.contains("DATE OF ISSUE");
    }

    private static boolean isDateOnly(String raw) {
        return raw.matches("\\s*[0-9]{1,2}\\s*[/.-]\\s*[0-9]{1,2}\\s*[/.-]\\s*[0-9]{2,4}\\s*");
    }

    private static boolean looksLikeHamletOrStreet(String s) {
        String x = fold(s);
        return x.startsWith("THON ") || x.startsWith("AP ") || x.startsWith("KP ")
                || x.startsWith("KHU PHO ") || x.startsWith("TO ")
                || x.startsWith("TDP ") || x.startsWith("DUONG ")
                || x.startsWith("SO ") || x.startsWith("PHUONG ") || x.startsWith("XA ");
    }

    // Old CCCDs may contain pre-2025 province names. Retain both old and new
    // names and normalize "Thành phố" => "TP", "Hồ Chí Minh" => "HCM".
    // A bare "TP" is NOT an endpoint: it must be followed by a city name.
    private static final java.util.Set<String> PROVINCE_ENDINGS = java.util.Set.of(
            "HA NOI", "TP HA NOI", "HAI PHONG", "TP HAI PHONG",
            "DA NANG", "TP DA NANG", "CAN THO", "TP CAN THO",
            "HO CHI MINH", "THANH PHO HO CHI MINH", "TP HO CHI MINH",
            "TP HCM", "TPHCM", "HCM",
            "HUE", "THUA THIEN HUE",
            "AN GIANG", "BA RIA VUNG TAU", "BAC GIANG", "BAC KAN",
            "BAC LIEU", "BAC NINH", "BEN TRE", "BINH DINH",
            "BINH DUONG", "BINH PHUOC", "BINH THUAN", "CA MAU",
            "CAO BANG", "DAK LAK", "DAK NONG", "DIEN BIEN",
            "DONG NAI", "DONG THAP", "GIA LAI", "HA GIANG",
            "HA NAM", "HA TINH", "HAI DUONG", "HAU GIANG",
            "HOA BINH", "HUNG YEN", "KHANH HOA", "KIEN GIANG",
            "KON TUM", "LAI CHAU", "LAM DONG", "LANG SON",
            "LAO CAI", "LONG AN", "NAM DINH", "NGHE AN",
            "NINH BINH", "NINH THUAN", "PHU THO", "PHU YEN",
            "QUANG BINH", "QUANG NAM", "QUANG NGAI",
            "QUANG NINH", "QUANG TRI", "SOC TRANG", "SON LA",
            "TAY NINH", "THAI BINH", "THAI NGUYEN", "THANH HOA",
            "TIEN GIANG", "TRA VINH", "TUYEN QUANG", "VINH LONG",
            "VINH PHUC", "YEN BAI"
    );

    static boolean endsWithProvince(String value) {
        if (value == null || value.isBlank()) return false;
        String normal = fold(value);
        for (String name : PROVINCE_ENDINGS) {
            if (normal.equals(name) || normal.endsWith(" " + name)) return true;
        }
        return false;
    }

    private static final java.util.regex.Pattern NEXT_ID_FIELD = java.util.regex.Pattern.compile(
            "(?iu)(?:nơi\\s+đăng\\s+ký\\s+khai\\s+sinh|place\\s+of\\s+birth"
            + "|quê\\s+quán|place\\s+of\\s+origin"
            + "|ngày(?:,?\\s*tháng,?\\s*năm)?\\s+cấp|date\\s+of\\s+issue"
            + "|ngày(?:,?\\s*tháng,?\\s*năm)?\\s+hết\\s+hạn|date\\s+of\\s+expiry"
            + "|có\\s+giá\\s+trị\\s+đến|giới\\s+tính|sex\\s*[:：]"
            + "|quốc\\s+tịch|nationality|bộ\\s+công\\s+an|ministry\\s+of\\s+public\\s+security)");

    private static boolean looksLikeAddressSegment(String text) {
        if (text == null || text.isBlank()) return false;
        String key = fold(text);
        if (key.isBlank() || isOriginLabel(key) || isResidenceLabel(key)
                || NEXT_ID_FIELD.matcher(text).find()
                || key.contains("HO VA TEN") || key.contains("FULL NAME")
                || key.contains("DATE OF BIRTH") || key.contains("NGAY SINH")) return false;
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
