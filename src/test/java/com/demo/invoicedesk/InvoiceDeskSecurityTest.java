package com.demo.invoicedesk;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class InvoiceDeskSecurityTest {
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @Test void invoiceRoleCannotReachAdminOrLegacyPermitAllEndpoints()throws Exception{
  SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated("Hanh","",List.of(new SimpleGrantedAuthority("ROLE_INVOICE_DESK"))));
  for(String path:List.of("/admin/users","/bom/materials","/auth/quick-login/generate","/shop/staff/orders","/legacy-private")){
   var req=new MockHttpServletRequest("GET",path);req.setServletPath(path);var response=new MockHttpServletResponse();
   new InvoiceDeskAccessFilter().doFilter(req,response,(a,b)->fail("Restricted endpoint reached"));assertEquals(403,response.getStatus());
  }
  for(String path:List.of("/api/invoice-desk/documents","/auth/change-password","/invoice-desk/index.html")){
   var req=new MockHttpServletRequest("GET",path);req.setServletPath(path);var response=new MockHttpServletResponse();boolean[] reached={false};
   new InvoiceDeskAccessFilter().doFilter(req,response,(a,b)->reached[0]=true);assertTrue(reached[0]);
  }
 }
 @Test void cancellationIsOwnedAndDoesNotLeakAcrossUsers()throws Exception{
  var scope=new InvoiceDeskService.Scope(UUID.randomUUID(),UUID.randomUUID(),"Test","Hanh");var other=new InvoiceDeskService.Scope(scope.tenantId(),scope.companyId(),"Test","Other");
  UUID id=UUID.randomUUID();var ready=new CountDownLatch(1);var release=new CountDownLatch(1);var pool=Executors.newSingleThreadExecutor();
  try{var result=pool.submit(()->InvoiceDeskTasks.run(scope,id,()->{ready.countDown();release.await(5,TimeUnit.SECONDS);InvoiceDeskTasks.check();return true;}));
   assertTrue(ready.await(5,TimeUnit.SECONDS));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->InvoiceDeskTasks.cancel(other,id));
   InvoiceDeskTasks.cancel(scope,id);release.countDown();assertThrows(ExecutionException.class,()->result.get(5,TimeUnit.SECONDS));
   assertThrows(org.springframework.web.server.ResponseStatusException.class,()->InvoiceDeskTasks.status(scope,id));
  }finally{release.countDown();pool.shutdownNow();}
 }
}
