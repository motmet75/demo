package com.anhmedia.portalweb.legacy.entity;

import com.anhmedia.portalweb.legacy.Utilities;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;

/** Port of legacy Client (table ClientTB). */
public class Client {
    private long id = 0;
    private String clientCode = "";
    private String clientName = "";
    private String clientTaxCode = "";
    private String clientBanner = "";
    private String clientLogo = "";
    private String clientBannerText = "";
    private String clientDescription = "";
    private String clientPhone = "";
    private String clientMail = "";
    private String clientAddress = "";
    private String clientMapEmbeded = "";
    private String clientLangStringId = "";
    private LocalDateTime createdTime = LocalDateTime.now();
    private LocalDateTime modifiedTime = LocalDateTime.now();
    private boolean visible = true;
    private boolean approved = false;
    private boolean locked = false;

    public static Client fromRow(ResultSet rs) throws SQLException {
        Client c = new Client();
        c.id = rs.getLong("id");
        c.clientCode = rs.getString("clientcode");
        c.clientName = rs.getString("clientname");
        c.clientTaxCode = rs.getString("clienttaxcode");
        c.clientBanner = rs.getString("clientbanner");
        c.clientLogo = rs.getString("clientlogo");
        c.clientBannerText = rs.getString("clientbannertext");
        c.clientDescription = rs.getString("clientdescription");
        c.clientPhone = rs.getString("clientphone");
        c.clientMail = rs.getString("clientmail");
        c.clientAddress = rs.getString("clientaddress");
        c.clientMapEmbeded = rs.getString("clientmapembeded");
        c.clientLangStringId = rs.getString("clientlangstringid");
        c.createdTime = Article.time(rs, "createdtime");
        c.modifiedTime = Article.time(rs, "modifiedtime");
        c.visible = rs.getBoolean("isvisible");
        c.approved = rs.getBoolean("isapproved");
        c.locked = rs.getBoolean("islocked");
        return c;
    }

    public long getId() { return id; }
    public String getClientCode() { return clientCode == null ? "" : Utilities.GetBackStringValue(clientCode); }
    public String getClientName() { return clientName == null ? "" : Utilities.GetBackStringValue(clientName); }
    public String getClientBanner() { return clientBanner; }
    public String getClientTaxCode() { return clientTaxCode == null ? "" : Utilities.GetBackStringValue(clientTaxCode); }
    public String getClientDescription() { return clientDescription == null ? "" : Utilities.GetBackStringValue(clientDescription); }
    public String getClientPhone() { return clientPhone == null ? "" : Utilities.GetBackStringValue(clientPhone); }
    public String getClientMail() { return clientMail == null ? "" : Utilities.GetBackStringValue(clientMail); }
    public String getClientAddress() { return clientAddress == null ? "" : Utilities.GetBackStringValue(clientAddress); }
    public String getClientMapEmbeded() { return clientMapEmbeded == null ? "" : Utilities.GetBackStringValue(clientMapEmbeded); }
    public String getClientLogo() { return clientLogo; }
    public String getClientBannerText() { return clientBannerText; }
    public LocalDateTime getCreatedTime() { return createdTime; }
    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public boolean isVisible() { return visible; }
    public boolean isApproved() { return approved; }
    public boolean isLocked() { return locked; }
    public String getClientLangStringId() { return clientLangStringId; }
}
