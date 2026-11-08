package com.ams.bomcore.service.invoice;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.ams.bomcore.domain.invoice.InvoiceEntity;
import com.ams.bomcore.repository.InvoiceRepository;
import com.ams.bomcore.service.shop.CounterShiftGuard;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class InvoiceServiceFlushTest {
    @Test void purchaseInvoiceIsFlushedBeforePdfReceivingJdbcCanReferenceIt() {
        InvoiceRepository repository=mock(InvoiceRepository.class);
        InvoiceService service=new InvoiceService(repository,
                mock(JdbcTemplate.class),mock(CounterShiftGuard.class));
        UUID tenant=UUID.randomUUID(),company=UUID.randomUUID();
        when(repository.saveAndFlush(any(InvoiceEntity.class))).thenAnswer(invocation->{
            InvoiceEntity entity=invocation.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });
        var invoice=service.create(Map.of(
            "invoiceNumber","1C26ABC/123",
            "invoiceType",InvoiceEntity.TYPE_PURCHASE,
            "partyName","Nhà cung cấp",
            "invoiceDate","2026-11-08",
            "currency","VND"),tenant,company);
        assertNotNull(invoice.getId());
        verify(repository).saveAndFlush(argThat(entry->
            InvoiceEntity.TYPE_PURCHASE.equals(entry.getInvoiceType())
              && tenant.equals(entry.getTenantId()) && company.equals(entry.getCompanyId())));
        verify(repository,never()).save(any(InvoiceEntity.class));
    }
}
