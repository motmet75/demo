package invoice;

import java.util.*;
import java.util.regex.Pattern;
import java.nio.file.*;

public final class TransportFields {
 public record Phrase(String from,String to){}
 public static List<Phrase> phrases(Settings settings)throws Exception{
  String configured=settings.get("phrase.rules","");
  com.fasterxml.jackson.databind.JsonNode node;
  if(configured.isBlank())try(var input=TransportFields.class.getResourceAsStream("/invoice-phrase-rules.json")){node=Engine.JSON.readTree(input);}
  else node=Engine.JSON.readTree(Path.of(configured).toFile());
  if(!node.isArray()||node.size()>100)throw new IllegalArgumentException("Phrase rules must be an array of at most 100 entries");
  List<Phrase> result=new ArrayList<>();
  for(var entry:node){String from=entry.path("from").asText(),to=entry.path("to").asText();if(from.isBlank()||from.length()>100||to.length()>300)throw new IllegalArgumentException("Invalid phrase rule");result.add(new Phrase(from,to));}
  result.sort(Comparator.comparingInt((Phrase p)->p.from().length()).reversed());return result;
 }
 public static void apply(Invoice invoice,Settings settings)throws Exception{
  List<Phrase> rules=phrases(settings);
  String alternatives=rules.stream().map(p->Pattern.quote(p.from())).collect(java.util.stream.Collectors.joining("|"));
  Pattern phrase=Pattern.compile("(?iu)(?<![\\p{L}\\p{N}])(?:"+alternatives+")(?![\\p{L}\\p{N}])");
  Pattern plate=Pattern.compile("(?i)(?<![A-Z0-9])([0-9]{2}[A-Z]{1,2}[- .]?(?:[0-9]{3}[.]?[0-9]{2}|[0-9]{4}))(?![A-Z0-9])");
  for(var item:invoice.items){
   String original=item.getOrDefault("description","");
   if(!rules.isEmpty()){
    var matcher=phrase.matcher(original);String expanded=matcher.replaceAll(m->java.util.regex.Matcher.quoteReplacement(rules.stream().filter(p->p.from().equalsIgnoreCase(m.group())).findFirst().orElseThrow().to()));
    if(!original.equals(expanded)){item.putIfAbsent("originalDescription",original);item.put("description",expanded);}
   }
   if(!item.getOrDefault("truckPlate","").isBlank())continue;
   var matcher=plate.matcher(item.getOrDefault("notes","")+" "+item.getOrDefault("note","")+" "+original);
   Set<String> plates=new LinkedHashSet<>();while(matcher.find())plates.add(matcher.group(1).replaceAll("[- .]","").toUpperCase(Locale.ROOT));
   item.put("truckPlate",String.join(", ",plates));
  }
 }
}
