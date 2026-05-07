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
 * Features:
 *   • Only SELECT statements accepted (enforced before execution)
 *   • Named :paramName placeholders → positional JDBC ?
 *   • Stacked statements (semicolons) rejected
 *   • Hard row cap (ETL_ROW_LIMIT) prevents runaway fetches
 *   • java.sql date/time types auto-converted to ISO strings
 *   • Column aliases honoured in result column names
 */
@Service
public class EtlQueryService {

    /** Maximum rows returned — raise if needed, keep it bounded */
    private static final int ETL_ROW_LIMIT = 5_000;

    /**
     * Matches :paramName — a colon followed by an identifier.
     * Negative lookbehind (?<!:) excludes Postgres cast syntax (::type).
     */
    private static final Pattern PARAM_PATTERN =
            Pattern.compile("(?<!:):([A-Za-z][A-Za-z0-9_]*)");

    private final DataSource dataSource;

    public EtlQueryService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // ── public API ────────────────────────────────────────────────────────────

    public EtlQueryResult execute(EtlQueryRequest req) throws Exception {
        String rawSql = req.getSql();
        Map<String, Object> params = req.getParams() != null ? req.getParams() : new HashMap<>();

        // 1. Mandatory Parameter Validation
        if (!params.containsKey("tenant_id") || !params.containsKey("company_id")) {
            throw new IllegalArgumentException("Missing mandatory parameters: tenant_id and company_id are required.");
        }

        validate(rawSql);

        List<Object> orderedValues = new ArrayList<>();
        String jdbcSql = convertNamedParams(rawSql, params, orderedValues);

        try (Connection con = dataSource.getConnection()) {
            con.setReadOnly(true);
            try (PreparedStatement pst = con.prepareStatement(jdbcSql)) {
                pst.setMaxRows(ETL_ROW_LIMIT);

                for (int i = 0; i < orderedValues.size(); i++) {
                    Object val = orderedValues.get(i);

                    // 2. Fix 400 Error: Convert String UUIDs to java.util.UUID
                    if (val instanceof String && ((String) val).length() == 36) {
                        try {
                            val = java.util.UUID.fromString((String) val);
                        } catch (IllegalArgumentException ignored) {}
                    }

                    pst.setObject(i + 1, val);
                }

                try (ResultSet rs = pst.executeQuery()) {
                    return mapResultSet(rs);
                }
            }
        }
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private void validate(String sql) {
        if (sql == null || sql.isBlank()) {
            throw new IllegalArgumentException("SQL query must not be empty.");
        }
        String upper = sql.stripLeading().toUpperCase();
        if (!upper.startsWith("SELECT")) {
            throw new SecurityException("Only SELECT statements are allowed in the ETL runner.");
        }
        if (sql.contains(";")) {
            throw new SecurityException("Semicolons (stacked statements) are not allowed.");
        }
    }

    /**
     * Replaces all :paramName tokens with positional ? placeholders.
     * The same :paramName may appear multiple times — each occurrence
     * adds an entry to orderedValues.
     */
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

        // Build column name list — prefer alias (getColumnLabel) over physical name
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
                // Normalise java.sql date/time → ISO strings for clean JSON
                if      (val instanceof java.sql.Timestamp ts) {
					val = ts.toLocalDateTime().toString();
				} else if (val instanceof java.sql.Date d) {
					val = d.toLocalDate().toString();
				} else if (val instanceof java.sql.Time t) {
					val = t.toLocalTime().toString();
				}
                row.put(columns.get(i - 1), val);
            }
            rows.add(row);
        }
        return new EtlQueryResult(columns, rows);
    }
}
