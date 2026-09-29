package com.ams.bomcore.controller.document;

import com.ams.bomcore.service.document.DocumentScanService;
import com.ams.bomcore.service.document.DocumentScanService.NormalizedPoint;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
public class DocumentScanController {

    private final DocumentScanService scanService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DocumentScanController(DocumentScanService scanService) {
        this.scanService = scanService;
    }

    @PostMapping(path = "/bom/document-scanner/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> process(@RequestParam("image") MultipartFile image,
                                          @RequestParam("corners") String cornersJson,
                                          @RequestParam(defaultValue = "document") String mode,
                                          @RequestParam(defaultValue = "2048") Integer maxDimension) {
        List<NormalizedPoint> corners;
        try {
            corners = objectMapper.readValue(cornersJson, new TypeReference<>() {});
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(BAD_REQUEST, "corners must be a JSON array of four {x,y} points", error);
        }
        DocumentScanService.ScanResult result = scanService.process(image, corners, mode, maxDimension);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(0, TimeUnit.SECONDS).noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=scan.jpg")
                .header("X-Scan-Width", String.valueOf(result.width()))
                .header("X-Scan-Height", String.valueOf(result.height()))
                .header("X-Scan-Mode", result.mode())
                .body(result.image());
    }
}
