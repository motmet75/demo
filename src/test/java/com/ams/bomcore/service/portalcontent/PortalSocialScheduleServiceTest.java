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

    @Test
    void repeatRoundsShiftTheWholeGroup() {
        LocalDateTime at = LocalDateTime.of(2026, 11, 28, 9, 30);
        assertEquals(at, PortalSocialScheduleService.shift(at, 0, 7, "DAYS"));
        assertEquals(at.plusDays(14), PortalSocialScheduleService.shift(at, 2, 7, "DAYS"));
        assertEquals(at.plusHours(12), PortalSocialScheduleService.shift(at, 3, 4, "HOURS"));
        assertEquals(at.plusWeeks(3), PortalSocialScheduleService.shift(at, 3, 1, "WEEKS"));
    }
}
