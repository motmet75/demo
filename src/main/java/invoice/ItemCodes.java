package invoice;
import java.util.*;
import java.util.regex.*;
public final class ItemCodes {
 // Accept A05.01.04.000001 and the OCR-compacted A05.0104.000001.
 static final String LEGACY_MATERIAL_TOKEN="[AB]\\d{2}\\s*[.\\uFF0E]\\s*\\d{2}(?:\\s*[.\\uFF0E]\\s*|\\s*)\\d{2}\\s*[.\\uFF0E]\\s*\\d{6}";
 static final String MATERIAL_TOKEN=LEGACY_MATERIAL_TOKEN.replace("[.\\uFF0E]","[.,\\uFF0E\\uFF0C]");
 static final String PREVIOUS_MATERIAL_PATTERN="\\bC?("+LEGACY_MATERIAL_TOKEN+")\\b";
 static final String LEGACY_MATERIAL_PATTERN="\\b("+LEGACY_MATERIAL_TOKEN+")\\b";
 // Vision sometimes reads the opening parenthesis as C. Capture only the complete A/B code.
 static final Pattern MATERIAL=Pattern.compile("\\bC?("+MATERIAL_TOKEN+")\\b",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
 static final Pattern LABELED_MATERIAL=Pattern.compile("(?:ma\\s*NVL|m\\u00e3\\s*NVL|material\\s*code|\\bNVL)\\s*[:\\uFF1A-]?\\s*[C(\\[]?("+MATERIAL_TOKEN+")\\b",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE);
 public static void fill(Invoice invoice){for(var item:invoice.items){String text=item.getOrDefault("description","")+" "+item.getOrDefault("note","")+" "+item.getOrDefault("notes","");put(item,"hsCode",text,"(?iu)\\bHS(?:\\s*code)?\\s*[:\\uFF1A-]?\\s*(\\d{4}(?:[. ]?\\d{2}){1,3})\\b");if(item.getOrDefault("materialCode","").isBlank()){String code=materialCode(text);if(!code.isBlank())item.put("materialCode",code);else put(item,"materialCode",text,"(?iu)(?:ma\\s*NVL|m\\u00e3\\s*NVL|material\\s*code)\\s*[:\\uFF1A-]?\\s*([A-Z0-9][A-Z0-9._/-]*)");}}}
 public static void fill(Invoice invoice,Settings settings){for(var item:invoice.items){String text=item.getOrDefault("description","")+" "+item.getOrDefault("note","")+" "+item.getOrDefault("notes","");put(item,"hsCode",text,"(?iu)\\bHS(?:\\s*code)?\\s*[:\\uFF1A-]?\\s*(\\d{4}(?:[. ]?\\d{2}){1,3})\\b");}MaterialPatterns.fill(invoice,settings);}
 static String materialCode(String text){Matcher labeled=LABELED_MATERIAL.matcher(text);if(labeled.find())return normalize(labeled.group(1));Set<String> matches=new LinkedHashSet<>();Matcher match=MATERIAL.matcher(text);while(match.find())matches.add(normalize(match.group(1)));return matches.size()==1?matches.iterator().next():"";}
 static String normalize(String value){String normalized=value.replaceAll("\\s","").replace('\uFF0E','.').toUpperCase(Locale.ROOT);return normalized.matches(MATERIAL_TOKEN)?normalized.replace(',','.').replace('\uFF0C','.'):normalized;}
 static void put(Map<String,String> item,String key,String text,String pattern){if(!item.getOrDefault(key,"").isBlank())return;Matcher match=Pattern.compile(pattern).matcher(text);if(match.find())item.put(key,match.group(1).replace(" ",""));}
}
