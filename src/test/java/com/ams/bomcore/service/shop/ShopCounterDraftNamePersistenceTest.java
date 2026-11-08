package com.ams.bomcore.service.shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.shop.ShopOrderItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ShopCounterDraftNamePersistenceTest {
    private static final UUID COFFEE_ID = UUID.fromString("00000000-0000-0000-0000-000000000011");
    private static final UUID OTHER_ID = UUID.fromString("00000000-0000-0000-0000-000000000012");

    private static ShopOrderService.ItemRequest orderLine(UUID id) {
        var item = new ShopOrderService.ItemRequest();
        item.setModelId(id);
        item.setQuantity(BigDecimal.ONE);
        item.setUnitPriceOverride(new BigDecimal("28000"));
        return item;
    }

    private static ShopOrderService.CreateOrderRequest draftRequest(ShopOrderService.ItemRequest item) {
        return new ShopOrderService.CreateOrderRequest(
                "DINE_IN", null, null, null, null, null, null, "CASH", null,
                List.of(item), null, null, null, null, null, null, null, null, null);
    }

    @Test
    void confirmationRetainsEditedNameAndSpecificationsFromDraftRows() {
        ShopOrderService.ItemRequest item = orderLine(COFFEE_ID);
        var draft = draftRequest(item);
        ShopOrderService.withCounterDraftLabels(draft, List.of(Map.of(
                "modelId", COFFEE_ID.toString(),
                "modelName", "Cà phê sữa - Size L",
                "itemNotes", "Ít đá / 500ml")));
        assertEquals(COFFEE_ID, item.modelId());
        assertEquals("Cà phê sữa - Size L", item.displayNameOverride());
        assertEquals("Ít đá / 500ml", item.itemNotes());
        assertEquals(28000, item.unitPriceOverride().intValue());
    }

    @Test
    void savedRedisDraftKeepsCustomNameThroughConfirmation() {
        var item = orderLine(COFFEE_ID);
        item.setDisplayNameOverride("Cà phê sữa - Size L");
        item.setItemNotes("Ly 500ml");
        var row = Map.<String,Object>of(
                "modelId", COFFEE_ID.toString(),
                "modelName", "Cà phê sữa - Size L",
                "itemNotes", "Ly 500ml");
        var original = new ShopOrderDraftCache.DraftView(
                "test-draft", UUID.randomUUID(), draftRequest(item),
                List.of(row), "staff", Instant.now());
        var stored = ShopOrderDraftCache.decode(ShopOrderDraftCache.encode(original)).orElseThrow();
        var confirmed = ShopOrderService.withCounterDraftLabels(stored.order(), stored.displayItems());
        var line = confirmed.items().get(0);
        assertEquals("Cà phê sữa - Size L", line.displayNameOverride());
        assertEquals("Ly 500ml", line.itemNotes());
        assertEquals(COFFEE_ID, line.modelId());
    }

    @Test
    void legacyDisplayNameInRedisDraftIsAcceptedAndPreserved() {
        var item = orderLine(COFFEE_ID);
        item.setDisplayNameOverride("Cà phê sữa - Size L");
        item.setItemNotes("Ít đá");
        var draft = new ShopOrderDraftCache.DraftView(
                "legacy-draft", UUID.randomUUID(), draftRequest(item),
                List.of(Map.of(
                        "modelId", COFFEE_ID.toString(),
                        "modelName", "Cà phê sữa - Size L",
                        "itemNotes", "Ít đá")),
                "staff", Instant.now());
        String canonical = ShopOrderDraftCache.encode(draft);
        String legacy = canonical.replace("\"displayNameOverride\":", "\"displayName\":");
        org.junit.jupiter.api.Assertions.assertNotEquals(canonical, legacy,
                "Test must use the legacy Redis field name");

        var decoded = ShopOrderDraftCache.decode(legacy).orElseThrow();
        assertEquals("Cà phê sữa - Size L", decoded.order().items().get(0).displayNameOverride());
        assertEquals("Ít đá", decoded.order().items().get(0).itemNotes());

        var confirmed = ShopOrderService.withCounterDraftLabels(
                decoded.order(), decoded.displayItems());
        assertEquals(COFFEE_ID, confirmed.items().get(0).modelId());
        assertEquals("Cà phê sữa - Size L",
                confirmed.items().get(0).displayNameOverride());

        String upgraded = ShopOrderDraftCache.encode(decoded);
        org.junit.jupiter.api.Assertions.assertTrue(upgraded.contains("\"displayNameOverride\":"));
        org.junit.jupiter.api.Assertions.assertFalse(upgraded.contains("\"displayName\":"));
    }

    @Test
    void legacyNameAliasAlsoWorksInSideItems() throws Exception {
        String json = """
                {"modelId":"00000000-0000-0000-0000-000000000011",
                 "quantity":1, "displayName":"Customized main item",
                 "sideItems":[{"modelId":"00000000-0000-0000-0000-000000000012",
                               "quantity":1, "displayName":"Customized topping"}]}
                """;
        var line = new com.fasterxml.jackson.databind.ObjectMapper().readValue(
                json, ShopOrderService.ItemRequest.class);
        assertEquals("Customized main item", line.displayNameOverride());
        assertEquals("Customized topping", line.sideItems().get(0).displayNameOverride());
    }

    @Test
    void redisDraftAcceptsBuyerIdentityNumberAndKeepsItAfterRoundTrip() {
        var line = orderLine(COFFEE_ID);
        var request = new ShopOrderService.CreateOrderRequest(
                "DINE_IN", null, "Test customer", null, null, null, null,
                "CASH", null, List.of(line), null, null, null, null,
                null, null, null, null, null, "TEST-ID-NOT-A-REAL-NUMBER");
        var draft = new ShopOrderDraftCache.DraftView("id-draft", UUID.randomUUID(), request,
                List.of(Map.of("modelId", COFFEE_ID.toString(), "modelName", "Custom label")),
                "test", Instant.now());

        var restored = ShopOrderDraftCache.decode(ShopOrderDraftCache.encode(draft)).orElseThrow();
        assertEquals("TEST-ID-NOT-A-REAL-NUMBER", restored.order().buyerIdentityNumber());
        assertEquals(COFFEE_ID, restored.order().items().get(0).modelId());

        String futureClientJson = ShopOrderDraftCache.encode(draft)
                .replace("\"buyerIdentityNumber\":\"TEST-ID-NOT-A-REAL-NUMBER\"",
                        "\"buyerIdentityNumber\":\"TEST-ID-NOT-A-REAL-NUMBER\","
                        + "\"optionalClientField\":\"should not break reading\"");
        var forwardsCompatible = ShopOrderDraftCache.decode(futureClientJson).orElseThrow();
        assertEquals("TEST-ID-NOT-A-REAL-NUMBER",
                forwardsCompatible.order().buyerIdentityNumber());
    }

    @Test
    void redisDraftWithoutBuyerIdentityNumberRemainsReadable() {
        var line = orderLine(COFFEE_ID);
        var draft = new ShopOrderDraftCache.DraftView(
                "old-draft", UUID.randomUUID(), draftRequest(line),
                List.of(Map.of("modelId", COFFEE_ID.toString(), "modelName", "Original")),
                "test", Instant.now());
        String json = ShopOrderDraftCache.encode(draft)
                .replace("\"buyerIdentityNumber\":null,", "")
                .replace(",\"buyerIdentityNumber\":null", "");
        var restored = ShopOrderDraftCache.decode(json).orElseThrow();
        assertNull(restored.order().buyerIdentityNumber());
        assertEquals(COFFEE_ID, restored.order().items().get(0).modelId());
    }

    @Test
    void confirmationWillNotApplyWrongMenuItemName() {
        ShopOrderService.ItemRequest item = orderLine(COFFEE_ID);
        ShopOrderService.withCounterDraftLabels(draftRequest(item), List.of(Map.of(
                "modelId", OTHER_ID.toString(),
                "modelName", "Wrong item")));
        assertNull(item.displayNameOverride());
    }

    @Test
    void responseDoesNotTranslateOriginalMenuNameOverCustomLineName() {
        Model model = new Model();
        model.setId(COFFEE_ID);
        model.setModelName("Cà phê sữa");
        model.setModelNameTranslations("{\"vi\":\"Cà phê sữa\",\"en\":\"Milk coffee\"}");
        ShopOrderItem item = new ShopOrderItem();
        item.setModel(model);
        item.setModelName("Cà phê sữa - Size L");
        var dto = ShopOrderResponseDto.ItemDto.from(item);
        assertEquals("Cà phê sữa - Size L", dto.getModelName());
        assertNull(dto.getModelNameTranslations());
        assertEquals(COFFEE_ID, dto.getModelId());
    }

    @Test
    void unmodifiedMenuItemStillUsesTranslations() {
        Model model = new Model();
        model.setId(COFFEE_ID);
        model.setModelName("Cà phê sữa");
        model.setModelNameTranslations("{\"en\":\"Milk coffee\"}");
        ShopOrderItem item = new ShopOrderItem();
        item.setModel(model);
        item.setModelName("Cà phê sữa");
        var dto = ShopOrderResponseDto.ItemDto.from(item);
        assertEquals("Cà phê sữa", dto.getModelName());
        assertEquals("{\"en\":\"Milk coffee\"}", dto.getModelNameTranslations());
    }
}
