package com.ams.bomcore.service.inventory;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

class CustomsTariffBridgeServiceTest {
    private final CustomsTariffBridgeService service =
            new CustomsTariffBridgeService("https://portal.tuonghoa-imex.com",
                    "test_tariff_bridge_token_32_chars_long");

    @Test
    void validMissingHsWithHttp200DoesNotBecomeSuccessfulTaxLookup() {
        Map<String,Object> payload=Map.of(
                "hsCode","39269099",
                "status","NOT_FOUND",
                "code","HS_NOT_FOUND",
                "message","Mã HS 39269099 chưa có trong bảng bieuthueTB của Portal");
        Map<String,Object> result=service.interpretPortalResult("39269099",payload);
        assertEquals("NOT_FOUND",result.get("status"));
        assertEquals("39269099",result.get("hsCode"));
        assertFalse(result.containsKey("fta"));
        assertFalse(result.containsKey("mfn"));
    }

    @Test
    void actualFoundHsStillPreservesRates() {
        Map<String,Object> payload=Map.of(
                "hsCode","76169990",
                "mfn","15", "vat","10",
                "fta",Map.of("ACFTA","5"),
                "matchMethod","EXACT");
        Map<String,Object> result=service.interpretPortalResult("76169990",payload);
        assertEquals("OK",result.get("status"));
        assertEquals("15",result.get("mfn"));
        assertEquals(Map.of("ACFTA","5"),result.get("fta"));
    }

    @Test
    void inconsistentOrIncompleteSuccessIsNotTreatedAsZeroPercentTax() {
        Map<String,Object> result=service.interpretPortalResult("39269099",Map.of(
                "hsCode","39269099", "status","NOT_FOUND", "code","OTHER_ERROR"));
        assertEquals("UPSTREAM_ERROR",result.get("status"));
        assertEquals("MISMATCH",service.interpretPortalResult("39269099",Map.of(
                "hsCode","76169990","mfn","0","vat","10","fta",Map.of())).get("status"));
    }

    @Test
    void realNotFoundFromPortalIsRecognizedOnlyWithStructuredCode() {
        String body = """
                {"code":"HS_NOT_FOUND","hsCode":"39249090",
                 "message":"Mã HS 39249090 không có trong biểu thuế Portal"}
                """;
        Map<String,Object> result=service.classifyPortal404("39249090", body);
        assertEquals("NOT_FOUND", result.get("status"));
        assertTrue(String.valueOf(result.get("message")).contains("39249090"));
    }

    @Test
    void anNginx404IsNotMislabeledAsMissingTariffCode() {
        Map<String,Object> result=service.classifyPortal404("39249090",
                "<html><body>404 Not Found</body></html>");
        assertEquals("PORTAL_API_NOT_FOUND",result.get("status"));
        assertTrue(String.valueOf(result.get("message")).contains("Nginx"));
    }

    @Test
    void staleOrMismatchedResponseIsNotTrustedAsNotFound() {
        Map<String,Object> result=service.classifyPortal404("39249090",
                "{\"code\":\"HS_NOT_FOUND\",\"hsCode\":\"39249091\"}");
        assertEquals("PORTAL_API_NOT_FOUND",result.get("status"));
    }

    @Test
    void unstructuredLegacy404IsNotDefinitiveMissingTariffEvidence() {
        Map<String,Object> result=service.classifyPortal404("39249090",
                "{\"message\":\"Not Found\"}");
        assertEquals("PORTAL_API_NOT_FOUND",result.get("status"));
    }
}
