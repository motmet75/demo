package com.demo.invoicedesk;

import java.nio.file.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.support.TransactionTemplate;

/** One-time administrator CLI. No web server or application startup hooks are run. */
public final class InvoiceDeskProvision {
 private InvoiceDeskProvision(){}
 public static void main(String[] args)throws Exception{
  if(args.length<4)throw new IllegalArgumentException("Usage: properties-file username tenant-uuid company-uuid [--apply] [email]. Password: INVOICE_INITIAL_PASSWORD environment or console.");
  Properties props=new Properties();try(var reader=Files.newBufferedReader(Path.of(args[0]))){props.load(reader);}
  String username=args[1];UUID tenant=UUID.fromString(args[2]),company=UUID.fromString(args[3]);boolean apply=Arrays.asList(args).contains("--apply");
  var ds=new DriverManagerDataSource(props.getProperty("spring.datasource.url"),props.getProperty("spring.datasource.username"),props.getProperty("spring.datasource.password"));
  var db=new JdbcTemplate(ds);
  var scope=db.queryForList("SELECT t.tenant_code,c.company_code FROM tenant t JOIN company c ON c.tenant_id=t.id WHERE t.id=? AND c.id=? AND t.is_active=true",tenant,company);
  if(scope.size()!=1)throw new IllegalArgumentException("Tenant/company is invalid or inactive.");
  var existing=db.queryForList("SELECT username,assignedtenantid,assignedcompanyid FROM usertb WHERE lower(username)=lower(?)",username);
  if(existing.size()>1)throw new IllegalStateException("Ambiguous case-insensitive username; administrator must resolve duplicates.");
  System.out.println("Scope: "+scope+"; account "+(existing.isEmpty()?"will be created":"exists; permissions will be restricted; password retained")+"; role: ROLE_INVOICE_DESK; apply="+apply);
  if(!apply)return;
  String initial=System.getenv("INVOICE_INITIAL_PASSWORD");
  if(existing.isEmpty()&&(initial==null||initial.isBlank())&&System.console()!=null){char[] chars=System.console().readPassword("Initial password: ");initial=new String(chars);Arrays.fill(chars,'\0');}
  if(existing.isEmpty()&&(initial==null||initial.length()<8))throw new IllegalArgumentException("Supply an initial password of at least eight characters using the environment or console.");
  String hash=existing.isEmpty()?new com.demo.security.SecurityConfig(null).passwordEncoder().encode(initial):null;
  String email=args.length>5?args[5]:username.toLowerCase(Locale.ROOT)+"@example.invalid";
  new TransactionTemplate(new DataSourceTransactionManager(ds)).executeWithoutResult(tx->{
   db.queryForObject("SELECT pg_advisory_xact_lock(hashtext(lower(?)))",Object.class,username);
   new ResourceDatabasePopulator(new ClassPathResource("db/schema/invoice_desk.sql"),new ClassPathResource("db/schema/invoice_desk_workspace.sql")).execute(ds);
   var mapping=db.queryForList("SELECT company_id FROM invoice_desk_company WHERE tenant_id=?",tenant);
   if(!mapping.isEmpty()&&!company.equals(mapping.get(0).get("company_id")))throw new IllegalArgumentException("This tenant is mapped to another Invoice Desk company; no data reassignment is allowed.");
   db.update("INSERT INTO invoice_desk_company(tenant_id,company_id) VALUES (?,?) ON CONFLICT(tenant_id) DO NOTHING",tenant,company);
   String canonical;
   if(existing.isEmpty()){
    if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM usertb WHERE lower(username)=lower(?))",Boolean.class,username)))throw new IllegalStateException("Account created concurrently. Run the command again.");
    db.update("INSERT INTO usertb(username,password,firstname,lastname,email,isaccountnonexpired,isaccountnonlocked,iscredentialsnonexpired,isenabled,assignedtenantid,assignedcompanyid,lasttenantid,lastcompanyid) VALUES (?,?,?,?,?,true,true,true,true,?,?,?,?)",username,hash,username,"Invoice Desk",email,tenant.toString(),company.toString(),tenant.toString(),company.toString());canonical=username;
   }else{canonical=existing.get(0).get("username").toString();db.update("UPDATE usertb SET isenabled=true,assignedtenantid=?,assignedcompanyid=?,lasttenantid=?,lastcompanyid=? WHERE username=?",tenant.toString(),company.toString(),tenant.toString(),company.toString(),canonical);}
   db.update("DELETE FROM authorities WHERE lower(username)=lower(?)",canonical);
   db.update("INSERT INTO authorities(username,authority,description,visible) VALUES (?,'ROLE_INVOICE_DESK','Invoice Desk only',true)",canonical);
   db.update("INSERT INTO invoice_desk_password_reset(username,initial_hash) SELECT username,password FROM usertb WHERE username=? ON CONFLICT(username) DO NOTHING",canonical);
  });
  System.out.println("Provisioned. Initial password change required. No password or hash printed. Existing sessions should sign out and sign in again.");
 }
}
