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
