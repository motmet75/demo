package com.ams.bomcore.service.invoice;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.ams.bomcore.domain.invoice.InvoiceEntity;
import com.ams.bomcore.repository.InvoiceRepository;
import com.ams.bomcore.service.shop.CounterShiftGuard;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class InvoiceServiceDateValidationTest {
    private final InvoiceRepository repository = mock(InvoiceRepository.class);
    private final InvoiceService service = new InvoiceService(
            repository, mock(JdbcTemplate.class), mock(CounterShiftGuard.class));
    private final UUID tenantId = UUID.randomUUID(), companyId = UUID.randomUUID();
    private final UUID invoiceId = UUID.randomUUID();

    private InvoiceEntity existing() {
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setId(invoiceId);
        invoice.setTenantId(tenantId);
        invoice.setCompanyId(companyId);
        invoice.setInvoiceDate(LocalDate.of(2026, 11, 1));
        invoice.setDueDate(LocalDate.of(2026, 11, 30));
        invoice.setStatus(InvoiceEntity.STATUS_DRAFT);
        when(repository.findByIdAndTenantIdAndCompanyId(invoiceId, tenantId, companyId))
                .thenReturn(Optional.of(invoice));
        when(repository.save(any(InvoiceEntity.class)))
                .thenAnswer(call -> call.getArgument(0));
        return invoice;
    }

    @Test void blankDateInputsDoNotPreventInvoiceStatusUpdate() {
        InvoiceEntity invoice = existing();
        InvoiceEntity updated = service.update(invoiceId,
                Map.of("status", InvoiceEntity.STATUS_ISSUED,
                       "invoiceDate", "", "dueDate", "   "),
                tenantId, companyId);

        assertSame(invoice, updated);
        assertEquals(InvoiceEntity.STATUS_ISSUED, updated.getStatus());
        assertNull(updated.getInvoiceDate());
        assertNull(updated.getDueDate());
        verify(repository).save(same(invoice));
    }

    @Test void statusOnlyRequestPreservesDatesWhenFieldsAreOmitted() {
        InvoiceEntity invoice = existing();
        service.update(invoiceId, Map.of("status", InvoiceEntity.STATUS_ISSUED),
                tenantId, companyId);
        assertEquals(LocalDate.of(2026, 11, 1), invoice.getInvoiceDate());
        assertEquals(LocalDate.of(2026, 11, 30), invoice.getDueDate());
        assertEquals(InvoiceEntity.STATUS_ISSUED, invoice.getStatus());
    }

    @Test void createAcceptsOptionalBlankDates() {
        when(repository.saveAndFlush(any(InvoiceEntity.class)))
                .thenAnswer(call -> call.getArgument(0));
        InvoiceEntity created = service.create(Map.of(
                "invoiceNumber", "TEST-DATE-001",
                "invoiceType", InvoiceEntity.TYPE_PURCHASE,
                "invoiceDate", "", "dueDate", ""),
                tenantId, companyId);
        assertNull(created.getInvoiceDate());
        assertNull(created.getDueDate());
        verify(repository).saveAndFlush(same(created));
    }

    @Test void validDateIsParsedOnUpdate() {
        InvoiceEntity invoice = existing();
        service.update(invoiceId, Map.of("invoiceDate", "2026-11-08"),
                tenantId, companyId);
        assertEquals(LocalDate.of(2026, 11, 8), invoice.getInvoiceDate());
        assertEquals(LocalDate.of(2026, 11, 30), invoice.getDueDate());
    }

    @Test void invalidDateReturnsReadableErrorInsteadOfParseException() {
        existing();
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.update(invoiceId, Map.of("dueDate", "08/11/2026"),
                        tenantId, companyId));
        assertTrue(error.getMessage().contains("dueDate"));
        assertTrue(error.getMessage().contains("YYYY-MM-DD"));
        verify(repository, never()).save(any(InvoiceEntity.class));
    }
}
