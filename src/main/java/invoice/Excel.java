package invoice;
import java.nio.file.*;
import java.util.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
public class Excel {
 public static void write(Path path,List<Invoice> invoices,boolean approvedOnly)throws Exception{
  try(var book=new XSSFWorkbook()){
   var summary=book.createSheet("Invoices");var items=book.createSheet("Line items");var audit=book.createSheet("Review log");
   List<String> columns=new ArrayList<>(Invoice.KEYS);columns.addAll(List.of("type","approved","method","profile","warnings","source","sha256","linkedInvoice","reconciliation","approvalMode"));
   row(summary,columns);row(items,List.of("sellerTaxId","serial","number","line","description","unit","HS code","M\u00e3 NVL","quantity","unitPrice","amount","source","Biển số xe","Ghi chú","Mô tả gốc"));
   var appendices=book.createSheet("Appendices");var appendixItems=book.createSheet("Appendix items");row(appendices,columns);row(appendixItems,List.of("sellerTaxId","serial","number","line","description","unit","HS code","M\u00e3 NVL","quantity","unitPrice","amount","source","Biển số xe","Ghi chú","Mô tả gốc"));
   var debitNotes=book.createSheet("Debit notes");var debitItems=book.createSheet("Debit items");row(debitNotes,columns);row(debitItems,List.of("sellerTaxId","serial","number","line","description","unit","HS code","Mã NVL","quantity","unitPrice","amount","source","Biển số xe","Ghi chú","Mô tả gốc"));
   row(audit,List.of("source","type","approved","warnings"));
   for(Invoice r:invoices){
    row(audit,List.of(r.source,r.type,String.valueOf(r.approved),String.join("; ",r.warnings)));
    if(!List.of("INVOICE","APPENDIX","DEBIT_NOTE").contains(r.type)||(approvedOnly&&!r.approved))continue;
    Sheet target=r.type.equals("DEBIT_NOTE")?debitNotes:r.type.equals("APPENDIX")?appendices:summary,itemTarget=r.type.equals("DEBIT_NOTE")?debitItems:r.type.equals("APPENDIX")?appendixItems:items;
    List<String> values=new ArrayList<>();Invoice.KEYS.forEach(k->values.add(r.get(k)));values.addAll(List.of(r.type,String.valueOf(r.approved),r.method,r.profile,String.join("; ",r.warnings),r.source,r.sha256,r.linkedInvoice,r.reconciliation,r.approvalMode));
    // Keep the first two sheets useful for normal Excel users: they contain every
    // approved document, including appendices and debit notes. The typed sheets
    // below remain available for downstream accounting workflows.
    Row record=row(summary,values);for(String k:List.of("subtotal","vat","total"))numeric(record.getCell(columns.indexOf(k)));
    if(target!=summary){Row typed=row(target,values);for(String k:List.of("subtotal","vat","total"))numeric(typed.getCell(columns.indexOf(k)));}
    for(var i:r.items){List<String> itemValues=List.of(r.get("sellerTaxId"),r.get("serial"),r.get("number"),i.getOrDefault("line",""),i.getOrDefault("description",""),i.getOrDefault("unit",""),i.getOrDefault("hsCode",""),i.getOrDefault("materialCode",""),i.getOrDefault("quantity",""),i.getOrDefault("unitPrice",""),i.getOrDefault("amount",""),r.source,i.getOrDefault("truckPlate",""),i.getOrDefault("notes",""),i.getOrDefault("originalDescription",""));Row ir=row(items,itemValues);for(int n=8;n<=10;n++)numeric(ir.getCell(n));if(itemTarget!=items){Row typedItem=row(itemTarget,itemValues);for(int n=8;n<=10;n++)numeric(typedItem.getCell(n));}}
   }
   Map<Integer,CellStyle> numberFormats=new HashMap<>();
   for(Sheet sheet:book)for(Row row:sheet)for(Cell cell:row)if(cell.getCellType()==CellType.NUMERIC){int scale=Math.max(0,java.math.BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().scale());scale=Math.min(15,scale);CellStyle style=numberFormats.get(scale);if(style==null){style=book.createCellStyle();style.setDataFormat(book.createDataFormat().getFormat("#,##0"+(scale>0?"."+"0".repeat(scale):"")));numberFormats.put(scale,style);}cell.setCellStyle(style);}
   CellStyle header=book.createCellStyle();header.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());header.setFillPattern(FillPatternType.SOLID_FOREGROUND);Font font=book.createFont();font.setBold(true);font.setColor(IndexedColors.WHITE.getIndex());header.setFont(font);
   for(Sheet s:book){s.createFreezePane(0,1);s.setAutoFilter(new CellRangeAddress(0,s.getLastRowNum(),0,s.getRow(0).getLastCellNum()-1));for(Cell c:s.getRow(0)){c.setCellStyle(header);s.setColumnWidth(c.getColumnIndex(),Math.min(c.getColumnIndex()==0?48:28,60)*256);}}
   Path absolute=path.toAbsolutePath();Files.createDirectories(absolute.getParent());Path tmp=Files.createTempFile(absolute.getParent(),"invoice-export-",".xlsx");
   try{try(var out=Files.newOutputStream(tmp)){book.write(out);}Files.move(tmp,absolute,StandardCopyOption.REPLACE_EXISTING);}finally{Files.deleteIfExists(tmp);}
  }
 }
 static Row row(Sheet sheet,List<String> values){Row row=sheet.createRow(sheet.getPhysicalNumberOfRows());for(int i=0;i<values.size();i++){String v=values.get(i);row.createCell(i,CellType.STRING).setCellValue(v.substring(0,Math.min(v.length(),32767)));}return row;}
 static void numeric(Cell c){try{var n=new java.math.BigDecimal(c.getStringCellValue());if(n.precision()<=15)c.setCellValue(n.doubleValue());}catch(Exception ignored){}}
}
