package com.ams.bomcore.service.portalcontent;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PortalFacebookGroupServiceTest {
    private static PortalFacebookGroupService.Parsed ok(String line) {
        var p = PortalFacebookGroupService.parseLine(line);
        assertNull(p.error(), line + " -> " + p.error());
        return p;
    }

    @Test
    void acceptsTheUsualWaysPeopleCopyAGroupLink() {
        assertEquals("noithatgiare", ok("https://www.facebook.com/groups/noithatgiare/").slug());
        assertEquals("1234567890123", ok("https://m.facebook.com/groups/1234567890123/permalink/99/?ref=share").slug());
        assertEquals("abc.def", ok("facebook.com/groups/abc.def?mibextid=xyz").slug());
        assertEquals("abc", ok("web.facebook.com/groups/abc").slug());
        assertEquals("1234567890", ok("1234567890").slug());
        assertEquals("abc", ok("groups/abc").slug());
    }

    @Test
    void takesTheNameAroundTheLink() {
        assertEquals("Nội thất giá rẻ", ok("Nội thất giá rẻ | https://www.facebook.com/groups/noithat").name());
        assertEquals("Hội mua bán", ok("https://facebook.com/groups/123456789 - Hội mua bán").name());
        assertEquals("", ok("<https://facebook.com/groups/abc>").name());
    }

    @Test
    void refusesLinksThatAreNotAGroup() {
        assertNotNull(PortalFacebookGroupService.parseLine("https://evil.com/groups/abc").error());
        assertNotNull(PortalFacebookGroupService.parseLine("https://facebook.com.evil.com/groups/abc").error());
        assertNotNull(PortalFacebookGroupService.parseLine("https://www.facebook.com/somepage").error());
        assertNotNull(PortalFacebookGroupService.parseLine("https://www.facebook.com/groups/feed/").error());
        assertTrue(PortalFacebookGroupService.parseLine("https://www.facebook.com/share/g/1AbCd/").error().startsWith("Share link"));
        assertNotNull(PortalFacebookGroupService.parseLine("chỉ có chữ").error());
        assertNotNull(PortalFacebookGroupService.parseLine("https://www.facebook.com/groups/a'b;drop/").error());
    }

    @Test
    void sameGroupMatchingAndIds() {
        String word = PortalFacebookGroupService.sameGroupRegex("abc.def");
        assertTrue("https://www.facebook.com/groups/abc.def".matches(word));
        assertTrue("facebook.com/groups/abc.def".matches(word));
        assertTrue(!"abc.def".matches(word));                    // a bare word may be a real username
        assertTrue(!"https://www.facebook.com/groups/abcxdef".matches(word));
        String numeric = PortalFacebookGroupService.sameGroupRegex("1234567");
        assertTrue("1234567".matches(numeric) && "https://m.facebook.com/groups/1234567".matches(numeric));
        assertEquals("fb-noi-that-gia-re-dep", PortalFacebookGroupService.groupStringId("Nội thất giá rẻ & đẹp"));
    }
}
