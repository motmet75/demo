package com.ams.bomcore.audit;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;
import com.ams.bomcore.domain.user.User;
import static org.junit.jupiter.api.Assertions.*;

class AuditHistoryAccessTest {
 @Test void refusesAnonymousCounterCrossTenantAndCrossCompanyRequestsBeforeReadingData() {
  var endpoint=new AuditHistoryController(null);
  UUID tenant=UUID.randomUUID(), company=UUID.randomUUID();
  assertThrows(ResponseStatusException.class,()->endpoint.list(null,tenant,company,"","","",null,null,null,false));
  var user=new User();user.setAssignedTenantId(tenant.toString());user.setAssignedCompanyId(company.toString());
  var counter=new UsernamePasswordAuthenticationToken(user,null,List.of(new SimpleGrantedAuthority("ROLE_COUNTER")));
  assertThrows(ResponseStatusException.class,()->endpoint.list(counter,tenant,company,"","","",null,null,null,false));
  var admin=new UsernamePasswordAuthenticationToken(user,null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
  assertThrows(ResponseStatusException.class,()->endpoint.list(admin,UUID.randomUUID(),company,"","","",null,null,null,false));
  assertThrows(ResponseStatusException.class,()->endpoint.list(admin,tenant,UUID.randomUUID(),"","","",null,null,null,false));
  assertThrows(ResponseStatusException.class,()->endpoint.list(admin,tenant,company,"","","",null,null,null,true));
 }
}
