package invoice;
import java.nio.file.*;
import java.util.*;
public class Settings {
 public final Properties p=new Properties();
 public final Path home;
 public Settings(Path workspace) throws Exception {
  home=workspace; Files.createDirectories(home); p.setProperty("server.mode","true");
 }
 public Settings() throws Exception {
  home=Path.of(System.getProperty("invoice.home",localHome().toString()));
  Files.createDirectories(home);
  if(Files.exists(home.resolve("config.properties"))) try(var in=Files.newInputStream(home.resolve("config.properties"))){p.load(in);}
  if(!Files.exists(home.resolve("seller-profiles.json")))try(var in=Settings.class.getResourceAsStream("/seller-profiles.json")){if(in!=null)SecureFiles.write(home.resolve("seller-profiles.json"),in.readAllBytes());}
  SecureFiles.migrate(home);if(installedHome()!=null)configureBundledCredential(installedHome());if(!Files.exists(MaterialPatterns.path(this)))MaterialPatterns.save(this,MaterialPatterns.defaults());save();
 }
 static Path installedHome(){try{Path location=Path.of(Settings.class.getProtectionDomain().getCodeSource().getLocation().toURI());if(!location.toString().endsWith(".jar"))return null;Path folder=location.getParent();return folder.getFileName().toString().equals("app")?folder.getParent():folder;}catch(Exception e){return null;}}
 static Path localHome(){try{Path location=Path.of(Settings.class.getProtectionDomain().getCodeSource().getLocation().toURI());if(location.toString().endsWith(".jar")){Path folder=location.getParent();if(folder.getFileName().toString().equals("app"))folder=folder.getParent();return folder.resolve("data");}}catch(Exception ignored){}return Path.of("data").toAbsolutePath();}
 void configureBundledCredential(Path install){
  if(!get("google.credentials",secret("GOOGLE_APPLICATION_CREDENTIALS")).isBlank())return;
  Path bundled=install.resolve("Google-OCR.ivcred").toAbsolutePath().normalize();
  if(Files.isRegularFile(bundled)){p.setProperty("google.credentials",bundled.toString());p.setProperty("ocr","google");}
 }
 public String get(String k,String d){return p.getProperty(k,d);}
 /** Server workspaces are private, disposable directories removed after each import. */
 public void writeOcrCache(Path path,Object value)throws Exception{
  if(get("server.mode","false").equals("true")){
   Path root=home.toAbsolutePath().normalize(),target=path.toAbsolutePath().normalize();
   if(!target.startsWith(root))throw new IllegalArgumentException("OCR cache must stay in its import workspace");
   Files.createDirectories(target.getParent());Engine.JSON.writeValue(target.toFile(),value);
  }else SecureFiles.writeValue(path.toFile(),value);
 }
 public String secret(String env){return System.getenv().getOrDefault(env,"");}
 public void save() throws Exception {
  String credential=get("google.credentials",secret("GOOGLE_APPLICATION_CREDENTIALS"));
  if(!credential.isBlank()&&Files.isRegularFile(Path.of(credential))){Path protectedCopy=home.resolve("google-service-account.json");if(!Path.of(credential).toAbsolutePath().normalize().equals(protectedCopy.toAbsolutePath().normalize()))SecureFiles.write(protectedCopy,CredentialPackage.read(Path.of(credential)));else SecureFiles.migrateFile(protectedCopy);p.setProperty("google.credentials",protectedCopy.toAbsolutePath().toString());}
  try(var out=Files.newOutputStream(home.resolve("config.properties"))){p.store(out,"Invoice Desk - protected credentials stored separately");}
 }
}
