package com.demo.invoicedesk;

import java.nio.file.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class InvoiceDeskOcrSettingsTest {
 @TempDir Path temp;
 private InvoiceDeskService service(String provider) {
  var service=new InvoiceDeskService(null,null);
  ReflectionTestUtils.setField(service,"ocr",provider);
  return service;
 }
 @Test void rejectsUnsupportedProviderAndRelativeGooglePath() {
  assertThrows(IllegalArgumentException.class,()->service("invalid").extractionSettings(temp));
  var service=service("google");ReflectionTestUtils.setField(service,"googleCredentials","relative.json");
  assertEquals(false,service.ocrStatus().get("googleCredentialsReadable"));
  assertThrows(IllegalArgumentException.class,()->service.extractionSettings(temp));
 }
 @Test void usesServerCredentialWithoutExposingPathOrSecretInStatus() throws Exception {
  Path credential=temp.resolve("google.json");Files.writeString(credential,"{\"type\":\"service_account\",\"client_email\":\"test@example.com\",\"private_key\":\"test-secret\"}");
  var service=service("google");ReflectionTestUtils.setField(service,"googleCredentials",credential.toString());
  var settings=service.extractionSettings(temp.resolve("work"));
  assertEquals(credential.toString(),settings.get("google.credentials",""));
  assertEquals("true",settings.get("server.google.enabled",""));
  assertFalse(service.ocrStatus().toString().contains(credential.toString()));
  assertFalse(service.ocrStatus().toString().contains("test-secret"));
 }
 @Test void rejectsNonServiceAccountAndPassesTesseractLanguages() throws Exception {
  Path credential=temp.resolve("wrong.json");Files.writeString(credential,"{}");
  var google=service("google");ReflectionTestUtils.setField(google,"googleCredentials",credential.toString());
  assertThrows(IllegalArgumentException.class,()->google.extractionSettings(temp.resolve("work")));
  var local=service("tesseract");ReflectionTestUtils.setField(local,"languages","eng");
  assertEquals("eng",local.extractionSettings(temp.resolve("local")).get("tesseract.languages",""));
 }
 @Test void reprocessRejectsStaleApprovedAndDisabledRequestsBeforeReadingSource() {
  var invoice=new invoice.Invoice();var id=java.util.UUID.randomUUID();
  var service=new InvoiceDeskService(null,null){
   @Override public Document document(Scope scope,java.util.UUID requested){return new Document(id,3,invoice);}
   @Override public byte[] source(Scope scope,java.util.UUID requested){fail("Source must not be read");return null;}
  };
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.reprocess(null,id,2));
  invoice.approved=true;
  assertThrows(IllegalArgumentException.class,()->service.reprocess(null,id,3));
  invoice.approved=false;
  assertThrows(IllegalArgumentException.class,()->service.reprocess(null,id,3));
 }
}
