package invoice;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.io.*;
import java.util.concurrent.TimeUnit;
import javax.crypto.*;
import javax.crypto.spec.*;
import com.fasterxml.jackson.databind.*;
/** AES-256-GCM envelopes; data keys are protected by the Windows user account. */
public final class SecureFiles {
 private static final String FORMAT="InvoiceDesk.Encrypted.v1";
 private static final ObjectMapper MAPPER=new ObjectMapper();
 private static final SecureRandom RANDOM=new SecureRandom();
 private static final Map<String,byte[]> KEYS=new HashMap<>();
 private static byte[] activeKey;private static Map<String,Object> protection;
 private static char[] linuxPassword;
 private static boolean windows(){return System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win");}
 private static byte[] random(int length){byte[] b=new byte[length];RANDOM.nextBytes(b);return b;}
 private static String b64(byte[] b){return Base64.getEncoder().encodeToString(b);}
 private static byte[] bytes(String s){return Base64.getDecoder().decode(s);}
 private static byte[] crypt(int mode,byte[] key,byte[] iv,byte[] data)throws Exception{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(mode,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));c.updateAAD(FORMAT.getBytes(StandardCharsets.UTF_8));return c.doFinal(data);}
 private static byte[] dpapi(byte[] data,boolean protect)throws Exception{
  return dpapi(data,protect,false);
 }
 static byte[] dpapi(byte[] data,boolean protect,boolean machine)throws Exception{
  if(!windows())throw new IOException("This encrypted file requires its original Windows user account");
  String script="$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::"+(protect?"Protect":"Unprotect")+"($b,$null,[Security.Cryptography.DataProtectionScope]::"+(machine?"LocalMachine":"CurrentUser")+"); [Console]::Out.Write([Convert]::ToBase64String($r))";
  Process p=new ProcessBuilder("powershell.exe","-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command",script).redirectError(ProcessBuilder.Redirect.DISCARD).start();
  try(var in=p.getOutputStream()){in.write(b64(data).getBytes(StandardCharsets.US_ASCII));}
  if(!p.waitFor(30,TimeUnit.SECONDS)){p.destroyForcibly();throw new IOException("Windows key protection timed out");}
  if(p.exitValue()!=0)throw new IOException("Windows could not unlock this data for the current user");return bytes(new String(p.getInputStream().readAllBytes(),StandardCharsets.US_ASCII).trim());
 }
 private static char[] password()throws IOException{
  if(linuxPassword!=null)return linuxPassword;String env=System.getenv("INVOICE_VAULT_PASSWORD");
  if(env!=null)linuxPassword=env.toCharArray();else if(System.console()!=null)linuxPassword=System.console().readPassword("Local data encryption password (at least 12 characters): ");
  else if(!java.awt.GraphicsEnvironment.isHeadless()){javax.swing.JPasswordField field=new javax.swing.JPasswordField();if(javax.swing.JOptionPane.showConfirmDialog(null,field,"Unlock local data (12+ character password)",javax.swing.JOptionPane.OK_CANCEL_OPTION)==javax.swing.JOptionPane.OK_OPTION)linuxPassword=field.getPassword();}
  if(linuxPassword==null||linuxPassword.length<12){linuxPassword=null;throw new IOException("Set INVOICE_VAULT_PASSWORD to a strong 12+ character password on Linux");}return linuxPassword;
 }
 private static byte[] derive(byte[] salt,int rounds)throws Exception{PBEKeySpec spec=new PBEKeySpec(password(),salt,rounds,256);try{return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();}finally{spec.clearPassword();}}
 private static synchronized void init()throws Exception{
  if(activeKey!=null)return;activeKey=random(32);protection=new LinkedHashMap<>();
  try{if(windows()){protection.put("keyProtection","windows-dpapi-current-user");protection.put("wrappedKey",b64(dpapi(activeKey,true)));}
   else{byte[] salt=random(16),iv=random(12);int rounds=310000;byte[] encrypted=crypt(Cipher.ENCRYPT_MODE,derive(salt,rounds),iv,activeKey);protection.put("keyProtection","password-pbkdf2-sha256");protection.put("salt",b64(salt));protection.put("rounds",rounds);protection.put("keyIv",b64(iv));protection.put("wrappedKey",b64(encrypted));}
   KEYS.put(protection.get("wrappedKey").toString(),activeKey);
  }catch(Exception e){activeKey=null;protection=null;throw e;}
 }
 public static boolean encrypted(byte[] data){try{return FORMAT.equals(MAPPER.readTree(data).path("format").asText());}catch(Exception e){return false;}}
 public static synchronized byte[] seal(byte[] plain)throws Exception{init();byte[] iv=random(12);Map<String,Object> envelope=new LinkedHashMap<>();envelope.put("format",FORMAT);envelope.putAll(protection);envelope.put("iv",b64(iv));envelope.put("ciphertext",b64(crypt(Cipher.ENCRYPT_MODE,activeKey,iv,plain)));return MAPPER.writeValueAsBytes(envelope);}
 public static synchronized byte[] open(byte[] data)throws Exception{
  if(!encrypted(data))return data;JsonNode envelope=MAPPER.readTree(data);String wrapped=envelope.path("wrappedKey").asText();byte[] key=KEYS.get(wrapped);
  if(key==null){String kind=envelope.path("keyProtection").asText();if(kind.equals("windows-dpapi-current-user"))key=dpapi(bytes(wrapped),false);else if(kind.equals("password-pbkdf2-sha256")){int rounds=envelope.path("rounds").asInt();if(rounds<100000||rounds>2000000)throw new IOException("Invalid encrypted file parameters");key=crypt(Cipher.DECRYPT_MODE,derive(bytes(envelope.path("salt").asText()),rounds),bytes(envelope.path("keyIv").asText()),bytes(wrapped));}else throw new IOException("Unsupported key protection");KEYS.put(wrapped,key);}
  try{return crypt(Cipher.DECRYPT_MODE,key,bytes(envelope.path("iv").asText()),bytes(envelope.path("ciphertext").asText()));}catch(AEADBadTagException e){throw new IOException("Encrypted file authentication failed; file is damaged or altered",e);}
 }
 public static byte[] read(Path path)throws Exception{try{return open(Files.readAllBytes(path));}catch(IOException e){throw new IOException("Cannot unlock "+path.toAbsolutePath()+": "+e.getMessage()+". Use the Windows account that saved this file, or restore it using Account Repair.",e);}}
 public static <T>T readValue(File file,Class<T> type)throws Exception{return Engine.JSON.readValue(read(file.toPath()),type);}
 public static JsonNode readTree(File file)throws Exception{return Engine.JSON.readTree(read(file.toPath()));}
 public static void writeValue(File file,Object value)throws Exception{write(file.toPath(),Engine.JSON.writeValueAsBytes(value));}
 public static void write(Path path,byte[] plain)throws Exception{byte[] encrypted=seal(plain);if(!Arrays.equals(plain,open(encrypted)))throw new IOException("Encryption verification failed");Files.createDirectories(path.toAbsolutePath().getParent());Path tmp=Files.createTempFile(path.toAbsolutePath().getParent(),"encrypted-",".tmp");try{Files.write(tmp,encrypted);try{Files.move(tmp,path,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException e){Files.move(tmp,path,StandardCopyOption.REPLACE_EXISTING);}}finally{Files.deleteIfExists(tmp);}}
 public static synchronized void append(Path path,String line)throws Exception{byte[] previous=Files.exists(path)?read(path):new byte[0];ByteArrayOutputStream out=new ByteArrayOutputStream();out.write(previous);out.write((line+"\n").getBytes(StandardCharsets.UTF_8));write(path,out.toByteArray());}
 public static void migrateFile(Path path)throws Exception{if(Files.isRegularFile(path)){byte[] old=Files.readAllBytes(path);if(!encrypted(old))write(path,old);}}
 public static void migrate(Path folder)throws Exception{if(!Files.isDirectory(folder))return;try(var paths=Files.walk(folder)){for(Path file:paths.filter(Files::isRegularFile).filter(p->p.toString().endsWith(".json")||p.toString().endsWith(".jsonl")).toList())migrateFile(file);}}
}
