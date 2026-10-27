package com.demo.invoicedesk;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class InvoiceDeskPageController {
 @GetMapping("/invoice-desk") public String redirect(){return "redirect:/invoice-desk/";}
 @GetMapping("/invoice-desk/") public String page(){return "forward:/invoice-desk/index.html";}
}
