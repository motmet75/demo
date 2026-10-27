package invoice;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;
/** Portable obfuscation: the bundled key is recoverable from the app. */
public final class CredentialPackage {
 private static final String FORMAT="InvoiceDesk.GoogleCredential.v1";
 private static final byte[] KEY=Base64.getDecoder().decode("uiY8pfqaRJZoTo56HdqR/XYkJZZVpw8Vl+w54ehC56c=");
 private static byte[] crypt(int mode,byte[] iv,byte[] data)throws Exception{Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(mode,new SecretKeySpec(KEY,"AES"),new GCMParameterSpec(128,iv));cipher.updateAAD(FORMAT.getBytes(StandardCharsets.UTF_8));return cipher.doFinal(data);}
 static void validate(byte[] data)throws Exception{var node=Engine.JSON.readTree(data);if(node==null||!node.path("type").asText().equals("service_account")||node.path("client_email").asText().isBlank()||node.path("private_key").asText().isBlank())throw new java.io.IOException("Select a Google service-account credential or an Invoice Desk .ivcred package");}
 public static byte[] read(Path path)throws Exception{if(Files.size(path)>1024*1024)throw new java.io.IOException("Credential file exceeds 1 MB");byte[] data=Files.readAllBytes(path);var node=Engine.JSON.readTree(data);if(node!=null&&FORMAT.equals(node.path("format").asText())){try{byte[] iv=Base64.getDecoder().decode(node.path("iv").asText());if(iv.length!=12)throw new IllegalArgumentException();data=crypt(Cipher.DECRYPT_MODE,iv,Base64.getDecoder().decode(node.path("ciphertext").asText()));}catch(Exception e){throw new java.io.IOException("Credential package is damaged or incompatible",e);}}else data=SecureFiles.open(data);validate(data);return data;}
 public static void export(Path source,Path destination)throws Exception{if(source.toAbsolutePath().normalize().equals(destination.toAbsolutePath().normalize()))throw new java.io.IOException("Choose a separate output file");byte[] plain=read(source);try{byte[] iv=new byte[12];new java.security.SecureRandom().nextBytes(iv);byte[] result=Engine.JSON.writeValueAsBytes(Map.of("format",FORMAT,"iv",Base64.getEncoder().encodeToString(iv),"ciphertext",Base64.getEncoder().encodeToString(crypt(Cipher.ENCRYPT_MODE,iv,plain))));Path parent=destination.toAbsolutePath().getParent();Files.createDirectories(parent);Path temp=Files.createTempFile(parent,"credential-",".tmp");try{Files.write(temp,result);try{Files.move(temp,destination,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException e){Files.move(temp,destination,StandardCopyOption.REPLACE_EXISTING);}}finally{Files.deleteIfExists(temp);}}finally{Arrays.fill(plain,(byte)0);}}
 public static void main(String[] args)throws Exception{if(args.length!=2)throw new IllegalArgumentException("source destination.ivcred");export(Path.of(args[0]),Path.of(args[1]));System.out.println("Encoded credential package created.");}
}
