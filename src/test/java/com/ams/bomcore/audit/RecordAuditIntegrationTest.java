package com.ams.bomcore.audit;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="RUN_MARE_INTEGRATION",matches="true")
class RecordAuditIntegrationTest {
 @Test void transactionalHistoryUsesAuthenticatedActorAndResetsPooledContext() throws Exception {
  Properties p=new Properties();try(var in=Files.newInputStream(Path.of("src/main/resources/application.properties"))){p.load(in);}
  var config=new HikariConfig();config.setJdbcUrl(p.getProperty("spring.datasource.url"));config.setUsername(p.getProperty("spring.datasource.username"));config.setPassword(p.getProperty("spring.datasource.password"));config.setMaximumPoolSize(1);
  try(var pool=new HikariDataSource(config)) {
   var ds=new AuditDataSource(pool);
   var req=new MockHttpServletRequest();req.addHeader("X-Username","forged-user");req.addHeader("X-Tenant-Id","test-tenant");req.addHeader("X-Company-Id","test-company");
   RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(req));
   SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("audit-alice","unused",List.of()));
   try(var c=ds.getConnection()) {
    c.setAutoCommit(false);
    try(var s=c.createStatement()) {
     s.execute("CREATE TEMP TABLE audit_test_probe(id text,tenant_id text,company_id text,name text,quantity numeric,password text)");
     s.execute("CREATE TRIGGER probe_audit AFTER INSERT OR UPDATE OR DELETE ON audit_test_probe FOR EACH ROW EXECUTE FUNCTION app_audit_capture()");
     s.execute("INSERT INTO audit_test_probe VALUES('probe','test-tenant','test-company','test',2,'do-not-store')");
     s.execute("UPDATE audit_test_probe SET quantity=5 WHERE id='probe'");
     s.execute("UPDATE audit_test_probe SET quantity=5 WHERE id='probe'");
     s.execute("DELETE FROM audit_test_probe WHERE id='probe'");
     try(var r=s.executeQuery("SELECT actor,operation,before_data->>'quantity',after_data->>'quantity',COALESCE(after_data,before_data)->>'password' FROM app_record_audit WHERE table_name='audit_test_probe' ORDER BY id")) {
      assertTrue(r.next());assertEquals("audit-alice",r.getString(1));assertEquals("INSERT",r.getString(2));assertEquals("[REDACTED]",r.getString(5));
      assertTrue(r.next());assertEquals("UPDATE",r.getString(2));assertEquals("2",r.getString(3));assertEquals("5",r.getString(4));
      assertTrue(r.next());assertEquals("DELETE",r.getString(2));assertFalse(r.next(),"No-op update should not add history");
     }
     try(var r=s.executeQuery("SELECT app_audit_redact('{\"config_key\":\"smtp_password\",\"value\":\"secret\",\"nested\":{\"accessToken\":\"secret\"}}'::jsonb)::text")) {r.next();assertFalse(r.getString(1).contains("secret"));}
     var savepoint=c.setSavepoint();assertThrows(SQLException.class,()->s.execute("DELETE FROM app_record_audit WHERE table_name='audit_test_probe'"));c.rollback(savepoint);
     // Every current business table has a trigger, including direct JDBC shift operations and printing.
     for(String table:List.of("shop_order","inventory","inventory_movement","company","model_bom","shop_print_history","shop_counter_shift")) {
      try(var q=c.prepareStatement("SELECT count(*) FROM pg_trigger WHERE tgrelid=?::regclass AND tgname='app_record_audit_trigger'")) {q.setString(1,table);try(var r=q.executeQuery()){r.next();assertEquals(1,r.getInt(1),table);}}
     }
    } finally { c.rollback(); }
   }
   SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("audit-bob","unused",List.of()));
   try(var c=ds.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT current_setting('app.audit_user'),(SELECT count(*) FROM app_record_audit WHERE table_name='audit_test_probe')")) {r.next();assertEquals("audit-bob",r.getString(1));assertEquals(0,r.getInt(2),"Rolled-back changes must leave no audit history");}
   RequestContextHolder.resetRequestAttributes();SecurityContextHolder.clearContext();
   try(var c=ds.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT current_setting('app.audit_user'),current_setting('app.audit_tenant')")){r.next();assertEquals("system",r.getString(1));assertEquals("",r.getString(2));}
  } finally {RequestContextHolder.resetRequestAttributes();SecurityContextHolder.clearContext();}
 }
}
