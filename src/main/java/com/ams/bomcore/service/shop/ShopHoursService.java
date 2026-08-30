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
        if (closure != null && closure.getForceOpenUntil() != null && closure.getForceOpenUntil().isAfter(now)) {
            return new OrderingStatus(true, null, null);
        }

        List<ShopShift> shifts = shopShiftRepository.findAllByTenantIdAndCompanyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(tenantId, companyId);
        if (shifts.isEmpty()) {
            // Ordering is only allowed inside a configured shift window — no schedule means closed.
            return new OrderingStatus(false, "OUTSIDE_HOURS", null);
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
        if (shifts.isEmpty()) {
            throw new IllegalArgumentException("No opening hours configured yet. Set up the shift schedule before using Close Today.");
        }
        Instant now = Instant.now();
        Instant reopensAt = computeNextOpenTime(shifts, zone, now);
        if (reopensAt == null) {
            // Shouldn't normally happen (active shifts exist but none found within 7 days) —
            // surface it rather than guessing a time.
            throw new IllegalStateException("Could not determine the next opening time from the configured shifts.");
        }
        ShopClosure closure = shopClosureRepository.findByTenantIdAndCompanyId(tenantId, companyId).orElseGet(ShopClosure::new);
        closure.setTenantId(tenantId);
        closure.setCompanyId(companyId);
        closure.setClosedAt(now);
        closure.setClosedUntil(reopensAt);
        closure.setForceOpenUntil(null);
        closure.setClosedBy(closedBy);
        shopClosureRepository.save(closure);
        return getOrderingStatus(tenantId, companyId, zone);
    }

    @Transactional(readOnly = true)
    public Instant previewNextOpenTime(UUID tenantId, UUID companyId, ZoneId zone) {
        List<ShopShift> shifts = shopShiftRepository.findAllByTenantIdAndCompanyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(tenantId, companyId);
        if (shifts.isEmpty()) return null;
        return computeNextOpenTime(shifts, zone, Instant.now());
    }

    @Transactional
    public OrderingStatus reopenNow(UUID tenantId, UUID companyId, ZoneId zone) {
        Instant now = Instant.now();
        ShopClosure closure = shopClosureRepository.findByTenantIdAndCompanyId(tenantId, companyId).orElseGet(ShopClosure::new);
        closure.setTenantId(tenantId);
        closure.setCompanyId(companyId);
        closure.setClosedUntil(null);
        // Force-open override: lets staff open even with no shift configured, or outside
        // the current shift window. Lasts until end of the current business day, so it
        // doesn't silently linger — staff can Close Today again anytime to cancel it.
        Instant endOfDay = now.atZone(zone).toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
        closure.setForceOpenUntil(endOfDay);
        shopClosureRepository.save(closure);
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
