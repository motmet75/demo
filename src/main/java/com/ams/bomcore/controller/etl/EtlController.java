package com.ams.bomcore.controller.etl;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.ams.bomcore.domain.etl.EtlQueryRequest;
import com.ams.bomcore.domain.etl.EtlQueryResult;
import com.ams.bomcore.service.etl.EtlQueryService;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/bom/etl")
public class EtlController {

    private static final Logger log = LoggerFactory.getLogger(EtlController.class);

    private final EtlQueryService etlQueryService;

    public EtlController(EtlQueryService etlQueryService) {
        this.etlQueryService = etlQueryService;
    }

    // ── helpers — mirrors your InvoiceController pattern ─────────────────────
    private UUID resolveTenant(UUID param, String header) {
        if (param != null) return param;
        try { return header != null && !header.isBlank() ? UUID.fromString(header) : null; }
        catch (Exception e) { return null; }
    }

    private UUID resolveCompany(UUID param, String header) {
        if (param != null) return param;
        try { return header != null && !header.isBlank() ? UUID.fromString(header) : null; }
        catch (Exception e) { return null; }
    }

    // ── GET ping ──────────────────────────────────────────────────────────────
    @GetMapping("/ping")
    public ResponseEntity<?> ping(
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {
        log.info("ETL ping — tenantHeader=[{}] companyHeader=[{}]", ht, hc);
        return ResponseEntity.ok(Map.of(
            "status",  "pong",
            "tenant",  ht  != null ? ht  : "(none)",
            "company", hc  != null ? hc  : "(none)"
        ));
    }

    // ── POST simple test ──────────────────────────────────────────────────────
    @PostMapping(value = "/test", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> simpleTest(
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",      required = false) UUID tenantId,
            @RequestParam(value = "companyId",     required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {

        tenantId  = resolveTenant(tenantId,  ht);
        companyId = resolveCompany(companyId, hc);

        log.info("ETL /test reached — tenant=[{}] company=[{}] body=[{}]",
                tenantId, companyId, body);

        return ResponseEntity.ok(Map.of(
            "status",    "controller reached",
            "tenant",    tenantId  != null ? tenantId.toString()  : "(none)",
            "company",   companyId != null ? companyId.toString() : "(none)",
            "echo",      body.getOrDefault("message", "(no message)"),
            "received",  body
        ));
    }

    // ── POST real ETL query ───────────────────────────────────────────────────
    @PostMapping(value = "/query", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> runQuery(
            @RequestBody EtlQueryRequest request,
            @RequestParam(value = "tenantId",      required = false) UUID tenantId,
            @RequestParam(value = "companyId",     required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {

        tenantId  = resolveTenant(tenantId,  ht);
        companyId = resolveCompany(companyId, hc);

        log.info("ETL /query — tenant=[{}] company=[{}] sql=[{}] params=[{}]",
                tenantId, companyId, request.getSql(), request.getParams());

        if (request.getSql() == null || request.getSql().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorDto("sql must not be empty"));
        }

        try {
            EtlQueryResult result = etlQueryService.execute(request);
            log.info("ETL OK — {} rows", result.getRowCount());
            return ResponseEntity.ok(result);

        } catch (SecurityException ex) {
            log.warn("ETL blocked: {}", ex.getMessage());
            return ResponseEntity.status(403).body(new ErrorDto(ex.getMessage()));

        } catch (IllegalArgumentException ex) {
            log.warn("ETL bad request: {}", ex.getMessage());
            return ResponseEntity.badRequest().body(new ErrorDto(ex.getMessage()));

        } catch (Exception ex) {
            Throwable root = ex;
            while (root.getCause() != null) root = root.getCause();
            String msg = root.getMessage() != null ? root.getMessage() : ex.toString();
            log.error("ETL execution error: {}", msg);
            return ResponseEntity.status(500).body(new ErrorDto(msg));
        }
    }

    public static class ErrorDto {
        public final String message;
        public ErrorDto(String message) { this.message = message; }
    }
}