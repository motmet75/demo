package com.demo.invoicedesk;

import com.fasterxml.jackson.databind.JsonNode;
import invoice.Engine;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GdtReportService {
 private static final long MAX_PACKAGE=100L*1024*1024,MAX_EXPANDED=250L*1024*1024;
 private static final int MAX_ENTRIES=5000;
 private final JdbcTemplate db;
 public GdtReportService(JdbcTemplate db){this.db=db;}

 public record Report(UUID id,String taxId,String periodFrom,String periodTo,boolean complete,int purchases,int sales,int documents,int failures,String coverage,String createdAt,String createdBy){}
 record Parsed(String taxId,LocalDate from,LocalDate to,boolean complete,int purchases,int sales,int documents,int failures,String coverage,String manifest,byte[] workbook){}

 static Parsed parsePackage(byte[] bytes)throws Exception{
  if(bytes.length<4||bytes.length>MAX_PACKAGE||bytes[0]!='P'||bytes[1]!='K')throw new IllegalArgumentException("Chọn gói báo cáo ZIP hợp lệ, tối đa 100 MB.");
  byte[] manifest=null,workbook=null,invoicesBytes=null;long expanded=0;int entries=0;
  try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))){
   for(ZipEntry entry;(entry=zip.getNextEntry())!=null;){
    if(++entries>MAX_ENTRIES)throw new IllegalArgumentException("Gói báo cáo có quá nhiều tệp.");
    String name=entry.getName().replace('\\','/');
    if(name.startsWith("/")||name.contains("../")||name.matches("^[A-Za-z]:.*"))throw new IllegalArgumentException("Tên tệp không an toàn trong gói báo cáo.");
    boolean keep=name.equals("manifest.json")||name.equals("invoice-review.xlsx")||name.equals("invoices.json");
    var out=keep?new ByteArrayOutputStream():null;byte[] buffer=new byte[8192];
    for(int n;(n=zip.read(buffer))>=0;){expanded+=n;if(expanded>MAX_EXPANDED)throw new IllegalArgumentException("Gói báo cáo giải nén vượt quá 250 MB.");if(keep)out.write(buffer,0,n);}
    if(name.equals("manifest.json"))manifest=out.toByteArray();
    if(name.equals("invoice-review.xlsx"))workbook=out.toByteArray();
    if(name.equals("invoices.json"))invoicesBytes=out.toByteArray();
   }
  }
  if(manifest==null||invoicesBytes==null||workbook==null||workbook.length<4||workbook[0]!='P'||workbook[1]!='K')throw new IllegalArgumentException("Gói báo cáo thiếu manifest.json, invoices.json hoặc invoice-review.xlsx.");
  JsonNode m=Engine.JSON.readTree(manifest);String tax=m.path("taxId").asText();
  if(!tax.matches("\\d{10}(\\d{3})?"))throw new IllegalArgumentException("Mã số thuế trong báo cáo không hợp lệ.");
  LocalDate from,to;try{from=LocalDate.parse(m.path("from").asText());to=LocalDate.parse(m.path("to").asText());}catch(Exception e){throw new IllegalArgumentException("Kỳ báo cáo không hợp lệ.");}
  if(to.isBefore(from)||to.isAfter(from.plusDays(366)))throw new IllegalArgumentException("Kỳ báo cáo không hợp lệ.");
  JsonNode invoices=Engine.JSON.readTree(invoicesBytes);if(!invoices.isArray())throw new IllegalArgumentException("invoices.json không hợp lệ.");
  int purchase=0,sold=0;for(JsonNode invoice:invoices){String direction=invoice.path("_direction").asText();if(direction.equals("purchase"))purchase++;else if(direction.equals("sold"))sold++;else throw new IllegalArgumentException("Chiều hóa đơn trong báo cáo không hợp lệ.");}
  int documents=m.path("files").isArray()?m.path("files").size():0,failures=m.path("errors").isArray()?m.path("errors").size():0;
  String coverage=m.path("coverage").asText("");if(coverage.length()>500)coverage=coverage.substring(0,500);
  return new Parsed(tax,from,to,m.path("complete").asBoolean(false),purchase,sold,documents,failures,coverage,new String(manifest,StandardCharsets.UTF_8),workbook);
 }

 public Report upload(InvoiceDeskService.Scope scope,MultipartFile file)throws Exception{
  if(file==null||file.isEmpty()||file.getSize()>MAX_PACKAGE)throw new IllegalArgumentException("Chọn gói báo cáo ZIP hợp lệ, tối đa 100 MB.");
  byte[] packageBytes=file.getBytes();Parsed p=parsePackage(packageBytes);String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(packageBytes));UUID id=UUID.randomUUID();
  db.update("""
   INSERT INTO invoice_desk_gdt_report(id,tenant_id,company_id,tax_id,period_from,period_to,complete,purchases,sales,documents,failures,coverage,manifest,workbook,package,sha256,created_by)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(tenant_id,company_id,tax_id,period_from,period_to) DO UPDATE SET
    complete=excluded.complete,purchases=excluded.purchases,sales=excluded.sales,documents=excluded.documents,failures=excluded.failures,coverage=excluded.coverage,
    manifest=excluded.manifest,workbook=excluded.workbook,package=excluded.package,sha256=excluded.sha256,created_at=CURRENT_TIMESTAMP,created_by=excluded.created_by
   """,id,scope.tenantId(),scope.companyId(),p.taxId(),p.from(),p.to(),p.complete(),p.purchases(),p.sales(),p.documents(),p.failures(),p.coverage(),p.manifest(),p.workbook(),packageBytes,hash,scope.username());
  return reports(scope).stream().filter(r->r.taxId().equals(p.taxId())&&r.periodFrom().equals(p.from().toString())&&r.periodTo().equals(p.to().toString())).findFirst().orElseThrow();
 }
 private Report row(java.sql.ResultSet rs)throws java.sql.SQLException{return new Report(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),rs.getString(4),rs.getBoolean(5),rs.getInt(6),rs.getInt(7),rs.getInt(8),rs.getInt(9),rs.getString(10),rs.getString(11),rs.getString(12));}
 public List<Report> reports(InvoiceDeskService.Scope scope){return db.query("SELECT id,tax_id,period_from::text,period_to::text,complete,purchases,sales,documents,failures,coverage,created_at::text,created_by FROM invoice_desk_gdt_report WHERE tenant_id=? AND company_id=? ORDER BY period_to DESC,tax_id",(rs,n)->row(rs),scope.tenantId(),scope.companyId());}
 public void delete(InvoiceDeskService.Scope scope,UUID id){if(db.update("DELETE FROM invoice_desk_gdt_report WHERE id=? AND tenant_id=? AND company_id=?",id,scope.tenantId(),scope.companyId())!=1)throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
 private byte[] artifact(InvoiceDeskService.Scope scope,UUID id,String column){if(!Set.of("workbook","package","manifest").contains(column))throw new IllegalArgumentException("Loại tệp không hợp lệ.");var rows=db.query("SELECT "+column+" FROM invoice_desk_gdt_report WHERE id=? AND tenant_id=? AND company_id=?",(rs,n)->column.equals("manifest")?rs.getString(1).getBytes(StandardCharsets.UTF_8):rs.getBytes(1),id,scope.tenantId(),scope.companyId());if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);return rows.get(0);}
 public byte[] workbook(InvoiceDeskService.Scope scope,UUID id){return normalizeAmounts(artifact(scope,id,"workbook"));}
 public byte[] packageFile(InvoiceDeskService.Scope scope,UUID id){return artifact(scope,id,"package");}
 public byte[] manifest(InvoiceDeskService.Scope scope,UUID id){return artifact(scope,id,"manifest");}

 static byte[] normalizeAmounts(byte[] source){
  try(var input=new ByteArrayInputStream(source);var book=new XSSFWorkbook(input);var output=new ByteArrayOutputStream()){
   Sheet sheet=book.getSheet("Invoices");if(sheet==null||sheet.getRow(0)==null)return source;
   Set<String> amountHeaders=Set.of("Before VAT","VAT","Total");Set<Integer> columns=new HashSet<>();
   for(Cell cell:sheet.getRow(0))if(cell.getCellType()==CellType.STRING&&amountHeaders.contains(cell.getStringCellValue().trim()))columns.add(cell.getColumnIndex());
   if(columns.isEmpty())return source;CellStyle style=book.createCellStyle();style.setDataFormat(book.createDataFormat().getFormat("#,##0.##"));
   for(int rowIndex=1;rowIndex<=sheet.getLastRowNum();rowIndex++){Row row=sheet.getRow(rowIndex);if(row==null)continue;for(int column:columns){Cell cell=row.getCell(column);if(cell==null)continue;BigDecimal value=null;try{if(cell.getCellType()==CellType.NUMERIC)value=BigDecimal.valueOf(cell.getNumericCellValue());else if(cell.getCellType()==CellType.STRING&&!cell.getStringCellValue().isBlank())value=new BigDecimal(cell.getStringCellValue().trim());}catch(NumberFormatException ignored){}if(value==null)continue;if(value.precision()<=15){cell.setCellValue(value.doubleValue());cell.setCellStyle(style);}else cell.setCellValue(value.toPlainString());}}
   book.write(output);return output.toByteArray();
  }catch(IOException e){throw new IllegalStateException("Không thể chuẩn hóa định dạng tiền trong Excel.",e);}
 }
}
