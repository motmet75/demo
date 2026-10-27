package com.demo.invoicedesk;

import invoice.*;
import java.util.*;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

class InvoiceDeskDatabaseTest {
 JdbcTemplate db;InvoiceDeskService service;String schema;InvoiceDeskService.Scope scope;
 @BeforeEach void setup(){
  String url=System.getenv("INVOICE_TEST_JDBC_URL");Assumptions.assumeTrue(url!=null,"Set INVOICE_TEST_JDBC_URL to an expendable PostgreSQL database");
  var ds=new DriverManagerDataSource(url,System.getenv().getOrDefault("INVOICE_TEST_DB_USER","invoice_test"),System.getenv().getOrDefault("INVOICE_TEST_DB_PASSWORD",""));
  schema="invoice_test_"+UUID.randomUUID().toString().replace("-","");new JdbcTemplate(ds).execute("CREATE SCHEMA "+schema);
  ds.setUrl(url+(url.contains("?")?"&":"?")+"currentSchema="+schema);db=new JdbcTemplate(ds);
  db.execute("CREATE TABLE tenant(id uuid PRIMARY KEY,is_active boolean)");db.execute("CREATE TABLE company(id uuid PRIMARY KEY,tenant_id uuid,company_name text)");db.execute("CREATE TABLE usertb(username text,assignedtenantid text,assignedcompanyid text,isenabled boolean)");
  new ResourceDatabasePopulator(new ClassPathResource("db/schema/invoice_desk.sql")).execute(ds);
  new ResourceDatabasePopulator(new ClassPathResource("db/schema/invoice_desk_workspace.sql")).execute(ds);
  scope=new InvoiceDeskService.Scope(UUID.randomUUID(),UUID.randomUUID(),"Test Company","reviewer");
  db.update("INSERT INTO tenant VALUES (?,true)",scope.tenantId());db.update("INSERT INTO company VALUES (?,?,?)",scope.companyId(),scope.tenantId(),scope.company());db.update("INSERT INTO invoice_desk_company VALUES (?,?)",scope.tenantId(),scope.companyId());db.update("INSERT INTO usertb VALUES (?,?,?,true)",scope.username(),scope.tenantId().toString(),scope.companyId().toString());var users=org.mockito.Mockito.mock(com.ams.bomcore.repository.UserRepository.class); var user=new com.ams.bomcore.domain.user.User(); user.setEnabled(true); user.setAssignedTenantId(scope.tenantId().toString()); user.setAssignedCompanyId(scope.companyId().toString()); org.mockito.Mockito.when(users.findByUsernameIgnoreCase(scope.username())).thenReturn(Optional.of(user)); service=new InvoiceDeskService(db,users);
 }
 @AfterEach void cleanup(){if(db!=null)db.execute("DROP SCHEMA "+schema+" CASCADE");}
 @Test void companyComesFromAccountNotRequest(){
  assertEquals(scope,service.scope(UsernamePasswordAuthenticationToken.authenticated("reviewer","",List.of())));
  assertThrows(ResponseStatusException.class,()->service.scope(UsernamePasswordAuthenticationToken.authenticated("stranger","",List.of())));
 }
 @Test void uploadReviewLearnExportAndIsolate()throws Exception{
  byte[] bytes;try(var pdf=new PDDocument();var out=new ByteArrayOutputStream()){
   var page=new PDPage();pdf.addPage(page);try(var content=new PDPageContentStream(pdf,page)){content.beginText();content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),12);content.newLineAtOffset(30,700);content.showText("VAT invoice source text for an integration test. This document has more than eighty characters for offline extraction. Number: 109");content.endText();}pdf.save(out);bytes=out.toByteArray();
  }
  var file=new MockMultipartFile("file","test.pdf","application/pdf",bytes);var uploaded=service.upload(scope,file);
  assertNotEquals("ERROR",uploaded.invoice().type);assertEquals(uploaded.id(),service.upload(scope,file).id());assertArrayEquals(bytes,service.source(scope,uploaded.id()));
  var other=new InvoiceDeskService.Scope(UUID.randomUUID(),UUID.randomUUID(),"Other","other");assertTrue(service.documents(other).isEmpty());assertThrows(ResponseStatusException.class,()->service.source(other,uploaded.id()));
  var fields=new LinkedHashMap<>(uploaded.invoice().fields);fields.putAll(Map.of("seller","Vendor","sellerTaxId","1234567890","buyer","Buyer","serial","AA26","number","109","date","2026-10-27","currency","VND","subtotal","100","vat","10","total","110"));
  var items=List.of(Map.of("line","1","description","Product","quantity","2","unitPrice","50","amount","100"));
  var approved=service.correct(scope,uploaded.id(),new InvoiceDeskService.Correction(0,fields,items,true));assertTrue(approved.invoice().approved);assertEquals(1,service.learning(scope).size());assertTrue(service.learning(other).isEmpty());
  assertThrows(ResponseStatusException.class,()->service.correct(scope,uploaded.id(),new InvoiceDeskService.Correction(0,fields,items,false)));
  try(var book=new XSSFWorkbook(new java.io.ByteArrayInputStream(service.export(scope,false)))){assertEquals(1,book.getSheet("Invoices").getLastRowNum());assertEquals(1,book.getSheet("Line items").getLastRowNum());}
  service.saveSupplier(scope,new InvoiceDeskService.Supplier("1234567890","Vendor","Number follows printed label",List.of(new SupplierRules.Rule("number","Number: (\\d+)","",true))));
  assertTrue(service.suppliers(other).isEmpty());var applied=service.applySupplierRules(scope,uploaded.id(),approved.version());assertFalse(applied.invoice().approved);assertEquals("109",applied.invoice().get("number"));
  assertThrows(IllegalArgumentException.class,()->service.export(scope,false));
 }
 private InvoiceDeskService.Document fixture()throws Exception{
  byte[] bytes;try(var pdf=new PDDocument();var out=new ByteArrayOutputStream()){
   for(int n=0;n<2;n++){var page=new PDPage();pdf.addPage(page);try(var content=new PDPageContentStream(pdf,page)){content.beginText();content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),12);content.newLineAtOffset(30,700);content.showText("VAT invoice source text for offline extraction. This invoice contains more than eighty printable characters. Number: 109");content.endText();}}pdf.save(out);bytes=out.toByteArray();
  }
  return service.upload(scope,new MockMultipartFile("file","two-pages.pdf","application/pdf",bytes));
 }
 @Test void cacheIsOfflinePreservesCorrectionsAndPreviewHasPages()throws Exception{
  var d=fixture();var fields=new LinkedHashMap<>(d.invoice().fields);fields.put("seller","Manually corrected seller");
  var edited=service.correct(scope,d.id(),new InvoiceDeskService.Correction(d.version(),fields,List.of(Map.of("description","Preserve metadata","quantity","1.234567890123456789","page","2","customEvidence","keep")),false));
  org.springframework.test.util.ReflectionTestUtils.setField(service,"ocr","google");
  org.springframework.test.util.ReflectionTestUtils.setField(service,"googleCredentials","/not-a-real-credential");
  var restored=service.reread(scope,d.id(),edited.version(),true);
  assertNotEquals("Manually corrected seller",restored.invoice().get("seller"));
  assertEquals(2,service.revisions(scope,d.id()).size());
  var revision=service.revisions(scope,d.id()).get(0);
  var recovered=service.restoreRevision(scope,d.id(),(UUID)revision.get("id"),restored.version());
  assertEquals("Manually corrected seller",recovered.invoice().get("seller"));
  assertEquals("keep",recovered.invoice().items.get(0).get("customEvidence"));
  assertFalse(recovered.invoice().approved);
  assertEquals(2,service.previewInfo(scope,d.id()).get("pages"));
  assertTrue(service.preview(scope,d.id(),2).length>100);
  assertThrows(IllegalArgumentException.class,()->service.preview(scope,d.id(),3));
  assertThrows(Exception.class,()->service.reread(scope,d.id(),recovered.version(),false));
  assertEquals(recovered.version(),service.document(scope,d.id()).version());
  assertThrows(ResponseStatusException.class,()->service.restoreRevision(scope,d.id(),(UUID)revision.get("id"),0));
 }
 @Test void sessionsArePrivateAndOptimisticAndNeverDeleteSources()throws Exception{
  var d=fixture();var id=UUID.randomUUID();var saved=service.saveSession(scope,id,new InvoiceDeskService.SessionChange("Session",List.of(d.id()),-1));
  assertEquals(List.of(d.id()),service.sessions(scope).get(0).documentIds());
  var colleague=new InvoiceDeskService.Scope(scope.tenantId(),scope.companyId(),scope.company(),"another-user");
  assertTrue(service.sessions(colleague).isEmpty());
  assertThrows(ResponseStatusException.class,()->service.saveSession(colleague,id,new InvoiceDeskService.SessionChange("Session",List.of(),saved.version())));
  service.saveSession(scope,id,new InvoiceDeskService.SessionChange("Session",List.of(),saved.version()));
  assertFalse(service.source(scope,d.id()).length==0);
  assertThrows(ResponseStatusException.class,()->service.saveSession(scope,id,new InvoiceDeskService.SessionChange("Session",List.of(d.id()),saved.version())));
  assertThrows(ResponseStatusException.class,()->service.saveSession(scope,UUID.randomUUID(),new InvoiceDeskService.SessionChange("Bad",List.of(UUID.randomUUID()),-1)));
 }
 @Test void validatesContentDecimalsAndExportsOnlySelectedApproved()throws Exception{
  assertThrows(IllegalArgumentException.class,()->service.upload(scope,new MockMultipartFile("file","bad.pdf","application/pdf","<script>bad</script>".getBytes())));
  var d=fixture();var fields=new LinkedHashMap<>(d.invoice().fields);
  fields.putAll(Map.of("seller","Vendor","sellerTaxId","1234567890","serial","AA26","number","109","date","2026-10-27","currency","VND","subtotal","1.234567890123456789","vat","0","total","1.234567890123456789"));
  assertThrows(IllegalArgumentException.class,()->service.export(scope,false,List.of(d.id())));
  assertThrows(IllegalArgumentException.class,()->service.correct(scope,d.id(),new InvoiceDeskService.Correction(d.version(),fields,List.of(Map.of("quantity","oops")),false)));
  var approved=service.correct(scope,d.id(),new InvoiceDeskService.Correction(d.version(),fields,List.of(Map.of("line","1","description","Item","quantity","1.234567890123456789","unitPrice","1","amount","1.234567890123456789")),true));
  try(var book=new XSSFWorkbook(new java.io.ByteArrayInputStream(service.export(scope,false,List.of(d.id()))))){assertEquals(1,book.getSheet("Line items").getLastRowNum());assertEquals("1.234567890123456789",book.getSheet("Line items").getRow(1).getCell(8).getStringCellValue());}
  var other=new InvoiceDeskService.Scope(UUID.randomUUID(),UUID.randomUUID(),"Other","other");
  assertThrows(ResponseStatusException.class,()->service.export(other,false,List.of(d.id())));
  assertThrows(ResponseStatusException.class,()->service.preview(other,d.id(),1));
  assertThrows(IllegalArgumentException.class,()->service.export(scope,true));
  assertTrue(approved.invoice().approved);
 }
}
