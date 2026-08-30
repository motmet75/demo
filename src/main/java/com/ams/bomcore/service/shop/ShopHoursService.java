package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.shop.ShopClosure;
import com.ams.bomcore.domain.shop.ShopShift;
import com.ams.bomcore.repository.ShopClosureRepository;
import com.ams.bomcore.repository.ShopShiftRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ShopHoursService {

    private final ShopShiftRepository shopShiftRepository;
    private final ShopClosureRepository shopClosureRepository;

    public ShopHoursService(ShopShiftRepository shopShiftRepository,
                            ShopClosureRepository shopClosureRepository) {
        this.shopShiftRepository = shopShiftRepository;
        this.shopClosureRepository = shopClosureRepository;
    }

    // ── DTOs ─────────────────────────────────────────────────────────

    public record ShiftDto(UUID id, Integer dayOfWeek, LocalTime startTime, LocalTime endTime,
                            String label, Boolean isActive) {}

    public record ShiftUpsertRequest(Integer dayOfWeek, String startTime, String endTime,
                                      String label, Boolean isActive) {}

    /**
     * reason is one of: null (open), "MANUAL_CLOSED" (staff pressed Close today),
     * "OUTSIDE_HOURS" (no shift covers the current time).
     */
    public record OrderingStatus(boolean open, String reason, Instant reopensAt) {}

    // ── Shift schedule CRUD ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ShiftDto> getShiftSchedule(UUID tenantId, UUID companyId) {
        return shopShiftRepository.findAllByTenantIdAndCompanyIdOrderByDayOfWeekAscStartTimeAsc(tenantId, companyId)
                .stream()
                .map(s -> new ShiftDto(s.getId(), s.getDayOfWeek(), s.getStartTime(), s.getEndTime(), s.getLabel(), s.getIsActive()))
                .toList();
    }

    /** Replaces the whole weekly schedule for a company — simplest correct semantics for an admin editor screen. */
    @Transactional
    public List<ShiftDto> saveShiftSchedule(UUID tenantId, UUID companyId, List<ShiftUpsertRequest> shifts) {
        shopShiftRepository.deleteAllByTenantIdAndCompanyId(tenantId, companyId);
        if (shifts == null) shifts = List.of();
        for (ShiftUpsertRequest req : shifts) {
            if (req.dayOfWeek() == null || req.startTime() == null || req.endTime() == null) continue;
            LocalTime start = LocalTime.parse(req.startTime());
            LocalTime end = LocalTime.parse(req.endTime());
            if (!start.isBefore(end)) {
                throw new IllegalArgumentException("Shift start time must be before end time (shifts cannot cross midnight — split into two shifts instead)");
            }
            ShopShift shift = new ShopShift();
            shift.setTenantId(tenantId);
            shift.setCompanyId(companyId);
            shift.setDayOfWeek(req.dayOfWeek());
            shift.setStartTime(start);
            shift.setEndTime(end);
            shift.setLabel(req.label());
            shift.setIsActive(req.isActive() == null || req.isActive());
            shopShiftRepository.save(shift);
        }
        return getShiftSchedule(tenantId, companyId);
    }

    // ── Ordering status ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public OrderingStatus getOrderingStatus(UUID tenantId, UUID companyId, ZoneId zone) {
        Instant now = Instant.now();

        ShopClosure closure = shopClosureRepository.findByTenantIdAndCompanyId(tenantId, companyId).orElse(null);
        if (closure != null && closure.getClosedUntil() != null && closure.getClosedUntil().isAfter(now)) {
            return new OrderingStatus(false, "MANUAL_CLOSED", closure.getClosedUntil());
        }

        List<ShopShift> shifts = shopShiftRepository.findAllByTenantIdAndCompanyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(tenantId, companyId);
        if (shifts.isEmpty()) {
            // No schedule configured at all — don't restrict ordering; shift hours are opt-in.
            return new OrderingStatus(true, null, null);
        }

        ZonedDateTime nowZ = now.atZone(zone);
        int dow = nowZ.getDayOfWeek().getValue();
        LocalTime nowTime = nowZ.toLocalTime();
        boolean withinShift = shifts.stream().anyMatch(s ->
                s.getDayOfWeek().equals(dow) && !nowTime.isBefore(s.getStartTime()) && nowTime.isBefore(s.getEndTime()));
        if (withinShift) {
            return new OrderingStatus(true, null, null);
        }
        return new OrderingStatus(false, "OUTSIDE_HOURS", computeNextOpenTime(shifts, zone, now));
    }

    /** Throws IllegalStateException if ordering is currently closed. Call this from order-creation. */
    @Transactional(readOnly = true)
    public void assertOpenForOrdering(UUID tenantId, UUID companyId, ZoneId zone) {
        OrderingStatus status = getOrderingStatus(tenantId, companyId, zone);
        if (!status.open()) {
            throw new IllegalStateException(status.reason() == null ? "Shop is closed" : status.reason());
        }
    }

    // ── Close today / reopen ────────────────────────────────────────

    @Transactional
    public OrderingStatus closeToday(UUID tenantId, UUID companyId, ZoneId zone, String closedBy) {
        List<ShopShift> shifts = shopShiftRepository.findAllByTenantIdAndCompanyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(tenantId, companyId);
        Instant now = Instant.now();
        Instant reopensAt = computeNextOpenTime(shifts, zone, now);
        if (reopensAt == null) {
            // No shift schedule configured (or none found in the next 7 days) — fall back to
            // "24 hours from now" so a forgotten close doesn't silently stay closed forever.
            // Staff can still reopen manually at any time.
            reopensAt = now.plusSeconds(24 * 3600);
        }
        ShopClosure closure = shopClosureRepository.findByTenantIdAndCompanyId(tenantId, companyId).orElseGet(ShopClosure::new);
        closure.setTenantId(tenantId);
        closure.setCompanyId(companyId);
        closure.setClosedAt(now);
        closure.setClosedUntil(reopensAt);
        closure.setClosedBy(closedBy);
        shopClosureRepository.save(closure);
        return getOrderingStatus(tenantId, companyId, zone);
    }

    @Transactional
    public OrderingStatus reopenNow(UUID tenantId, UUID companyId, ZoneId zone) {
        shopClosureRepository.findByTenantIdAndCompanyId(tenantId, companyId).ifPresent(c -> {
            c.setClosedUntil(null);
            shopClosureRepository.save(c);
        });
        return getOrderingStatus(tenantId, companyId, zone);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    /** Finds the next moment (today or up to 7 days out) a shift starts, strictly after `from`. */
    private Instant computeNextOpenTime(List<ShopShift> shifts, ZoneId zone, Instant from) {
        if (shifts.isEmpty()) return null;
        ZonedDateTime fromZ = from.atZone(zone);
        for (int dayOffset = 0; dayOffset <= 7; dayOffset++) {
            ZonedDateTime candidateDay = fromZ.plusDays(dayOffset);
            int dow = candidateDay.getDayOfWeek().getValue();
            for (ShopShift s : shifts) {
                if (!s.getDayOfWeek().equals(dow)) continue;
                ZonedDateTime shiftStart = candidateDay.toLocalDate().atTime(s.getStartTime()).atZone(zone);
                if (!shiftStart.isAfter(fromZ)) continue; // already started/passed — look for a later one
                return shiftStart.toInstant();
            }
        }
        return null;
    }
}
