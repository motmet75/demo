package com.ams.bomcore.controller.admin;

import com.ams.bomcore.service.portalcontent.PortalPublicSnapshotService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * A private port-8081 bridge for port-8083. NOT a browser-facing public API.
 * It is disabled until BOTH services have the same long random secret set.
 * An authenticated Demo admin session does not bypass the token check.
 */
@RestController
@RequestMapping("/internal/portal-public")
public class PortalPublicBridgeController {
    private final PortalPublicSnapshotService content;
    private final String secret;

    public PortalPublicBridgeController(PortalPublicSnapshotService content,
            @Value("${portal-content.public-bridge-token:}") String secret) {
        this.content = content;
        this.secret = secret == null ? "" : secret.trim();
    }

    @GetMapping("/{tenantId}")
    public Map<String,Object> home(@PathVariable String tenantId,
                                   @RequestParam(defaultValue = "en") String lang,
                                   @RequestHeader(value = "X-Portal-Bridge-Token", required = false) String token,
                                   HttpServletRequest request) {
        if (secret.length() < 32) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Portal public content bridge disabled");
        String addr = request.getRemoteAddr();
        if (!("127.0.0.1".equals(addr) || "::1".equals(addr)
                || "0:0:0:0:0:0:0:1".equals(addr) || "::ffff:127.0.0.1".equals(addr))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        byte[] expected = secret.getBytes(StandardCharsets.UTF_8);
        byte[] actual = (token == null ? "" : token).getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return content.home(tenantId, lang);
    }
}
