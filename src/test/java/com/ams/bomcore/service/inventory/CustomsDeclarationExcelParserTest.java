package com.ams.bomcore.service.inventory;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class CustomsDeclarationExcelParserTest {
    private final CustomsDeclarationExcelParser parser=new CustomsDeclarationExcelParser();

    private static void row(Sheet sheet,int index,String key,String value,String extra){
        Row r=sheet.createRow(index);
        r.createCell(0).setCellValue(key);
        r.createCell(1).setCellValue(value);
        if(extra!=null)r.createCell(2).setCellValue(extra);
    }
    private static byte[] workbook(Workbook book)throws Exception {
        var sheet=book.createSheet("HQ");
        row(sheet,0,"Số tờ khai","108379535020",null);
        row(sheet,1,"<IMP>","",null);
        row(sheet,2,"Mã số hàng hóa","840810",null);
        row(sheet,3,"Mô tả hàng hóa","Động cơ thủy Yanmar, số máy A123",null);
        row(sheet,4,"Số lượng (1)","1","PCE");
        row(sheet,5,"Đơn giá hóa đơn","17.361.111,11",null);
        row(sheet,6,"Nước xuất xứ","JP",null);
        row(sheet,7,"<IMP>","",null);
        row(sheet,8,"Mã số hàng hóa","840810",null);
        row(sheet,9,"Mô tả hàng hóa","Động cơ thủy Suzuki, số máy B234",null);
        row(sheet,10,"Số lượng (1)","2","PCE");
        row(sheet,11,"Đơn giá hóa đơn","3.703.703,70",null);
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(book){book.write(bytes);}
        return bytes.toByteArray();
    }
    @Test void readsPortalIMPFormatInXlsx()throws Exception {
        var parsed=parser.parse(workbook(new XSSFWorkbook()),"ToKhaiHQ.xlsx");
        assertEquals("108379535020",parsed.declarationNumber());
        assertEquals(2,parsed.items().size());
        assertEquals("840810",parsed.items().get(0).hsCode());
        assertEquals("Động cơ thủy Yanmar, số máy A123",parsed.items().get(0).description());
        assertEquals("PCE",parsed.items().get(0).unit());
        assertEquals(new BigDecimal("17361111.11"),parsed.items().get(0).unitPrice());
        assertEquals(new BigDecimal("2"),parsed.items().get(1).quantity());
    }
    @Test void alsoReadsLegacyXls()throws Exception {
        var parsed=parser.parse(workbook(new HSSFWorkbook()),"ToKhaiHQ.xls");
        assertEquals(2,parsed.items().size());
        assertEquals("Động cơ thủy Suzuki, số máy B234",parsed.items().get(1).description());
    }
    @Test void vietnameseNumberFormatDoesNotUseUsCommaGrouping(){
        assertEquals(new BigDecimal("17361111.11"),CustomsDeclarationExcelParser.parseVietnameseNumber("17.361.111,11"));
        assertEquals(new BigDecimal("1000000"),CustomsDeclarationExcelParser.parseVietnameseNumber("1.000.000"));
        assertEquals(new BigDecimal("1.5"),CustomsDeclarationExcelParser.parseVietnameseNumber("1,5"));
        assertNull(CustomsDeclarationExcelParser.parseVietnameseNumber("not-a-number"));
    }
    @Test void rejectsUnsupportedFileAndEmptyWorkbook()throws Exception {
        assertThrows(IllegalArgumentException.class,
            ()->parser.parse(new byte[]{1,2,3},"customs.pdf"));
        var empty=new XSSFWorkbook();
        empty.createSheet("EMPTY");
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        empty.write(bytes);empty.close();
        assertThrows(IllegalArgumentException.class,
            ()->parser.parse(bytes.toByteArray(),"customs.xlsx"));
    }
}
