package com.ams.bomcore.service.shop;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
public class CounterShiftGuard {
    private final JdbcTemplate db;
    public CounterShiftGuard(JdbcTemplate db) { this.db=db; }
    /** Called inside payment transactions; the company lock serializes receipts with closing. */
    public void requireOpenForReceipt(UUID tenantId, UUID companyId) {
        db.queryForList("SELECT id FROM company WHERE id=? AND tenant_id=? FOR UPDATE",companyId,tenantId);
        boolean adopted=Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM shop_counter_shift WHERE tenant_id=? AND company_id=?)",Boolean.class,tenantId,companyId));
        if(adopted && !Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM shop_counter_shift WHERE tenant_id=? AND company_id=? AND status='OPEN')",Boolean.class,tenantId,companyId)))
            throw new IllegalStateException("Cần mở ca trước khi ghi nhận thu / chi tiền");
    }
}
