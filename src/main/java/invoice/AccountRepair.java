package invoice;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.security.*;
import java.util.*;
import java.util.regex.*;
import javax.crypto.*;
import javax.crypto.spec.*;

/** One-time, ACL-restricted transfer from the build account to the desktop account.
 * Normal app storage remains CurrentUser DPAPI. No plaintext files are created. */
public final class AccountRepair {
 static final String PENDING="account-repair";
 // Base64 ciphertext combines every migrated file and exceeds normal API JSON limits.
 // Scope the larger limit to repair bundles; keep ordinary invoice/API readers unchanged.
 static final long MAX_BUNDLE_BYTES=128L*1024*1024;
 static final com.fasterxml.jackson.databind.ObjectMapper REPAIR_JSON=new com.fasterxml.jackson.databind.ObjectMapper(
  com.fasterxml.jackson.core.JsonFactory.builder().streamReadConstraints(com.fasterxml.jackson.core.StreamReadConstraints.builder().maxStringLength(96*1024*1024).maxNestingDepth(50).build()).build());
 static com.fasterxml.jackson.databind.JsonNode readBundle(Path path)throws IOException{
  if(Files.size(path)>MAX_BUNDLE_BYTES)throw new IOException("Account repair bundle exceeds the 128 MiB safety limit");
  return REPAIR_JSON.readTree(Files.readAllBytes(path));
 }
 static String sid()throws Exception{
  Process p=new ProcessBuilder("whoami.exe","/user","/fo","csv","/nh").redirectErrorStream(true).start();
  String result=new String(p.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
  if(p.waitFor()!=0)throw new IOException("Cannot identify Windows account");Matcher m=Pattern.compile("S-1-5-[0-9-]+").matcher(result);if(!m.find())throw new IOException("Cannot identify Windows SID");return m.group();
 }
 static byte[] crypt(int mode,byte[] key,byte[] iv,byte[] data)throws Exception{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(mode,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));c.updateAAD("InvoiceDesk.AccountRepair.v1".getBytes(java.nio.charset.StandardCharsets.US_ASCII));return c.doFinal(data);}
 static Path inside(Path home,String name)throws IOException{Path target=home.resolve(name).normalize();if(!target.startsWith(home)||target.equals(home)||Path.of(name).isAbsolute())throw new IOException("Invalid repair path");return target;}
 static void restrict(Path path,String targetSid)throws Exception{
  var lookup=path.getFileSystem().getUserPrincipalLookupService();List<AclEntry> entries=new ArrayList<>();
  for(String user:new LinkedHashSet<>(List.of(sid(),targetSid))){var principal=lookup.lookupPrincipalByName(accountName(user));var builder=AclEntry.newBuilder().setType(AclEntryType.ALLOW).setPrincipal(principal).setPermissions(EnumSet.allOf(AclEntryPermission.class));if(Files.isDirectory(path))builder.setFlags(AclEntryFlag.FILE_INHERIT,AclEntryFlag.DIRECTORY_INHERIT);entries.add(builder.build());}
  Files.getFileAttributeView(path,AclFileAttributeView.class).setAcl(entries);
 }
 static String accountName(String sid)throws Exception{
  if(!sid.matches("S-1-[0-9-]+"))throw new IOException("Invalid Windows SID");
  String script="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; [Console]::Write(([Security.Principal.SecurityIdentifier]::new('"+sid+"')).Translate([Security.Principal.NTAccount]).Value)";
  Process p=new ProcessBuilder("powershell.exe","-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command",script).redirectError(ProcessBuilder.Redirect.DISCARD).start();String name=new String(p.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).replace("\uFEFF","").trim();if(p.waitFor()!=0||name.isEmpty())throw new IOException("Cannot resolve Windows account");return name;
 }
 public static void prepare(Path home,String targetSid)throws Exception{
  home=home.toAbsolutePath().normalize();Path pending=home.resolve(PENDING);if(Files.exists(pending))throw new IOException("A repair is already prepared");
  Map<String,String> files=new LinkedHashMap<>();List<String> alreadyTarget=new ArrayList<>();try(var walk=Files.walk(home)){for(Path file:walk.filter(Files::isRegularFile).filter(p->p.toString().endsWith(".json")||p.toString().endsWith(".jsonl")).toList()){String name=home.relativize(file).toString();try{files.put(name,Base64.getEncoder().encodeToString(SecureFiles.read(file)));}catch(IOException e){if(!SecureFiles.encrypted(Files.readAllBytes(file)))throw e;alreadyTarget.add(name);System.out.println("Requires destination-account verification: "+name);}}}
  byte[] key=new byte[32],iv=new byte[12];new SecureRandom().nextBytes(key);new SecureRandom().nextBytes(iv);
  byte[] plain=Engine.JSON.writeValueAsBytes(Map.of("targetSid",targetSid,"files",files,"verifyExisting",alreadyTarget));byte[] cipher=crypt(Cipher.ENCRYPT_MODE,key,iv,plain);byte[] wrapped=SecureFiles.dpapi(key,true,true);
  if(!Arrays.equals(plain,crypt(Cipher.DECRYPT_MODE,SecureFiles.dpapi(wrapped,false,true),iv,cipher)))throw new IOException("Repair verification failed");
  byte[] encoded=Engine.JSON.writeValueAsBytes(Map.of("format","InvoiceDesk.AccountRepair.v1","targetSid",targetSid,"wrappedKey",Base64.getEncoder().encodeToString(wrapped),"iv",Base64.getEncoder().encodeToString(iv),"ciphertext",Base64.getEncoder().encodeToString(cipher)));
  if(encoded.length>MAX_BUNDLE_BYTES)throw new IOException("Account repair bundle exceeds the 128 MiB safety limit");
  REPAIR_JSON.readTree(encoded);REPAIR_JSON.readTree(plain);
  Files.createDirectory(pending);restrict(pending,targetSid);
  Files.write(pending.resolve("bundle.json"),encoded);
  System.out.println("Prepared encrypted account repair: "+files.size()+" files; target "+targetSid);
 }
 public static boolean apply(Path home)throws Exception{
  home=home.toAbsolutePath().normalize();Path pending=home.resolve(PENDING),bundle=pending.resolve("bundle.json");if(!Files.exists(bundle))return false;
  var outer=readBundle(bundle);if(!outer.path("format").asText().equals("InvoiceDesk.AccountRepair.v1"))throw new IOException("Unsupported account repair format");String targetSid=outer.path("targetSid").asText();if(!sid().equals(targetSid))throw new IOException("Account repair must be opened by its intended Windows user. Double-click InvoiceDesk.exe in your normal desktop session.");
  var b64=Base64.getDecoder();byte[] key=SecureFiles.dpapi(b64.decode(outer.path("wrappedKey").asText()),false,true);var content=REPAIR_JSON.readTree(crypt(Cipher.DECRYPT_MODE,key,b64.decode(outer.path("iv").asText()),b64.decode(outer.path("ciphertext").asText())));if(!targetSid.equals(content.path("targetSid").asText()))throw new IOException("Repair account mismatch");
  Map<Path,byte[]> files=new LinkedHashMap<>();var fields=content.path("files").fields();while(fields.hasNext()){var entry=fields.next();files.put(inside(home,entry.getKey()),b64.decode(entry.getValue().asText()));}
  for(var existing:content.path("verifyExisting"))SecureFiles.read(inside(home,existing.asText()));
  // Keep the old encrypted files until the user has verified the recovered session.
  Path backup=home.resolveSibling("data-before-account-repair-"+System.currentTimeMillis());Files.createDirectory(backup);restrict(backup,targetSid);
  for(var entry:files.entrySet()){Path target=entry.getKey();if(Files.exists(target)){Path old=backup.resolve(home.relativize(target));Files.createDirectories(old.getParent());Files.copy(target,old);}SecureFiles.write(target,entry.getValue());if(!Arrays.equals(entry.getValue(),SecureFiles.read(target)))throw new IOException("Repaired file verification failed");}
  Files.writeString(home.resolve("account-repair-complete.txt"),"Repaired "+files.size()+" encrypted files for Windows SID "+targetSid+".\nOriginal encrypted files retained in "+backup.getFileName()+".\n");
  Files.delete(bundle);Files.delete(pending);return true;
 }
 public static void main(String[] args)throws Exception{if(args.length==3&&args[0].equals("prepare"))prepare(Path.of(args[1]),args[2]);else if(args.length==2&&args[0].equals("apply"))System.out.println("Repair applied: "+apply(Path.of(args[1])));else throw new IllegalArgumentException("prepare home targetSid | apply home");}
}
