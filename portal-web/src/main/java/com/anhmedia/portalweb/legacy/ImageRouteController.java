package com.anhmedia.portalweb.legacy;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Port of GreetingController.ImageController (/image/{endpoint}), disk-cache path only.
 *
 * Legacy looks the image up in mediaTB by downloadURL, then serves it (or the
 * resized "_rslt_WxH" variant chosen from fixed size presets) from
 * /opt/tuonghoa/images/{tenant}/. On a cache miss it downloads the original
 * from Google Drive, resizes it, writes it to disk and updates mediaTB; that
 * needs Drive credentials and DB writes, which Portal Web does not have. For a
 * miss (or an unknown image) this answers 404 so Nginx serves the request from
 * Portal 8080. (Legacy also writes "last used" to mediaTB on every hit; that
 * bookkeeping is not reproduced.)
 */
@RestController
public class ImageRouteController {
    private record Preset(int width, int height) {}

    /** GreetingController.ALLOWED_SIZES, in order. */
    private static final List<Preset> ALLOWED_SIZES = List.of(
            new Preset(64, 64), new Preset(200, 200), new Preset(600, 600), new Preset(800, 800), new Preset(1000, 1000));

    private final LegacySite site;
    private final TenantDatabases databases;
    private final Path imagesRoot;

    public ImageRouteController(LegacySite site, TenantDatabases databases,
                                @Value("${portal.web.images-root:/opt/tuonghoa/images}") String imagesRoot) {
        this.site = site;
        this.databases = databases;
        this.imagesRoot = Path.of(imagesRoot).toAbsolutePath().normalize();
    }

    @GetMapping({"/image/{endpoint}", "/image/{endpoint}/"})
    public ResponseEntity<byte[]> image(@PathVariable String endpoint, HttpServletRequest request) throws IOException {
        String separator = Utilities.getConfig("imagesolutionsaperator");
        Matcher matcher = Pattern.compile("^(.*)" + (separator == null ? "null" : separator)
                + "([0-9]+)x([0-9]+)\\.(jpg|jpeg|png|webp)$").matcher(endpoint);
        boolean isResized = matcher.matches();
        int oriWidth = isResized ? Integer.parseInt(matcher.group(2)) : 0;

        String tenant = site.resolveTenantId(site.domainString(request));
        var db = databases.forTenant(tenant);
        if (db.isEmpty()) return ResponseEntity.notFound().build();
        Path homeDir = imagesRoot.resolve(tenant).normalize();
        if (!homeDir.startsWith(imagesRoot)) return ResponseEntity.notFound().build();

        String originalUrl = endpoint.replaceAll("_rslt_([0-9]+)x([0-9]+)\\.(jpg|jpeg|png|webp)$", ".$3");
        List<Map<String, Object>> rows = db.get().queryForList(
                "SELECT downloadurl, oriwidth, oriheight FROM mediatb WHERE downloadurl = ? AND visible = true", originalUrl);
        if (rows.isEmpty() || rows.get(0).get("downloadurl") == null) return ResponseEntity.notFound().build();
        String downloadUrl = rows.get(0).get("downloadurl").toString();
        int w = number(rows.get(0).get("oriwidth"));
        int h = number(rows.get(0).get("oriheight"));

        Path existsCheck = homeDir.resolve(endpoint).normalize();
        Path read = homeDir.resolve(downloadUrl).normalize();
        if (w * h > 0 && isResized) {
            Preset preset = ALLOWED_SIZES.stream().filter(p -> p.width() >= oriWidth && p.height() >= oriWidth)
                    .findFirst().orElse(null);
            int tw = preset != null ? preset.width() : w;
            int th = preset != null ? (preset.height() * h) / w : h;
            existsCheck = homeDir.resolve(Utilities.appendResolutionToFilename(downloadUrl, "_rslt_" + tw + "x" + th)).normalize();
            read = existsCheck;
        }
        if (!existsCheck.startsWith(homeDir) || !read.startsWith(homeDir)) return ResponseEntity.notFound().build();
        if (!Files.isRegularFile(existsCheck) || Files.size(existsCheck) == 0 || !Files.isRegularFile(read)) {
            return ResponseEntity.notFound().build(); // cache miss: legacy would fetch from Google Drive
        }

        HttpHeaders headers = new HttpHeaders();
        String ext = Utilities.getFileExtension(downloadUrl);
        switch (ext) {
            case "jpg", "jpeg" -> headers.setContentType(MediaType.IMAGE_JPEG);
            case "png" -> headers.setContentType(MediaType.IMAGE_PNG);
            case "gif" -> headers.setContentType(MediaType.IMAGE_GIF);
            case "webp" -> headers.setContentType(MediaType.parseMediaType("image/webp"));
            case "jfif" -> headers.setContentType(MediaType.parseMediaType("image/jfif"));
            default -> { }
        }
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES)).headers(headers)
                .body(Files.readAllBytes(read));
    }

    private static int number(Object v) {
        return v instanceof Number n ? n.intValue() : 0;
    }
}
