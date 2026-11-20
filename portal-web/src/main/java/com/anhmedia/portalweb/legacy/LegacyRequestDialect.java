package com.anhmedia.portalweb.legacy;

import org.springframework.stereotype.Component;
import org.thymeleaf.context.IExpressionContext;
import org.thymeleaf.context.IWebContext;
import org.thymeleaf.dialect.AbstractDialect;
import org.thymeleaf.dialect.IExpressionObjectDialect;
import org.thymeleaf.expression.IExpressionObjectFactory;

import java.util.Set;

/**
 * Thymeleaf 3.1 removed #httpServletRequest, which the legacy Portal
 * (Thymeleaf 3.0) templates/fragments.html still uses for its pagination
 * form: th:action="@{__${#httpServletRequest.requestURI}__}". This restores
 * only the read-only request URI, nothing else from the request.
 */
@Component
public class LegacyRequestDialect extends AbstractDialect implements IExpressionObjectDialect {
    private static final String NAME = "httpServletRequest";

    public LegacyRequestDialect() {
        super("portal-web-legacy-request");
    }

    public record RequestView(String requestURI) {
        public String getRequestURI() { return requestURI; }
    }

    @Override
    public IExpressionObjectFactory getExpressionObjectFactory() {
        return new IExpressionObjectFactory() {
            @Override
            public Set<String> getAllExpressionObjectNames() { return Set.of(NAME); }

            @Override
            public Object buildObject(IExpressionContext context, String expressionObjectName) {
                if (!NAME.equals(expressionObjectName) || !(context instanceof IWebContext web)) return null;
                // getRequestPath() = application (context) path + path within it = getRequestURI().
                return new RequestView(web.getExchange().getRequest().getRequestPath());
            }

            @Override
            public boolean isCacheable(String expressionObjectName) { return false; }
        };
    }
}
