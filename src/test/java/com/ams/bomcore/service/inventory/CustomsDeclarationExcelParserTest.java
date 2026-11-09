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

    // Layout copied from customs declaration 103847745300, page 3 (Excel BIFF8):
    // the value and the field label are in different, non-adjacent columns.
    // This verifies that 22% is read after tariff code "A" (not as "A"),
    // and that the declared customs VAT base is not the USD invoice value.
    @Test void readsOriginalCustomsDeclaredInvoiceDutyAndVatFromLegacyXls() throws Exception {
        var book = new HSSFWorkbook();
        Sheet sheet = book.createSheet("HQ");
        cell(sheet,0,2,"<IMP>");     // page 1 (cover, not a goods line)
        cell(sheet,1,2,"Số tờ khai");cell(sheet,1,4,"103847745300");
        cell(sheet,2,2,"Ngày đăng ký");cell(sheet,2,6,"19/02/2021 14:23:21");
        cell(sheet,5,2,"<IMP>");     // page 3, goods line <01>
        cell(sheet,10,2,"Mã số hàng hóa");cell(sheet,10,6,"39249090");
        cell(sheet,11,2,"Mô tả hàng hóa");cell(sheet,11,6,"Kệ để dao làm bằng nhựa");
        cell(sheet,12,18,"Số lượng (1)");cell(sheet,12,21,"400");cell(sheet,12,30,"PCE");
        cell(sheet,13,2,"Trị giá hóa đơn");cell(sheet,13,8,"303");
        cell(sheet,13,18,"Đơn giá hóa đơn");cell(sheet,13,21,"0,7575");
        cell(sheet,13,28,"USD");cell(sheet,13,30,"PCE");
        cell(sheet,14,2,"Thuế nhập khẩu");
        cell(sheet,15,3,"Trị giá tính thuế(S)");cell(sheet,15,8,"6.941.730");
        cell(sheet,16,18,"Đơn giá tính thuế");cell(sheet,16,21,"17.354,325");
        cell(sheet,17,3,"Thuế suất");cell(sheet,17,7,"A");cell(sheet,17,8,"22%");
        cell(sheet,18,3,"Số tiền thuế");cell(sheet,18,8,"1.527.180,6");
        cell(sheet,18,18,"Nước xuất xứ");cell(sheet,18,23,"CN");
        cell(sheet,19,2,"Thuế và thu khác");
        cell(sheet,20,3,"Tên");cell(sheet,20,7,"Thuế GTGT");
        cell(sheet,20,18,"Mã áp dụng thuế suất");cell(sheet,20,22,"VB901");
        cell(sheet,21,3,"Trị giá tính thuế");cell(sheet,21,8,"8.468.910,6");
        cell(sheet,22,3,"Thuế suất");cell(sheet,22,8,"10%");
        cell(sheet,23,3,"Số tiền thuế");cell(sheet,23,8,"846.891");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (book) {book.write(bytes);}
        var parsed = parser.parse(bytes.toByteArray(), "ToKhaiHQ7N.xls");
        assertEquals("103847745300", parsed.declarationNumber());
        assertEquals(1, parsed.items().size());
        var item = parsed.items().get(0);
        assertEquals("39249090", item.hsCode());
        assertEquals(new BigDecimal("400"),item.quantity());
        assertEquals("PCE",item.unit());
        assertEquals("USD",item.currency());
        assertEquals(new BigDecimal("0.7575"),item.unitPrice());
        assertEquals(new BigDecimal("303"),item.invoiceValue());
        assertEquals(new BigDecimal("6941730"),item.importTaxableValueVnd());
        assertEquals(new BigDecimal("17354.325"),item.importTaxUnitPriceVnd());
        assertEquals(new BigDecimal("22"),item.importTaxRate());
        assertEquals("A",item.importTariffCode());
        assertEquals(new BigDecimal("1527180.6"),item.importTaxAmountVnd());
        assertEquals(new BigDecimal("8468910.6"),item.vatTaxableValueVnd());
        assertEquals(new BigDecimal("10"),item.vatRate());
        assertEquals(new BigDecimal("846891"),item.vatAmountVnd());
        assertEquals("VB901",item.vatTariffCode());
        assertEquals("CN",item.originCountry());
    }
    private static void cell(Sheet sheet,int rowIndex,int column,String value) {
        Row row=sheet.getRow(rowIndex);
        if(row==null)row=sheet.createRow(rowIndex);
        row.createCell(column).setCellValue(value);
    }


    @Test void readsExportDeclarationExpRowsFromLegacyXls() throws Exception {
        var book = new HSSFWorkbook();
        var sheet = book.createSheet("XuatKhau");
        cell(sheet,0,2,"<EXP>");
        cell(sheet,1,2,"Số tờ khai");cell(sheet,1,5,"308998544060");
        cell(sheet,4,2,"<EXP>");
        cell(sheet,5,2,"<01>");
        cell(sheet,6,2,"Mã số hàng hóa");cell(sheet,6,5,"54011010");
        cell(sheet,7,2,"Mô tả hàng hóa");cell(sheet,7,6,"Sợi chỉ tổng hợp");
        cell(sheet,8,18,"Số lượng (1)");cell(sheet,8,21,"200");cell(sheet,8,25,"KGM");
        cell(sheet,9,18,"Đơn giá hóa đơn");cell(sheet,9,21,"1,25");cell(sheet,9,24,"USD");
        cell(sheet,10,2,"Thuế xuất khẩu");
        cell(sheet,11,3,"Trị giá tính thuế(S)");cell(sheet,11,8,"5.000.000");
        cell(sheet,12,3,"Thuế suất");cell(sheet,12,8,"5%");
        cell(sheet,13,3,"Số tiền thuế");cell(sheet,13,8,"250.000");
        cell(sheet,16,2,"<EXP>");
        cell(sheet,17,2,"<02>");
        cell(sheet,18,2,"Mã số hàng hóa");cell(sheet,18,5,"54011010");
        cell(sheet,19,2,"Mô tả hàng hóa");cell(sheet,19,5,"Sợi chỉ loại B");
        cell(sheet,20,18,"Số lượng (1)");cell(sheet,20,21,"100");cell(sheet,20,25,"KGM");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try(book){book.write(bytes);}
        var parsed=parser.parse(bytes.toByteArray(),"ToKhaiHQ7X_QDTQ_308998544060.xls");
        assertEquals("OUT",parsed.direction());
        assertEquals("308998544060",parsed.declarationNumber());
        assertEquals(2,parsed.items().size());
        assertEquals("54011010",parsed.items().get(0).hsCode());
        assertEquals(new BigDecimal("200"),parsed.items().get(0).quantity());
        assertEquals(new BigDecimal("1.25"),parsed.items().get(0).unitPrice());
        assertEquals("USD",parsed.items().get(0).currency());
        assertEquals(new BigDecimal("5000000"),parsed.items().get(0).exportTaxableValueVnd());
        assertEquals(new BigDecimal("5"),parsed.items().get(0).exportTaxRate());
        assertEquals(new BigDecimal("250000"),parsed.items().get(0).exportTaxAmountVnd());
        assertNull(parsed.items().get(1).exportTaxRate());
    }

    @Test void importDirectionAndMixedMarkerAreHandledSafely() throws Exception {
        var incoming=parser.parse(workbook(new XSSFWorkbook()),"import.xlsx");
        assertEquals("IN",incoming.direction());
        var book=new HSSFWorkbook();
        var sheet=book.createSheet("HQ");
        cell(sheet,0,2,"<IMP>");
        cell(sheet,1,2,"<EXP>");
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(book){book.write(bytes);}
        var err=assertThrows(IllegalArgumentException.class,
                ()->parser.parse(bytes.toByteArray(),"mixed.xls"));
        assertTrue(err.getMessage().contains("cả <IMP> và <EXP>"));
    }

}
