package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Language;
import com.anhmedia.portalweb.legacy.entity.LanguageOption;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * GreetingController's frontend language rules: ?lang= wins, then the
 * session's language, then geo headers / IP country, then English.
 * Legacy kept the language in the HttpSession ("lang") plus a map keyed by
 * session id; both live in this app's own session (cookie PORTALWEBSESSION).
 */
@Component
public class LegacyLanguage {
    private static final Logger log = LoggerFactory.getLogger(LegacyLanguage.class);
    public static final String DEFAULT_LANGUAGE = "vi";
    public static final String FALLBACK_FRONTEND_LANGUAGE = "en";
    public static final List<String> SUPPORTED_FRONTEND_LANGUAGES = Arrays.asList(
            "vi", "en", "cn", "tw", "ja", "ko", "es", "dv", "ms", "id", "ar", "fr", "ur", "fil");
    private static final Set<String> SUPPORTED = new HashSet<>(SUPPORTED_FRONTEND_LANGUAGES);
    /** Stands in for the legacy defaultLangMap.get(session.getId()). */
    static final String MAPPED_LANG = "portalweb.defaultLang";

    private final boolean geoIpLookup;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final Map<String, CachedIp> ipCache = new ConcurrentHashMap<>();

    public LegacyLanguage(@Value("${portal.web.geo-ip-lookup:true}") boolean geoIpLookup) {
        this.geoIpLookup = geoIpLookup;
    }

    /** defaultLangMap.get(session.getId()); null when never set. */
    public String mappedLanguage(HttpSession session) {
        Object v = session.getAttribute(MAPPED_LANG);
        return v == null ? null : v.toString();
    }

    public String resolveRequestedOrSessionLanguage(HttpServletRequest request, HttpSession session) {
        String requested = normalizeFrontendLanguageCode(request.getParameter("lang"));
        if (requested != null) {
            setSessionLanguage(session, requested);
            return requested;
        }
        String mapped = normalizeFrontendLanguageCode(mappedLanguage(session));
        if (mapped != null) {
            setSessionLanguage(session, mapped);
            return mapped;
        }
        Object stored = session.getAttribute("lang");
        String storedLanguage = normalizeFrontendLanguageCode(stored == null ? null : stored.toString());
        if (storedLanguage != null) {
            setSessionLanguage(session, storedLanguage);
            return storedLanguage;
        }
        String detected = detectFrontendLanguage(request);
        setSessionLanguage(session, detected);
        return detected;
    }

    public void setSessionLanguage(HttpSession session, String languageCode) {
        String normalized = normalizeFrontendLanguageCode(languageCode);
        if (normalized == null) normalized = FALLBACK_FRONTEND_LANGUAGE;
        session.setAttribute("lang", normalized);
        session.setAttribute(MAPPED_LANG, normalized);
    }

    private String detectFrontendLanguage(HttpServletRequest request) {
        String location = detectFrontendLanguageByLocation(request);
        return location == null ? FALLBACK_FRONTEND_LANGUAGE : location;
    }

    private String detectFrontendLanguageByLocation(HttpServletRequest request) {
        String country = firstNonBlankHeader(request, "CF-IPCountry", "CloudFront-Viewer-Country",
                "X-Vercel-IP-Country", "X-AppEngine-Country", "X-Country-Code", "X-Geo-Country");
        String mapped = mapCountryToFrontendLanguage(country);
        if (mapped != null) return mapped;
        String clientIp = getFirstClientIp(request);
        if (!hasText(clientIp) || isLocalOrPrivateIp(clientIp) || !geoIpLookup) return null;
        String[] codeAndName = lookupCountry(clientIp);
        if (codeAndName == null) return null;
        mapped = mapCountryToFrontendLanguage(codeAndName[0]);
        return mapped != null ? mapped : mapCountryToFrontendLanguage(codeAndName[1]);
    }

    /** IPService: free.freeipapi.com, 5 s timeouts, 24 h cache, stale cache on failure. */
    private String[] lookupCountry(String ip) {
        CachedIp cached = ipCache.get(ip);
        if (cached != null && !cached.expired()) return cached.value();
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create("https://free.freeipapi.com/api/json/" + ip))
                    .timeout(Duration.ofSeconds(5)).GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) return cached == null ? null : cached.value();
            String[] value = {jsonString(res.body(), "countryCode"), jsonString(res.body(), "countryName")};
            ipCache.put(ip, new CachedIp(value, System.currentTimeMillis()));
            return value;
        } catch (Exception e) {
            log.debug("IP lookup skipped for {}: {}", ip, e.toString());
            return cached == null ? null : cached.value();
        }
    }

    private static final java.util.regex.Pattern JSON_STRING_FIELD =
            java.util.regex.Pattern.compile("\"(countryCode|countryName)\"\\s*:\\s*\"([^\"]*)\"");

    /** optString(key, "undefined") for the two flat string fields we read. */
    static String jsonString(String body, String key) {
        java.util.regex.Matcher m = JSON_STRING_FIELD.matcher(body == null ? "" : body);
        while (m.find()) {
            if (m.group(1).equals(key)) return m.group(2);
        }
        return "undefined";
    }

    private record CachedIp(String[] value, long at) {
        boolean expired() { return System.currentTimeMillis() - at > 24L * 60 * 60 * 1000; }
    }

    private String mapCountryToFrontendLanguage(String value) {
        if (!hasText(value)) return null;
        String n = value.trim().toUpperCase(Locale.ROOT);
        if ("VN".equals(n) || "VNM".equals(n) || "VIET NAM".equals(n) || "VIETNAM".equals(n)) return DEFAULT_LANGUAGE;
        switch (n) {
            case "CN": case "CHN": case "CHINA": case "ZH": case "HONG KONG": case "HK": case "HKG": return "cn";
            case "TW": case "TWN": case "TAIWAN": return "tw";
            case "KR": case "KOR": case "KOREA": case "SOUTH KOREA": case "REPUBLIC OF KOREA": return "ko";
            case "MY": case "MYS": case "MALAYSIA": return "ms";
            case "MV": case "MDV": case "MALDIVES": return "dv";
            case "PK": case "PAK": case "PAKISTAN": return "ur";
            case "PH": case "PHL": case "PHILIPPINES": return "fil";
            case "AE": case "ARE": case "UAE": case "UNITED ARAB EMIRATES":
            case "SA": case "SAU": case "SAUDI ARABIA":
            case "QA": case "QAT": case "QATAR":
            case "KW": case "KWT": case "KUWAIT":
            case "BH": case "BHR": case "BAHRAIN":
            case "OM": case "OMN": case "OMAN": return "ar";
            case "FR": case "FRA": case "FRANCE":
            case "MC": case "MCO": case "MONACO": return "fr";
            case "ES": case "ESP": case "SPAIN":
            case "MX": case "MEX": case "MEXICO":
            case "AR": case "ARG": case "ARGENTINA":
            case "CL": case "CHL": case "CHILE":
            case "CO": case "COL": case "COLOMBIA":
            case "PE": case "PER": case "PERU":
            case "VE": case "VEN": case "VENEZUELA":
            case "UY": case "URY": case "URUGUAY":
            case "PY": case "PRY": case "PARAGUAY":
            case "BO": case "BOL": case "BOLIVIA":
            case "EC": case "ECU": case "ECUADOR":
            case "GT": case "GTM": case "GUATEMALA":
            case "CR": case "CRI": case "COSTA RICA":
            case "PA": case "PAN": case "PANAMA":
            case "DO": case "DOM": case "DOMINICAN REPUBLIC":
            case "CU": case "CUB": case "CUBA":
            case "HN": case "HND": case "HONDURAS":
            case "NI": case "NIC": case "NICARAGUA":
            case "SV": case "SLV": case "EL SALVADOR":
            case "PR": case "PRI": case "PUERTO RICO": return "es";
            case "JP": case "JPN": case "JAPAN": return "ja";
            case "ID": case "IDN": case "INDONESIA": return "id";
            case "US": case "USA": case "UNITED STATES":
            case "GB": case "GBR": case "UNITED KINGDOM":
            case "AU": case "AUS": case "AUSTRALIA":
            case "CA": case "CAN": case "CANADA":
            case "NZ": case "NZL": case "NEW ZEALAND":
            case "IE": case "IRL": case "IRELAND": return FALLBACK_FRONTEND_LANGUAGE;
            default: return null;
        }
    }

    private String firstNonBlankHeader(HttpServletRequest request, String... names) {
        for (String name : names) {
            String value = request.getHeader(name);
            if (hasText(value)) return value.split(",")[0].trim();
        }
        return "";
    }

    private String getFirstClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (hasText(forwardedFor)) return forwardedFor.split(",")[0].trim();
        String realIp = request.getHeader("X-Real-IP");
        if (hasText(realIp)) return realIp.trim();
        return request.getRemoteAddr();
    }

    private boolean isLocalOrPrivateIp(String ip) {
        if (!hasText(ip)) return true;
        String n = ip.trim().toLowerCase(Locale.ROOT);
        if ("localhost".equals(n) || "127.0.0.1".equals(n) || "::1".equals(n) || "0:0:0:0:0:0:0:1".equals(n)) return true;
        if (n.startsWith("10.") || n.startsWith("192.168.")) return true;
        if (n.startsWith("172.")) {
            String[] parts = n.split("\\.");
            if (parts.length > 1) {
                try {
                    int second = Integer.parseInt(parts[1]);
                    return second >= 16 && second <= 31;
                } catch (NumberFormatException ignored) {
                    return false;
                }
            }
        }
        return false;
    }

    private String supportedOrNull(String code) { return SUPPORTED.contains(code) ? code : null; }

    public String normalizeFrontendLanguageCode(String languageCode) {
        if (languageCode == null) return null;
        String code = languageCode.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        if (code.isBlank()) return null;
        String primary = code.split("-")[0];
        if (SUPPORTED.contains(primary)) return primary;
        if ("in".equals(primary)) return supportedOrNull("id");
        if ("ae".equals(primary) || "uae".equals(primary)) return supportedOrNull("ar");
        if ("pk".equals(primary)) return supportedOrNull("ur");
        if ("tl".equals(primary) || "ph".equals(primary) || "tagalog".equals(primary) || "filipino".equals(primary)) return supportedOrNull("fil");
        if ("zh-hant".equals(code) || code.startsWith("zh-hant-") || code.endsWith("-tw")) return supportedOrNull("tw");
        if ("zh".equals(primary) || "cn".equals(primary)) return supportedOrNull("cn");
        if (code.endsWith("-vn")) return supportedOrNull("vi");
        if (code.endsWith("-cn") || code.endsWith("-hk")) return supportedOrNull("cn");
        if (code.endsWith("-kr") || code.endsWith("-kp")) return supportedOrNull("ko");
        if (code.endsWith("-my")) return supportedOrNull("ms");
        if (code.endsWith("-mv")) return supportedOrNull("dv");
        if (code.endsWith("-ae") || code.endsWith("-sa") || code.endsWith("-qa")
                || code.endsWith("-kw") || code.endsWith("-bh") || code.endsWith("-om")) return supportedOrNull("ar");
        if (code.endsWith("-pk")) return supportedOrNull("ur");
        if (code.endsWith("-ph")) return supportedOrNull("fil");
        if (code.endsWith("-fr")) return supportedOrNull("fr");
        if (code.endsWith("-es")) return supportedOrNull("es");
        if (code.endsWith("-jp")) return supportedOrNull("ja");
        if (code.endsWith("-id")) return supportedOrNull("id");
        return null;
    }

    public List<Language> getLanguagesForModel(String selectedLanguageCode) {
        String selected = normalizeFrontendLanguageCode(selectedLanguageCode);
        if (selected == null) selected = FALLBACK_FRONTEND_LANGUAGE;
        List<Language> languages = new ArrayList<>();
        int sequence = 1;
        for (String code : SUPPORTED_FRONTEND_LANGUAGES) {
            Language language = new Language(code, displayLanguageName(code), String.valueOf(sequence++));
            language.setSelected(code.equals(selected));
            languages.add(language);
        }
        return languages;
    }

    public List<LanguageOption> getLanguageOptionsForModel(String selectedLanguageCode) {
        String selected = normalizeFrontendLanguageCode(selectedLanguageCode);
        if (selected == null) selected = FALLBACK_FRONTEND_LANGUAGE;
        List<LanguageOption> options = new ArrayList<>();
        for (String code : SUPPORTED_FRONTEND_LANGUAGES) {
            options.add(new LanguageOption(code, displayLanguageName(code), flagUrlForLanguage(code), code.equals(selected)));
        }
        return options;
    }

    public String displayLanguageName(String languageCode) {
        String code = normalizeFrontendLanguageCode(languageCode);
        if (code == null) code = FALLBACK_FRONTEND_LANGUAGE;
        switch (code) {
            case "vi": return "Vietnamese";
            case "cn": return "Chinese";
            case "tw": return "Traditional Chinese (Taiwan)";
            case "ko": return "Korean";
            case "ms": return "Malay";
            case "dv": return "Dhivehi (Maldives)";
            case "ar": return "Arabic (UAE)";
            case "fr": return "French";
            case "ur": return "Urdu (Pakistan)";
            case "fil": return "Filipino";
            case "es": return "Spanish";
            case "ja": return "Japanese";
            case "id": return "Indonesian";
            default: return "English";
        }
    }

    public String flagUrlForLanguage(String languageCode) {
        String code = normalizeFrontendLanguageCode(languageCode);
        if (code == null) code = FALLBACK_FRONTEND_LANGUAGE;
        if ("ar".equals(code)) return "/img/languageflags/ae.svg";
        if ("ur".equals(code)) return "/img/languageflags/pk.svg";
        if ("tw".equals(code)) return "/img/languageflags/tw.svg";
        if ("fil".equals(code)) return "/img/languageflags/ph.svg";
        return "/img/languageflags/" + code + ".png";
    }

    /** setLanguage(): the redirect target, after storing the language. */
    public String setLanguageRedirect(String languageCode, String redirectPath, HttpSession session) {
        String selected = normalizeFrontendLanguageCode(languageCode);
        if (selected == null) selected = FALLBACK_FRONTEND_LANGUAGE;
        setSessionLanguage(session, selected);
        String safe = sanitizeLanguageRedirectPath(redirectPath);
        if (safe != null) {
            String separator = safe.contains("?") ? (safe.endsWith("?") || safe.endsWith("&") ? "" : "&") : "?";
            return safe + separator + "lang=" + selected;
        }
        if (DEFAULT_LANGUAGE.equals(selected)) return "/trang-chu.html?lang=" + selected;
        return "/home?lang=" + selected;
    }

    private String sanitizeLanguageRedirectPath(String redirectPath) {
        if (redirectPath == null || redirectPath.isBlank()) return null;
        String path = redirectPath.trim();
        if (!path.startsWith("/") || path.startsWith("//") || path.contains("://")
                || path.contains("\r") || path.contains("\n")) return null;
        return path;
    }

    private static boolean hasText(String value) { return value != null && !value.isBlank(); }
}
