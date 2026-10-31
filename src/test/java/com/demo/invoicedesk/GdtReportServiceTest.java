package com.demo.invoicedesk;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.*;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GdtReportServiceTest {
 private byte[] pack(String manifest,String invoices,String extraName)throws Exception{
  var out=new ByteArrayOutputStream();try(var zip=new ZipOutputStream(out)){
   for(var entry:new String[][]{{"manifest.json",manifest},{"invoices.json",invoices},{"invoice-review.xlsx","PK workbook"},{extraName,"x"}}){zip.putNextEntry(new ZipEntry(entry[0]));zip.write(entry[1].getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
  }return out.toByteArray();
 }
 @Test void parsesAuditablePackage()throws Exception{
  String manifest="{\"taxId\":\"0317544489\",\"from\":\"2026-07-01\",\"to\":\"2026-09-30\",\"complete\":false,\"coverage\":\"ordinary\",\"files\":[{},{}],\"errors\":[{}]}";
  var parsed=GdtReportService.parsePackage(pack(manifest,"[{\"_direction\":\"purchase\"},{\"_direction\":\"sold\"}]","safe.pdf"));
  assertEquals("0317544489",parsed.taxId());assertEquals(1,parsed.purchases());assertEquals(1,parsed.sales());assertEquals(2,parsed.documents());assertEquals(1,parsed.failures());assertFalse(parsed.complete());
 }
 @Test void rejectsTraversalBadIdentityAndNonZip()throws Exception{
  String good="{\"taxId\":\"0317544489\",\"from\":\"2026-07-01\",\"to\":\"2026-09-30\"}";
  assertThrows(IllegalArgumentException.class,()->GdtReportService.parsePackage(pack(good,"[]","../escape")));
  assertThrows(IllegalArgumentException.class,()->GdtReportService.parsePackage(pack(good.replace("0317544489","bad"),"[]","safe")));
  assertThrows(IllegalArgumentException.class,()->GdtReportService.parsePackage("not zip".getBytes()));
 }
 @Test void normalizesMoneyWithoutScientificNotation()throws Exception{
  byte[] source;try(var book=new XSSFWorkbook();var out=new ByteArrayOutputStream()){var sheet=book.createSheet("Invoices");var header=sheet.createRow(0);header.createCell(0).setCellValue("Before VAT");header.createCell(1).setCellValue("VAT");header.createCell(2).setCellValue("Total");var row=sheet.createRow(1);row.createCell(0).setCellValue("4602239.0");row.createCell(1).setCellValue("1388888.89");row.createCell(2).setCellValue("1.875E7");book.write(out);source=out.toByteArray();}
  try(var book=new XSSFWorkbook(new ByteArrayInputStream(GdtReportService.normalizeAmounts(source)))){var row=book.getSheet("Invoices").getRow(1);var format=new DataFormatter(Locale.US);assertEquals("4,602,239",format.formatCellValue(row.getCell(0)));assertEquals("1,388,888.89",format.formatCellValue(row.getCell(1)));assertEquals("18,750,000",format.formatCellValue(row.getCell(2)));}
 }
}
