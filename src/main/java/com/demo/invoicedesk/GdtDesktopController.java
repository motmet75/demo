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
 @Value("${invoice-desk.desktop-linux-path:./downloads/anhmedia-gdt-client-linux.zip}") private String linuxPath;
 @Value("${invoice-desk.desktop-windows-path:./downloads/anhmedia-gdt-client-windows.zip}") private String windowsPath;
 public GdtDesktopController(InvoiceDeskService invoiceDesk,GdtDesktopService desktop,GdtReportService reports){this.invoiceDesk=invoiceDesk;this.desktop=desktop;this.reports=reports;}
 @PostMapping(value="/pairings",headers="X-Invoice-Desk=true") public Object pairing(Authentication auth){return desktop.create(invoiceDesk.scope(auth));}
 @GetMapping("/status") public Object status(Authentication auth){return desktop.status(invoiceDesk.scope(auth));}
 @GetMapping("/client") public ResponseEntity<byte[]> client(Authentication auth)throws Exception{return download(auth,clientPath,"anhmedia-gdt-client.jar","application/java-archive");}
 @GetMapping("/client/linux") public ResponseEntity<byte[]> linux(Authentication auth)throws Exception{return download(auth,linuxPath,"anhmedia-gdt-client-linux.zip","application/zip");}
 @GetMapping("/client/windows") public ResponseEntity<byte[]> windows(Authentication auth)throws Exception{return download(auth,windowsPath,"anhmedia-gdt-client-windows.zip","application/zip");}
 @PostMapping("/handshake") public Object handshake(@RequestBody GdtDesktopService.HandshakeRequest request){return desktop.handshake(request);}
 @PostMapping("/heartbeat") public Object heartbeat(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String authorization){return desktop.heartbeat(authorization);}
 @PostMapping(value="/reports",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public Object report(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String authorization,@RequestParam MultipartFile file)throws Exception{return reports.upload(desktop.authorize(authorization),file);}
 @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<?> invalid(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}
 private ResponseEntity<byte[]> download(Authentication auth,String value,String filename,String contentType)throws Exception{invoiceDesk.scope(auth);Path path=Path.of(value).toAbsolutePath().normalize();if(!Files.isRegularFile(path)||Files.size(path)>150L*1024*1024)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND);return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename="+filename).contentType(MediaType.parseMediaType(contentType)).contentLength(Files.size(path)).body(Files.readAllBytes(path));}
}
