package com.ams.bomcore.context;

public class TenantContext {
    private static final ThreadLocal<String> current = new ThreadLocal<>();

    public static void setTenantId(String id) { current.set(id); }
    public static String getTenantId() { return current.get(); }
    public static void clear() { current.remove(); }
}
