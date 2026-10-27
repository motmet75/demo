package com.demo.invoicedesk;

import invoice.*;
import java.nio.file.*;
import java.util.*;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

@Service
public class InvoiceDeskService {
 private final JdbcTemplate db;
 private final com.ams.bomcore.repository.UserRepository users;
 @Value("${invoice-desk.ocr:off}") private String ocr="off";
 @Value("${invoice-desk.tesseract-path:tesseract}") private String tesseract="tesseract";
 @Value("${invoice-desk.phrase-rules:}") private String phraseRules="";
 @Value("${invoice-desk.tesseract-languages:vie+eng}") private String languages="vie+eng";
 @Value("${invoice-desk.google-credentials:${GOOGLE_APPLICATION_CREDENTIALS:}}") private String googleCredentials="";
 public Map<String,Object> ocrStatus(){
  boolean credentialReady=false;
  try{credentialReady=!googleCredentials.isBlank()&&Path.of(googleCredentials).isAbsolute()&&Files.isRegularFile(Path.of(googleCredentials))&&Files.isReadable(Path.of(googleCredentials));}catch(InvalidPathException ignored){}
  return Map.of("provider",ocr,"languages",languages,"googleCredentialsReadable",credentialReady,
   "message",switch(ocr){case "google" -> credentialReady?"Google Vision configured. Imports send document images to Google Cloud; API access and quota are checked when processing.":"Set invoice-desk.google-credentials to an absolute, readable service-account JSON path on the server.";case "tesseract" -> "Tesseract selected. The server needs the executable and configured language packs.";default -> "OCR is disabled. Text PDFs work; scanned PDFs and images need an OCR provider.";});
 }
 Settings extractionSettings(Path workspace)throws Exception{
  if(!Set.of("off","tesseract","google").contains(ocr))throw new IllegalArgumentException("invoice-desk.ocr must be off, tesseract or google");
  Settings settings=new Settings(workspace);settings.p.setProperty("ocr",ocr);
  settings.p.setProperty("phrase.rules",phraseRules);
  settings.p.setProperty("tesseract.path",tesseract);settings.p.setProperty("tesseract.languages",languages);
  if("google".equals(ocr)){
   if(!Boolean.TRUE.equals(ocrStatus().get("googleCredentialsReadable")))throw new IllegalArgumentException("Configure a readable absolute invoice-desk.google-credentials path on the server before using Google Vision");
   var credential=SecureFiles.readTree(Path.of(googleCredentials).toFile());
   if(!"service_account".equals(credential.path("type").asText())||credential.path("client_email").asText().isBlank()||credential.path("private_key").asText().isBlank())throw new IllegalArgumentException("Google OCR requires a service-account JSON credential, not an HTTPS certificate");
   settings.p.setProperty("google.credentials",googleCredentials);settings.p.setProperty("server.google.enabled","true");
  }
  return settings;
 }
 public InvoiceDeskService(JdbcTemplate db,com.ams.bomcore.repository.UserRepository users){this.db=db;this.users=users;}
 public record Scope(UUID tenantId,UUID companyId,String company,String username){}
 public record Document(UUID id,long version,Invoice invoice,String updatedAt,String updatedBy){public Document(UUID id,long version,Invoice invoice){this(id,version,invoice,"","");}}
 public record Correction(long version,Map<String,String> fields,List<Map<String,String>> items,boolean approve){}
 public record Supplier(String taxId,String name,String notes,List<SupplierRules.Rule> rules){}
 public boolean passwordChangeRequired(Authentication auth){
  if(auth==null||!auth.isAuthenticated())return false;
  var user=users.findByUsernameIgnoreCase(auth.getName()).orElse(null);if(user==null)return false;
  return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM invoice_desk_password_reset WHERE lower(username)=lower(?) AND initial_hash=?)",Boolean.class,auth.getName(),user.getPassword()));
 }
 private void archive(Scope scope,UUID id){db.update("INSERT INTO invoice_desk_revision(id,tenant_id,document_id,version,payload,changed_by) SELECT ?,tenant_id,id,version,payload,? FROM invoice_desk_document WHERE tenant_id=? AND id=? ON CONFLICT(document_id,version) DO NOTHING",UUID.randomUUID(),scope.username(),scope.tenantId(),id);}
 public List<Map<String,Object>> revisions(Scope scope,UUID id){document(scope,id);return db.queryForList("SELECT id,version,changed_by,created_at FROM invoice_desk_revision WHERE tenant_id=? AND document_id=? ORDER BY version DESC LIMIT 100",scope.tenantId(),id);}
 @Transactional public Document restoreRevision(Scope scope,UUID id,UUID revision,long version){
  Document current=document(scope,id);
  String json=db.query("SELECT payload FROM invoice_desk_revision WHERE tenant_id=? AND document_id=? AND id=?",(rs,n)->rs.getString(1),scope.tenantId(),id,revision).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
  Invoice restored=decode(json);restored.approved=false;restored.approvalMode="";archive(scope,id);
  if(current.version()!=version||db.update("UPDATE invoice_desk_document SET payload=?,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND version=?",encode(restored),scope.username(),scope.tenantId(),id,version)!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Hóa đơn đã thay đổi. Vui lòng tải lại.");
  return document(scope,id);
 }
 static void validateNumbers(Map<String,String> fields,List<Map<String,String>> items){
  for(String key:List.of("subtotal","vat","total"))decimal(fields.get(key));
  for(var row:items)for(String key:List.of("quantity","unitPrice","amount","taxRate"))decimal(row.get(key));
 }
 private static void decimal(String value){if(value==null||value.isBlank())return;if(value.length()>100||!value.matches("-?\\d+(?:\\.\\d+)?"))throw new IllegalArgumentException("Số không hợp lệ: dùng dấu chấm thập phân, không dùng dấu phân cách hàng nghìn.");}
 static void validateSource(String name,byte[] bytes)throws Exception{
  if(name.toLowerCase(Locale.ROOT).endsWith(".pdf")){
   if(bytes.length<5||!new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))throw new IllegalArgumentException("Nội dung không phải PDF.");
   try(var pdf=org.apache.pdfbox.Loader.loadPDF(bytes)){if(pdf.isEncrypted()||pdf.getNumberOfPages()>100||pdf.getNumberOfPages()<1)throw new IllegalArgumentException("PDF phải có 1–100 trang và không khóa mật khẩu.");for(var page:pdf.getPages())if(page.getMediaBox().getWidth()*page.getMediaBox().getHeight()>5_000_000)throw new IllegalArgumentException("Kích thước trang PDF quá lớn.");}
  }else try(var input=javax.imageio.ImageIO.createImageInputStream(new java.io.ByteArrayInputStream(bytes))){
   var readers=javax.imageio.ImageIO.getImageReaders(input);if(!readers.hasNext())throw new IllegalArgumentException("Nội dung ảnh không hợp lệ.");var reader=readers.next();try{reader.setInput(input);if((long)reader.getWidth(0)*reader.getHeight(0)>30_000_000)throw new IllegalArgumentException("Ảnh vượt quá 30 triệu điểm ảnh.");}finally{reader.dispose();}
  }
 }
 private String captureCache(Path workspace)throws Exception{
  Map<String,com.fasterxml.jackson.databind.JsonNode> cached=new LinkedHashMap<>();Path folder=workspace.resolve("ocr-cache");
  if(Files.isDirectory(folder))try(var files=Files.list(folder)){for(Path file:files.toList())if(file.getFileName().toString().matches("[a-f0-9]{64}-[a-zA-Z0-9-]+\\.json"))cached.put(file.getFileName().toString(),SecureFiles.readTree(file.toFile()));}
  return encode(cached);
 }
 private void restoreCache(Scope scope,UUID id,Path workspace)throws Exception{
  String json=db.queryForObject("SELECT ocr_cache FROM invoice_desk_document WHERE tenant_id=? AND id=?",String.class,scope.tenantId(),id);
  var tree=Engine.JSON.readTree(json);Path folder=workspace.resolve("ocr-cache");Files.createDirectories(folder);
  var fields=tree.fields();while(fields.hasNext()){var field=fields.next();if(!field.getKey().matches("[a-f0-9]{64}-[a-zA-Z0-9-]+\\.json"))throw new IllegalArgumentException("Cache không hợp lệ.");Engine.JSON.writeValue(folder.resolve(field.getKey()).toFile(),field.getValue());}
 }
 public record WorkSession(UUID id,String name,List<UUID> documentIds,long version,String updatedAt){}
 public record SessionChange(String name,List<UUID> documentIds,long version){}
 private WorkSession sessionRow(java.sql.ResultSet rs)throws java.sql.SQLException{
  try{return new WorkSession(rs.getObject(1,UUID.class),rs.getString(2),Engine.JSON.readValue(rs.getString(3),new TypeReference<List<UUID>>(){}),rs.getLong(4),rs.getString(5));}catch(java.io.IOException e){throw new IllegalStateException(e);}
 }
 public List<WorkSession> sessions(Scope scope){return db.query("SELECT id,name,document_ids,version,updated_at FROM invoice_desk_session WHERE tenant_id=? AND username=? ORDER BY updated_at DESC",(rs,n)->sessionRow(rs),scope.tenantId(),scope.username().toLowerCase(Locale.ROOT));}
 @Transactional public WorkSession saveSession(Scope scope,UUID id,SessionChange change){
  if(change.name()==null||change.name().isBlank()||change.name().length()>160||change.documentIds()==null||change.documentIds().size()>3000)throw new IllegalArgumentException("Tên phiên hoặc danh sách hóa đơn không hợp lệ.");
  var ids=change.documentIds().stream().distinct().toList();for(UUID document:ids)document(scope,document);
  String username=scope.username().toLowerCase(Locale.ROOT);
  if(change.version()<0){db.update("INSERT INTO invoice_desk_session(id,tenant_id,username,name,document_ids) VALUES (?,?,?,?,?)",id,scope.tenantId(),username,change.name(),encode(ids));}
  else if(db.update("UPDATE invoice_desk_session SET name=?,document_ids=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND username=? AND version=?",change.name(),encode(ids),id,scope.tenantId(),username,change.version())!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Phiên đã thay đổi ở cửa sổ khác. Mở lại phiên trước khi lưu.");
  return sessions(scope).stream().filter(row->row.id().equals(id)).findFirst().orElseThrow();
 }
 public Map<String,Object> previewInfo(Scope scope,UUID id)throws Exception{
  Document d=document(scope,id);if(!d.invoice().source.toLowerCase(Locale.ROOT).endsWith(".pdf"))return Map.of("pages",1,"pdf",false);
  try(var pdf=org.apache.pdfbox.Loader.loadPDF(source(scope,id))){return Map.of("pages",pdf.getNumberOfPages(),"pdf",true);}
 }
 private static final java.util.concurrent.Semaphore PREVIEWS=new java.util.concurrent.Semaphore(2);
 public byte[] preview(Scope scope,UUID id,int page)throws Exception{
  document(scope,id);if(!PREVIEWS.tryAcquire())throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Đang tải nhiều trang. Vui lòng thử lại.");
  try{byte[] bytes=source(scope,id);java.awt.image.BufferedImage image;
   if(document(scope,id).invoice().source.toLowerCase(Locale.ROOT).endsWith(".pdf"))try(var pdf=org.apache.pdfbox.Loader.loadPDF(bytes)){
    if(page<1||page>pdf.getNumberOfPages())throw new IllegalArgumentException("Số trang không hợp lệ.");
    var box=pdf.getPage(page-1).getCropBox();float scale=Math.min(2.5f,2600f/Math.max(box.getWidth(),box.getHeight()));
    image=new org.apache.pdfbox.rendering.PDFRenderer(pdf).renderImage(page-1,scale);
   }else {if(page!=1)throw new IllegalArgumentException("Số trang không hợp lệ.");image=javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes));}
   if(image==null)throw new IllegalArgumentException("Không đọc được ảnh.");var out=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",out);return out.toByteArray();
  }finally{PREVIEWS.release();}
 }
 public Scope scope(Authentication auth){
  if(auth==null||!auth.isAuthenticated())throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
  if(passwordChangeRequired(auth))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Vui lòng đổi mật khẩu ban đầu trước khi sử dụng.");
  var user=users.findByUsernameIgnoreCase(auth.getName()).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN));
  if(!user.isEnabled()||user.getAssignedTenantId()==null||user.getAssignedCompanyId()==null)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"No invoice company assigned to this account");
  UUID tenantId,companyId;
  try{tenantId=UUID.fromString(user.getAssignedTenantId());companyId=UUID.fromString(user.getAssignedCompanyId());}catch(IllegalArgumentException e){throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Invalid company assignment");}
  var rows=db.query("""
   SELECT d.tenant_id,d.company_id,c.company_name FROM invoice_desk_company d
   JOIN tenant t ON t.id=d.tenant_id JOIN company c ON c.id=d.company_id AND c.tenant_id=d.tenant_id
   WHERE d.tenant_id=? AND d.company_id=? AND t.is_active=true
   """,(rs,n)->new Scope(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),rs.getString(3),auth.getName()),tenantId,companyId);
  if(rows.size()!=1)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"No invoice company assigned to this account");
  return rows.get(0);
 }
 private Invoice decode(String json){try{return Engine.JSON.readValue(json,Invoice.class);}catch(Exception e){throw new IllegalStateException("Invalid stored document",e);}}
 private String encode(Object value){try{return Engine.JSON.writeValueAsString(value);}catch(Exception e){throw new IllegalArgumentException("Invalid document",e);}}
 public List<Document> documents(Scope scope){return db.query("SELECT id,version,payload,updated_at,updated_by FROM invoice_desk_document WHERE tenant_id=? ORDER BY created_at DESC",(rs,n)->new Document(rs.getObject(1,UUID.class),rs.getLong(2),decode(rs.getString(3)),rs.getString(4),rs.getString(5)),scope.tenantId());}
 public Document document(Scope scope,UUID id){return db.query("SELECT id,version,payload,updated_at,updated_by FROM invoice_desk_document WHERE tenant_id=? AND id=?",(rs,n)->new Document(rs.getObject(1,UUID.class),rs.getLong(2),decode(rs.getString(3)),rs.getString(4),rs.getString(5)),scope.tenantId(),id).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
 public byte[] source(Scope scope,UUID id){document(scope,id);return db.queryForObject("SELECT source FROM invoice_desk_document WHERE tenant_id=? AND id=?",byte[].class,scope.tenantId(),id);}
 public List<Supplier> suppliers(Scope scope){return db.query("SELECT tax_id,name,notes,rules FROM invoice_desk_supplier WHERE tenant_id=? ORDER BY name",(rs,n)->{
  try{return new Supplier(rs.getString(1),rs.getString(2),rs.getString(3),Engine.JSON.readValue(rs.getString(4),new TypeReference<List<SupplierRules.Rule>>(){}));}catch(Exception e){throw new IllegalStateException(e);}
 },scope.tenantId());}
 public void saveSupplier(Scope scope,Supplier supplier){
  String tax=SupplierRules.taxId(supplier.taxId());SupplierRules.validate(supplier.rules());
  if(supplier.name()==null||supplier.name().isBlank()||supplier.name().length()>300||supplier.notes()==null||supplier.notes().length()>10000)throw new IllegalArgumentException("Provide a supplier name and notes within limits");
  db.update("""
   INSERT INTO invoice_desk_supplier(tenant_id,tax_id,name,notes,rules) VALUES (?,?,?,?,?)
   ON CONFLICT(tenant_id,tax_id) DO UPDATE SET name=excluded.name,notes=excluded.notes,rules=excluded.rules,updated_at=CURRENT_TIMESTAMP
   """,scope.tenantId(),tax,supplier.name(),supplier.notes(),encode(supplier.rules()));
 }
 private void applyRules(Scope scope,Invoice invoice){
  String tax;try{tax=SupplierRules.taxId(invoice.get("sellerTaxId"));}catch(IllegalArgumentException e){return;}
  for(Supplier supplier:suppliers(scope))if(supplier.taxId().equals(tax)){SupplierRules.apply(invoice,supplier.rules());invoice.profile="sql-supplier:"+tax;}
 }
 public Document upload(Scope scope,MultipartFile file)throws Exception{
  String name=Objects.toString(file.getOriginalFilename(),"invoice.pdf").replace('\\','/');name=name.substring(name.lastIndexOf('/')+1);
  if(file.isEmpty()||file.getSize()>25L*1024*1024||!name.toLowerCase(Locale.ROOT).matches(".*\\.(pdf|png|jpe?g|tiff?|bmp)"))throw new IllegalArgumentException("Upload PDF or image files up to 25 MB each");
  byte[] bytes=file.getBytes();validateSource(name,bytes);String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
  var existing=db.query("SELECT id FROM invoice_desk_document WHERE tenant_id=? AND sha256=?",(rs,n)->rs.getObject(1,UUID.class),scope.tenantId(),hash);
  if(!existing.isEmpty())return document(scope,existing.get(0));
  Path workspace=Files.createTempDirectory("invoice-desk-");
  try{
   Path source=workspace.resolve("source"+name.substring(name.lastIndexOf('.')).toLowerCase(Locale.ROOT));Files.write(source,bytes);
   Settings settings=extractionSettings(workspace);
   Engine engine=new Engine(settings);InvoiceDeskTasks.bind(engine);Invoice invoice=engine.read(source);InvoiceDeskTasks.check();invoice.source=name;invoice.sha256=hash;
   Parser.validate(invoice);applyRules(scope,invoice);
   UUID id=UUID.randomUUID();
   db.update("INSERT INTO invoice_desk_document(id,tenant_id,filename,sha256,source,payload,extracted_payload,ocr_cache,updated_by) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,sha256) DO NOTHING",id,scope.tenantId(),name,hash,bytes,encode(invoice),encode(invoice),captureCache(workspace),scope.username());
   UUID stored=db.queryForObject("SELECT id FROM invoice_desk_document WHERE tenant_id=? AND sha256=?",UUID.class,scope.tenantId(),hash);
   return document(scope,stored);
  }finally{try(var paths=Files.walk(workspace)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
 }
 @Transactional public Document reprocess(Scope scope,UUID id,long version)throws Exception{return reread(scope,id,version,false);}
 @Transactional public Document reread(Scope scope,UUID id,long version,boolean cached)throws Exception{
  Document old=document(scope,id);
  if(old.version()!=version)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before running OCR");
  if(old.invoice().approved)throw new IllegalArgumentException("Save as a draft before re-running OCR on an approved invoice");
  if(!cached&&"off".equals(ocr))throw new IllegalArgumentException("OCR is disabled; configure the server OCR provider first");
  Path workspace=Files.createTempDirectory("invoice-desk-");
  try{
   String name=old.invoice().source;Path input=workspace.resolve("source"+name.substring(name.lastIndexOf('.')).toLowerCase(Locale.ROOT));Files.write(input,source(scope,id));
   if(cached)restoreCache(scope,id,workspace);
   Settings settings=cached?new Settings(workspace):extractionSettings(workspace);
   Engine engine=new Engine(settings);InvoiceDeskTasks.bind(engine);
   Invoice invoice;
   String snapshot=cached?db.queryForObject("SELECT extracted_payload FROM invoice_desk_document WHERE tenant_id=? AND id=?",String.class,scope.tenantId(),id):null;
   // Persisted extraction is also the cache for providers such as Tesseract, which have no Vision JSON.
   if(cached&&snapshot!=null&&!snapshot.isBlank())invoice=decode(snapshot);
   else invoice=cached?engine.readOffline(input):engine.readFresh(input);
   InvoiceDeskTasks.check();
   if(invoice.text==null||invoice.text.isBlank()||"ERROR".equals(invoice.type)||invoice.warnings.stream().anyMatch(w->w.startsWith("OCR ")))throw new IllegalArgumentException("OCR did not complete successfully. Check the provider credentials, executable, language packs and source image. Existing draft preserved.");
   invoice.source=name;invoice.sha256=old.invoice().sha256;Parser.validate(invoice);applyRules(scope,invoice);
   archive(scope,id);
   int updated=db.update("UPDATE invoice_desk_document SET payload=?,extracted_payload=?,ocr_cache=?,updated_at=CURRENT_TIMESTAMP,updated_by=?,version=version+1 WHERE tenant_id=? AND id=? AND version=?",encode(invoice),encode(invoice),captureCache(workspace),scope.username(),scope.tenantId(),id,version);
   if(updated!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before running OCR");
   return document(scope,id);
  }finally{try(var paths=Files.walk(workspace)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
 }
 @Transactional public Document applySupplierRules(Scope scope,UUID id,long version){
  Invoice invoice=document(scope,id).invoice();invoice.approved=false;invoice.approvalMode="";
  applyRules(scope,invoice);Parser.validate(invoice);
  archive(scope,id);
  int updated=db.update("UPDATE invoice_desk_document SET payload=?,updated_at=CURRENT_TIMESTAMP,updated_by=?,version=version+1 WHERE tenant_id=? AND id=? AND version=?",encode(invoice),scope.username(),scope.tenantId(),id,version);
  if(updated!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before applying rules");
  return document(scope,id);
 }
 @Transactional public Document correct(Scope scope,UUID id,Correction change){
  Document old=document(scope,id);Invoice invoice=old.invoice();String before=encode(invoice);
  if(change.fields()==null||!change.fields().keySet().equals(new HashSet<>(Invoice.KEYS))||change.fields().values().stream().anyMatch(v->v==null||v.length()>2000))throw new IllegalArgumentException("Provide all invoice header fields");
  if(change.items()==null||change.items().size()>3000||change.items().stream().anyMatch(row->row==null||row.size()>30||row.entrySet().stream().anyMatch(e->e.getKey()==null||e.getValue()==null||e.getValue().length()>5000)))throw new IllegalArgumentException("Invalid invoice line items");
  validateNumbers(change.fields(),change.items());
  invoice.fields=new LinkedHashMap<>(change.fields());invoice.items=new ArrayList<>(change.items());invoice.approved=false;invoice.approvalMode="";Parser.validate(invoice);
  // Required supplier fields are validation only here; manual corrections must never be overwritten.
  String tax="";try{tax=SupplierRules.taxId(invoice.get("sellerTaxId"));}catch(IllegalArgumentException ignored){}
  for(Supplier supplier:suppliers(scope))if(supplier.taxId().equals(tax))for(var rule:supplier.rules())if(rule.required()&&invoice.get(rule.field()).isBlank())invoice.warnings.add("Missing supplier field "+rule.field());
  if(change.approve()){
   if(!List.of("INVOICE","APPENDIX","DEBIT_NOTE").contains(invoice.type)||invoice.warnings.stream().anyMatch(w->w.startsWith("Missing ")||w.startsWith("Check:")||w.startsWith("OCR ")))throw new IllegalArgumentException("Resolve extraction and validation warnings before approval: "+String.join("; ",invoice.warnings));
   invoice.approved=true;invoice.approvalMode="MANUAL";
  }
  archive(scope,id);
  int updated=db.update("UPDATE invoice_desk_document SET payload=?,updated_at=CURRENT_TIMESTAMP,updated_by=?,version=version+1 WHERE tenant_id=? AND id=? AND version=?",encode(invoice),scope.username(),scope.tenantId(),id,change.version());
  if(updated!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before saving");
  if(change.approve())db.update("INSERT INTO invoice_desk_learning(id,tenant_id,document_id,tax_id,sha256,before_payload,approved_payload,reviewed_by) VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),scope.tenantId(),id,tax,invoice.sha256,before,encode(invoice),scope.username());
  return document(scope,id);
 }
 public List<Map<String,Object>> learning(Scope scope){return db.queryForList("SELECT id,document_id,tax_id,sha256,reviewed_by,created_at,approved_payload FROM invoice_desk_learning WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200",scope.tenantId());}
 public byte[] export(Scope scope,boolean draft)throws Exception{return export(scope,draft,null);}
 public byte[] export(Scope scope,boolean draft,List<UUID> ids)throws Exception{
  if(draft)throw new IllegalArgumentException("Chỉ xuất hóa đơn đã duyệt.");
  List<Document> chosen=ids==null?documents(scope):ids.stream().distinct().map(id->document(scope,id)).toList();
  if(ids!=null&&chosen.stream().anyMatch(d->!d.invoice().approved))throw new IllegalArgumentException("Danh sách có hóa đơn chưa duyệt.");
  List<Invoice> all=chosen.stream().map(Document::invoice).filter(i->i.approved).toList();
  for(Invoice i:all){Parser.validate(i);if(i.warnings.stream().anyMatch(w->w.startsWith("Missing ")||w.startsWith("Check:")||w.startsWith("OCR ")))throw new IllegalArgumentException("Hóa đơn còn lỗi kiểm tra, vui lòng kiểm tra lại.");}
  Set<Invoice> approved=new HashSet<>(all.stream().filter(i->i.approved).toList());Reconciler.reconcile(all);
  if(!draft&&all.stream().noneMatch(i->i.approved))throw new IllegalArgumentException("Approve at least one document before production export");
  if(!draft&&approved.stream().anyMatch(i->!i.approved))throw new IllegalArgumentException("Resolve invoice/appendix reconciliation conflicts before export");
  if(!draft){Set<String> identities=new HashSet<>();for(Invoice invoice:approved){String identity=invoice.type.equals("DEBIT_NOTE")?"DEBIT_NOTE/"+invoice.sha256:invoice.type+"/"+SupplierRules.taxId(invoice.get("sellerTaxId"))+"/"+invoice.get("serial")+"/"+invoice.get("number").replaceFirst("^0+(?!$)","");if(!identities.add(identity))throw new IllegalArgumentException("Duplicate invoice identity; keep only one copy approved");}}
  Path file=Files.createTempFile("invoice-export-",".xlsx");try{Excel.write(file,all,!draft);return Files.readAllBytes(file);}finally{Files.deleteIfExists(file);}
 }
}
