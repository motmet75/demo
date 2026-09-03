package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.shop.ShopReservation;
import com.ams.bomcore.repository.CompanyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Sends booking confirmation emails: always to the shop's notify list (reusing the same
 * newOrderNotificationEmails field as order notifications), and additionally to the customer
 * if — and only if — they supplied an email address when booking.
 */
@Service
public class ShopReservationNotificationService {
    private static final Logger log = LoggerFactory.getLogger(ShopReservationNotificationService.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm", Locale.ENGLISH);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final CompanyRepository companyRepository;
    private final String from;

    public ShopReservationNotificationService(ObjectProvider<JavaMailSender> mailSenderProvider,
                                               CompanyRepository companyRepository,
                                               Environment environment) {
        this.mailSenderProvider = mailSenderProvider;
        this.companyRepository = companyRepository;
        this.from = environment.getProperty("MAIL_FROM", "services@anhmedia.vn");
    }

    public void notifyReservationCreated(ShopReservation reservation, ZoneId zone) {
        if (reservation == null || reservation.getCompanyId() == null) {
            log.warn("RESERVATION EMAIL: SKIP - reservation or companyId is NULL");
            return;
        }

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(reservation, zone);
                }
            });
            return;
        }

        send(reservation, zone);
    }

    private void send(ShopReservation reservation, ZoneId zone) {
        Company company = companyRepository.findById(reservation.getCompanyId()).orElse(null);
        if (company == null) {
            log.warn("RESERVATION EMAIL: SKIP - company not found. companyId={}", reservation.getCompanyId());
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.error("RESERVATION EMAIL: SKIP - JavaMailSender is NOT available. Check spring.mail configuration.");
            return;
        }

        // Always notify the shop, regardless of whether the customer supplied an email.
        List<String> shopRecipients = normalizeEmails(company.getNewOrderNotificationEmails());
        if (!shopRecipients.isEmpty()) {
            sendOne(mailSender, shopRecipients, shopSubject(company, reservation), body(company, reservation, zone, false));
        } else {
            log.warn("RESERVATION EMAIL: no shop notify recipients configured. companyId={}", company.getId());
        }

        // Customer confirmation is optional — only if they gave a valid email.
        String customerEmail = reservation.getCustomerEmail();
        if (StringUtils.hasText(customerEmail) && EMAIL_PATTERN.matcher(customerEmail.trim()).matches()) {
            sendOne(mailSender, List.of(customerEmail.trim()), customerSubject(company), body(company, reservation, zone, true));
        }
    }

    public void notifyReservationCancelled(ShopReservation reservation, String reason, ZoneId zone) {
        if (reservation == null) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { sendCancellation(reservation, reason, zone); }
            });
            return;
        }
        sendCancellation(reservation, reason, zone);
    }

    private void sendCancellation(ShopReservation r, String reason, ZoneId zone) {
        String customerEmail = r.getCustomerEmail();
        if (!StringUtils.hasText(customerEmail) || !EMAIL_PATTERN.matcher(customerEmail.trim()).matches()) return;

        Company company = companyRepository.findById(r.getCompanyId()).orElse(null);
        if (company == null) return;
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) return;

        StringBuilder body = new StringBuilder();
        appendLine(body, "Shop", firstText(company.getShopName(), company.getCompanyName(), ""));
        appendLine(body, "Table", r.getTableName());
        appendLine(body, "Date/time", r.getReservationTime() != null
                ? DISPLAY_FORMAT.format(r.getReservationTime().atZone(zone)) : "");
        appendLine(body, "Reason", StringUtils.hasText(reason) ? reason : "Not specified");
        body.append(System.lineSeparator())
                .append("We're sorry we couldn't accommodate this booking. Please contact the shop if you have any questions.")
                .append(System.lineSeparator());

        sendOne(mailSender, List.of(customerEmail.trim()),
                "Your reservation was cancelled - " + firstText(company.getShopName(), company.getCompanyName(), "Shop"),
                body.toString());
    }

    private void sendOne(JavaMailSender mailSender, List<String> recipients, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) message.setFrom(from);
        message.setTo(recipients.toArray(String[]::new));
        message.setSubject(subject);
        message.setText(text);
        try {
            mailSender.send(message);
            log.info("RESERVATION EMAIL: SEND SUCCESS. recipients={}", recipients);
        } catch (MailException ex) {
            log.error("RESERVATION EMAIL: SEND FAILED. recipients={}", recipients, ex);
        } catch (Exception ex) {
            log.error("RESERVATION EMAIL: UNEXPECTED ERROR. recipients={}", recipients, ex);
        }
    }

    private List<String> normalizeEmails(String raw) {
        if (!StringUtils.hasText(raw)) return List.of();
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String part : raw.split("[\\s,;]+")) {
            String email = part != null ? part.trim() : "";
            if (email.isEmpty()) continue;
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                log.warn("Skipping invalid reservation notification email: {}", email);
                continue;
            }
            unique.putIfAbsent(email.toLowerCase(Locale.ROOT), email);
        }
        return List.copyOf(unique.values());
    }

    private String shopSubject(Company company, ShopReservation r) {
        return "New reservation - " + firstText(company.getShopName(), company.getCompanyName(), "Shop")
                + " - " + firstText(r.getTableName(), "");
    }

    private String customerSubject(Company company) {
        return "Your table reservation - " + firstText(company.getShopName(), company.getCompanyName(), "Shop");
    }

    private String body(Company company, ShopReservation r, ZoneId zone, boolean forCustomer) {
        StringBuilder body = new StringBuilder();
        appendLine(body, "Shop", firstText(company.getShopName(), company.getCompanyName(), ""));
        appendLine(body, "Table", r.getTableName());
        appendLine(body, "Date/time", r.getReservationTime() != null
                ? DISPLAY_FORMAT.format(r.getReservationTime().atZone(zone)) : "");
        appendLine(body, "Duration", r.getDurationMinutes() + " minutes");
        appendLine(body, "Party size", r.getPartySize());
        appendLine(body, "Status", r.getStatus());
        if (!forCustomer) {
            appendLine(body, "Customer", r.getCustomerName());
            appendLine(body, "Phone", r.getCustomerPhone());
            appendLine(body, "Email", r.getCustomerEmail());
        }
        if (StringUtils.hasText(r.getNote())) appendLine(body, "Note", r.getNote());
        body.append(System.lineSeparator())
                .append(forCustomer
                        ? "We look forward to seeing you! If you need to change or cancel this reservation, please contact the shop directly."
                        : "Notification time: " + Instant.now())
                .append(System.lineSeparator());
        return body.toString();
    }

    private void appendLine(StringBuilder body, String label, Object value) {
        String text = value != null ? String.valueOf(value).trim() : "";
        if (!StringUtils.hasText(text)) return;
        body.append(label).append(": ").append(text).append(System.lineSeparator());
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) return value.trim();
        }
        return "";
    }
}
