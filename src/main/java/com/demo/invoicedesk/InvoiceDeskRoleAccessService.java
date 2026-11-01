package com.demo.invoicedesk;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Registers the one Invoice Desk company allowed for a ROLE_USER tenant. */
@Service
public class InvoiceDeskRoleAccessService {
 private final JdbcTemplate db;
 public InvoiceDeskRoleAccessService(JdbcTemplate db){this.db=db;}

 public void sync(String username){
  if(username==null||username.isBlank())return;
  db.update("""
   INSERT INTO invoice_desk_company(tenant_id,company_id)
   SELECT ids.tenant_id,ids.company_id
   FROM usertb u
   CROSS JOIN LATERAL (SELECT
     CASE WHEN u.assignedtenantid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN u.assignedtenantid::uuid END tenant_id,
     CASE WHEN u.assignedcompanyid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN u.assignedcompanyid::uuid END company_id
   ) ids
   JOIN tenant t ON t.id=ids.tenant_id AND t.is_active=true
   JOIN company c ON c.id=ids.company_id AND c.tenant_id=t.id
   WHERE lower(u.username)=lower(?)
     AND EXISTS (SELECT 1 FROM authorities a WHERE lower(a.username)=lower(u.username) AND upper(a.authority)='ROLE_USER')
   ON CONFLICT DO NOTHING
   """,username);
 }
}
