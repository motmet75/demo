package com.anhmedia.portalweb.legacy;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Port of GreetingController.MenuController: the 1-4 segment catch-all
 * routes. Each one serves a designer/static file when one exists at that
 * path, and otherwise renders returnPageofMenu for the last segment.
 *
 * Legacy's dynamicRoutePattern ("^(?!anhmedia\\.vn|assets|...).*") is
 * matched against a path that starts with "/", so its negative lookahead
 * never applies and it excludes nothing. That no-op is reproduced by simply
 * not filtering here. Spring 5 also matched a trailing slash, hence the
 * "/{path}/" variants.
 */
@Controller
public class MenuRouteController {
    private final MenuPageRenderer renderer;
    private final Path liveStatic;
    private final Path packagedStatic;

    public MenuRouteController(MenuPageRenderer renderer,
                               @Value("${portal.live.root:/opt/portal-live}") String liveRoot,
                               @Value("${portal.web.legacy-resources-root:/opt/tuonghoa/portal/src/main/resources}") String legacyRoot) {
        this.renderer = renderer;
        this.liveStatic = Path.of(liveRoot, "static").toAbsolutePath().normalize();
        this.packagedStatic = Path.of(legacyRoot, "static").toAbsolutePath().normalize();
    }

    @GetMapping({"/{path}/{subpath}/{subpath4}/{link}", "/{path}/{subpath}/{subpath4}/{link}/"})
    public Object level4(@PathVariable String path, @PathVariable String subpath, @PathVariable String subpath4,
                         @PathVariable String link, Model model, HttpServletRequest request, HttpSession session) {
        if (LegacyExplicitRoutes.ownedByLegacy(request.getRequestURI())) return notPorted();
        Optional<ResponseEntity<FileSystemResource>> file = staticFile(path + "/" + subpath + "/" + subpath4 + "/" + link, link);
        if (file.isPresent()) return file.get();
        return page(subpath + "/" + subpath4 + "/" + link, subpath + "/" + subpath4, link, model, request, session);
    }

    @GetMapping({"/{path}/{subpath}/{link}", "/{path}/{subpath}/{link}/"})
    public Object level3(@PathVariable String path, @PathVariable String subpath, @PathVariable String link,
                         Model model, HttpServletRequest request, HttpSession session) {
        if ("admin".equalsIgnoreCase(path)) return ResponseEntity.notFound().build();
        if (LegacyExplicitRoutes.ownedByLegacy(request.getRequestURI())) return notPorted();
        Optional<ResponseEntity<FileSystemResource>> file = staticFile(path + "/" + subpath + "/" + link, link);
        if (file.isPresent()) return file.get();
        return page(subpath + "/" + link, subpath, link, model, request, session);
    }

    @GetMapping({"/{path}/{subpath}", "/{path}/{subpath}/"})
    public Object level2(@PathVariable String path, @PathVariable String subpath,
                         Model model, HttpServletRequest request, HttpSession session) {
        if (LegacyExplicitRoutes.ownedByLegacy(request.getRequestURI())) return notPorted();
        Optional<ResponseEntity<FileSystemResource>> file = staticFile(path + "/" + subpath, subpath);
        if (file.isPresent()) return file.get();
        return page(subpath, path, subpath, model, request, session);
    }

    @GetMapping({"/{path}", "/{path}/"})
    public Object level1(@PathVariable String path, Model model, HttpServletRequest request, HttpSession session) {
        if (LegacyExplicitRoutes.ownedByLegacy(request.getRequestURI())) return notPorted();
        Optional<ResponseEntity<FileSystemResource>> file = staticFile(path, path);
        if (file.isPresent()) return file.get();
        return page(path, "", path, model, request, session);
    }

    private Object page(String menuPathForBlogPage, String menuPathForHtmlPage, String link,
                        Model model, HttpServletRequest request, HttpSession session) {
        Optional<MenuPageRenderer.Page> page = renderer.render(menuPathForBlogPage, menuPathForHtmlPage, link, request, session);
        if (page.isEmpty()) return notPorted();
        model.addAllAttributes(page.get().model());
        return page.get().view();
    }

    /** 404 from Portal Web = "served by Portal 8080" through the Nginx fallback. */
    private static ResponseEntity<Void> notPorted() {
        return ResponseEntity.notFound().build();
    }

    /** resolveStaticResource(): live designer static first, then the packaged Portal static tree. */
    private Optional<ResponseEntity<FileSystemResource>> staticFile(String relativePath, String fileName) {
        for (Path root : new Path[] {liveStatic, packagedStatic}) {
            Path candidate = root.resolve(relativePath).normalize();
            if (!candidate.startsWith(root) || !Files.isRegularFile(candidate)) continue;
            try {
                Path realRoot = root.toRealPath();
                Path realCandidate = candidate.toRealPath();
                if (!realCandidate.startsWith(realRoot)) continue;
                return Optional.of(ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(detectContentType(fileName.toLowerCase())))
                        .body(new FileSystemResource(realCandidate)));
            } catch (IOException ignored) {
                // unreadable: treat as missing, like a failed ClassPathResource lookup
            }
        }
        return Optional.empty();
    }

    static String detectContentType(String fileName) {
        if (fileName.endsWith(".woff2")) return "font/woff2";
        if (fileName.endsWith(".woff")) return "font/woff";
        if (fileName.endsWith(".ttf")) return "font/ttf";
        if (fileName.endsWith(".ico")) return "image/x-icon";
        if (fileName.endsWith(".glb")) return "model/gltf-binary";
        if (fileName.endsWith(".gltf")) return "model/gltf+json";
        if (fileName.endsWith(".mp3")) return "audio/mpeg";
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
        if (fileName.endsWith(".png")) return "image/png";
        if (fileName.endsWith(".gif")) return "image/gif";
        if (fileName.endsWith(".webp")) return "image/webp";
        if (fileName.endsWith(".bmp")) return "image/bmp";
        if (fileName.endsWith(".svg")) return "image/svg+xml";
        if (fileName.endsWith(".tif") || fileName.endsWith(".tiff")) return "image/tiff";
        if (fileName.endsWith(".exr")) return "image/aces";
        if (fileName.endsWith(".css")) return "text/css";
        if (fileName.endsWith(".js")) return "application/javascript";
        if (fileName.endsWith(".html")) return "text/html";
        if (fileName.endsWith(".xml")) return "application/xml";
        if (fileName.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }
}
