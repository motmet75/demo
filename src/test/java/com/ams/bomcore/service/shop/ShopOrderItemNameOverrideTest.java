package com.ams.bomcore.service.shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/**
 * Order-draft compatibility: name changes must survive the JSON->ItemRequest
 * round trip before a cached draft is confirmed.
 */
class ShopOrderItemNameOverrideTest {
    @Test
    void customNameAndSpecsReachOrderRequestWithoutChangingModelId() throws Exception {
        String json = """
                {"modelId":"00000000-0000-0000-0000-000000000001",
                 "quantity":2,"unitPriceOverride":28000,
                 "displayNameOverride":"Cà phê sữa size L",
                 "itemNotes":"Ít đá, không đường","sideItems":[]}
                """;
        var item = new ObjectMapper().readValue(json, ShopOrderService.ItemRequest.class);
        assertEquals("00000000-0000-0000-0000-000000000001", item.modelId().toString());
        assertEquals("Cà phê sữa size L", item.displayNameOverride());
        assertEquals("Ít đá, không đường", item.itemNotes());
        assertEquals(28000, item.unitPriceOverride().intValue());
    }

    @Test
    void olderDraftWithoutOverrideKeepsMenuNameAsFallback() throws Exception {
        var item = new ObjectMapper().readValue(
                "{\"modelId\":\"00000000-0000-0000-0000-000000000002\",\"quantity\":1}",
                ShopOrderService.ItemRequest.class);
        assertNull(item.displayNameOverride());
    }
}
