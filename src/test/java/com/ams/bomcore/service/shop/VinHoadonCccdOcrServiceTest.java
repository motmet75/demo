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
    void doesNotInventANameWhenTextIsIncomplete() {
        assertNull(VinHoadonCccdOcrService.extractFullName(
                "CĂN CƯỚC CÔNG DÂN\nFull name\nNgày, tháng, năm sinh / Date of birth\nViệt Nam"));
    }
}
