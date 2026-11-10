package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Calculates warehouse VND cost from the ORIGINAL import declaration, not
 * today's tariff rates. Kept separate from VAT recoverability/bookkeeping.
 */
public final class CustomsLandedCostCalculator {
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private CustomsLandedCostCalculator() {}

    public record Cost(BigDecimal goodsValueVnd, String goodsValueSource,
                       BigDecimal foreignInvoiceValue, BigDecimal importDutyVnd,
                       BigDecimal importVatVnd, BigDecimal importVatRate,
                       BigDecimal additionalCostsVnd, boolean vatCreditable,
                       BigDecimal historicalFxRate, BigDecimal totalVnd,
                       BigDecimal declaredUnitVnd, BigDecimal stockUnitVnd) {}

    private static BigDecimal nonnegative(BigDecimal amount, String label) {
        if (amount == null || amount.signum() < 0 ||
                amount.compareTo(new BigDecimal("1000000000000000")) > 0)
            throw new IllegalArgumentException(label + " phải là số VND không âm hợp lệ.");
        return amount;
    }

    public static Cost calculate(CustomsDeclarationExcelParser.Item item,
            BigDecimal stockQuantity, BigDecimal reviewedGoodsValueVnd,
            BigDecimal historicalFxRate, BigDecimal additionalCostsVnd,
            boolean vatCreditable, BigDecimal selectedVatRate) {

        if (item == null || item.quantity() == null ||
                item.quantity().signum() <= 0 || stockQuantity == null ||
                stockQuantity.signum() <= 0)
            throw new IllegalArgumentException("Số lượng khai báo/kho không hợp lệ.");

        BigDecimal invoiceValue = item.invoiceValue();
        if (invoiceValue == null && item.unitPrice() != null)
            invoiceValue = item.unitPrice().multiply(item.quantity());
        if (invoiceValue != null) nonnegative(invoiceValue, "Trị giá hóa đơn gốc");

        BigDecimal goods;
        String source;
        if (reviewedGoodsValueVnd != null) {
            goods = nonnegative(reviewedGoodsValueVnd, "Trị giá hàng quy đổi VND");
            source = "REVIEWED_VND";
        } else if (invoiceValue != null && historicalFxRate != null &&
                historicalFxRate.signum() > 0) {
            goods = invoiceValue.multiply(historicalFxRate);
            source = "INVOICE_HISTORICAL_FX";
        } else if (item.importTaxableValueVnd() != null) {
            goods = nonnegative(item.importTaxableValueVnd(), "Trị giá tính thuế Hải quan");
            source = "CUSTOMS_TAXABLE_PROXY";
        } else {
            throw new IllegalArgumentException(
                "Thiếu giá trị hàng VND: nhập trị giá mua quy đổi hoặc tỷ giá ngày tờ khai.");
        }
        if (goods.signum() <= 0) throw new IllegalArgumentException("Giá trị hàng VND phải lớn hơn 0.");
        if (historicalFxRate != null &&
                (historicalFxRate.signum() <= 0 ||
                historicalFxRate.compareTo(new BigDecimal("100000000")) > 0))
            throw new IllegalArgumentException("Tỷ giá ngày tờ khai phải lớn hơn 0.");
        BigDecimal extras = additionalCostsVnd == null ? BigDecimal.ZERO :
                nonnegative(additionalCostsVnd, "Phí vận chuyển/thông quan");

        BigDecimal duty = item.importTaxAmountVnd();
        if (duty == null && item.importTaxableValueVnd() != null &&
                item.importTaxRate() != null) {
            duty = item.importTaxableValueVnd().multiply(item.importTaxRate())
                    .divide(ONE_HUNDRED, 4, RoundingMode.HALF_UP);
        }
        if (duty == null && item.importTaxRate() != null &&
                item.importTaxRate().signum() == 0) duty = BigDecimal.ZERO;
        if (duty == null) throw new IllegalArgumentException(
                "Tờ khai thiếu tiền thuế nhập khẩu gốc. Phải đối chiếu và bổ sung trước khi ghi giá vốn.");
        nonnegative(duty, "Thuế nhập khẩu");

        BigDecimal rate = selectedVatRate == null ? item.vatRate() : selectedVatRate;
        if (rate == null || rate.signum() < 0 || rate.compareTo(ONE_HUNDRED) > 0)
            throw new IllegalArgumentException("Thiếu hoặc sai thuế suất VAT nhập khẩu.");
        BigDecimal vat = null;
        if (item.vatAmountVnd() != null &&
                (selectedVatRate == null ||
                 item.vatRate() != null && item.vatRate().compareTo(rate) == 0)) {
            // Preserve the customs authority's original rounding.
            vat = item.vatAmountVnd();
        }
        if (vat == null && item.vatTaxableValueVnd() != null) {
            vat = item.vatTaxableValueVnd().multiply(rate)
                    .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
        }
        if (vat == null && rate.signum() == 0) vat = BigDecimal.ZERO;
        if (vat == null) throw new IllegalArgumentException(
                "Thiếu tiền VAT và trị giá tính VAT gốc. Không thể tự coi VAT bằng 0.");
        nonnegative(vat, "VAT nhập khẩu");

        BigDecimal landed = goods.add(duty).add(extras).add(
                vatCreditable ? BigDecimal.ZERO : vat);
        return new Cost(goods, source, invoiceValue, duty, vat, rate, extras,
                vatCreditable, historicalFxRate, landed,
                landed.divide(item.quantity(), 6, RoundingMode.HALF_UP),
                landed.divide(stockQuantity, 6, RoundingMode.HALF_UP));
    }
}
