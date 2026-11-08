package com.ams.bomcore.service.inventory;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.time.LocalDate;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Component;

/**
 * Imports Vietnamese Customs declaration spreadsheets using the same <IMP>
 * line markers and labels as Portal Utilities.CDSExcelImporter (master).
 *
 * Unlike the legacy Portal parser this uses WorkbookFactory + DataFormatter
 * and does not mutate the uploaded workbook's cell types.
 */
@Component
public class CustomsDeclarationExcelParser {
    public record Item(int lineIndex, String hsCode, String description,
                       BigDecimal quantity, String unit,
                       BigDecimal unitPrice, String currency,
                       String originCountry) {}
    public record Parsed(String declarationNumber, String declarationDate,
                         String fileName, List<Item> items) {}

    private static String fold(String value) {
        return java.text.Normalizer.normalize(Objects.toString(value,""),java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+","").replace('đ','d').replace('Đ','D').toLowerCase(Locale.ROOT).trim();
    }
    private static String nearby(Row row,int position,DataFormatter format,int occurrence) {
        int count=0;
        for(int offset=1;offset<=20;offset++) {
            Cell cell=row.getCell(position+offset);
            if(cell==null)continue;
            String value=format.formatCellValue(cell).trim();
            if(value.isEmpty())continue;
            count++;
            if(count==occurrence)return value;
        }
        return "";
    }
    private static BigDecimal number(String raw) {
        if(raw==null||raw.isBlank())return null;
        String val=raw.replaceAll("[\\s\\u00a0\\u202f]","").replace("%","");
        if(!val.matches("\\d+(?:[.,]\\d+)*"))return null;
        if(val.contains(",")) {
            if(val.contains("."))val=val.replace(".","").replace(',','.');
            else if(val.matches("\\d{1,3}(?:,\\d{3})+"))val=val.replace(",","");
            else val=val.replace(',','.');
        } else if(val.matches("\\d{1,3}(?:\\.\\d{3})+"))val=val.replace(".","");
        try{return new BigDecimal(val);}catch(NumberFormatException ex){return null;}
    }
    public static BigDecimal parseVietnameseNumber(String raw) {return number(raw);}

    public Parsed parse(byte[] bytes,String fileName) throws Exception {
        if(bytes==null||bytes.length==0||bytes.length>10_000_000)throw new IllegalArgumentException("Tờ khai Excel phải dưới 10 MB.");
        if(fileName==null||!fileName.toLowerCase(Locale.ROOT).matches(".*\\.(xls|xlsx)"))
            throw new IllegalArgumentException("Chỉ nhận tờ khai Excel .xls/.xlsx từ Hải quan.");
        try(Workbook book=WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            if(book.getNumberOfSheets()==0)throw new IllegalArgumentException("Excel không có sheet.");
            DataFormatter formatter=new DataFormatter(new Locale("vi","VN"));
            List<Item> items=new ArrayList<>();
            Map<String,String> current=null;
            String number="",date="";
            Sheet sheet=book.getSheetAt(0);
            if(sheet.getLastRowNum()>10_000)throw new IllegalArgumentException("Tờ khai có quá nhiều dòng.");
            for(Row row:sheet){
                if(row.getLastCellNum()>200)throw new IllegalArgumentException("Tờ khai có quá nhiều cột.");
                for(int c=0;c<row.getLastCellNum();c++){
                    Cell cell=row.getCell(c);
                    if(cell==null)continue;
                    String label=formatter.formatCellValue(cell).trim();
                    if(label.isEmpty())continue;
                    String key=fold(label);
                    if("<imp>".equalsIgnoreCase(label)){
                        if(current!=null)append(items,current);
                        current=new LinkedHashMap<>();
                        continue;
                    }
                    String value=nearby(row,c,formatter,1);
                    if(key.equals("so to khai")&&!value.isBlank())number=value;
                    if(key.equals("ngay dang ky")&&!value.isBlank())date=value;
                    if(current==null)continue;
                    if(key.startsWith("ma so hang hoa"))current.put("hsCode",value);
                    else if(key.startsWith("mo ta hang hoa"))current.put("description",value);
                    else if(key.startsWith("so luong (1)")) {
                        current.put("quantity",value);
                        current.put("unit",nearby(row,c,formatter,2));
                    }
                    else if(key.startsWith("don gia hoa don"))current.put("unitPrice",value);
                    else if(key.equals("currency")||key.startsWith("dong tien"))current.put("currency",value);
                    else if(key.startsWith("nuoc xuat xu"))current.put("originCountry",value);
                }
            }
            if(current!=null)append(items,current);
            if(items.isEmpty())throw new IllegalArgumentException("Không tìm thấy dòng <IMP> và mô tả hàng hóa trong tờ khai. Kiểm tra định dạng Excel.");
            if(items.size()>200)throw new IllegalArgumentException("Tối đa 200 dòng hàng/tờ khai.");
            String declaration=number.trim();
            // Some customs exports repeat declaration number per item; a file
            // without it can be previewed, but number is mandatory on posting.
            return new Parsed(declaration,date,fileName,List.copyOf(items));
        }
    }
    private void append(List<Item> lines,Map<String,String> item) {
        String desc=Objects.toString(item.get("description"),"").trim();
        BigDecimal qty=number(item.get("quantity"));
        if(desc.isBlank()&&qty==null)return;
        if(desc.isBlank()||qty==null||qty.signum()<=0)
            throw new IllegalArgumentException("Thiếu mô tả hoặc số lượng tại dòng tờ khai số "+(lines.size()+1));
        lines.add(new Item(lines.size(),item.getOrDefault("hsCode",""),desc,
                qty,Objects.toString(item.get("unit"),"").trim(),
                number(item.get("unitPrice")),
                Objects.toString(item.getOrDefault("currency",""),"").trim(),
                Objects.toString(item.getOrDefault("originCountry",""),"").trim()));
    }
}
