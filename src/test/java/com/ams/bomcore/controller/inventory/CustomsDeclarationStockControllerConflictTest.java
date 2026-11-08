package com.ams.bomcore.controller.inventory;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class CustomsDeclarationStockControllerConflictTest {
    private final CustomsDeclarationStockController controller =
            new CustomsDeclarationStockController(null, null);

    @Test
    void conflictReturnsSpecificReasonInsteadOfOnlyConflictTitle() {
        var response = controller.explainStatus(new ResponseStatusException(
                HttpStatus.CONFLICT, "Tờ khai số 123 đã nhập kho rồi."));
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(409, body.get("status"));
        assertEquals("CUSTOMS_CONFLICT", body.get("code"));
        assertEquals("Tờ khai số 123 đã nhập kho rồi.", body.get("detail"));
        assertEquals(body.get("detail"), body.get("message"));
    }

    @Test
    void preexistingMaterialCodeHasActionableConflictMessage() {
        var response = controller.explainDbConflict(new DataIntegrityViolationException(
                "ERROR: duplicate key violates unique constraint \"uq_material_tenant_company_code_ci\""));
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        String detail = String.valueOf(response.getBody().get("detail"));
        assertTrue(detail.contains("Mã nguyên vật liệu"));
        assertTrue(detail.contains("trùng"));
        assertFalse(detail.contains("SQL"));
    }

    @Test
    void duplicatePostedDeclarationExplainsHistoryCheck() {
        var response = controller.explainDbConflict(new DataIntegrityViolationException(
                "ERROR: duplicate key violates unique constraint \"inventory_customs_declaration_posted_uniq\""));
        String detail = String.valueOf(response.getBody().get("detail"));
        assertTrue(detail.contains("lịch sử tờ khai"));
    }

    @Test
    void invalidDeclarationReturnsBadRequestWithMessage() {
        var response = controller.explainStatus(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Dòng 4: chưa chọn kho nhận."));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Dòng 4: chưa chọn kho nhận.", response.getBody().get("detail"));
    }
}
