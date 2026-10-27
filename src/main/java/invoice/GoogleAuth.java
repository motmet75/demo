package invoice;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.*;
import java.net.*;
import java.net.http.*;
import java.util.*;
import java.io.IOException;
public class GoogleAuth {
 private String token="",credentialPath="";private long expires=0;
 static String b64(byte[] bytes){return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 public synchronized String token(Path file)throws Exception{
  if(file.toAbsolutePath().toString().equals(credentialPath)&&Instant.now().getEpochSecond()<expires-60)return token;
  long now=Instant.now().getEpochSecond();String endpoint="https://oauth2.googleapis.com/token";
  String form=form(file);
  var request=HttpRequest.newBuilder(URI.create(endpoint)).timeout(Duration.ofSeconds(60)).header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form)).build();
  var response=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build().send(request,HttpResponse.BodyHandlers.ofString());
  var json=Engine.JSON.readTree(response.body());
  if(response.statusCode()!=200||!json.hasNonNull("access_token"))throw new IOException("Google service-account authentication failed (HTTP "+response.statusCode()+", "+json.path("error").asText("unknown")+")");
  token=json.path("access_token").asText();expires=now+json.path("expires_in").asLong(3600);credentialPath=file.toAbsolutePath().toString();return token;
 }
 static String form(Path file)throws Exception{
  var c=SecureFiles.readTree(file.toFile());
  if(!c.path("type").asText().equals("service_account"))throw new IOException("Google credentials must be a service_account JSON file");
  long now=Instant.now().getEpochSecond();String endpoint="https://oauth2.googleapis.com/token";
  String header=b64(Engine.JSON.writeValueAsBytes(Map.of("alg","RS256","typ","JWT")));
  String claims=b64(Engine.JSON.writeValueAsBytes(Map.of("iss",c.path("client_email").asText(),"scope","https://www.googleapis.com/auth/cloud-vision","aud",endpoint,"iat",now,"exp",now+3600)));
  byte[] der=Base64.getDecoder().decode(c.path("private_key").asText().replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replaceAll("\\s",""));
  var key=KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));var signer=Signature.getInstance("SHA256withRSA");signer.initSign(key);signer.update((header+"."+claims).getBytes(StandardCharsets.UTF_8));
  String assertion=header+"."+claims+"."+b64(signer.sign());
  return "grant_type="+URLEncoder.encode("urn:ietf:params:oauth:grant-type:jwt-bearer",StandardCharsets.UTF_8)+"&assertion="+assertion;
 }
}
