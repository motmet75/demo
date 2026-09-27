package com.ams.bomcore.audit;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Reset audit context on every checkout, including pooled connections and background jobs. */
public class AuditDataSource extends DelegatingDataSource {
    public AuditDataSource(DataSource target) { super(target); }
    @Override public Connection getConnection() throws SQLException { return prepare(super.getConnection()); }
    @Override public Connection getConnection(String username, String password) throws SQLException { return prepare(super.getConnection(username,password)); }
    private Connection prepare(Connection connection) throws SQLException {
        var attrs = RequestContextHolder.getRequestAttributes();
        var request = attrs instanceof ServletRequestAttributes servlet ? servlet.getRequest() : null;
        try (var statement = connection.prepareStatement("SELECT set_config('app.audit_user', ?, false), set_config('app.audit_path', ?, false), set_config('app.audit_tenant', ?, false), set_config('app.audit_company', ?, false)")) {
            statement.setString(1, AuditActor.username());
            // No query strings, bodies, cookies or credentials are captured.
            statement.setString(2, request == null ? "" : request.getMethod()+" "+java.util.Objects.toString(request.getAttribute(org.springframework.web.servlet.HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE), "request"));
            statement.setString(3, request == null ? "" : value(request.getHeader("X-Tenant-Id")));
            statement.setString(4, request == null ? "" : value(request.getHeader("X-Company-Id")));
            statement.execute();
            return connection;
        } catch (SQLException e) { connection.close(); throw e; }
    }
    private String value(String value) { return value == null ? "" : value; }
}
