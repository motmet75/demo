package com.ams.bomcore.context;

/**
 * Thread-local holder for the currently authenticated username,
 * populated from the X-Username request header by ContextInterceptor.
 */
public class UserContext {
    private static final ThreadLocal<String> current = new ThreadLocal<>();

    public static void setUsername(String username) { current.set(username); }
    public static String getUsername() { return current.get(); }
    public static String getUsernameOrDefault() {
        String u = current.get();
        return (u != null && !u.isBlank()) ? u : "system";
    }
    public static void clear() { current.remove(); }
}
