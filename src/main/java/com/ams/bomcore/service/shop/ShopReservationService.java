package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.shop.ShopReservation;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.repository.ShopReservationRepository;
import com.ams.bomcore.repository.ShopTableRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class ShopReservationService {

    private static final List<String> ACTIVE_STATUSES = List.of(
            ShopReservation.STATUS_PENDING,
            ShopReservation.STATUS_CONFIRMED,
            ShopReservation.STATUS_SEATED);

    public record CreateReservationRequest(UUID tableId, String customerName, String customerPhone, String customerEmail,
                                           Integer partySize, Instant reservationTime, Integer durationMinutes, String note) {}

    public record AvailabilityResult(
            boolean available,
            int tablesTotal,
            int tablesBooked) {}

    public record TableDaySlots(
            UUID tableId,
            String tableName,
            List<BookedSlot> booked) {}

    public record BookedSlot(
            Instant start,
            Instant end,
            String status,
            String customerName,
            UUID reservationId,
            boolean hidden) {}

    private final ShopReservationRepository shopReservationRepository;
    private final ShopTableRepository shopTableRepository;
    private final ShopHoursService shopHoursService;
    private final ShopReservationNotificationService shopReservationNotificationService;
    private static final List<String> ALL_STATUSES = List.of(
            ShopReservation.STATUS_PENDING, ShopReservation.STATUS_CONFIRMED, ShopReservation.STATUS_SEATED,
            ShopReservation.STATUS_COMPLETED, ShopReservation.STATUS_CANCELLED, ShopReservation.STATUS_NO_SHOW);

    private static final List<String> HIDDEN_STATUSES = List.of(
            ShopReservation.STATUS_CANCELLED, ShopReservation.STATUS_NO_SHOW);

    public ShopReservationService(ShopReservationRepository shopReservationRepository,
                                  ShopTableRepository shopTableRepository,
                                  ShopHoursService shopHoursService,
                                  ShopReservationNotificationService shopReservationNotificationService) {
        this.shopReservationRepository = shopReservationRepository;
        this.shopTableRepository = shopTableRepository;
        this.shopHoursService = shopHoursService;
        this.shopReservationNotificationService = shopReservationNotificationService;
    }

    // ── Availability ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AvailabilityResult checkAvailability(UUID tenantId,
                                                UUID companyId,
                                                Instant reservationTime,
                                                int durationMinutes) {
        int totalTables = (int) shopTableRepository
                .findAllByTenantIdAndCompanyIdAndIsActiveTrueOrderByTableNameAsc(tenantId, companyId)
                .size();

        int booked = countOverlapping(
                tenantId,
                companyId,
                reservationTime,
                durationMinutes,
                null);

        return new AvailabilityResult(booked < totalTables, totalTables, booked);
    }

    private int countOverlapping(UUID tenantId,
                                 UUID companyId,
                                 Instant start,
                                 int durationMinutes,
                                 UUID excludeReservationId) {
        Instant end = start.plusSeconds(durationMinutes * 60L);

        // Widen the fetch window to catch reservations that started before
        // the requested slot but are still active during it.
        Instant fetchFrom = start.minusSeconds(6 * 3600L);
        Instant fetchTo = end.plusSeconds(6 * 3600L);

        return (int) shopReservationRepository
                .findOverlapping(
                        tenantId,
                        companyId,
                        ACTIVE_STATUSES,
                        fetchFrom,
                        fetchTo)
                .stream()
                .filter(r -> excludeReservationId == null
                        || !r.getId().equals(excludeReservationId))
                .filter(r -> r.getReservationTime().isBefore(end)
                        && r.getReservationEndTime().isAfter(start))
                .count();
    }

    private boolean isTableOverlapping(UUID tenantId,
                                       UUID companyId,
                                       UUID tableId,
                                       Instant start,
                                       int durationMinutes,
                                       UUID excludeReservationId) {
        Instant end = start.plusSeconds(durationMinutes * 60L);
        Instant fetchFrom = start.minusSeconds(6 * 3600L);
        Instant fetchTo = end.plusSeconds(6 * 3600L);

        return shopReservationRepository
                .findOverlapping(
                        tenantId,
                        companyId,
                        ACTIVE_STATUSES,
                        fetchFrom,
                        fetchTo)
                .stream()
                .filter(r -> excludeReservationId == null
                        || !r.getId().equals(excludeReservationId))
                .filter(r -> tableId.equals(r.getTableId()))
                .anyMatch(r -> r.getReservationTime().isBefore(end)
                        && r.getReservationEndTime().isAfter(start));
    }

    // ── Create ───────────────────────────────────────────────────────

    @Transactional
    public ShopReservation createReservation(UUID tenantId,
                                             UUID companyId,
                                             CreateReservationRequest req,
                                             ZoneId zone,
                                             String source) {
        if (req == null) {
            throw new IllegalArgumentException("Reservation request is required");
        }

        if (req.customerName() == null || req.customerName().isBlank()) {
            throw new IllegalArgumentException("Customer name is required");
        }

        if (req.partySize() == null || req.partySize() < 1) {
            throw new IllegalArgumentException("Party size must be at least 1");
        }

        if (req.reservationTime() == null) {
            throw new IllegalArgumentException("Reservation time is required");
        }

        if (req.reservationTime().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Reservation time must be in the future");
        }

        int duration = req.durationMinutes() != null && req.durationMinutes() > 0
                ? req.durationMinutes()
                : 90;

        // Reservation must fall inside a configured opening shift.
        shopHoursService.assertOpenAtInstant(
                tenantId,
                companyId,
                req.reservationTime(),
                zone);

        if (req.tableId() != null) {
            ShopTable table = shopTableRepository.findById(req.tableId())
                    .orElseThrow(() -> new NoSuchElementException("Table not found"));

            if (!tenantId.equals(table.getTenantId())
                    || !companyId.equals(table.getCompanyId())) {
                throw new IllegalArgumentException("Table does not belong to this company");
            }

            if (!Boolean.TRUE.equals(table.getIsActive())) {
                throw new IllegalArgumentException("Table is not active");
            }

            if (isTableOverlapping(
                    tenantId,
                    companyId,
                    req.tableId(),
                    req.reservationTime(),
                    duration,
                    null)) {
                throw new IllegalStateException(
                        "That table is already booked for the selected time — please choose a different table or time.");
            }
        } else {
            AvailabilityResult availability = checkAvailability(
                    tenantId,
                    companyId,
                    req.reservationTime(),
                    duration);

            if (!availability.available()) {
                throw new IllegalStateException(
                        "No tables available for that time — please choose a different slot.");
            }
        }

        ShopReservation reservation = new ShopReservation();
        reservation.setTenantId(tenantId);
        reservation.setCompanyId(companyId);

        if (req.tableId() != null) {
            ShopTable table = shopTableRepository.findById(req.tableId())
                    .orElseThrow(() -> new NoSuchElementException("Table not found"));
            reservation.setTableId(table.getId());
            reservation.setTableName(table.getTableName());
        }

        reservation.setCustomerName(req.customerName().trim());
        reservation.setCustomerPhone(req.customerPhone());
        reservation.setCustomerEmail(req.customerEmail());
        reservation.setPartySize(req.partySize());
        reservation.setReservationTime(req.reservationTime());
        reservation.setDurationMinutes(duration);
        reservation.setNote(req.note());
        reservation.setSource(source);
        reservation.setStatus(ShopReservation.STATUS_PENDING);

        shopReservationRepository.save(reservation);
        shopReservationNotificationService.notifyReservationCreated(reservation, zone);
        return reservation;
    }

    // ── Day slots ────────────────────────────────────────────────────


    @Transactional(readOnly = true)
    public List<TableDaySlots> getDaySlots(UUID tenantId, UUID companyId, Instant dayStart, Instant dayEnd, boolean includeHidden) {
        List<ShopTable> tables = shopTableRepository.findAllByTenantIdAndCompanyIdAndIsActiveTrueOrderByTableNameAsc(tenantId, companyId);
        List<String> statuses = includeHidden ? ALL_STATUSES : ACTIVE_STATUSES;
        List<ShopReservation> dayReservations = shopReservationRepository.findOverlapping(
                        tenantId, companyId, statuses, dayStart.minusSeconds(12 * 3600L), dayEnd.plusSeconds(12 * 3600L))
                .stream()
                .filter(r -> r.getReservationTime().isBefore(dayEnd) && r.getReservationEndTime().isAfter(dayStart))
                .toList();

        return tables.stream().map(table -> {
            List<BookedSlot> ranges = dayReservations.stream()
                    .filter(r -> table.getId().equals(r.getTableId()))
                    .map(r -> new BookedSlot(
                            r.getReservationTime(),
                            r.getReservationEndTime(),
                            r.getStatus(),
                            r.getCustomerName(),
                            r.getId(),
                            HIDDEN_STATUSES.contains(r.getStatus())))
                    .toList();

            return new TableDaySlots(
                    table.getId(),
                    table.getTableName(),
                    ranges);
        }).toList();
    }

    // ── Staff actions ────────────────────────────────────────────────

    @Transactional
    public ShopReservation confirm(UUID reservationId,
                                   UUID tenantId,
                                   UUID companyId,
                                   UUID tableId) {
        ShopReservation r = getOwned(reservationId, tenantId, companyId);

        if (tableId != null) {
            ShopTable table = getOwnedTable(tableId, tenantId, companyId);
            if (!Boolean.TRUE.equals(table.getIsActive())) {
                throw new IllegalArgumentException("Table is not active");
            }

            r.setTableId(table.getId());
            r.setTableName(table.getTableName());
        }

        r.setStatus(ShopReservation.STATUS_CONFIRMED);
        r.setConfirmedAt(Instant.now());

        return shopReservationRepository.save(r);
    }

    @Transactional
    public ShopReservation seat(UUID reservationId,
                                UUID tenantId,
                                UUID companyId,
                                UUID tableId) {
        ShopReservation r = getOwned(reservationId, tenantId, companyId);

        if (tableId != null) {
            ShopTable table = getOwnedTable(tableId, tenantId, companyId);
            if (!Boolean.TRUE.equals(table.getIsActive())) {
                throw new IllegalArgumentException("Table is not active");
            }

            r.setTableId(table.getId());
            r.setTableName(table.getTableName());
        }

        if (r.getTableId() == null) {
            throw new IllegalArgumentException("Assign a table before seating this reservation");
        }

        r.setStatus(ShopReservation.STATUS_SEATED);
        r.setSeatedAt(Instant.now());

        return shopReservationRepository.save(r);
    }

    @Transactional
    public ShopReservation complete(UUID reservationId,
                                    UUID tenantId,
                                    UUID companyId) {
        ShopReservation r = getOwned(reservationId, tenantId, companyId);
        r.setStatus(ShopReservation.STATUS_COMPLETED);
        return shopReservationRepository.save(r);
    }

    @Transactional
    public ShopReservation cancel(UUID reservationId, UUID tenantId, UUID companyId, String reason, ZoneId zone) {
        ShopReservation r = getOwned(reservationId, tenantId, companyId);
        r.setStatus(ShopReservation.STATUS_CANCELLED);
        r.setCancelledAt(Instant.now());
        r.setCancelReason(reason);
        shopReservationRepository.save(r);
        shopReservationNotificationService.notifyReservationCancelled(r, reason, zone);
        return r;
    }

    @Transactional
    public ShopReservation restore(UUID reservationId, UUID tenantId, UUID companyId) {
        ShopReservation r = getOwned(reservationId, tenantId, companyId);
        if (!HIDDEN_STATUSES.contains(r.getStatus())) {
            throw new IllegalStateException("Only cancelled or no-show reservations can be restored");
        }
        r.setStatus(ShopReservation.STATUS_PENDING);
        r.setCancelledAt(null);
        r.setCancelReason(null);
        return shopReservationRepository.save(r);
    }

    @Transactional
    public ShopReservation markNoShow(UUID reservationId,
                                      UUID tenantId,
                                      UUID companyId) {
        ShopReservation r = getOwned(reservationId, tenantId, companyId);
        r.setStatus(ShopReservation.STATUS_NO_SHOW);
        return shopReservationRepository.save(r);
    }

    // ── Customer self-service (by token) ────────────────────────────

    @Transactional(readOnly = true)
    public ShopReservation getByToken(String token,
                                      UUID tenantId,
                                      UUID companyId) {
        return shopReservationRepository
                .findByTokenAndTenantIdAndCompanyId(token, tenantId, companyId)
                .orElseThrow(() -> new NoSuchElementException("Reservation not found"));
    }

    @Transactional
    public ShopReservation cancelByToken(String token,
                                         UUID tenantId,
                                         UUID companyId) {
        ShopReservation r = getByToken(token, tenantId, companyId);
        r.setStatus(ShopReservation.STATUS_CANCELLED);
        r.setCancelledAt(Instant.now());
        r.setCancelReason("Cancelled by customer");
        return shopReservationRepository.save(r);
    }

    // ── Listing ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ShopReservation> listByRange(UUID tenantId,
                                             UUID companyId,
                                             Instant from,
                                             Instant to) {
        if (from == null && to == null) {
            return shopReservationRepository
                    .findAllByTenantIdAndCompanyIdOrderByReservationTimeAsc(
                            tenantId,
                            companyId);
        }

        Instant f = from != null ? from : Instant.EPOCH;
        Instant t = to != null
                ? to
                : Instant.parse("9999-12-31T23:59:59Z");

        return shopReservationRepository.searchByRange(
                tenantId,
                companyId,
                f,
                t);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private ShopTable getOwnedTable(UUID tableId,
                                    UUID tenantId,
                                    UUID companyId) {
        ShopTable table = shopTableRepository.findById(tableId)
                .orElseThrow(() -> new NoSuchElementException("Table not found"));

        if (!tenantId.equals(table.getTenantId())
                || !companyId.equals(table.getCompanyId())) {
            throw new IllegalArgumentException("Table does not belong to this company");
        }

        return table;
    }

    private ShopReservation getOwned(UUID reservationId,
                                     UUID tenantId,
                                     UUID companyId) {
        ShopReservation r = shopReservationRepository.findById(reservationId)
                .orElseThrow(() -> new NoSuchElementException("Reservation not found"));

        if (!r.getTenantId().equals(tenantId)
                || !r.getCompanyId().equals(companyId)) {
            throw new IllegalArgumentException("Reservation does not belong to this company");
        }

        return r;
    }
}
