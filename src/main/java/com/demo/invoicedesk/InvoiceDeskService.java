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
 public record Document(UUID id,long version,Invoice invoice){}
 public record Correction(long version,Map<String,String> fields,List<Map<String,String>> items,boolean approve){}
 public record Supplier(String taxId,String name,String notes,List<SupplierRules.Rule> rules){}
 public Scope scope(Authentication auth){
  if(auth==null||!auth.isAuthenticated())throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
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
 public List<Document> documents(Scope scope){return db.query("SELECT id,version,payload FROM invoice_desk_document WHERE tenant_id=? ORDER BY created_at DESC",(rs,n)->new Document(rs.getObject(1,UUID.class),rs.getLong(2),decode(rs.getString(3))),scope.tenantId());}
 public Document document(Scope scope,UUID id){return db.query("SELECT id,version,payload FROM invoice_desk_document WHERE tenant_id=? AND id=?",(rs,n)->new Document(rs.getObject(1,UUID.class),rs.getLong(2),decode(rs.getString(3))),scope.tenantId(),id).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
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
  byte[] bytes=file.getBytes();String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
  var existing=db.query("SELECT id FROM invoice_desk_document WHERE tenant_id=? AND sha256=?",(rs,n)->rs.getObject(1,UUID.class),scope.tenantId(),hash);
  if(!existing.isEmpty())return document(scope,existing.get(0));
  Path workspace=Files.createTempDirectory("invoice-desk-");
  try{
   Path source=workspace.resolve("source"+name.substring(name.lastIndexOf('.')).toLowerCase(Locale.ROOT));Files.write(source,bytes);
   Settings settings=extractionSettings(workspace);
   Invoice invoice=new Engine(settings).read(source);invoice.source=name;invoice.sha256=hash;
   Parser.validate(invoice);applyRules(scope,invoice);
   UUID id=UUID.randomUUID();
   db.update("INSERT INTO invoice_desk_document(id,tenant_id,filename,sha256,source,payload) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,sha256) DO NOTHING",id,scope.tenantId(),name,hash,bytes,encode(invoice));
   UUID stored=db.queryForObject("SELECT id FROM invoice_desk_document WHERE tenant_id=? AND sha256=?",UUID.class,scope.tenantId(),hash);
   return document(scope,stored);
  }finally{try(var paths=Files.walk(workspace)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
 }
 public Document reprocess(Scope scope,UUID id,long version)throws Exception{
  Document old=document(scope,id);
  if(old.version()!=version)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before running OCR");
  if(old.invoice().approved)throw new IllegalArgumentException("Save as a draft before re-running OCR on an approved invoice");
  if("off".equals(ocr))throw new IllegalArgumentException("OCR is disabled; configure the server OCR provider first");
  Path workspace=Files.createTempDirectory("invoice-desk-");
  try{
   String name=old.invoice().source;Path input=workspace.resolve("source"+name.substring(name.lastIndexOf('.')).toLowerCase(Locale.ROOT));Files.write(input,source(scope,id));
   Invoice invoice=new Engine(extractionSettings(workspace)).read(input);
   if(invoice.text==null||invoice.text.isBlank()||"ERROR".equals(invoice.type)||invoice.warnings.stream().anyMatch(w->w.startsWith("OCR ")))throw new IllegalArgumentException("OCR did not complete successfully. Check the provider credentials, executable, language packs and source image. Existing draft preserved.");
   invoice.source=name;invoice.sha256=old.invoice().sha256;Parser.validate(invoice);applyRules(scope,invoice);
   int updated=db.update("UPDATE invoice_desk_document SET payload=?,version=version+1 WHERE tenant_id=? AND id=? AND version=?",encode(invoice),scope.tenantId(),id,version);
   if(updated!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before running OCR");
   return document(scope,id);
  }finally{try(var paths=Files.walk(workspace)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
 }
 @Transactional public Document applySupplierRules(Scope scope,UUID id,long version){
  Invoice invoice=document(scope,id).invoice();invoice.approved=false;invoice.approvalMode="";
  applyRules(scope,invoice);Parser.validate(invoice);
  int updated=db.update("UPDATE invoice_desk_document SET payload=?,version=version+1 WHERE tenant_id=? AND id=? AND version=?",encode(invoice),scope.tenantId(),id,version);
  if(updated!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before applying rules");
  return document(scope,id);
 }
 @Transactional public Document correct(Scope scope,UUID id,Correction change){
  Document old=document(scope,id);Invoice invoice=old.invoice();String before=encode(invoice);
  if(change.fields()==null||!change.fields().keySet().equals(new HashSet<>(Invoice.KEYS))||change.fields().values().stream().anyMatch(v->v==null||v.length()>2000))throw new IllegalArgumentException("Provide all invoice header fields");
  if(change.items()==null||change.items().size()>3000||change.items().stream().anyMatch(row->row==null||row.size()>30||row.entrySet().stream().anyMatch(e->e.getKey()==null||e.getValue()==null||e.getValue().length()>5000)))throw new IllegalArgumentException("Invalid invoice line items");
  invoice.fields=new LinkedHashMap<>(change.fields());invoice.items=new ArrayList<>(change.items());invoice.approved=false;invoice.approvalMode="";Parser.validate(invoice);
  // Required supplier fields are validation only here; manual corrections must never be overwritten.
  String tax="";try{tax=SupplierRules.taxId(invoice.get("sellerTaxId"));}catch(IllegalArgumentException ignored){}
  for(Supplier supplier:suppliers(scope))if(supplier.taxId().equals(tax))for(var rule:supplier.rules())if(rule.required()&&invoice.get(rule.field()).isBlank())invoice.warnings.add("Missing supplier field "+rule.field());
  if(change.approve()){
   if(!List.of("INVOICE","APPENDIX","DEBIT_NOTE").contains(invoice.type)||invoice.warnings.stream().anyMatch(w->w.startsWith("Missing ")||w.startsWith("Check:")||w.startsWith("OCR ")))throw new IllegalArgumentException("Resolve extraction and validation warnings before approval: "+String.join("; ",invoice.warnings));
   invoice.approved=true;invoice.approvalMode="MANUAL";
  }
  int updated=db.update("UPDATE invoice_desk_document SET payload=?,version=version+1 WHERE tenant_id=? AND id=? AND version=?",encode(invoice),scope.tenantId(),id,change.version());
  if(updated!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Document changed; reload before saving");
  if(change.approve())db.update("INSERT INTO invoice_desk_learning(id,tenant_id,document_id,tax_id,sha256,before_payload,approved_payload,reviewed_by) VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),scope.tenantId(),id,tax,invoice.sha256,before,encode(invoice),scope.username());
  return document(scope,id);
 }
 public List<Map<String,Object>> learning(Scope scope){return db.queryForList("SELECT id,document_id,tax_id,sha256,reviewed_by,created_at,approved_payload FROM invoice_desk_learning WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200",scope.tenantId());}
 public byte[] export(Scope scope,boolean draft)throws Exception{
  List<Invoice> all=documents(scope).stream().map(Document::invoice).toList();
  Set<Invoice> approved=new HashSet<>(all.stream().filter(i->i.approved).toList());Reconciler.reconcile(all);
  if(!draft&&all.stream().noneMatch(i->i.approved))throw new IllegalArgumentException("Approve at least one document before production export");
  if(!draft&&approved.stream().anyMatch(i->!i.approved))throw new IllegalArgumentException("Resolve invoice/appendix reconciliation conflicts before export");
  if(!draft){Set<String> identities=new HashSet<>();for(Invoice invoice:approved){String identity=invoice.type.equals("DEBIT_NOTE")?"DEBIT_NOTE/"+invoice.sha256:invoice.type+"/"+SupplierRules.taxId(invoice.get("sellerTaxId"))+"/"+invoice.get("serial")+"/"+invoice.get("number").replaceFirst("^0+(?!$)","");if(!identities.add(identity))throw new IllegalArgumentException("Duplicate invoice identity; keep only one copy approved");}}
  Path file=Files.createTempFile("invoice-export-",".xlsx");try{Excel.write(file,all,!draft);return Files.readAllBytes(file);}finally{Files.deleteIfExists(file);}
 }
}
