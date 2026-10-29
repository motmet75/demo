package com.demo.invoicedesk;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** A dedicated invoice role must not inherit the legacy permitAll fallback. */
public class InvoiceDeskAccessFilter extends OncePerRequestFilter {
 private final org.springframework.jdbc.core.JdbcTemplate db;
 public InvoiceDeskAccessFilter(){this.db=null;}
 public InvoiceDeskAccessFilter(org.springframework.jdbc.core.JdbcTemplate db){this.db=db;}
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{
  var auth=SecurityContextHolder.getContext().getAuthentication();
  boolean fullBusiness=auth!=null&&auth.getAuthorities().stream().anyMatch(a->java.util.Set.of("ROLE_SUPER_ADMIN","ROLE_ADMIN","ROLE_USER").contains(a.getAuthority()));
  boolean invoiceRole=auth!=null&&auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_INVOICE_DESK"));
  if(db!=null&&auth!=null&&auth.isAuthenticated()&&!(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
   String username=auth.getName();
   if(!invoiceRole) invoiceRole=Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM authorities WHERE lower(username)=lower(?) AND authority='ROLE_INVOICE_DESK')",Boolean.class,username));
   if(!fullBusiness) fullBusiness=Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM authorities WHERE lower(username)=lower(?) AND authority IN ('ROLE_SUPER_ADMIN','ROLE_ADMIN','ROLE_USER'))",Boolean.class,username));
  }
  boolean invoiceOnly=invoiceRole&&!fullBusiness;
  if(invoiceOnly){
   String path=req.getServletPath();
   boolean allowed=path.startsWith("/api/invoice-desk/")||path.startsWith("/invoice-desk/")||path.equals("/invoice-desk")||path.equals("/bom-inventory/invoice-desk")||path.startsWith("/assets/")||path.equals("/error")||java.util.Set.of("/auth/me","/auth/login","/auth/logout","/auth/change-password").contains(path);
   if(!allowed){res.setStatus(403);res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"message\":\"Tài khoản chỉ được sử dụng Invoice Desk.\"}");return;}
  }
  chain.doFilter(req,res);
 }
}
