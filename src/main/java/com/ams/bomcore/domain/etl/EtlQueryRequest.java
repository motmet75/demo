package com.ams.bomcore.domain.etl;

import java.util.Collections;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;

/**
 * Request body for POST /sapi/bom/etl/query
 */
public class EtlQueryRequest {

    /** Raw SQL — only SELECT statements are accepted */
	@JsonProperty("params")
    @JsonSetter(nulls = Nulls.AS_EMPTY)
    private Map<String, Object> params = Collections.emptyMap();
	
	@JsonProperty("sql")
    private String sql;

    /**
     * Named parameter values matching :paramName placeholders in the SQL.
     * Example: { "bomId": 1, "companyId": 5 }
     */


	public EtlQueryRequest() {}

    public String getSql()                          { return sql; }
    public void   setSql(String sql)                { this.sql = sql; }

    public Map<String, Object> getParams()                          { return params; }
    public void                setParams(Map<String, Object> p)     {  this.params = (p != null) ? p : Collections.emptyMap(); }
}
