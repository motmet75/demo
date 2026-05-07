package com.ams.bomcore.domain.etl;

import java.util.List;
import java.util.Map;

/**
 * Response payload for ETL query results.
 * Serialises cleanly to JSON consumed by ETLPage.jsx.
 *
 * Shape:
 * {
 *   "columns":  ["id", "code", "name", ...],
 *   "rows":     [ {"id": 1, "code": "M001", "name": "Steel"}, ... ],
 *   "rowCount": 42
 * }
 */
public class EtlQueryResult {

    /** Ordered column names (alias-aware) */
    private List<String> columns;

    /**
     * Each row is a LinkedHashMap preserving column order.
     * Value types: String | Integer | Long | Double | Boolean | null.
     * java.sql date/time types are pre-converted to ISO strings.
     */
    private List<Map<String, Object>> rows;

    /** Convenience count — matches rows.size() */
    private int rowCount;

    public EtlQueryResult() {}

    public EtlQueryResult(List<String> columns, List<Map<String, Object>> rows) {
        this.columns  = columns;
        this.rows     = rows;
        this.rowCount = rows == null ? 0 : rows.size();
    }

    public List<String>              getColumns()                      { return columns; }
    public void                      setColumns(List<String> c)        { this.columns = c; }

    public List<Map<String, Object>> getRows()                         { return rows; }
    public void                      setRows(List<Map<String, Object>> r) {
        this.rows     = r;
        this.rowCount = r == null ? 0 : r.size();
    }

    public int  getRowCount()               { return rowCount; }
    public void setRowCount(int rowCount)   { this.rowCount = rowCount; }
}
