package com.ams.bomcore.service.shop;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.math.BigDecimal;
import java.time.Year;
import java.time.ZoneId;
import java.util.Map;
import java.util.Locale;
import java.util.List;
import org.junit.jupiter.api.Test;

class VinHoadonInvoiceSeriesTest {

    @Test
    void savesIndependentPosAndNormalSeries() {
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", "1", "C26MMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("NORMAL", "1", "C26TMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", "1", "C26TBB"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", "2", "2C26MAM"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", "1", "C26TMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("NORMAL", "1", "C26MMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("NORMAL", "1", "CUSTOM"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", null, null));
        assertThrows(IllegalArgumentException.class,
                () -> VinHoadonInvoiceService.validateTypedPair("POS", null, "C26MMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", "1", "invalid"));
        assertThrows(IllegalArgumentException.class,
                () -> VinHoadonInvoiceService.validateTypedPair("POS", "1", "TOO-LONG-1"));
    }

    @Test
    void vatBasisSelectedPerInvoiceRecalculatesAmounts() {
        var included = VinHoadonInvoiceService.calculateVat(new BigDecimal("108000"), 8, true);
        assertEquals(0, included.subtotal().compareTo(new BigDecimal("100000")));
        assertEquals(0, included.tax().compareTo(new BigDecimal("8000")));
        assertEquals(0, included.total().compareTo(new BigDecimal("108000")));

        var excluded = VinHoadonInvoiceService.calculateVat(new BigDecimal("108000"), 8, false);
        assertEquals(0, excluded.subtotal().compareTo(new BigDecimal("108000")));
        assertEquals(0, excluded.tax().compareTo(new BigDecimal("8640")));
        assertEquals(0, excluded.total().compareTo(new BigDecimal("116640")));

        var noVat = VinHoadonInvoiceService.calculateVat(new BigDecimal("108000"), 0, false);
        assertEquals(0, noVat.tax().compareTo(BigDecimal.ZERO));
        assertEquals(0, noVat.total().compareTo(new BigDecimal("108000")));
    }

    @Test
    void issueRequiresCurrentRegisteredYear() {
        String thisYear = String.format(Locale.ROOT, "%02d", Year.now(ZoneId.of("Asia/Ho_Chi_Minh")).getValue() % 100);
        String previousYear = String.format(Locale.ROOT, "%02d", (Year.now(ZoneId.of("Asia/Ho_Chi_Minh")).getValue() - 1) % 100);
        assertDoesNotThrow(() -> VinHoadonInvoiceService.requireCurrentYear("C" + thisYear + "MMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.requireCurrentYear("2C" + thisYear + "MAM"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.requireCurrentYear("CUSTOM"));
        assertThrows(IllegalStateException.class,
                () -> VinHoadonInvoiceService.requireCurrentYear("C" + previousYear + "MMC"));
        assertThrows(IllegalStateException.class,
                () -> VinHoadonInvoiceService.requireCurrentYear("2C" + previousYear + "MAM"));
    }

    @Test
    void retryCanUseAFreshVendorInvoiceIdAfterDefinitiveFailure() {
        String first = VinHoadonInvoiceService.newExternalInvoiceId();
        String second = VinHoadonInvoiceService.newExternalInvoiceId();
        assertTrue(first.matches("^SO[0-9a-f]{32}$"));
        assertTrue(second.matches("^SO[0-9a-f]{32}$"));
        assertNotEquals(first, second);
        assertTrue(VinHoadonInvoiceService.canSwitchEnvironmentOnRetry("FAILED"));
        assertFalse(VinHoadonInvoiceService.canSwitchEnvironmentOnRetry("RECONCILE"));
        assertFalse(VinHoadonInvoiceService.canSwitchEnvironmentOnRetry("ISSUING"));
        assertTrue(VinHoadonInvoiceService.isConfirmedAbsentResult("11"));
        assertTrue(VinHoadonInvoiceService.isConfirmedAbsentResult("37"));
        assertFalse(VinHoadonInvoiceService.isConfirmedAbsentResult("01"));
        assertFalse(VinHoadonInvoiceService.isConfirmedAbsentResult(null));

        Map<String, Object> refreshed = VinHoadonInvoiceService.refreshFailedPayload(
                Map.of("ma_hoadon", first, "doanhnghiep_mst", "0401486901", "kyhieu", "C26MAM"),
                second, "0123456789");
        assertEquals(second, refreshed.get("ma_hoadon"));
        assertEquals("0123456789", refreshed.get("doanhnghiep_mst"));
        assertEquals("C26MAM", refreshed.get("kyhieu"));
    }

    @Test
    void submissionRequiresAnExactAnnouncedTemplatePair() {
        var announced = List.of(
                new VinHoadonInvoiceService.TemplateOption("2", "C26MTT", "POS"),
                new VinHoadonInvoiceService.TemplateOption("2", "C26TKT", "Normal"));

        assertTrue(VinHoadonInvoiceService.isAnnouncedTemplate(announced,
                new VinHoadonInvoiceService.TemplateOption("2", "C26MTT", null)));
        assertTrue(VinHoadonInvoiceService.isAnnouncedTemplate(announced,
                new VinHoadonInvoiceService.TemplateOption("2", "C26TKT", null)));
        assertFalse(VinHoadonInvoiceService.isAnnouncedTemplate(announced,
                new VinHoadonInvoiceService.TemplateOption("2", "C26MAM", null)));
        assertFalse(VinHoadonInvoiceService.isAnnouncedTemplate(announced,
                new VinHoadonInvoiceService.TemplateOption("1", "C26MTT", null)));
        assertFalse(VinHoadonInvoiceService.isAnnouncedTemplate(List.of(),
                new VinHoadonInvoiceService.TemplateOption("2", "C26MTT", null)));
    }
}
