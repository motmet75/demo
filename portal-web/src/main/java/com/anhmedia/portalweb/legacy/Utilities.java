package com.anhmedia.portalweb.legacy;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.util.List;

/**
 * The subset of the legacy Portal "Utilities.Utilities" class that public
 * entities and page handlers call. Behaviour is copied line for line,
 * including quirks, so model values match Portal 8080 exactly.
 */
public final class Utilities {
    private static volatile ConfigXml config;

    private Utilities() {}

    static void init(ConfigXml configXml) { config = configXml; }

    static ConfigXml config() {
        ConfigXml c = config;
        if (c == null) throw new IllegalStateException("Legacy config.xml not initialised");
        return c;
    }

    public static String ValidateInputValue(String string) {
        if (string != null) {
            if (string.toLowerCase().indexOf("delete") != -1) {
                return string.replaceAll("delete", "del.ete_");
            }
            if (string.toLowerCase().indexOf("update") != -1) {
                return string.replaceAll("update", "up.date_");
            }
            return string;
        }
        return "";
    }

    public static String GetBackStringValue(String string) {
        if (string != null) {
            if (string.toLowerCase().indexOf("del.ete_") != -1 || string.toLowerCase().indexOf("up.date_") != -1) {
                if (string.toLowerCase().indexOf("del.ete_") != -1) {
                    return string.replaceAll("del.ete_", "delete");
                } else if (string.toLowerCase().indexOf("up.date_") != -1) {
                    return string.replaceAll("up.date_", "update");
                }
                return string;
            }
            return string;
        }
        return "";
    }

    public static String getConfig(String componentName) { return config().getConfig(componentName); }

    public static String getConfigByTenantAndLang(String componentName, String tenantId, String langCode) {
        return config().getConfigByTenantAndLang(componentName, tenantId, langCode);
    }

    public static List<String> getConfigListByTenant(String componentName, String tenantId) {
        return config().getConfigListByTenant(componentName, tenantId);
    }

    public static String getConfigValueByLanguage(String componentName, String languageCode) {
        return config().getConfigValueByLanguage(componentName, languageCode);
    }

    public static String getFileExtension(String fileName) {
        if (fileName == null) return "";
        int lastDotIndex = fileName.lastIndexOf(".");
        if (lastDotIndex == -1) return "";
        return fileName.substring(lastDotIndex + 1);
    }

    public static String doubleToStringCurrency(BigDecimal sell, String tenant, String langCode) {
        String formatedPriceString = "#,###.00";
        String getFormatedString = getConfigByTenantAndLang("priceFormat", tenant, langCode);
        if (getFormatedString != null) {
            formatedPriceString = getFormatedString;
        }
        DecimalFormat formatter = new DecimalFormat(formatedPriceString);
        String formattedAmount = formatter.format(sell);
        if ((langCode.equals("vn") || langCode.equals("vi")) && getFormatedString != null) {
            formattedAmount = formattedAmount.replace(",", ".");
        }
        if (sell.compareTo(BigDecimal.valueOf(1)) < 0) {
            return "";
        }
        return formattedAmount;
    }

    /** AppConfiguration.getHostbaseurl on Linux (the Windows dev branch is not reproduced). */
    public static String getHostbaseurl(String tenString) {
        if (tenString != null && !tenString.isBlank()) return "https://" + tenString;
        return "https://portal.tuonghoa-imex.com";
    }
}
