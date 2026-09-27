package com.ams.bomcore.audit;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;

public final class AuditActor {
    private AuditActor() {}
    public static String username() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) return auth.getName();
        return RequestContextHolder.getRequestAttributes() == null ? "system" : "anonymous";
    }
}
