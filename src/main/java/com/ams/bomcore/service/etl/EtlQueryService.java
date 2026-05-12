package com.ams.bomcore.service.etl;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.sql.DataSource;

import org.springframework.stereotype.Service;

import com.ams.bomcore.domain.etl.EtlQueryRequest;
import com.ams.bomcore.domain.etl.EtlQueryResult;

/**
 * EtlQueryService
 * ────────────────────────────────────────────────────────────────
 * Executes read-only SELECT queries from the ETL runner page.
 *
 * Security model:
 *   • tenant_id and company_id are NEVER accepted from the client request.
 *     They are passed exclusively from EtlController (resolved from
 *     X-Tenant-Id / X-Company-Id headers or query params).
 *   • Any :tenant_id / :company_id tokens in the client SQL are stripped.
 *   • Any "tenant_id" / "company_id" keys in the client params map are removed.
 *   • The authoritative predicates are injected DIRECTLY into the SQL:
 *       - If the client SQL has a WHERE clause → append AND … to it
 *       - If it has no WHERE clause            → insert WHERE … before
 *         ORDER BY / GROUP BY / LIMIT / end-of-string
 *     This avoids subquery wrapping which breaks ORDER BY, table aliases,
 *     and column references in PostgreSQL.
 *
 * Other features:
 *   • Only SELECT statements accepted
 *   • Named :paramName placeholders → positional JDBC ?
 *   • Stacked statements (semicolons) rejected
 *   • Hard row cap (ETL_ROW_LIMIT) prevents runaway fetches
 *   • java.sql date/time types auto-converted to ISO strings
 *   • Column aliases honoured in result column names
 */
@Service
public class EtlQueryService {

    private static final int ETL_ROW_LIMIT = 5_000;

    /** Matches :paramName, excludes Postgres cast ::type */
    private static final Pattern PARAM_PATTERN =
            Pattern.compile("(?<!:):([A-Za-z_][A-Za-z0-9_]*)");

    /** Strips client-supplied tenant/company predicates */
    private static final Pattern STRIP_TENANT_PRED =
            Pattern.compile("(?i)\\bAND\\s+[\\w]*\\.?tenant_id\\s*=\\s*:\\w+");
    private static final Pattern STRIP_COMPANY_PRED =
            Pattern.compile("(?i)\\bAND\\s+[\\w]*\\.?company_id\\s*=\\s*:\\w+");

    /** Detects existing WHERE */
    private static final Pattern HAS_WHERE =
            Pattern.compile("(?i)\\bWHERE\\b");

    /**
     * Top-level trailing clauses — injection point when there is no WHERE.
     * Scanned at parenthesis depth 0 so subquery ORDER BY is not mistaken.
     */
    private static final Pattern TRAILING_CLAUSE =
            Pattern.compile(
                "(?i)\\b(ORDER\\s+BY|GROUP\\s+BY|HAVING|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT)\\b");

    /** Detects primary FROM alias: "FROM table alias" or "FROM table" */
    private static final Pattern FROM_ALIAS_PATTERN =
            Pattern.compile("(?i)\\bFROM\\s+([\\w.]+)(?:\\s+(?:AS\\s+)?([\\w]+))?");

    private final DataSource dataSource;

    public EtlQueryService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // ── public API ────────────────────────────────────────────────────────────

    public EtlQueryResult execute(EtlQueryRequest req, UUID tenantId, UUID companyId) throws Exception {

        if (tenantId == null || companyId == null) {
            throw new SecurityException("Tenant and company context is required.");
        }

        // 1. Remove any tenant/company keys the client may have sent in params
        Map<String, Object> clientParams = new HashMap<>(
                req.getParams() != null ? req.getParams() : new HashMap<>());
        clientParams.remove("tenant_id");
        clientParams.remove("company_id");

        // 2. Strip any tenant/company predicates embedded in the SQL
        String cleanSql = stripTenantPredicates(req.getSql());

        // 3. Validate
        validate(cleanSql, clientParams);

        // 4. Inject server-authoritative predicate directly into the SQL
        String securedSql = injectTenantPredicate(cleanSql);

        // 5. Merge server params (underscore-prefixed, unreachable by clients)
        Map<String, Object> finalParams = new HashMap<>(clientParams);
        finalParams.put("_tenant_id",  tenantId);
        finalParams.put("_company_id", companyId);

        // 6. Convert named params → positional JDBC ?
        List<Object> orderedValues = new ArrayList<>();
        String jdbcSql = convertNamedParams(securedSql, finalParams, orderedValues);

        try (Connection con = dataSource.getConnection()) {
            con.setReadOnly(true);
            try (PreparedStatement pst = con.prepareStatement(jdbcSql)) {
                pst.setMaxRows(ETL_ROW_LIMIT);
                for (int i = 0; i < orderedValues.size(); i++) {
                    Object val = orderedValues.get(i);
                    if (val instanceof String s && s.length() == 36) {
                        try { val = UUID.fromString(s); }
                        catch (IllegalArgumentException ignored) {}
                    }
                    pst.setObject(i + 1, val);
                }
                try (ResultSet rs = pst.executeQuery()) {
                    return mapResultSet(rs);
                }
            }
        }
    }

    // ── SQL injection helpers ─────────────────────────────────────────────────

    /**
     * Injects the tenant/company predicate directly into the SQL body.
     *
     * Case A — SQL already has WHERE:
     *   Appends "AND alias.tenant_id = :_tenant_id AND alias.company_id = :_company_id"
     *   just before the first top-level trailing clause (ORDER BY etc.) or end.
     *
     * Case B — SQL has no WHERE:
     *   Inserts "WHERE alias.tenant_id = :_tenant_id AND alias.company_id = :_company_id"
     *   just before the first top-level trailing clause or end.
     *
     * Examples produced:
     *   SELECT ... FROM material m ORDER BY m.material_code
     *   → SELECT ... FROM material m
     *     WHERE m.tenant_id = ? AND m.company_id = ?
     *     ORDER BY m.material_code
     *
     *   SELECT ... FROM material m JOIN bom b ON ... WHERE b.status = 'ACTIVE' ORDER BY ...
     *   → SELECT ... FROM material m JOIN bom b ON ... WHERE b.status = 'ACTIVE'
     *     AND m.tenant_id = ? AND m.company_id = ?
     *     ORDER BY ...
     */
    private String injectTenantPredicate(String sql) {
        String alias   = detectPrimaryAlias(sql);
        String prefix  = alias.isEmpty() ? "" : alias + ".";
        String pred    = prefix + "tenant_id = :_tenant_id"
                       + " AND " + prefix + "company_id = :_company_id";

        int insertAt   = findTopLevelTrailingClause(sql);
        String before  = sql.substring(0, insertAt).stripTrailing();
        String after   = insertAt < sql.length() ? "\n" + sql.substring(insertAt) : "";

        if (HAS_WHERE.matcher(before).find()) {
            return before + "\n  AND " + pred + after;
        } else {
            return before + "\nWHERE " + pred + after;
        }
    }

    /**
     * Returns the alias (or table name) of the primary FROM table.
     * "FROM material m"  → "m"
     * "FROM material"    → "material"
     * Falls back to empty string if detection fails.
     */
    private String detectPrimaryAlias(String sql) {
        Matcher m = FROM_ALIAS_PATTERN.matcher(sql);
        if (m.find()) {
            String alias = m.group(2);
            // Reject keywords that can follow the table name without being an alias
            if (alias != null && !alias.isBlank()) {
                String up = alias.toUpperCase();
                if (!up.equals("WHERE") && !up.equals("JOIN") && !up.equals("LEFT")
                        && !up.equals("RIGHT") && !up.equals("INNER") && !up.equals("OUTER")
                        && !up.equals("ON") && !up.equals("SET") && !up.equals("ORDER")
                        && !up.equals("GROUP") && !up.equals("HAVING") && !up.equals("LIMIT")) {
                    return alias.trim();
                }
            }
            // No alias — use bare table name (strip schema prefix)
            String table = m.group(1);
            if (table.contains(".")) {
                table = table.substring(table.lastIndexOf('.') + 1);
            }
            return table.trim();
        }
        return "";
    }

    /**
     * Finds the index of the first top-level trailing clause by scanning at
     * parenthesis depth 0 — subquery clauses are correctly skipped.
     * Returns sql.length() if none found.
     */
    private int findTopLevelTrailingClause(String sql) {
        int depth = 0;
        int len   = sql.length();
        for (int i = 0; i < len; i++) {
            char c = sql.charAt(i);
            if      (c == '(') { depth++; }
            else if (c == ')') { depth--; }
            else if (depth == 0) {
                Matcher m = TRAILING_CLAUSE.matcher(sql).region(i, len);
                m.useTransparentBounds(true);
                if (m.lookingAt()) {
                    return i;
                }
            }
        }
        return len;
    }

    private String stripTenantPredicates(String sql) {
        String s = STRIP_TENANT_PRED.matcher(sql).replaceAll("");
        s = STRIP_COMPANY_PRED.matcher(s).replaceAll("");
        return s.stripTrailing();
    }

    private void validate(String sql, Map<String, Object> clientParams) {
        if (sql == null || sql.isBlank()) {
            throw new IllegalArgumentException("SQL query must not be empty.");
        }
        if (!sql.stripLeading().toUpperCase().startsWith("SELECT")) {
            throw new SecurityException("Only SELECT statements are allowed in the ETL runner.");
        }
        if (sql.contains(";")) {
            throw new SecurityException("Semicolons (stacked statements) are not allowed.");
        }
        for (String key : clientParams.keySet()) {
            if (key.startsWith("_")) {
                throw new SecurityException("Parameter names starting with '_' are reserved.");
            }
        }
    }

    private String convertNamedParams(String sql,
                                      Map<String, Object> params,
                                      List<Object> orderedValues) {
        Matcher m = PARAM_PATTERN.matcher(sql);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String name = m.group(1);
            if (!params.containsKey(name)) {
                throw new IllegalArgumentException(
                        "Missing parameter value for :" + name + ". Add it to the Parameters JSON.");
            }
            orderedValues.add(params.get(name));
            m.appendReplacement(sb, "?");
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private EtlQueryResult mapResultSet(ResultSet rs) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        int colCount = meta.getColumnCount();
        List<String> columns = new ArrayList<>(colCount);
        for (int i = 1; i <= colCount; i++) {
            String label = meta.getColumnLabel(i);
            columns.add(label != null && !label.isBlank() ? label : meta.getColumnName(i));
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>(colCount * 2);
            for (int i = 1; i <= colCount; i++) {
                Object val = rs.getObject(i);
                if      (val instanceof java.sql.Timestamp ts) { val = ts.toLocalDateTime().toString(); }
                else if (val instanceof java.sql.Date d)        { val = d.toLocalDate().toString(); }
                else if (val instanceof java.sql.Time t)        { val = t.toLocalTime().toString(); }
                row.put(columns.get(i - 1), val);
            }
            rows.add(row);
        }
        return new EtlQueryResult(columns, rows);
    }
}