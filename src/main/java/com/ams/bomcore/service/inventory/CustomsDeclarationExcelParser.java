package com.ams.bomcore.service.inventory;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.time.LocalDate;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Component;

/**
 * Reads Vietnamese customs XLS/XLSX source sheets with <IMP> (import)
 * or <EXP> (export) markers, preserving the original declaration direction.
 *
 * Unlike the legacy Portal parser this uses WorkbookFactory + DataFormatter
 * and does not mutate the uploaded workbook's cell types.
 */
@Component
public class CustomsDeclarationExcelParser {
    public record Item(int lineIndex, String hsCode, String description,
                       BigDecimal quantity, String unit,
                       BigDecimal unitPrice, String currency,
                       String originCountry,
                       BigDecimal invoiceValue,
                       BigDecimal importTaxableValueVnd,
                       BigDecimal importTaxRate,
                       BigDecimal importTaxAmountVnd,
                       BigDecimal vatTaxableValueVnd,
                       BigDecimal vatRate,
                       BigDecimal vatAmountVnd,
                       BigDecimal importTaxUnitPriceVnd,
                       String importTariffCode,
                       String vatTariffCode,
                       BigDecimal exportTaxableValueVnd,
                       BigDecimal exportTaxRate,
                       BigDecimal exportTaxAmountVnd) {}
    public record Parsed(String declarationNumber, String declarationDate,
                         String fileName, List<Item> items, String direction) {}

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

    private static String nearbyCurrency(Row row,int position,DataFormatter formatter) {
        for(int column=position+1;column<Math.min(position+21,row.getLastCellNum());column++) {
            Cell cell=row.getCell(column);
            if(cell==null)continue;
            String candidate=formatter.formatCellValue(cell).trim().toUpperCase(Locale.ROOT);
            if(Set.of("VND","USD","EUR","JPY","CNY","HKD","KRW","SGD","AUD","GBP","THB")
                .contains(candidate))return candidate;
        }
        return "";
    }

    private static BigDecimal percentage(Row row,int position,DataFormatter formatter) {
        for(int column=position+1;column<Math.min(position+14,row.getLastCellNum());column++) {
            Cell cell=row.getCell(column);
            if(cell==null)continue;
            String candidate=formatter.formatCellValue(cell).trim();
            if(candidate.endsWith("%")) {
                BigDecimal value=number(candidate);
                if(value!=null&&value.signum()>=0&&value.compareTo(new BigDecimal("100"))<=0)
                    return value;
            }
        }
        return null;
    }

    public Parsed parse(byte[] bytes,String fileName) throws Exception {
        if(bytes==null||bytes.length==0||bytes.length>10_000_000)throw new IllegalArgumentException("Tờ khai Excel phải dưới 10 MB.");
        if(fileName==null||!fileName.toLowerCase(Locale.ROOT).matches(".*\\.(xls|xlsx)"))
            throw new IllegalArgumentException("Chỉ nhận tờ khai Excel .xls/.xlsx từ Hải quan.");
        try(Workbook book=WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            if(book.getNumberOfSheets()==0)throw new IllegalArgumentException("Excel không có sheet.");
            DataFormatter formatter=new DataFormatter(new Locale("vi","VN"));
            List<Item> items=new ArrayList<>();
            Map<String,String> current=null;
            String number="",date="",direction=null;
            String taxSection="NONE";
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
                    if("<imp>".equalsIgnoreCase(label)||"<exp>".equalsIgnoreCase(label)){
                        String markerDirection="<exp>".equalsIgnoreCase(label)?"OUT":"IN";
                        if(direction!=null&&!direction.equals(markerDirection))
                            throw new IllegalArgumentException(
                                "File có cả <IMP> và <EXP>; vui lòng tách tờ khai nhập/xuất riêng.");
                        direction=markerDirection;
                        if(current!=null)append(items,current);
                        current=new LinkedHashMap<>();
                        taxSection="NONE";
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
                    else if(key.startsWith("don gia hoa don")) {
                        current.put("unitPrice",value);
                        String unitCurrency=nearbyCurrency(row,c,formatter);
                        if(!unitCurrency.isBlank())current.put("currency",unitCurrency);
                    }
                    else if(key.equals("currency")||key.startsWith("dong tien"))current.put("currency",value);
                    else if(key.startsWith("nuoc xuat xu"))current.put("originCountry",value);
                    else if(key.equals("tri gia hoa don"))current.put("invoiceValue",value);
                    else if(key.equals("thue nhap khau"))taxSection="IMPORT";
                    else if(key.equals("thue xuat khau"))taxSection="EXPORT";
                    else if(key.startsWith("thue va thu khac"))taxSection="OTHER";
                    else if(key.equals("ten")&&taxSection.equals("VAT"))taxSection="OTHER";
                    else if(key.equals("thue gtgt"))taxSection="VAT";
                    else if(key.equals("tri gia tinh thue(s)")&&taxSection.equals("IMPORT"))
                        current.put("importTaxableValueVnd",value);
                    else if(key.equals("tri gia tinh thue(s)")&&taxSection.equals("EXPORT"))
                        current.put("exportTaxableValueVnd",value);
                    else if(key.equals("don gia tinh thue")&&taxSection.equals("IMPORT"))
                        current.put("importTaxUnitPriceVnd",value);
                    else if(key.equals("tri gia tinh thue")&&taxSection.equals("EXPORT"))
                        current.put("exportTaxableValueVnd",value);
                    else if(key.equals("tri gia tinh thue")&&taxSection.equals("VAT"))
                        current.put("vatTaxableValueVnd",value);
                    else if(key.equals("thue suat")&&(taxSection.equals("IMPORT")
                            ||taxSection.equals("EXPORT")||taxSection.equals("VAT"))) {
                        BigDecimal rate=percentage(row,c,formatter);
                        if(rate!=null)current.put(taxSection.equals("IMPORT")?"importTaxRate":
                            taxSection.equals("EXPORT")?"exportTaxRate":"vatRate",rate.toPlainString());
                        if(taxSection.equals("IMPORT")&&!value.equals("")&&!value.endsWith("%"))
                            current.put("importTariffCode",value);
                    }
                    else if(key.equals("so tien thue")&&taxSection.equals("IMPORT"))
                        current.put("importTaxAmountVnd",value);
                    else if(key.equals("so tien thue")&&taxSection.equals("EXPORT"))
                        current.put("exportTaxAmountVnd",value);
                    else if(key.equals("so tien thue")&&taxSection.equals("VAT"))
                        current.put("vatAmountVnd",value);
                    else if(key.equals("ma ap dung thue suat")&&taxSection.equals("VAT"))
                        current.put("vatTariffCode",value);
                }
            }
            if(current!=null)append(items,current);
            if(items.isEmpty())throw new IllegalArgumentException(
                "Không tìm thấy dòng hàng <IMP>/<EXP> với mô tả và số lượng. "
                + "Kiểm tra định dạng hoặc sheet của tờ khai Hải quan.");
            if(items.size()>200)throw new IllegalArgumentException("Tối đa 200 dòng hàng/tờ khai.");
            String declaration=number.trim();
            // Some customs exports repeat declaration number per item; a file
            // without it can be previewed, but number is mandatory on posting.
            return new Parsed(declaration,date,fileName,List.copyOf(items),direction);
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
                Objects.toString(item.getOrDefault("originCountry",""),"").trim(),
                number(item.get("invoiceValue")),
                number(item.get("importTaxableValueVnd")),
                number(item.get("importTaxRate")),
                number(item.get("importTaxAmountVnd")),
                number(item.get("vatTaxableValueVnd")),
                number(item.get("vatRate")),
                number(item.get("vatAmountVnd")),
                number(item.get("importTaxUnitPriceVnd")),
                Objects.toString(item.getOrDefault("importTariffCode",""),"").trim(),
                Objects.toString(item.getOrDefault("vatTariffCode",""),"").trim(),
                number(item.get("exportTaxableValueVnd")),
                number(item.get("exportTaxRate")),
                number(item.get("exportTaxAmountVnd")));
    }
}
