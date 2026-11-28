package com.ams.bomcore.service.portalcontent;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PortalSocialScheduleServiceTest {

    @Test
    void imageUrlsResolveLikeThePortal() {
        String raw = "https://cdn.example.com/a.jpg\n/image/b.png\nabc123.webp\nnone\n\n https://cdn.example.com/a.jpg ";
        assertEquals(List.of(
                "https://cdn.example.com/a.jpg",
                "https://shop.vn/image/b.png",
                "https://shop.vn/image/abc123.webp"), PortalSocialScheduleService.imageUrls(raw, "shop.vn"));
        assertTrue(PortalSocialScheduleService.imageUrls(null, "shop.vn").isEmpty());
        assertTrue(PortalSocialScheduleService.imageUrls("none", "shop.vn").isEmpty());
    }

    @Test
    void imageUrlsAreCapped() {
        String raw = String.join("\n", java.util.stream.IntStream.range(0, 50).mapToObj(i -> "img" + i + ".jpg").toList());
        assertEquals(PortalSocialScheduleService.MAX_IMAGES, PortalSocialScheduleService.imageUrls(raw, "shop.vn").size());
    }

    private static PortalSocialScheduleService.ProductContent product(String shortDes, String video) {
        return new PortalSocialScheduleService.ProductContent(7, "Mì gia truyền", "MGT01", "mi-gia-truyen",
                List.of("https://shop.vn/image/a.jpg"), shortDes, "Tường Hoa", "Thực phẩm", "Mì khô", video);
    }

    @Test
    void sequenceComposesLikeThePortal() {
        var campaigns = new PortalSocialScheduleService.Campaigns("#hashtag #sale", "Inbox để đặt hàng!");
        assertEquals("Sợi mì dai\nInbox để đặt hàng!\n#hashtag #sale #tường_hoa\nhttps://shop.vn/san-pham/mi-gia-truyen\nMGT01",
                PortalSocialScheduleService.buildMessage(product("Sợi mì dai", ""), "51267", campaigns, "shop.vn"));
        assertEquals("Mì gia truyền\nSợi mì dai #thực_phẩm\n#mì_khô",
                PortalSocialScheduleService.buildMessage(product("Sợi mì dai", ""), "034", campaigns, "shop.vn"));
        // Missing pieces are skipped; repeated digits never duplicate text.
        assertEquals("https://shop.vn/san-pham/mi-gia-truyen",
                PortalSocialScheduleService.buildMessage(product("", ""), "566",
                        new PortalSocialScheduleService.Campaigns("", ""), "shop.vn"));
    }

    @Test
    void videoIdIsReadFromProductVideoAdd() {
        assertEquals("x8abc12", PortalSocialScheduleService.videoId("https://www.dailymotion.com/embed?video=x8abc12&autoplay=1"));
        assertEquals("x8abc12", PortalSocialScheduleService.videoId("https://www.dailymotion.com/video/x8abc12"));
        assertEquals("x8abc12", PortalSocialScheduleService.videoId("https://dai.ly/x8abc12"));
        assertEquals("x8abc12", PortalSocialScheduleService.videoId("x8abc12"));
        assertEquals("", PortalSocialScheduleService.videoId("none"));
        assertEquals("", PortalSocialScheduleService.videoId("https://youtube.com/watch?v=abc"));
    }

    @Test
    void repeatRoundsShiftTheWholeGroup() {
        LocalDateTime at = LocalDateTime.of(2026, 11, 28, 9, 30);
        assertEquals(at, PortalSocialScheduleService.shift(at, 0, 7, "DAYS"));
        assertEquals(at.plusDays(14), PortalSocialScheduleService.shift(at, 2, 7, "DAYS"));
        assertEquals(at.plusHours(12), PortalSocialScheduleService.shift(at, 3, 4, "HOURS"));
        assertEquals(at.plusWeeks(3), PortalSocialScheduleService.shift(at, 3, 1, "WEEKS"));
    }
}
