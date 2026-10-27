package com.demo.invoicedesk;

import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/invoice-desk")
public class InvoiceDeskController {
 private final InvoiceDeskService service;
 public InvoiceDeskController(InvoiceDeskService service){this.service=service;}
 @GetMapping("/context") public Object context(Authentication auth){return service.scope(auth);}
 @GetMapping("/settings") public Object settings(Authentication auth){service.scope(auth);return service.ocrStatus();}
 @GetMapping("/documents") public Object documents(Authentication auth){return service.documents(service.scope(auth));}
 @PostMapping(value="/documents",headers="X-Invoice-Desk=true") public Object upload(Authentication auth,@RequestParam MultipartFile file)throws Exception{return service.upload(service.scope(auth),file);}
 @PutMapping(value="/documents/{id}",headers="X-Invoice-Desk=true") public Object correct(Authentication auth,@PathVariable UUID id,@RequestBody InvoiceDeskService.Correction change){return service.correct(service.scope(auth),id,change);}
 @GetMapping("/documents/{id}/source") public ResponseEntity<byte[]> source(Authentication auth,@PathVariable UUID id){
  var scope=service.scope(auth);String name=service.document(scope,id).invoice().source;
  return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(name,java.nio.charset.StandardCharsets.UTF_8).build().toString()).contentType(MediaType.APPLICATION_OCTET_STREAM).body(service.source(scope,id));
 }
 @GetMapping("/suppliers") public Object suppliers(Authentication auth){return service.suppliers(service.scope(auth));}
 public record RuleRequest(long version){}
 @PostMapping(value="/documents/{id}/reprocess",headers="X-Invoice-Desk=true") public Object reprocess(Authentication auth,@PathVariable UUID id,@RequestBody RuleRequest request)throws Exception{return service.reprocess(service.scope(auth),id,request.version());}
 @PostMapping(value="/documents/{id}/rules",headers="X-Invoice-Desk=true") public Object applyRules(Authentication auth,@PathVariable UUID id,@RequestBody RuleRequest request){return service.applySupplierRules(service.scope(auth),id,request.version());}
 @PutMapping(value="/suppliers",headers="X-Invoice-Desk=true") public void supplier(Authentication auth,@RequestBody InvoiceDeskService.Supplier supplier){service.saveSupplier(service.scope(auth),supplier);}
 @GetMapping("/learning") public Object learning(Authentication auth){return service.learning(service.scope(auth));}
 @GetMapping("/export") public ResponseEntity<byte[]> export(Authentication auth,@RequestParam(defaultValue="false") boolean draft)throws Exception{
  return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename="+(draft?"draft-invoices.xlsx":"approved-invoices.xlsx")).contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).body(service.export(service.scope(auth),draft));
 }
 @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<?> invalid(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("message",Objects.toString(e.getMessage(),"Invalid request")));}
}
