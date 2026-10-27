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
 @GetMapping("/context") public Object context(Authentication auth){if(service.passwordChangeRequired(auth))return Map.of("passwordChangeRequired",true);return service.scope(auth);}
 @GetMapping("/settings") public Object settings(Authentication auth){service.scope(auth);return service.ocrStatus();}
 @GetMapping("/documents") public Object documents(Authentication auth){return service.documents(service.scope(auth));}
 @PostMapping(value="/documents",headers="X-Invoice-Desk=true") public Object upload(Authentication auth,@RequestParam MultipartFile file,@RequestParam(required=false) UUID task)throws Exception{var scope=service.scope(auth);return InvoiceDeskTasks.run(scope,task==null?UUID.randomUUID():task,()->service.upload(scope,file));}
 @PutMapping(value="/documents/{id}",headers="X-Invoice-Desk=true") public Object correct(Authentication auth,@PathVariable UUID id,@RequestBody InvoiceDeskService.Correction change){return service.correct(service.scope(auth),id,change);}
 @GetMapping("/documents/{id}/source") public ResponseEntity<byte[]> source(Authentication auth,@PathVariable UUID id){
  var scope=service.scope(auth);String name=service.document(scope,id).invoice().source;
  return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(name,java.nio.charset.StandardCharsets.UTF_8).build().toString()).contentType(MediaType.APPLICATION_OCTET_STREAM).body(service.source(scope,id));
 }
 @GetMapping("/suppliers") public Object suppliers(Authentication auth){return service.suppliers(service.scope(auth));}
 public record RuleRequest(long version){}
 @PostMapping(value="/documents/{id}/reprocess",headers="X-Invoice-Desk=true") public Object reprocess(Authentication auth,@PathVariable UUID id,@RequestBody RuleRequest request,@RequestParam(defaultValue="false") boolean cached,@RequestParam(required=false) UUID task)throws Exception{var scope=service.scope(auth);return InvoiceDeskTasks.run(scope,task==null?UUID.randomUUID():task,()->service.reread(scope,id,request.version(),cached));}
 @GetMapping("/tasks/{id}") public Object task(Authentication auth,@PathVariable UUID id){return InvoiceDeskTasks.status(service.scope(auth),id);}
 @DeleteMapping(value="/tasks/{id}",headers="X-Invoice-Desk=true") public void cancel(Authentication auth,@PathVariable UUID id){InvoiceDeskTasks.cancel(service.scope(auth),id);}
 @GetMapping("/documents/{id}/preview") public Object previewInfo(Authentication auth,@PathVariable UUID id)throws Exception{return service.previewInfo(service.scope(auth),id);}
 @GetMapping("/documents/{id}/pages/{page}") public ResponseEntity<byte[]> preview(Authentication auth,@PathVariable UUID id,@PathVariable int page)throws Exception{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG).body(service.preview(service.scope(auth),id,page));}
 @GetMapping("/documents/{id}/revisions") public Object revisions(Authentication auth,@PathVariable UUID id){return service.revisions(service.scope(auth),id);}
 @PostMapping(value="/documents/{id}/revisions/{revision}",headers="X-Invoice-Desk=true") public Object restore(Authentication auth,@PathVariable UUID id,@PathVariable UUID revision,@RequestBody RuleRequest request){return service.restoreRevision(service.scope(auth),id,revision,request.version());}
 @GetMapping("/sessions") public Object sessions(Authentication auth){return service.sessions(service.scope(auth));}
 @PutMapping(value="/sessions/{id}",headers="X-Invoice-Desk=true") public Object session(Authentication auth,@PathVariable UUID id,@RequestBody InvoiceDeskService.SessionChange request){return service.saveSession(service.scope(auth),id,request);}
 @PostMapping(value="/documents/{id}/rules",headers="X-Invoice-Desk=true") public Object applyRules(Authentication auth,@PathVariable UUID id,@RequestBody RuleRequest request){return service.applySupplierRules(service.scope(auth),id,request.version());}
 @PutMapping(value="/suppliers",headers="X-Invoice-Desk=true") public void supplier(Authentication auth,@RequestBody InvoiceDeskService.Supplier supplier){service.saveSupplier(service.scope(auth),supplier);}
 @GetMapping("/learning") public Object learning(Authentication auth){return service.learning(service.scope(auth));}
 @GetMapping("/export") public ResponseEntity<byte[]> export(Authentication auth,@RequestParam(defaultValue="false") boolean draft,@RequestParam(required=false) List<UUID> ids)throws Exception{
  return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=hoa-don-"+java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"))+".xlsx").contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).body(service.export(service.scope(auth),draft,ids));
 }
 public record ExportSelection(List<UUID> ids){}
 @PostMapping(value="/export",headers="X-Invoice-Desk=true") public ResponseEntity<byte[]> exportSelected(Authentication auth,@RequestBody ExportSelection selection)throws Exception{
  if(selection.ids()==null||selection.ids().isEmpty()||selection.ids().size()>3000)throw new IllegalArgumentException("Chọn từ 1 đến 3000 hóa đơn đã duyệt.");
  return export(auth,false,selection.ids());
 }
 @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<?> invalid(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("message",Objects.toString(e.getMessage(),"Invalid request")));}
}
