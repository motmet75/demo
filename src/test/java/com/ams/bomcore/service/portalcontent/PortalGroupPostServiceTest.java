package com.ams.bomcore.service.portalcontent;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PortalGroupPostServiceTest {

    private static final PortalGroupPostService.Product P = new PortalGroupPostService.Product(
            7, "Ghe sofa", "SP001", "ghe-sofa-sp001.html", "Ghe dep gia tot", "Hoa Phat", "Noi that",
            "Phong khach", "https://x/1.jpg", "");

    @Test
    void base62MatchesLegacyAlphabet() {
        assertEquals("0", PortalGroupPostService.base62(0));
        assertEquals("Z", PortalGroupPostService.base62(35));
        assertEquals("z", PortalGroupPostService.base62(61));
        assertEquals("10", PortalGroupPostService.base62(62));
        assertEquals("G8", PortalGroupPostService.base62(1000));
    }

    @Test
    void productsSpreadEvenlyWithRemainderOnLastProducts() {
        // legacy productForRowIndex: 5 groups over A,B -> A,A,B,B,B
        List<String> got = new ArrayList<>();
        for (int i = 0; i < 5; i++) got.add(PortalGroupPostService.productForRow(i, 5, List.of("A", "B")));
        assertEquals(List.of("A", "A", "B", "B", "B"), got);
        // more products than groups -> one each, extra products unused
        assertEquals("B", PortalGroupPostService.productForRow(1, 2, List.of("A", "B", "C")));
    }

    @Test
    void emptySequenceIsShortDescriptionPlusLink() {
        assertEquals("Ghe dep gia tot\n{{link}}", PortalGroupPostService.message(P, "", Map.of()));
    }

    @Test
    void legacyDefaultSequence51267() {
        String msg = PortalGroupPostService.message(P, "51267", Map.of("1", "#nncminhchau", "5", "Hotline 0909"));
        assertEquals("Ghe dep gia tot\nHotline 0909\n#nncminhchau #hoa_phat\n{{link}}\nSP001", msg);
    }

    @Test
    void nameDigitPrependsAndDuplicatesAreSkipped() {
        assertEquals("Ghe sofa\nGhe dep gia tot #noi_that\n#phong_khach",
                PortalGroupPostService.message(P, "0334", Map.of()));
    }
}
