package com.anhmedia.portalweb.legacy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Emulates the legacy request-wide Hibernate persistence context
 * (open-session-in-view): within one request, loading a row whose entity is
 * already loaded returns the SAME object, and its in-memory state (mutated
 * by setters such as setHostString / setArticleThumnailURL /
 * setProductImageDesUrl) is NOT refreshed from the row. Templates depend on
 * that sharing, e.g. the home "page" article gets the tenant host because the
 * same instance is later loaded again by getAllDisplayedArticle("page").
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PersistenceContext extends OncePerRequestFilter {
    private static final ThreadLocal<Map<String, Object>> CONTEXT = new ThreadLocal<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Map<String, Object> previous = CONTEXT.get();
        CONTEXT.set(new HashMap<>());
        try {
            chain.doFilter(request, response);
        } finally {
            if (previous == null) CONTEXT.remove(); else CONTEXT.set(previous);
        }
    }

    public interface Loader<T> { T load() throws java.sql.SQLException; }

    /** The managed instance for (type, id), loading it only when this request has not seen it. */
    @SuppressWarnings("unchecked")
    public static <T> T managed(Class<T> type, Object id, Loader<T> loader) throws java.sql.SQLException {
        Map<String, Object> context = CONTEXT.get();
        if (context == null || id == null) return loader.load(); // outside a web request (tests)
        String key = type.getName() + "#" + id;
        Object existing = context.get(key);
        if (existing != null) return (T) existing;
        T loaded = loader.load();
        context.put(key, loaded);
        return loaded;
    }
}
