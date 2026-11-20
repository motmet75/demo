package com.ams.bomcore.service.shop;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** Extract buyer fields from either side of a card; never treat its birthplace as residence. */
public final class CccdParser {
    private CccdParser() {}
    public record Buyer(String buyerIdentityNumber, String buyerName, String buyerAddress) {}

    public static Buyer parse(String text) {
        var lines = Objects.toString(text, "").lines().map(String::trim).filter(s -> !s.isBlank()).toList();
        String id = "", name = "", address = "";
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i), folded = fold(line);
            if (folded.matches(".*(?:so|no\\.|number|dinh danh).*")) {
                var match = Pattern.compile("(?<![0-9])([0-9]{12})(?![0-9])").matcher(line);
                if (match.find()) id = match.group(1);
                else if (i + 1 < lines.size() && lines.get(i + 1).matches("[0-9]{12}")) id = lines.get(i + 1);
            }
            if (folded.contains("ho va ten") || folded.contains("full name") || folded.contains("chu dem va ten")) {
                name = afterLabel(line, "full name", "ho, chu dem va ten khai sinh", "ho va ten", "chu dem va ten khai sinh", "chu dem va ten");
                if (name.isBlank() && i + 1 < lines.size() && !isField(fold(lines.get(i + 1)))) name = lines.get(i + 1);
            }
            if (folded.contains("noi thuong tru") || folded.contains("place of residence") || folded.contains("noi cu tru")) {
                var parts = new ArrayList<String>();
                String first = residenceValue(afterLabel(line, "place of residence", "noi thuong tru", "noi cu tru"));
                if (!first.isBlank()) parts.add(first);
                for (int j = i + 1; j < lines.size() && parts.size() < 4; j++) {
                    String next = lines.get(j), f = fold(next);
                    if (isField(f) || next.matches("(?i)(F[0-9]{1,2}|PrtScr|IDVNM.*|[A-Za-z])")) break;
                    String value = residenceValue(next);
                    if (!value.isBlank()) parts.add(value);
                }
                address = String.join(" ", parts).replaceAll("\\s*,\\s*", ", ").replaceAll("\\s+", " ").trim();
            }
        }
        if (!name.isBlank() && !name.matches("[\\p{L} .'-]{2,255}")) name = "";
        return new Buyer(id, name.toUpperCase(Locale.forLanguageTag("vi")), address);
    }

    private static boolean isField(String s) {
        return s.matches(".*(?:ngay sinh|date of birth|gioi tinh|quoc tich|que quan|place of origin|noi dang ky khai sinh|place of birth|co gia tri|date of expiry|date of issue|dac diem|personal identification|ngay, thang|date, month|ngon tro|cuc truong|bo cong an|ministry of public security).*");
    }
    private static String residenceValue(String value) {
        // OCR can misread the English label, e.g. "Pate of residence", while the Vietnamese label is intact.
        return value.replaceFirst("(?i)^[\\s:/|\"'.]*(?:[a-z]+\\s+of\\s+residence)[\\s:./|\"']*", "").trim();
    }
    private static String afterLabel(String line, String... labels) {
        String folded = fold(line);
        for (String label : labels) {
            int at = folded.indexOf(label);
            if (at >= 0) return line.substring(at + label.length()).replaceFirst("^[\\s:/|]+", "").trim();
        }
        return "";
    }
    static String fold(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT);
    }
}
