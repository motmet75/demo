package com.ams.bomcore.service.inventory;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.repository.InventoryRepository;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class InventoryPatchXlsxCurrencyTest {
    private static final UUID TENANT=UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID COMPANY=UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID ID=UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID OTHER=UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final String[] HEADERS={
        "id","original_currency","original_unit_price","currency","unit_price",
        "confirm_currency_change"
    };

    private InventoryEntity inventory(UUID id,String currency,String price){
        InventoryEntity inv=new InventoryEntity();
        inv.setId(id);
        inv.setTenantId(TENANT);
        inv.setCompanyId(COMPANY);
        inv.setCurrency(currency);
        inv.setUnitPrice(new BigDecimal(price));
        return inv;
    }
    private MockMultipartFile excel(Object[][] values) throws Exception {
        try(var wb=new XSSFWorkbook();var bytes=new ByteArrayOutputStream()){
            var sh=wb.createSheet("inventory_patch");
            var header=sh.createRow(0);
            for(int i=0;i<HEADERS.length;i++)header.createCell(i).setCellValue(HEADERS[i]);
            for(int n=0;n<values.length;n++){
                Row row=sh.createRow(n+1);
                for(int i=0;i<HEADERS.length;i++){
                    Object v=values[n][i];
                    if(v instanceof Number num)row.createCell(i).setCellValue(num.doubleValue());
                    else if(v!=null)row.createCell(i).setCellValue(String.valueOf(v));
                }
            }
            wb.write(bytes);
            return new MockMultipartFile("file","inventory-price.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    bytes.toByteArray());
        }
    }

    @Test void bulkCurrencyAndPriceUpdateRequiresConfirmedReview() throws Exception {
        var repo=mock(InventoryRepository.class);
        var inv=inventory(ID,"USD","12.5");
        when(repo.findById(ID)).thenReturn(Optional.of(inv));
        var result=new InventoryPatchXlsxService(repo).patchFromXlsx(excel(
            new Object[][]{{ID.toString(),"USD",12.5,"VND",317500,"YES"}}),TENANT,COMPANY);
        assertTrue(result.isSuccess(),result.getMessage());
        assertEquals(1,result.getUpdated());
        assertEquals("VND",inv.getCurrency());
        assertEquals(0,inv.getUnitPrice().compareTo(new BigDecimal("317500")));
        verify(repo,times(1)).save(inv);
    }

    @Test void changingOnlyCurrencyWithoutApprovalDoesNotWrite() throws Exception {
        var repo=mock(InventoryRepository.class);
        var inv=inventory(ID,"USD","12.5");
        when(repo.findById(ID)).thenReturn(Optional.of(inv));
        var result=new InventoryPatchXlsxService(repo).patchFromXlsx(excel(
            new Object[][]{{ID.toString(),"USD",12.5,"VND",12.5,""}}),TENANT,COMPANY);
        assertFalse(result.isSuccess());
        assertTrue(result.getErrors().get(0).contains("confirm_currency_change"));
        assertEquals("USD",inv.getCurrency());
        verify(repo,never()).save(any());
    }

    @Test void rejectsEntireWorkbookIfAnyCurrencyIsInvalid() throws Exception {
        var repo=mock(InventoryRepository.class);
        var first=inventory(ID,"USD","12.5");
        var second=inventory(OTHER,"USD","7.5");
        when(repo.findById(ID)).thenReturn(Optional.of(first));
        when(repo.findById(OTHER)).thenReturn(Optional.of(second));
        var result=new InventoryPatchXlsxService(repo).patchFromXlsx(excel(
            new Object[][]{
              {ID.toString(),"USD",12.5,"VND",317500,"YES"},
              {OTHER.toString(),"USD",7.5,"ABC",190000,"YES"}
            }),TENANT,COMPANY);
        assertFalse(result.isSuccess());
        assertEquals("USD",first.getCurrency());
        assertEquals(0,first.getUnitPrice().compareTo(new BigDecimal("12.5")));
        verify(repo,never()).save(any());
    }

    @Test void staleExcelPriceMustNotReplaceRecentlyChangedUnitPrice() throws Exception {
        var repo=mock(InventoryRepository.class);
        var inv=inventory(ID,"USD","15");
        when(repo.findById(ID)).thenReturn(Optional.of(inv));
        var result=new InventoryPatchXlsxService(repo).patchFromXlsx(excel(
            new Object[][]{{ID.toString(),"USD",12.5,"VND",317500,"YES"}}),TENANT,COMPANY);
        assertFalse(result.isSuccess());
        assertTrue(result.getErrors().get(0).contains("tải lại Excel"));
        verify(repo,never()).save(any());
    }

    @Test void priceUpdatePreservesCurrencyWhenNoConversionRequested() throws Exception {
        var repo=mock(InventoryRepository.class);
        var inv=inventory(ID,"USD","12.5");
        when(repo.findById(ID)).thenReturn(Optional.of(inv));
        var result=new InventoryPatchXlsxService(repo).patchFromXlsx(excel(
            new Object[][]{{ID.toString(),"USD",12.5,"USD",18.75,""}}),TENANT,COMPANY);
        assertTrue(result.isSuccess());
        assertEquals("USD",inv.getCurrency());
        assertEquals(0,inv.getUnitPrice().compareTo(new BigDecimal("18.75")));
        verify(repo,times(1)).save(inv);
    }
}
