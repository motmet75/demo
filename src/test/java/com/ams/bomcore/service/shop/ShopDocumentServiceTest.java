package com.ams.bomcore.service.shop;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.zip.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class ShopDocumentServiceTest {
    private static final String FRONT = """
            Số định danh cá nhân Personal identification number:
            001185000123
            Họ, chữ đệm và tên khai sinh / Full name:
            NGUYỄN VĂN AN
            Ngày, tháng, năm sinh / Date of birth
            01/01/1985
            """;
    private static final String BACK = """
            Nơi cư trú "Pate of residence. Thôn Mẫu Nam
            Xã Mẫu, Gia Lai
            Nơi đăng ký khai sinh "Piece of birth
            Xã Khác, Gia Lai
            Ngày, tháng, năm cấp / Date of issue
            30/07/2026
            BỘ CÔNG AN/MINISTRY OF PUBLIC SECURITY
            IDVNM1850001230001185000123<<7
            NGUYEN<<VAN<AN<<<<
            """;

    @Test void combinesFrontIdentityWithBackResidenceInEitherOrder() {
        var buyer = ShopDocumentService.combineBuyerTexts(List.of(FRONT, BACK));
        assertEquals("001185000123", buyer.buyerIdentityNumber());
        assertEquals("NGUYỄN VĂN AN", buyer.buyerName());
        assertEquals("Thôn Mẫu Nam Xã Mẫu, Gia Lai", buyer.buyerAddress());
        assertTrue(buyer.warnings().isEmpty());
        assertEquals(buyer, ShopDocumentService.combineBuyerTexts(List.of(BACK, FRONT)));
    }
    @Test void rejectsMismatchedFrontAndBackAndConflictingResidence() {
        assertThrows(IllegalArgumentException.class, () -> ShopDocumentService.combineBuyerTexts(List.of(FRONT, BACK.replace("001185000123", "002185000456"))));
        assertThrows(IllegalArgumentException.class, () -> ShopDocumentService.combineBuyerTexts(List.of(FRONT, BACK, BACK.replace("Thôn Mẫu Nam", "Thôn Khác"))));
        assertThrows(IllegalArgumentException.class, () -> ShopDocumentService.combineBuyerTexts(List.of(FRONT, FRONT.replace("001185000123", "002185000456"))));
    }
    @Test void requiresFrontAndWarnsWhenBackIsMissing() {
        assertThrows(IllegalArgumentException.class, () -> ShopDocumentService.combineBuyerTexts(List.of(BACK)));
        var buyer = ShopDocumentService.combineBuyerTexts(List.of(FRONT));
        assertEquals("", buyer.buyerAddress());
        assertTrue(buyer.warnings().stream().anyMatch(w -> w.contains("mặt sau")));
    }
    @Test void parsesNewVietnameseOnlyNameLabelAndOldBackResidence() {
        assertEquals("NGUYỄN VĂN AN", CccdParser.parse("Họ, chữ đệm và tên khai sinh: Nguyễn Văn An\nNgày, tháng, năm sinh: 01/01/1985").buyerName());
        assertEquals("12 Phố Mẫu Hà Nội", CccdParser.parse("Nơi thường trú:\nPlace of residence:\n12 Phố Mẫu\nHà Nội\nNgày, tháng, năm cấp: 30/07/2026").buyerAddress());
    }
    @Test void rejectsTooManyFilesBeforeCallingGoogle() {
        var service = new ShopDocumentService();
        var file = new MockMultipartFile("file", "card.png", null, new byte[]{1});
        assertThrows(IllegalArgumentException.class, () -> service.readBuyer(List.of(file, file, file, file, file)));
    }
    @Test void readsUppercaseNameLeadingZeroAndResidenceInsteadOfBirthplace() {
        var buyer = CccdParser.parse("""
                Số / No.: 001185000123
                Họ và tên / Full name:
                Nguyễn Văn An
                Ngày sinh / Date of birth: 01/01/1985
                Quê quán / Place of origin: Ba Đình, Hà Nội
                Nơi thường trú / Place of residence Hẻm 12 Trần
                Q. Diệu, Nghĩa Lộ, TP. Quảng Ngãi, Quảng Ngãi
                F10
                F11
                """);
        assertEquals("001185000123", buyer.buyerIdentityNumber());
        assertEquals("NGUYỄN VĂN AN", buyer.buyerName());
        assertEquals("Hẻm 12 Trần Q. Diệu, Nghĩa Lộ, TP. Quảng Ngãi, Quảng Ngãi", buyer.buyerAddress());
    }
    @Test void handlesSplitIdAndDoesNotInventResidence() {
        var buyer = CccdParser.parse("Số định danh cá nhân / Personal identification number:\n001185000123\nHọ và tên: NGUYỄN VĂN AN\nNgày sinh: 01/01/1985\nQuê quán: Hà Nội");
        assertEquals("001185000123", buyer.buyerIdentityNumber());
        assertEquals("", buyer.buyerAddress());
        assertEquals("", CccdParser.parse("IDVNM1850001233001185000123<<9\nNGUYEN<<VAN<AN<<").buyerName());
    }
    @Test void readsNamespacedInvoiceXmlWithoutChangingNumbers() throws Exception {
        var invoice = ShopDocumentService.readXml(("""
                <HDon xmlns="urn:invoice"><DLHDon><TTChung><SHDon>00042</SHDon></TTChung><NDHDon>
                <NMua><Ten>CÔNG TY MẪU</Ten><MST>0123456789</MST><DChi>12 Hà Nội</DChi></NMua>
                <DSHHDVu><HHDVu><MHHDVu>A01</MHHDVu><THHDVu>Máy bơm A</THHDVu><DVTinh>Cái</DVTinh>
                <SLuong>2.5</SLuong><DGia>120000.25</DGia><ThTien>300000.625</ThTien></HHDVu></DSHHDVu>
                </NDHDon></DLHDon></HDon>
                """).getBytes(StandardCharsets.UTF_8));
        assertEquals("00042", invoice.get("number"));
        assertEquals("0123456789", invoice.get("buyerTaxId"));
        assertEquals("Máy bơm A", invoice.items.get(0).get("description"));
        assertEquals("2.5", invoice.items.get(0).get("quantity"));
        assertEquals("120000.25", invoice.items.get(0).get("unitPrice"));
    }
    @Test void rejectsXmlExternalEntities() {
        var xml = "<!DOCTYPE x [<!ENTITY secret SYSTEM 'file:///private.txt'>]><HDon><HHDVu><THHDVu>&secret;</THHDVu></HHDVu></HDon>";
        assertThrows(Exception.class, () -> ShopDocumentService.readXml(xml.getBytes(StandardCharsets.UTF_8)));
    }
    @Test void rejectsEmptyAndOversizedFilesBeforeCallingGoogle() {
        var service = new ShopDocumentService();
        assertThrows(IllegalArgumentException.class, () -> service.readBuyer(new MockMultipartFile("file", "card.docx", null, new byte[0])));
        assertThrows(IllegalArgumentException.class, () -> service.readBuyer(new MockMultipartFile("file", "card.png", null, new byte[10 * 1024 * 1024 + 1])));
    }
    @Test void boundsDocxDecompression() throws Exception {
        var out = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("word/document.xml"));
            zip.write(new byte[10 * 1024 * 1024 + 2]);
            zip.closeEntry();
        }
        assertThrows(IllegalArgumentException.class, () -> ShopDocumentService.cardImages("card.docx", out.toByteArray()));
    }
}
