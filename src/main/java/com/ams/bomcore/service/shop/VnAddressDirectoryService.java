package com.ams.bomcore.service.shop;

import com.ams.bomcore.viettelpost.ViettelPostDTO.District;
import com.ams.bomcore.viettelpost.ViettelPostDTO.Province;
import com.ams.bomcore.viettelpost.ViettelPostDTO.Ward;
import com.ams.bomcore.viettelpost.ViettelPostService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shared multi-tenant Vietnamese address catalogue. Never stores buyer or CCCD data.
 * Official/2-level and Viettel Post legacy/logistics codes are kept separate.
 */
@Service
public class VnAddressDirectoryService {
    private static final String CURRENT = "CURRENT_2025";
    private static final String VTP = "VIETTELPOST_LEGACY";
    private static final String CURRENT_URL = "https://provinces.open-api.vn/api/v2/?depth=2";
    private static final String VTP_URL = "https://partner.viettelpost.vn/v2/categories/";
    private final JdbcTemplate db;
    private final ViettelPostService viettelPost;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).build();

    public VnAddressDirectoryService(JdbcTemplate db, ViettelPostService viettelPost) {
        this.db = db;
        this.viettelPost = viettelPost;
        this.mapper = new ObjectMapper();
    }

    record Unit(String source, String type, String code, String parentCode,
                String provinceCode, String name) {}

    /** Normalizes accents, TP, HCM and common administrative prefixes. */
    public static String normalize(String value) {
        String result = Normalizer.normalize(Objects.toString(value, ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT);
        result = result.replaceAll("\\b(?:tp\\s*\\.?\\s*hcm|tphcm|hcm)\\b", " ho chi minh ");
        result = result.replaceAll("\\b(?:thanh pho|thi xa|thi tran|phuong|xa|tinh|quan|huyen|dac khu|tp)\\b", " ");
        return result.replaceAll("[^a-z0-9]+", " ").replaceAll("\\s+", " ").trim();
    }

    /**
     * Sync the 2-level post-2025 catalogue. Only commit when the source has
     * enough provinces AND wards; a bad upstream response cannot empty the DB.
     * The official NSO directory remains authoritative for future verification.
     */
    @Transactional
    public Map<String, Object> syncCurrent() throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(CURRENT_URL))
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(45)).GET().build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() != 200 || response.body().length() > 12_000_000)
            throw new IllegalStateException("Nguồn danh mục hành chính V2 không phản hồi hợp lệ.");
        JsonNode provinces = mapper.readTree(response.body());
        if (!provinces.isArray()) throw new IllegalStateException("Nguồn V2 không trả về danh sách tỉnh.");
        List<Unit> units = new ArrayList<>();
        int provinceCount = 0, wardCount = 0;
        for (JsonNode province : provinces) {
            String pcode = province.path("code").asText("");
            String pname = province.path("name").asText("");
            if (pcode.isBlank() || pname.isBlank()) continue;
            JsonNode wards = province.path("wards");
            if (!wards.isArray()) throw new IllegalStateException(
                    "Nguồn V2 thiếu danh sách phường/xã; yêu cầu depth=2.");
            units.add(new Unit(CURRENT, "PROVINCE", pcode, null, pcode, pname));
            provinceCount++;
            for (JsonNode ward : wards) {
                String wcode = ward.path("code").asText("");
                String wname = ward.path("name").asText("");
                if (wcode.isBlank() || wname.isBlank()) continue;
                units.add(new Unit(CURRENT, "WARD", wcode, pcode, pcode, wname));
                wardCount++;
            }
        }
        if (provinceCount < 25 || wardCount < 2_000)
            throw new IllegalStateException("Dữ liệu V2 không đủ tỉnh/phường; giữ nguyên dữ liệu cũ.");
        db.update("UPDATE public.vn_address_unit SET active=false WHERE source=?", CURRENT);
        store(units);
        db.update("""
                INSERT INTO public.vn_address_import_log(source,source_version,source_url,province_count,ward_count)
                VALUES (?,?,?,?,?)
                """, CURRENT, "provinces.open-api.vn/v2 2-level", CURRENT_URL, provinceCount, wardCount);
        return Map.of("source", CURRENT, "provinces", provinceCount, "wards", wardCount);
    }

    public List<Map<String, Object>> listViettelPostProvinces() throws Exception {
        String token = viettelPost.getDefaultToken();
        if (token == null || token.isBlank())
            throw new IllegalStateException("Chưa cấu hình Viettel Post token trên server.");
        List<Map<String,Object>> output = new ArrayList<>();
        for (Province province : viettelPost.getProvinces(token)) {
            output.add(Map.of("id", province.getProvinceId(),
                    "name", Objects.toString(province.getProvinceName(), "")));
        }
        return output;
    }

    /**
     * Import ONE ViettelPost province per request. That provider currently
     * exposes district-based delivery areas; they are legacy suggestions,
     * never authoritative new administrative mappings.
     * Credentials stay on the server: never send or log the Token.
     */
    @Transactional
    public Map<String, Object> syncViettelPost(int provinceId) throws Exception {
        if (provinceId < 1) throw new IllegalArgumentException("provinceId không hợp lệ.");
        String token = viettelPost.getDefaultToken();
        if (token == null || token.isBlank())
            throw new IllegalStateException("Chưa cấu hình Viettel Post token trên server.");
        Province province = viettelPost.getProvinces(token).stream()
                .filter(p -> p.getProvinceId() == provinceId).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tỉnh Viettel Post."));
        List<Unit> units = new ArrayList<>();
        String pcode = String.valueOf(province.getProvinceId());
        units.add(new Unit(VTP, "PROVINCE", pcode, null, pcode, province.getProvinceName()));
        int districtCount = 0, wardCount = 0;
        for (District district : viettelPost.getDistricts(token, provinceId)) {
            String dcode = String.valueOf(district.getDistrictId());
            if (district.getDistrictName() == null || district.getDistrictName().isBlank()) continue;
            units.add(new Unit(VTP, "DISTRICT", dcode, pcode, pcode, district.getDistrictName()));
            districtCount++;
            for (Ward ward : viettelPost.getWards(token, district.getDistrictId())) {
                if (ward.getWardsName() == null || ward.getWardsName().isBlank()) continue;
                units.add(new Unit(VTP, "WARD", String.valueOf(ward.getWardsId()),
                        dcode, pcode, ward.getWardsName()));
                wardCount++;
            }
        }
        if (districtCount == 0 || wardCount == 0)
            throw new IllegalStateException("Viettel Post chưa trả về đủ huyện/xã; không ghi dữ liệu thiếu.");
        store(units);
        db.update("""
                INSERT INTO public.vn_address_import_log(source,source_version,source_url,province_count,ward_count)
                VALUES (?,?,?,?,?)
                """, VTP, "viettelpost v2 legacy delivery", VTP_URL, 1, wardCount);
        return Map.of("source", VTP, "provinceId", provinceId,
                "districts", districtCount, "wards", wardCount);
    }

    private void store(List<Unit> units) {
        db.batchUpdate("""
                INSERT INTO public.vn_address_unit
                  (source, unit_type, code, parent_code, province_code, display_name, search_key, active, imported_at)
                VALUES (?,?,?,?,?,?,?,true,now())
                ON CONFLICT (source,unit_type,code) DO UPDATE SET
                  parent_code=excluded.parent_code,
                  province_code=excluded.province_code,
                  display_name=excluded.display_name,
                  search_key=excluded.search_key,
                  active=true,
                  imported_at=now()
                """, units.stream().map(u -> new Object[]{
                u.source(), u.type(), u.code(), u.parentCode(), u.provinceCode(),
                u.name(), normalize(u.name())
        }).toList());
    }

    public List<Map<String, Object>> suggest(String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank() || rawQuery.length() > 250) return List.of();
        String normalized = normalize(rawQuery);
        if (normalized.length() < 3) return List.of();
        // Anchored ward+province matching. Historical matches remain visible,
        // but never silently converted to an unverified modern locality.
        List<Map<String, Object>> records = db.query("""
                SELECT w.source, w.code AS ward_code, w.display_name AS ward_name,
                       w.search_key AS ward_key, p.code AS province_code,
                       p.display_name AS province_name, p.search_key AS province_key,
                       d.display_name AS district_name
                FROM public.vn_address_unit w
                JOIN public.vn_address_unit p ON p.source=w.source
                  AND p.unit_type='PROVINCE' AND p.code=w.province_code AND p.active
                LEFT JOIN public.vn_address_unit d ON d.source=w.source
                  AND d.unit_type='DISTRICT' AND d.code=w.parent_code AND d.active
                WHERE w.unit_type='WARD' AND w.active
                  AND (position(w.search_key in ?) > 0 OR word_similarity(w.search_key, ?) >= 0.55)
                  AND (position(p.search_key in ?) > 0 OR word_similarity(p.search_key, ?) >= 0.48)
                ORDER BY (CASE WHEN w.source='CURRENT_2025' THEN 0 ELSE 1 END),
                         word_similarity(w.search_key, ?) DESC, w.display_name
                LIMIT 12
                """, (rs, i) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            for (String col : List.of("source", "ward_code", "ward_name", "ward_key",
                    "province_code", "province_name", "province_key")) {
                row.put(col, rs.getString(col));
            }
            row.put("district_name", rs.getString("district_name"));
            return row;
        }, normalized, normalized, normalized, normalized, normalized);
        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (Map<String, Object> row : records) {
            String province = (String) row.get("province_name");
            String ward = (String) row.get("ward_name");
            String district = (String) row.get("district_name");
            boolean historical = VTP.equals(row.get("source"));
            String suffix = ward + (historical && district != null ? ", " + district : "") + ", " + province;
            String proposed = reconstruct(rawQuery, (String) row.get("ward_key"),
                    (String) row.get("province_key"), suffix);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("source", row.get("source"));
            item.put("wardCode", row.get("ward_code"));
            item.put("provinceCode", row.get("province_code"));
            item.put("wardName", ward);
            item.put("provinceName", province);
            item.put("districtName", district);
            item.put("administrativeSuffix", suffix);
            item.put("suggestedAddress", proposed);
            item.put("historical", historical);
            item.put("requiresReview", true);
            suggestions.add(item);
        }
        return suggestions;
    }

    /**
     * Only offer a full replacement when the OCR has an identifiable comma-
     * delimited ward and province. Prefix (house/hamlet) is preserved verbatim.
     */
    static String reconstruct(String raw, String wardKey, String provinceKey, String suffix) {
        String[] pieces = raw.split(",");
        if (pieces.length < 2) return null;
        int wardIndex = -1;
        for (int i = 0; i < pieces.length; i++) {
            if (normalize(pieces[i]).contains(wardKey)) {
                wardIndex = i;
                break;
            }
        }
        if (wardIndex < 0) return null;
        boolean provinceFound = false;
        for (int i = wardIndex + 1; i < pieces.length; i++) {
            if (normalize(pieces[i]).contains(provinceKey)) {
                provinceFound = true;
                break;
            }
        }
        if (!provinceFound) return null;
        List<String> prefix = new ArrayList<>();
        for (int i = 0; i < wardIndex; i++) {
            if (!pieces[i].isBlank()) prefix.add(pieces[i].trim());
        }
        prefix.add(suffix);
        return String.join(", ", prefix);
    }

    public Map<String, Object> status() {
        List<Map<String, Object>> counts = db.query("""
                SELECT source, unit_type, count(*)::integer AS total
                FROM public.vn_address_unit WHERE active
                GROUP BY source, unit_type ORDER BY source, unit_type
                """, (rs,i) -> Map.of("source", rs.getString("source"),
                        "type", rs.getString("unit_type"), "count", rs.getInt("total")));
        return Map.of("counts", counts);
    }
}
