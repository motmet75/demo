package com.ams.bomcore.service.inventory;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.demo.invoicedesk.InvoiceDeskService;
import com.demo.invoicedesk.InvoiceDeskService.Document;
import com.demo.invoicedesk.InvoiceDeskService.Scope;
import com.ams.bomcore.repository.InventoryMovementRepository;
import invoice.Invoice;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class InvoiceStockOutServiceTest {
    private final InvoiceDeskService desk=mock(InvoiceDeskService.class);
    private final InventoryMovementService movements=mock(InventoryMovementService.class);
    private final InventoryMovementRepository repo=mock(InventoryMovementRepository.class);
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final InvoiceStockOutService service=new InvoiceStockOutService(desk,movements,repo,jdbc);
    private final Scope scope=new Scope(UUID.randomUUID(),UUID.randomUUID(),"Example Co","staff");

    @Test void personalInvoiceUsesFullnameWhenCompanyBuyerIsBlank() {
        Invoice invoice=new Invoice();
        invoice.source="personal.pdf";invoice.type="INVOICE";
        invoice.put("serial","1C23ABC");invoice.put("number","159");
        invoice.text="Địa chỉ (Address): Seller Address\n"
                +"Họ tên người mua hàng (Buyer's fullname): NGUYỄN VĂN A\n"
                +"Tên đơn vị (Company's name):\n"
                +"Địa chỉ (Address): Buyer Address\n";
        invoice.items.add(Map.of("description","Máy thủy Yanmar","quantity","1",
                "unitPrice","3703703.7","amount","3703703.7"));
        UUID id=UUID.randomUUID();
        when(desk.document(scope,id)).thenReturn(new Document(id,0,invoice));
        var result=service.document(scope,id);
        assertEquals("PERSONAL",result.get("buyerType"));
        assertEquals("NGUYỄN VĂN A",result.get("buyer"));
        assertEquals("Buyer Address",result.get("buyerAddress"));
        assertEquals(1,((List<?>)result.get("items")).size());
    }

    @Test void companyInvoiceRetainsTaxIdAndExtractedRows() {
        Invoice invoice=new Invoice();
        invoice.source="company.pdf";invoice.type="INVOICE";
        invoice.put("buyer","CÔNG TY TEST");invoice.put("buyerTaxId","3502290749");
        invoice.put("date","2026-10-30");invoice.put("taxRate","8%");
        invoice.items.add(Map.of("description","Máy thủy Yanmar, số máy: 71450",
                "quantity","1","unitPrice","17361111.11","amount","17361111.11"));
        UUID id=UUID.randomUUID();
        when(desk.document(scope,id)).thenReturn(new Document(id,0,invoice));
        var result=service.document(scope,id);
        assertEquals("COMPANY",result.get("buyerType"));
        assertEquals("CÔNG TY TEST",result.get("buyer"));
        assertEquals("8%",result.get("vatRate"));
    }

    @Test void noRecognizedItemsCannotDeductInventory() {
        UUID docId=UUID.randomUUID();
        Invoice invoice=new Invoice();invoice.type="INVOICE";invoice.put("number","9");
        when(desk.document(scope,docId)).thenReturn(new Document(docId,0,invoice));
        var request=new InvoiceStockOutService.Confirm(docId,LocalDate.now(),"SERIAL","9",
            "PERSONAL","Người mua",null,"Địa chỉ","SALE",
            new java.math.BigDecimal("8"),false,false,List.of());
        assertThrows(ResponseStatusException.class,()->service.confirm(scope,request));
        verifyNoInteractions(movements,repo,jdbc);
    }
}
