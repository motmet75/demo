package com.demo.invoicedesk;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.user.Authority;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class InvoiceDeskBootstrap implements ApplicationRunner {
 private final JdbcTemplate db;
 private final TenantRepository tenants; private final CompanyRepository companies;
 private final UserRepository users; private final AuthorityRepository authorities; private final PasswordEncoder passwords;
 @Value("${invoice-desk.bootstrap-password:}") private String initialPassword;
 public InvoiceDeskBootstrap(JdbcTemplate db,TenantRepository tenants,CompanyRepository companies,UserRepository users,AuthorityRepository authorities,PasswordEncoder passwords){
  this.db=db;this.tenants=tenants;this.companies=companies;this.users=users;this.authorities=authorities;this.passwords=passwords;
 }
 @Override @Transactional public void run(ApplicationArguments args){
  new ResourceDatabasePopulator(new ClassPathResource("db/schema/invoice_desk.sql")).execute(db.getDataSource());
  new ResourceDatabasePopulator(new ClassPathResource("db/schema/invoice_desk_workspace.sql")).execute(db.getDataSource());
  // Never reset an existing login or claim its data during startup.
  if(users.findByUsernameIgnoreCase("anthony").isPresent())return;
  // New deployments must explicitly opt into provisioning a login.
  if(initialPassword.isBlank())return;
  if(tenants.findByTenantCode("anthony").isPresent())throw new IllegalStateException("Anthony tenant exists; provision its account explicitly");
  Tenant tenant=new Tenant();tenant.setTenantCode("anthony");tenant.setTenantName("Anthony");tenant.setTenantType("INVOICE");tenant.setMaxCompanies(1);tenants.saveAndFlush(tenant);
  Company company=new Company();company.setTenant(tenant);company.setCompanyCode("ANTHONY");company.setCompanyName("Anthony");companies.saveAndFlush(company);
  User user=new User();user.setUsername("anthony");
  user.setPassword(passwords.encode(initialPassword));
  user.setFirstName("Anthony");user.setLastName("Company");user.setEmail("anthony@example.invalid");user.setEnabled(true);
  user.setAssignedTenantId(tenant.getId().toString());user.setAssignedCompanyId(company.getId().toString());user.setLastTenantId(tenant.getId().toString());user.setLastCompanyId(company.getId().toString());users.saveAndFlush(user);
  Authority role=new Authority("ROLE_USER");role.setUsername("anthony");authorities.saveAndFlush(role);
  db.update("INSERT INTO invoice_desk_company(tenant_id,company_id) VALUES (?,?)",tenant.getId(),company.getId());
 }
}
