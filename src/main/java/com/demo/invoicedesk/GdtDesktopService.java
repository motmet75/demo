package com.demo.invoicedesk;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GdtDesktopService {
 private static final SecureRandom RANDOM=new SecureRandom();
 private final JdbcTemplate db;
 public GdtDesktopService(JdbcTemplate db){this.db=db;}
 public record Pairing(String token,String expiresAt){}
 public record Handshake(String sessionToken,String expiresAt,String company,String username){}
 public record HandshakeRequest(String pairingToken,String clientNonce,String appVersion){}
 public record DesktopStatus(boolean paired,boolean online,String appVersion,String username,String expiresAt,String lastSeen){}
 private static String token(String prefix){byte[] bytes=new byte[32];RANDOM.nextBytes(bytes);return prefix+Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 private static String clean(String value,int max,String label){if(value==null||value.isBlank()||value.length()>max||value.chars().anyMatch(c->c<32||c==127))throw new IllegalArgumentException(label+" không hợp lệ.");return value.trim();}
 public Pairing create(InvoiceDeskService.Scope scope){
  db.update("DELETE FROM invoice_desk_desktop_pairing WHERE expires_at<CURRENT_TIMESTAMP OR consumed_at IS NOT NULL");String value=token("gdtp_");Instant expires=Instant.now().plusSeconds(600);
  db.update("INSERT INTO invoice_desk_desktop_pairing(id,tenant_id,company_id,username,token_hash,expires_at) VALUES (?,?,?,?,?,?)",UUID.randomUUID(),scope.tenantId(),scope.companyId(),scope.username(),hash(value),Timestamp.from(expires));return new Pairing(value,expires.toString());
 }
 public Handshake handshake(HandshakeRequest request){
  String pairing=clean(request==null?null:request.pairingToken(),80,"Mã ghép nối"),nonce=clean(request.clientNonce(),100,"Mã thiết bị"),version=clean(request.appVersion(),40,"Phiên bản");
  if(!pairing.matches("gdtp_[A-Za-z0-9_-]{43}"))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Mã ghép nối không hợp lệ hoặc đã hết hạn.");
  var rows=db.query("UPDATE invoice_desk_desktop_pairing SET consumed_at=CURRENT_TIMESTAMP WHERE token_hash=? AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING tenant_id,company_id,username",(rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),rs.getString(3)},hash(pairing));
  if(rows.size()!=1)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Mã ghép nối không hợp lệ hoặc đã hết hạn.");UUID tenant=(UUID)rows.get(0)[0],company=(UUID)rows.get(0)[1];String username=(String)rows.get(0)[2];
  String session=token("gdts_");Instant expires=Instant.now().plusSeconds(8*3600);db.update("INSERT INTO invoice_desk_desktop_session(id,tenant_id,company_id,username,token_hash,client_nonce,app_version,expires_at) VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),tenant,company,username,hash(session),nonce,version,Timestamp.from(expires));
  String companyName=db.queryForObject("SELECT company_name FROM company WHERE id=? AND tenant_id=?",String.class,company,tenant);return new Handshake(session,expires.toString(),companyName,username);
 }
 public InvoiceDeskService.Scope authorize(String authorization){
  if(authorization==null||!authorization.startsWith("Bearer "))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Desktop session required.");String value=authorization.substring(7).trim();if(!value.matches("gdts_[A-Za-z0-9_-]{43}"))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Desktop session invalid.");
  var rows=db.query("SELECT s.tenant_id,s.company_id,c.company_name,s.username FROM invoice_desk_desktop_session s JOIN invoice_desk_company d ON d.tenant_id=s.tenant_id AND d.company_id=s.company_id JOIN company c ON c.id=s.company_id AND c.tenant_id=s.tenant_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP",(rs,n)->new InvoiceDeskService.Scope(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),rs.getString(3),rs.getString(4)),hash(value));
  if(rows.size()!=1)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Desktop session expired. Pair again.");db.update("UPDATE invoice_desk_desktop_session SET last_seen=CURRENT_TIMESTAMP WHERE token_hash=?",hash(value));return rows.get(0);
 }
 public DesktopStatus status(InvoiceDeskService.Scope scope){
  var rows=db.query("SELECT username,app_version,expires_at,last_seen,last_seen>CURRENT_TIMESTAMP-INTERVAL '2 minutes' FROM invoice_desk_desktop_session WHERE tenant_id=? AND company_id=? AND LOWER(username)=LOWER(?) AND expires_at>CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1",(rs,n)->new DesktopStatus(true,rs.getBoolean(5),rs.getString(2),rs.getString(1),rs.getObject(3,OffsetDateTime.class).toInstant().toString(),rs.getObject(4,OffsetDateTime.class).toInstant().toString()),scope.tenantId(),scope.companyId(),scope.username());
  return rows.isEmpty()?new DesktopStatus(false,false,null,null,null,null):rows.get(0);
 }
 public DesktopStatus heartbeat(String authorization){return status(authorize(authorization));}
}
