package com.ams.bomcore.controller.shop;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import java.nio.file.*;
import java.util.*;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

/** Explicit opt-in; every write is rolled back, including successful open/close and stock movements. */
@EnabledIfEnvironmentVariable(named="RUN_MARE_INTEGRATION", matches="true")
class CounterWorkflowIntegrationTest {
    @Test void shiftAndInventoryInvariants() throws Exception {
        Properties p=new Properties(); try(var in=Files.newInputStream(Path.of("src/main/resources/application.properties"))) {p.load(in);}
        var ds=new DriverManagerDataSource(p.getProperty("spring.datasource.url"),p.getProperty("spring.datasource.username"),p.getProperty("spring.datasource.password"));
        var db=new JdbcTemplate(ds);
        var reports=new ShopCounterOpsController(db,null,null,null,null) {
            @Override public ResponseEntity<?> shiftSummary(UUID t,UUID c,String ht,String hc,java.time.Instant from,java.time.Instant to) {
                return ResponseEntity.ok(new LinkedHashMap<>(Map.of("cashIn",BigDecimal.ZERO,"bankingIn",BigDecimal.ZERO,"paymentNoteTotal",BigDecimal.ZERO)));
            }
        };
        var controller=new ShopCounterWorkflowController(db,reports);
        var guard=new com.ams.bomcore.service.shop.CounterShiftGuard(db);
        var c=UUID.fromString("28fa1d59-7af1-3e11-586d-ae3bbee8a952"); var t=UUID.fromString("720a023d-5c43-2c3b-cff5-3a7d980f288c");
        var auth=new UsernamePasswordAuthenticationToken("workflow-test",null);
        new TransactionTemplate(new DataSourceTransactionManager(ds)).execute(status -> {
            status.setRollbackOnly();
            String shiftDate=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toString();
            assertNull(controller.state(t,c).get("active"),"Run only before a real shift opens");
            assertThrows(ResponseStatusException.class,()->controller.open(t,c,auth,Map.of("openingCash",-1,"shiftNumber",1,"shiftDate",shiftDate)));
            BigDecimal previous=controller.state(t,c).get("previousCash")==null?BigDecimal.ZERO:new BigDecimal(controller.state(t,c).get("previousCash").toString());
            var opening=previous.add(new BigDecimal("500000"));
            assertThrows(ResponseStatusException.class,()->controller.open(t,c,auth,Map.of("openingCash",opening,"shiftNumber",1,"shiftDate",shiftDate)));
            var state=controller.open(t,c,auth,Map.of("openingCash",opening,"reason","Rollback test","confirmed",true,"shiftNumber",1,"shiftDate",shiftDate));
            var shift=(Map<?,?>)state.get("active");
            guard.requireOpenForReceipt(t,c);
            assertThrows(ResponseStatusException.class,()->controller.stock(UUID.randomUUID(),c));
            assertThrows(ResponseStatusException.class,()->controller.open(t,c,auth,Map.of("openingCash",opening,"shiftNumber",1,"shiftDate",shiftDate)));
            var stock=controller.stock(t,c); assertFalse(stock.isEmpty()); var inv=stock.get(0);
            var line=new HashMap<String,Object>(); line.put("inventoryId",inv.get("id"));line.put("shiftId",shift.get("id"));line.put("requestId",UUID.randomUUID()); line.put("type","IN");line.put("quantity",2);line.put("unit",inv.get("unit"));line.put("unitPrice",1000);
            var before=new BigDecimal(inv.get("quantity_on_hand").toString());
            controller.movement(t,c,auth,line);
            assertEquals(true,controller.movement(t,c,auth,line).get("alreadySaved"));
            assertEquals(0,before.add(new BigDecimal("2")).compareTo(db.queryForObject("SELECT quantity_on_hand FROM inventory WHERE id=?",BigDecimal.class,inv.get("id"))));
            line.put("requestId",UUID.randomUUID());line.put("type","ADJUSTMENT");
            assertThrows(ResponseStatusException.class,()->controller.movement(t,c,auth,line));
            line.put("type","OUT");line.put("quantity","9999999999");assertThrows(ResponseStatusException.class,()->controller.movement(t,c,auth,line));
            line.put("quantity",1);line.put("unit","unconfigured-carton");assertThrows(ResponseStatusException.class,()->controller.movement(t,c,auth,line));
            line.put("unit",inv.get("unit"));line.put("inventoryId",UUID.randomUUID());assertThrows(ResponseStatusException.class,()->controller.movement(t,c,auth,line));
            var close=new HashMap<String,Object>();close.put("shiftId",shift.get("id"));close.put("confirmed",true);close.put("actualCash",opening);close.put("actualBank",0);close.put("handoverTo","test receiver");close.put("counts",List.of());
            assertThrows(ResponseStatusException.class,()->controller.close(t,c,auth,close));
            var counts=new ArrayList<Map<String,Object>>();for(var row:controller.stock(t,c)) counts.add(new HashMap<>(Map.of("id",row.get("id"),"expected",row.get("quantity_on_hand"),"actual",row.get("quantity_on_hand"))));
            close.put("counts",counts);close.put("actualBank",1);assertThrows(ResponseStatusException.class,()->controller.close(t,c,auth,close));close.put("actualBank",0);
            counts.get(0).put("actual",-1);assertThrows(ResponseStatusException.class,()->controller.close(t,c,auth,close));
            counts.get(0).put("actual",new BigDecimal(counts.get(0).get("expected").toString()).add(BigDecimal.ONE));assertThrows(ResponseStatusException.class,()->controller.close(t,c,auth,close));
            counts.get(0).put("reason","test stock variance");
            var done=controller.close(t,c,auth,close);assertNull(done.get("active"));assertEquals(0,opening.compareTo(new BigDecimal(done.get("previousCash").toString())));
            line.put("inventoryId",inv.get("id"));line.put("quantity",1);assertThrows(ResponseStatusException.class,()->controller.movement(t,c,auth,line));
            assertThrows(IllegalStateException.class,()->guard.requireOpenForReceipt(t,c));
            assertTrue(((Map<?,?>)((List<?>)done.get("history")).get(0)).get("inventory_counts") instanceof List<?>);
            assertThrows(ResponseStatusException.class,()->controller.open(t,c,auth,Map.of("openingCash",opening,"shiftNumber",1,"shiftDate",shiftDate)));
            assertThrows(ResponseStatusException.class,()->controller.open(t,c,auth,Map.of("openingCash",opening,"shiftNumber",3,"shiftDate",shiftDate)));
            assertThrows(ResponseStatusException.class,()->controller.open(t,c,auth,Map.of("openingCash",opening,"shiftNumber",2,"shiftDate","2000-01-01")));
            var next=controller.open(t,c,auth,Map.of("openingCash",opening,"shiftNumber",2,"shiftDate",shiftDate));assertNotNull(next.get("active"));
            assertEquals(2,((Number)((Map<?,?>)next.get("active")).get("shift_number")).intValue());
            assertEquals(2,((List<?>)next.get("usedShifts")).size());
            return null;
        });
        assertNull(controller.state(t,c).get("active"),"Test transaction must leave no open shift");
    }
}
