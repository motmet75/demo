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
    void keepsSecondAddressLineMergedWithFollowingBirthplaceLabel() {
        String text = """
                Nơi cư trú / Pate of residence.
                Thôn Minh Tân
                Phường Hòa Lạc, Gia Lai Nơi đăng ký khai sinh / Place of birth
                Quy Nhơn, Gia Lai
                Ngày, tháng, năm cấp / Date of issue
                """;
        assertEquals("Thôn Minh Tân, Phường Hòa Lạc, Gia Lai",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void doesNotAppendPlaceOfBirthAsAnAddressContinuation() {
        String text = """
                Nơi cư trú / Place of residence
                Thôn Minh Tân
                Phường Hòa Lạc, Gia Lai
                Nơi đăng ký khai sinh / Place of birth
                Quy Nhơn, Gia Lai
                """;
        assertEquals("Thôn Minh Tân, Phường Hòa Lạc, Gia Lai",
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
    void oldCardKeepsSecondResidenceRowAfterInterleavedExpiryField() {
        String text = """
                Quê quán / Place of origin:
                Phường Bình Minh, Bà Rịa - Vũng Tàu
                Nơi thường trú / Place of residence: KP Hoa Mai
                Có giá trị đến / Date of expiry
                01/03/2029
                Phường Bình Minh, Đất Đỏ, Bà Rịa - Vũng Tàu
                """;
        assertEquals("KP Hoa Mai, Phường Bình Minh, Đất Đỏ, Bà Rịa - Vũng Tàu",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void oldCardKeepsSecondRowWhenMergedWithExpiryLabel() {
        String text = """
                Nơi thường trú / Place of residence: KP Hoa Mai
                Phường Bình Minh, Bà Rịa - Vũng Tàu Có giá trị đến / Date of expiry
                01/03/2029
                """;
        assertEquals("KP Hoa Mai, Phường Bình Minh, Bà Rịa - Vũng Tàu",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void newerCardDoesNotDiscardFirstRowBeforeEnglishLabel() {
        String text = """
                Thôn Sao Mai / Nơi cư trú / Pate of residence.
                Phường Đông Nam, TP. HCM
                Nơi đăng ký khai sinh / Place of birth
                """;
        assertEquals("Thôn Sao Mai, Phường Đông Nam, TP. HCM",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void newerCardLooksBackWhenOcrReadsFirstRowBeforeLabel() {
        String text = """
                Thôn Sao Mai
                Nơi cư trú / Place of residence:
                Phường Đông Nam, Gia Lai
                Nơi đăng ký khai sinh / Place of birth
                """;
        assertEquals("Thôn Sao Mai, Phường Đông Nam, Gia Lai",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void recognizesCityAbbreviationsAndHistoricalProvinceNames() {
        assertEquals(true, VinHoadonCccdOcrService.endsWithProvince("Phường Bình An, TP.HCM"));
        assertEquals(true, VinHoadonCccdOcrService.endsWithProvince("Thủ Đức, TP Hồ Chí Minh"));
        assertEquals(true, VinHoadonCccdOcrService.endsWithProvince("Thủ Đức, Thành phố Hồ Chí Minh"));
        assertEquals(true, VinHoadonCccdOcrService.endsWithProvince("Phường Bình An, HCM"));
        assertEquals(true, VinHoadonCccdOcrService.endsWithProvince("Đất Đỏ, Bà Rịa - Vũng Tàu"));
        assertEquals(false, VinHoadonCccdOcrService.endsWithProvince("Khu phố Sao Mai, TP."));
    }

    @Test
    void residenceDoesNotPullQuEQuanWhenResidenceLabelFollowsOrigin() {
        String text = """
                Quê quán / Place of origin
                Phú Mỹ, Bà Rịa - Vũng Tàu
                Nơi thường trú / Place of residence
                KP Hồng Hoa
                Thủ Đức, TP HCM
                """;
        assertEquals("KP Hồng Hoa, Thủ Đức, TP HCM",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void provincePrintedBeforeHamletInOcrTextIsReordered() {
        String text = """
                Nơi cư trú / Place of residence
                Phường Đông Nam, Gia Lai
                Thôn Sao Mai
                Nơi đăng ký khai sinh / Place of birth
                """;
        assertEquals("Thôn Sao Mai, Phường Đông Nam, Gia Lai",
                VinHoadonCccdOcrService.extractResidence(text));
    }

    @Test
    void croppedOcrRecoversAddressWithoutTheLabel() {
        assertEquals("Thôn Xuân Thanh Nam, Phù Mỹ Đông, Gia Lai",
                VinHoadonCccdOcrService.extractCroppedResidence(
                        "Thôn Xuân Thanh Nam\nPhù Mỹ Đông, Gia Lai"));
    }

    @Test
    void croppedOcrDoesNotUsePlaceOfOriginAsResidence() {
        assertNull(VinHoadonCccdOcrService.extractCroppedResidence(
                "Quê quán / Place of origin\nPhú Mỹ, Gia Lai"));
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
