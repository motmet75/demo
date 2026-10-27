package invoice;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
public final class MaterialPatterns {
 public static class Rule {
  public String id=UUID.randomUUID().toString(),scope="any",sellerTaxId="",sellerNameContains="",pattern="";public boolean enabled=true,normalize=true;public int group=1;
 }
 public static class Library {public int schemaVersion=1;public List<Rule> rules=new ArrayList<>();}
 static Path path(Settings settings){return settings.home.resolve("material-patterns.json");}
 public static Library defaults(){Library library=new Library();Rule rule=new Rule();rule.id="nvl-a-b-dotted-or-compact-v1";rule.pattern="(?iu)"+ItemCodes.MATERIAL.pattern();library.rules.add(rule);return library;}
 public static Library load(Settings settings)throws Exception{if(!Files.exists(path(settings))){Library defaults=defaults();save(settings,defaults);return defaults;}Library library=SecureFiles.readValue(path(settings).toFile(),Library.class);validate(library);boolean updated=false;for(Rule rule:library.rules){if((rule.pattern.equals("(?iu)"+ItemCodes.LEGACY_MATERIAL_PATTERN)||rule.pattern.equals("(?iu)"+ItemCodes.PREVIOUS_MATERIAL_PATTERN))&&rule.group==1){rule.pattern="(?iu)"+ItemCodes.MATERIAL.pattern();updated=true;}}if(updated)save(settings,library);return library;}
 public static void validate(Library library){if(library.schemaVersion!=1)throw new IllegalArgumentException("Unsupported material-pattern schema");for(Rule rule:library.rules){if(!List.of("any","company").contains(rule.scope))throw new IllegalArgumentException("Choose Any company or Company");if(rule.scope.equals("company")&&rule.sellerTaxId.isBlank()&&rule.sellerNameContains.isBlank())throw new IllegalArgumentException("Company rules need a seller tax ID or name");Pattern pattern=Pattern.compile(rule.pattern);if(rule.pattern.isBlank()||rule.group<0||rule.group>pattern.matcher("").groupCount())throw new IllegalArgumentException("Choose a valid pattern and capture group (0 means the complete match)");}}
 public static void save(Settings settings,Library library)throws Exception{validate(library);SecureFiles.writeValue(path(settings).toFile(),library);}
 static boolean matches(Rule rule,Invoice invoice){if(!rule.enabled)return false;if(rule.scope.equals("any"))return true;if(!rule.sellerTaxId.isBlank()&&!rule.sellerTaxId.replaceAll("\\s","").equals(invoice.get("sellerTaxId").replaceAll("\\s","")))return false;return rule.sellerNameContains.isBlank()||Parser.fold(invoice.get("seller")).contains(Parser.fold(rule.sellerNameContains));}
 public static int apply(Invoice invoice,Library library){List<Rule> rules=library.rules.stream().filter(rule->matches(rule,invoice)).sorted(Comparator.comparingInt(rule->rule.scope.equals("company")?0:1)).toList();int changed=0;
  for(var item:invoice.items){if(!item.getOrDefault("materialCode","").isBlank())continue;String text=item.getOrDefault("description","")+" "+item.getOrDefault("note","")+" "+item.getOrDefault("notes","");for(Rule rule:rules){Set<String> values=new LinkedHashSet<>();Matcher matcher=Pattern.compile(rule.pattern).matcher(text);while(matcher.find()){String value=matcher.group(rule.group);if(value!=null&&!value.isBlank())values.add(rule.normalize?ItemCodes.normalize(value):value.trim());}if(values.size()==1){item.put("materialCode",values.iterator().next());item.put("materialCodeSource","pattern:"+rule.id);changed++;break;}}}return changed;
 }
 public static void fill(Invoice invoice,Settings settings){try{apply(invoice,settings.get("server.mode","false").equals("true")?defaults():load(settings));}catch(Exception e){String warning="Material-code rules unavailable: "+e.getMessage();if(!invoice.warnings.contains(warning))invoice.warnings.add(warning);}}
}
