package com.anhmedia.portalweb.legacy.entity;

import com.anhmedia.portalweb.legacy.Utilities;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Port of legacy WebMenu (table menuTB). */
public class WebMenu {
    private long id = 0;
    private String menuStringId = String.valueOf(System.currentTimeMillis());
    private String menuRootStringId = "root";
    private String menuName = "none";
    private String path = "none";
    private String language = "vi";
    private String index = "0";
    private String external = "local";
    private List<WebMenu> subItems = new ArrayList<>();
    private LocalDateTime createdTime = LocalDateTime.now();
    private LocalDateTime modifiedTime = LocalDateTime.now();
    private boolean approved = true;
    private boolean locked = false;
    private boolean visible = true;
    private WebMenu rootMenu;

    public static WebMenu fromRow(ResultSet rs) throws SQLException {
        WebMenu m = new WebMenu();
        m.id = rs.getLong("id");
        m.menuStringId = rs.getString("menustringid");
        m.menuRootStringId = rs.getString("menurootstringid");
        m.menuName = rs.getString("menuname");
        m.path = rs.getString("path");
        m.language = rs.getString("language");
        m.index = rs.getString("index");
        m.external = rs.getString("external");
        m.createdTime = Article.time(rs, "createdtime");
        m.modifiedTime = Article.time(rs, "modifiedtime");
        m.approved = rs.getBoolean("isapproved");
        m.locked = rs.getBoolean("islocked");
        m.visible = rs.getBoolean("isvisible");
        return m;
    }

    public long getId() { return id; }
    public String getMenuStringId() { return menuStringId == null ? "" : Utilities.GetBackStringValue(menuStringId); }
    public String getMenuRootStringId() { return menuRootStringId == null ? "" : Utilities.GetBackStringValue(menuRootStringId); }
    public String getMenuName() { return menuName == null ? "" : Utilities.GetBackStringValue(menuName); }
    public String getPath() { return path == null ? "" : Utilities.GetBackStringValue(path); }
    public String getLanguage() { return language == null ? "" : Utilities.GetBackStringValue(language); }
    public LocalDateTime getCreatedTime() { return createdTime; }
    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public boolean getApproved() { return approved; }
    public boolean getLocked() { return locked; }
    public boolean getVisible() { return visible; }
    public List<WebMenu> getSubItems() { return subItems; }
    public void setSubItems(List<WebMenu> subItems) { this.subItems = subItems; }
    public boolean isRoot() { return getMenuRootStringId().equals("root"); }
    public WebMenu getRootMenu() { return rootMenu; }
    public String getIndex() { return index; }
    public String getExternal() { return external; }

    /** Utilities.buildMenuTree: note it mutates subItems and is called once per request. */
    public static List<WebMenu> buildMenuTree(List<WebMenu> menuItems, String rootId) {
        List<WebMenu> tree = new ArrayList<>();
        for (WebMenu item : menuItems) {
            if ((rootId.equals("root") && item.getMenuRootStringId().equals("root"))
                    || (!rootId.equals("root") && rootId.equals(item.getMenuRootStringId()))) {
                item.getSubItems().addAll(buildMenuTree(menuItems, item.getMenuStringId()));
                tree.add(item);
            }
        }
        return tree;
    }
}
