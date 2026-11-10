package com.ams.bomcore.service.inventory;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CustomsLandedCostCalculatorTest {
    private static BigDecimal d(String s) { return new BigDecimal(s); }
    private static CustomsDeclarationExcelParser.Item imported() {
        return new CustomsDeclarationExcelParser.Item(
                0,"39249090","Plastic goods",d("400"),"PCE",
                d("0.7575"),"USD","CN",d("303"),
                d("6941730"),d("22"),d("1527180.6"),
                d("8468910.6"),d("10"),d("846891"),
                d("17354.325"),"A","VB901",null,null,null);
    }

    @Test void original2021TaxAmountsBecomeAuditedVndWarehouseUnitPrice() {
        var c=CustomsLandedCostCalculator.calculate(imported(),d("400"),
                null,null,d("0"),false,d("10"));
        assertEquals("CUSTOMS_TAXABLE_PROXY",c.goodsValueSource());
        assertEquals(0,c.importDutyVnd().compareTo(d("1527180.6")));
        assertEquals(0,c.importVatVnd().compareTo(d("846891")));
        assertEquals(0,c.totalVnd().compareTo(d("9315801.6")));
        assertEquals(0,c.stockUnitVnd().compareTo(d("23289.504")));
        assertEquals(0,c.foreignInvoiceValue().compareTo(d("303")));
    }

    @Test void recoverableImportVatStillStoredButExcludedFromCost() {
        var c=CustomsLandedCostCalculator.calculate(imported(),d("800"),
                null,null,d("200000"),true,d("10"));
        assertEquals(0,c.importVatVnd().compareTo(d("846891")));
        assertEquals(0,c.totalVnd().compareTo(d("8668910.6")));
        assertEquals(0,c.stockUnitVnd().compareTo(d("10836.13825")));
        assertEquals("USD",imported().currency());
    }

    @Test void purchaseValueCanBeCalculatedFromHistoricalFxWhenCustomsValueMissing() {
        var item= new CustomsDeclarationExcelParser.Item(
                0,"39249090","Canadian product",d("2"),"PCE",d("100"),"CAD",
                "CA",d("200"),null,d("0"),d("0"),d("3800000"),d("10"),
                d("380000"),null,"","",null,null,null);
        var c=CustomsLandedCostCalculator.calculate(item,d("2"),
                null,d("19000"),d("100000"),false,d("10"));
        assertEquals("INVOICE_HISTORICAL_FX",c.goodsValueSource());
        assertEquals(0,c.totalVnd().compareTo(d("4280000")));
        assertEquals(0,c.stockUnitVnd().compareTo(d("2140000")));
    }

    @Test void customsVatIsRecomputedOnlyWhenUserChangesOriginalRate() {
        var c=CustomsLandedCostCalculator.calculate(imported(),d("400"),
                null,null,d("0"),false,d("8"));
        assertEquals(0,c.importVatVnd().compareTo(d("677512.85")));
    }

    @Test void failsClosedWhenOriginalDutyOrVatIsUnavailable() {
        var item=new CustomsDeclarationExcelParser.Item(
                0,"39249090","Incomplete",d("1"),"PCE",d("1"),"CAD",
                "CA",d("1"),null,null,null,null,null,null,
                null,"","",null,null,null);
        assertThrows(IllegalArgumentException.class,()->CustomsLandedCostCalculator.calculate(
                item,d("1"),d("20000"),null,d("0"),false,null));
    }

    @Test void cannotPostWithNoVndBaseOrBadQuantity() {
        assertThrows(IllegalArgumentException.class,()->CustomsLandedCostCalculator.calculate(
                imported(),d("0"),null,null,d("0"),false,d("10")));
        assertThrows(IllegalArgumentException.class,()->CustomsLandedCostCalculator.calculate(
                imported(),d("400"),d("-1"),null,d("0"),false,d("10")));
    }
}
