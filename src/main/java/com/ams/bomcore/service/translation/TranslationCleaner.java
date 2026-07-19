package com.ams.bomcore.service.translation;

import java.util.regex.Pattern;

public final class TranslationCleaner {

    private static final Pattern MARKDOWN_FENCE = Pattern.compile("^```(?:\\w+)?\\s*|\\s*```$", Pattern.CASE_INSENSITIVE);
    private static final Pattern LEADING_LABEL = Pattern.compile("(?is)^\\s*(translation|translated text|result)\\s*[:：]\\s*");

    private TranslationCleaner() {
    }

    public static String cleanTrainingPattern(String value) {
        if (value == null) return "";
        String cleaned = MARKDOWN_FENCE.matcher(value.trim()).replaceAll("").trim();
        return LEADING_LABEL.matcher(cleaned).replaceFirst("").trim();
    }
}
