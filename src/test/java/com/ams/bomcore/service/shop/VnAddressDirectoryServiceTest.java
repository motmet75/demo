package com.ams.bomcore.service.shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import org.junit.jupiter.api.Test;

class VnAddressDirectoryServiceTest {
    @Test
    void normalizesVietnameseAccents() {
        assertEquals("phu my dong", VnAddressDirectoryService.normalize("Xã Phù Mỹ Đông"));
        assertEquals("thon xuan thanh nam phu my dong gia lai",
                VnAddressDirectoryService.normalize("Thôn Xuân Thanh Nam, Phù Mỹ Đông, Gia Lai"));
    }

    @Test
    void normalizesHoChiMinhAbbreviations() {
        assertEquals("ho chi minh", VnAddressDirectoryService.normalize("TP.HCM"));
        assertEquals("ho chi minh", VnAddressDirectoryService.normalize("TP HCM"));
        assertEquals("ho chi minh", VnAddressDirectoryService.normalize("HCM"));
        assertEquals("ho chi minh", VnAddressDirectoryService.normalize("Thành phố Hồ Chí Minh"));
    }

    @Test
    void retainsHamletWhileReplacingAdministrativeSuffix() {
        assertEquals("Thôn Xuân Thanh Nam, Xã Phù Mỹ Đông, Tỉnh Gia Lai",
                VnAddressDirectoryService.reconstruct(
                        "Thôn Xuân Thanh Nam, phu my dong, gia lai",
                        "phu my dong", "gia lai", "Xã Phù Mỹ Đông, Tỉnh Gia Lai"));
    }

    @Test
    void willNotRewriteWithoutUnambiguousAddressParts() {
        assertNull(VnAddressDirectoryService.reconstruct(
                "Thôn Xuân Thanh Nam Phù Mỹ Đông Gia Lai",
                "phu my dong", "gia lai", "Xã Phù Mỹ Đông, Tỉnh Gia Lai"));
        assertNull(VnAddressDirectoryService.reconstruct(
                "Thôn Xuân Thanh Nam, Phù Mỹ Đông, Bình Định",
                "phu my dong", "gia lai", "Xã Phù Mỹ Đông, Tỉnh Gia Lai"));
    }
}
