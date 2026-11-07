package com.ams.bomcore.service.shop;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.math.BigDecimal;
import java.time.Year;
import java.time.ZoneId;
import java.util.Locale;
import org.junit.jupiter.api.Test;

class VinHoadonInvoiceSeriesTest {

    @Test
    void savesIndependentPosAndNormalSeries() {
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", "1", "C26MMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("NORMAL", "1", "C26TMC"));
        assertDoesNotThrow(() -> VinHoadonInvoiceService.validateTypedPair("POS", null, null));
        assertThrows(IllegalArgumentException.class,
                () -> VinHoadonInvoiceService.validateTypedPair("POS", "1", "C26TMC"));
        assertThrows(IllegalArgumentException.class,
                () -> VinHoadonInvoiceService.validateTypedPair("NORMAL", "1", "C26MMC"));
        assertThrows(IllegalArgumentException.class,
                () -> VinHoadonInvoiceService.validateTypedPair("POS", null, "C26MMC"));
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
        assertThrows(IllegalStateException.class,
                () -> VinHoadonInvoiceService.requireCurrentYear("C" + previousYear + "MMC"));
    }
}
