package com.ams.bomcore.service.shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import org.junit.jupiter.api.Test;

class VinHoadonCccdOcrServiceTest {

    @Test
    void readsNameFromOlderCitizenIdentityCardLayout() {
        String text = """
                CĂN CƯỚC CÔNG DÂN
                Số / No.: 000000000000
                Họ và tên / Full name:
                NGUYỄN VĂN AN
                Ngày, tháng, năm sinh / Date of birth: 01/01/2000
                """;
        assertEquals("NGUYỄN VĂN AN", VinHoadonCccdOcrService.extractFullName(text));
    }

    @Test
    void readsNameFromNewIdentityCardLabelAndInlineName() {
        String text = """
                THẺ CĂN CƯỚC
                Họ, chữ đệm và tên khai sinh / Full name: TRẦN THỊ BÌNH
                Ngày, tháng, năm sinh / Date of birth
                """;
        assertEquals("TRẦN THỊ BÌNH", VinHoadonCccdOcrService.extractFullName(text));
    }

    @Test
    void readsNameFromEnglishLayout() {
        assertEquals("TONY STARK", VinHoadonCccdOcrService.extractFullName(
                "Personal Identification\nFull name: TONY STARK\nDate of birth: 01/01/1990"));
    }

    @Test
    void extractsTwoLinePermanentResidenceOnOldCardFront() {
        String text = """
                Quê quán / Place of origin:
                Bình Hải, Đất Đỏ
                Nơi thường trú / Place of residence: KP Lộc An
                Phước Hải, Đất Đỏ, Bà Rịa - Vũng Tàu
                Có giá trị đến / Date of expiry: 01/01/2032
                """;
        assertEquals("KP Lộc An, Phước Hải, Đất Đỏ, Bà Rịa - Vũng Tàu",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void extractsTwoLineResidenceOnNewCardBack() {
        String text = """
                Nơi cư trú / Place of residence
                Thôn Xuân Thanh Nam
                Phù Mỹ Đông, Gia Lai
                Nơi đăng ký khai sinh / Place of birth
                Quy Nhơn, Gia Lai
                Ngày, tháng, năm cấp / Date of issue
                30/07/2026
                """;
        assertEquals("Thôn Xuân Thanh Nam, Phù Mỹ Đông, Gia Lai",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void stripsMisreadEnglishResidenceLabelBeforeTwoLineAddress() {
        String text = """
                Nơi cư trú / Pate of residence.
                Thôn Bình Minh
                Phường An Phú, Gia Lai
                Ngày, tháng, năm cấp / Date of issue
                30/07/2026
                """;
        assertEquals("Thôn Bình Minh, Phường An Phú, Gia Lai",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void stripsMisreadEnglishLabelWhenFirstAddressLineIsInline() {
        String text = """
                Nơi cư trú / Pate of residence. Thôn Bình Minh
                Phường An Phú, Gia Lai
                Ngày, tháng, năm cấp / Date of issue
                """;
        assertEquals("Thôn Bình Minh, Phường An Phú, Gia Lai",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void stripsEnglishOnlyMisreadResidenceLabel() {
        String text = """
                Pate of residence. Thôn Bình Minh
                Phường An Phú, Gia Lai
                Date of issue
                """;
        assertEquals("Thôn Bình Minh, Phường An Phú, Gia Lai",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void doesNotTreatMisreadLabelAloneAsAddress() {
        assertNull(VinHoadonCccdOcrService.extractResidence(
                "Nơi cư trú / Pate of residence.\nDate of issue"));
    }

    @Test
    void ignoresPlaceOfOriginWithoutResidenceLabel() {
        String text = """
                Quê quán / Place of origin:
                Phước Hải, Đất Đỏ, Bà Rịa - Vũng Tàu
                Ngày sinh / Date of birth: 01/01/2000
                """;
        assertNull(VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void doesNotInventANameWhenTextIsIncomplete() {
        assertNull(VinHoadonCccdOcrService.extractFullName(
                "CĂN CƯỚC CÔNG DÂN\nFull name\nNgày, tháng, năm sinh / Date of birth\nViệt Nam"));
    }
}
