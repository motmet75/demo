package com.demo.invoicedesk;

import invoice.Invoice;
import com.google.re2j.Pattern;
import java.util.*;

/** Linear-time regular expressions; no executable scripts in supplier configuration. */
public final class SupplierRules {
 public record Rule(String field,String pattern,String value,boolean required) {}
 public static String taxId(String value){
  String normalized=Objects.toString(value,"").replaceAll("[\\s-]","");
  if(!normalized.matches("\\d{10}(?:\\d{3})?"))throw new IllegalArgumentException("Tax ID must contain 10 or 13 digits");
  return normalized;
 }
 public static void validate(List<Rule> rules){
  if(rules==null||rules.size()>30)throw new IllegalArgumentException("Provide at most 30 rules");
  for(Rule rule:rules){
   if(rule==null||!Invoice.KEYS.contains(rule.field())||rule.field().equals("sellerTaxId"))throw new IllegalArgumentException("Choose a supported field other than sellerTaxId");
   if(rule.pattern()==null||rule.value()==null||rule.pattern().length()>1000||rule.value().length()>1000)throw new IllegalArgumentException("Rule text exceeds limit");
   try{if(!rule.pattern().isBlank()&&Pattern.compile(rule.pattern()).matcher("").groupCount()<1)throw new IllegalArgumentException("Pattern must have a capture group");}
   catch(com.google.re2j.PatternSyntaxException e){throw new IllegalArgumentException("Invalid supplier pattern: "+e.getMessage());}
  }
 }
 public static void apply(Invoice invoice,List<Rule> rules){
  validate(rules);
  for(Rule rule:rules){
   if(!rule.pattern().isBlank()){
    var match=Pattern.compile(rule.pattern(),Pattern.CASE_INSENSITIVE|Pattern.MULTILINE).matcher(invoice.text);
    if(match.find()&&match.group(1)!=null)invoice.put(rule.field(),match.group(1));
   }else if(!rule.value().isBlank())invoice.put(rule.field(),rule.value());
   if(rule.required()&&invoice.get(rule.field()).isBlank())invoice.warnings.add("Missing supplier field "+rule.field());
  }
 }
}
