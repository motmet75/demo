package com.anhmedia.portalweb.legacy.entity;

import com.anhmedia.portalweb.legacy.Utilities;

/** Port of legacy Language (model attribute "languages"). */
public class Language {
    private String langId;
    private String langName;
    private int sequence;
    private boolean selected;

    public Language(String id, String name, String seq) {
        this.langId = Utilities.ValidateInputValue(id);
        this.langName = Utilities.ValidateInputValue(name);
        this.sequence = Integer.valueOf(seq);
    }

    public boolean isSelected() { return selected; }
    public void setSelected(boolean selected) { this.selected = selected; }
    public boolean isSeleted() { return selected; }
    public boolean getSeleted() { return selected; }
    public String getLangId() { return langId; }
    public String getLangName() { return langName; }
    public int getSequence() { return sequence; }

    @Override
    public String toString() { return "Language [id=" + langId + "]"; }
}
