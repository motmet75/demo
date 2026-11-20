package com.anhmedia.portalweb.legacy.entity;

/** Port of GreetingController.LanguageOption (model attribute "languageOptions"). */
public class LanguageOption {
    private final String code;
    private final String name;
    private final String flagUrl;
    private final boolean selected;

    public LanguageOption(String code, String name, String flagUrl, boolean selected) {
        this.code = code;
        this.name = name;
        this.flagUrl = flagUrl;
        this.selected = selected;
    }

    public String getCode() { return code; }
    public String getName() { return name; }
    public String getFlagUrl() { return flagUrl; }
    public boolean isSelected() { return selected; }
}
