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

    public static String appendResolutionToFilename(String fileName, String resolutionSuffix) {
        if (fileName.contains("_rslt_")) {
            fileName = fileName.replaceFirst("_rslt_.*(?=\\.)", "");
        }
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex == -1) {
            return fileName + resolutionSuffix;
        }
        String namePart = fileName.substring(0, dotIndex);
        String extension = fileName.substring(dotIndex);
        return namePart + resolutionSuffix + extension;
    }

    /** True when the URL is one of the tenant's own uploads (it has resized "_rslt_" variants). */
    public static boolean returnTenants(String tenantId, String Url) {
        if (tenantId == null || tenantId.isBlank() || Url == null || Url.isBlank()) return false;
        java.nio.file.Path dir = tenantRuntimePath;
        if (dir == null) return false;
        java.io.File[] tenantFiles = dir.toFile()
                .listFiles(file -> file.isFile() && file.getName().endsWith(".properties"));
        if (tenantFiles == null) return false;
        for (java.io.File propertyFile : tenantFiles) {
            java.util.Properties tenantProperties = new java.util.Properties();
            try (java.io.FileInputStream input = new java.io.FileInputStream(propertyFile)) {
                tenantProperties.load(input);
                String loadedTenantId = tenantProperties.getProperty("id");
                if (tenantId.equals(loadedTenantId) && Url.contains(tenantId)) return true;
            } catch (java.io.IOException e) {
                // removed or unreadable between listFiles() and open(): scan the rest
            }
        }
        return false;
    }

    public static <T> List<T> getPage(List<T> fullList, int pageNumber, int pageSize) {
        if (pageSize <= 0 || pageNumber <= 0) {
            throw new IllegalArgumentException("pageSize and pageNumber must be greater than 0");
        }
        int fromIndex = (pageNumber - 1) * pageSize;
        if (fromIndex >= fullList.size()) return List.of();
        int toIndex = Math.min(fromIndex + pageSize, fullList.size());
        return fullList.subList(fromIndex, toIndex);
    }

    private static volatile java.nio.file.Path tenantRuntimePath;

    static void initTenantRuntimePath(java.nio.file.Path path) { tenantRuntimePath = path; }

    /** AppConfiguration.getHostbaseurl on Linux (the Windows dev branch is not reproduced). */
    public static String getHostbaseurl(String tenString) {
        if (tenString != null && !tenString.isBlank()) return "https://" + tenString;
        return "https://portal.tuonghoa-imex.com";
    }
}
