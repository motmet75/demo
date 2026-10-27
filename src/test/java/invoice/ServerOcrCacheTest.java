package invoice;
import java.nio.file.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;
class ServerOcrCacheTest {
 @TempDir Path temp;
 @Test void writesReadableDisposableCacheWithoutDesktopVault()throws Exception{
  var settings=new Settings(temp);Path cache=temp.resolve("ocr-cache/page.json");
  settings.writeOcrCache(cache,Map.of("text","sample OCR"));
  assertFalse(SecureFiles.encrypted(Files.readAllBytes(cache)));
  assertEquals("sample OCR",SecureFiles.readTree(cache.toFile()).path("text").asText());
  assertThrows(IllegalArgumentException.class,()->settings.writeOcrCache(temp.resolve("../outside.json"),Map.of()));
 }
}
