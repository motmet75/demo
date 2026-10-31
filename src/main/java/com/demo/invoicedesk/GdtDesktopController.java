package com.demo.invoicedesk;

import java.util.Map;
import java.nio.file.*;
import org.springframework.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/invoice-desk/desktop")
public class GdtDesktopController {
 private final InvoiceDeskService invoiceDesk;private final GdtDesktopService desktop;private final GdtReportService reports;
 @Value("${invoice-desk.desktop-client-path:./downloads/anhmedia-gdt-client.jar}") private String clientPath;
 public GdtDesktopController(InvoiceDeskService invoiceDesk,GdtDesktopService desktop,GdtReportService reports){this.invoiceDesk=invoiceDesk;this.desktop=desktop;this.reports=reports;}
 @PostMapping(value="/pairings",headers="X-Invoice-Desk=true") public Object pairing(Authentication auth){return desktop.create(invoiceDesk.scope(auth));}
 @GetMapping("/status") public Object status(Authentication auth){return desktop.status(invoiceDesk.scope(auth));}
 @GetMapping("/client") public ResponseEntity<byte[]> client(Authentication auth)throws Exception{invoiceDesk.scope(auth);Path path=Path.of(clientPath).toAbsolutePath().normalize();if(!Files.isRegularFile(path)||Files.size(path)>100L*1024*1024)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND);return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=anhmedia-gdt-client.jar").contentType(MediaType.parseMediaType("application/java-archive")).contentLength(Files.size(path)).body(Files.readAllBytes(path));}
 @PostMapping("/handshake") public Object handshake(@RequestBody GdtDesktopService.HandshakeRequest request){return desktop.handshake(request);}
 @PostMapping("/heartbeat") public Object heartbeat(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String authorization){return desktop.heartbeat(authorization);}
 @PostMapping(value="/reports",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public Object report(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String authorization,@RequestParam MultipartFile file)throws Exception{return reports.upload(desktop.authorize(authorization),file);}
 @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<?> invalid(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}
}
