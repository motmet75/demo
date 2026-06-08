package com.ams.bomcore.util;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

/**
 * Builds a VietQR-compliant EMVCo/NAPAS246 QR payload.
 * Spec: https://vietqr.net/portal-service/download/documents/VietQR_TCH_v2.0.1.pdf
 */
public class VietQrBuilder {

    // NAPAS bank BIN prefix used in Merchant Account Information
    private static final String NAPAS_GUID = "A000000727";

    private VietQrBuilder() {}

    public static String build(String bankBin, String accountNumber, BigDecimal amount, String orderCode) {
        StringBuilder sb = new StringBuilder();

        // Tag 00 - Payload Format Indicator
        sb.append(tlv("00", "01"));

        // Tag 01 - Point of Initiation Method (12 = static, 11 = dynamic)
        sb.append(tlv("01", "12"));

        // Tag 38 - Merchant Account Information (NAPAS)
        String napasId = tlv("00", NAPAS_GUID) + tlv("01", bankBin) + tlv("02", accountNumber);
        sb.append(tlv("38", napasId));

        // Tag 52 - Merchant Category Code (0000 = generic)
        sb.append(tlv("52", "0000"));

        // Tag 53 - Transaction Currency (704 = VND)
        sb.append(tlv("53", "704"));

        // Tag 54 - Transaction Amount (omit decimals for VND)
        if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
            sb.append(tlv("54", amount.setScale(0, java.math.RoundingMode.HALF_UP).toPlainString()));
        }

        // Tag 58 - Country Code
        sb.append(tlv("58", "VN"));

        // Tag 62 - Additional Data (bill number = orderCode)
        String addData = tlv("01", orderCode);
        sb.append(tlv("62", addData));

        // Tag 63 - CRC (placeholder, calculated below)
        sb.append("6304");

        // Compute CRC16-CCITT (0xFFFF init, poly 0x1021)
        String payload = sb.toString();
        String crc = String.format("%04X", crc16(payload.getBytes(StandardCharsets.UTF_8)));
        return payload + crc;
    }

    private static String tlv(String tag, String value) {
        return tag + String.format("%02d", value.length()) + value;
    }

    private static int crc16(byte[] data) {
        int crc = 0xFFFF;
        for (byte b : data) {
            crc ^= (b & 0xFF) << 8;
            for (int i = 0; i < 8; i++) {
                if ((crc & 0x8000) != 0) crc = (crc << 1) ^ 0x1021;
                else crc <<= 1;
            }
        }
        return crc & 0xFFFF;
    }
}
