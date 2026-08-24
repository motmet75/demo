package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.company.Company;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class ShopNewOrderNotificationService {
    private static final Logger log = LoggerFactory.getLogger(ShopNewOrderNotificationService.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final CompanyRepository companyRepository;
    private final String from;
    private final String publicBaseUrl;

    public ShopNewOrderNotificationService(ObjectProvider<JavaMailSender> mailSenderProvider,
                                           CompanyRepository companyRepository,
                                           Environment environment) {
        this.mailSenderProvider = mailSenderProvider;
        this.companyRepository = companyRepository;
        this.from = environment.getProperty("spring.mail.username", "");
        this.publicBaseUrl = environment.getProperty("app.shop.public-base-url",
                environment.getProperty("hostbaseurl", ""));
    }

    public void notifyOrderCreated(ShopOrderResponseDto order) {
        if (order == null || order.getCompanyId() == null || order.getId() == null) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(order);
                }
            });
            return;
        }
        send(order);
    }

    private void send(ShopOrderResponseDto order) {
        Company company = companyRepository.findById(order.getCompanyId()).orElse(null);
        if (company == null || !Boolean.TRUE.equals(company.getNewOrderNotificationEnabled())) return;

        List<String> recipients = normalizeEmails(company.getNewOrderNotificationEmails());
        if (recipients.isEmpty()) {
            log.warn("New order notification skipped for company {} because no valid recipient email is configured",
                    order.getCompanyId());
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("New order notification skipped for order {} because no JavaMailSender is configured", order.getId());
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) {
            message.setFrom(from);
        }
        message.setTo(recipients.toArray(String[]::new));
        message.setSubject(subject(company, order));
        message.setText(body(company, order, recipients.size()));

        try {
            mailSender.send(message);
        } catch (MailException ex) {
            log.warn("Failed to send new order notification email for order {}", order.getId(), ex);
        }
    }

    private List<String> normalizeEmails(String raw) {
        if (!StringUtils.hasText(raw)) return List.of();
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String part : raw.split("[\\s,;]+")) {
            String email = part != null ? part.trim() : "";
            if (email.isEmpty()) continue;
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                log.warn("Skipping invalid new order notification email: {}", email);
                continue;
            }
            unique.putIfAbsent(email.toLowerCase(Locale.ROOT), email);
        }
        return List.copyOf(unique.values());
    }

    private String subject(Company company, ShopOrderResponseDto order) {
        String shopName = firstText(company.getShopName(), company.getCompanyName(), "Shop");
        String number = orderNumber(order);
        return "New order " + number + " - " + shopName;
    }

    private String body(Company company, ShopOrderResponseDto order, int recipientCount) {
        StringBuilder body = new StringBuilder();
        appendLine(body, "Shop", firstText(company.getShopName(), company.getCompanyName(), ""));
        appendLine(body, "Order", orderNumber(order));
        appendLine(body, "Order code", order.getOrderCode());
        appendLine(body, "Status", order.getStatus());
        appendLine(body, "Fulfillment", order.getFulfillmentType());
        appendLine(body, "Table", firstText(order.getTableName(), order.getCustomerTableTag(), ""));
        appendLine(body, "Customer", order.getCustomerName());
        appendLine(body, "Phone", order.getCustomerPhone());
        appendLine(body, "Total", money(order.getTotalAmount()));
        appendLine(body, "Payment", firstText(order.getPaymentMethod(), "") + " / " + firstText(order.getPaymentStatus(), ""));
        appendLine(body, "Created at", order.getCreatedAt());
        appendLine(body, "Recipients", recipientCount);
        String link = orderLink(order);
        if (StringUtils.hasText(link)) appendLine(body, "Track", link);
        if (StringUtils.hasText(order.getNotes())) appendLine(body, "Notes", order.getNotes());

        if (order.getItems() != null && !order.getItems().isEmpty()) {
            body.append(System.lineSeparator()).append("Items:").append(System.lineSeparator());
            for (ShopOrderResponseDto.ItemDto item : order.getItems()) {
                if (item.getParentItemId() != null) continue;
                body.append("- ")
                        .append(quantity(item.getQuantity()))
                        .append(" x ")
                        .append(firstText(item.getModelName(), "Item"));
                if (item.getLineTotal() != null) {
                    body.append(" = ").append(money(item.getLineTotal()));
                }
                body.append(System.lineSeparator());
            }
        }

        body.append(System.lineSeparator())
                .append("Notification time: ")
                .append(Instant.now())
                .append(System.lineSeparator());
        return body.toString();
    }

    private String orderNumber(ShopOrderResponseDto order) {
        if (order.getOrderNumber() != null) return "#" + order.getOrderNumber();
        return firstText(order.getOrderCode(), String.valueOf(order.getId()));
    }

    private String orderLink(ShopOrderResponseDto order) {
        String base = publicBaseUrl != null ? publicBaseUrl.trim() : "";
        if (base.isBlank() || order.getOrderCode() == null || order.getOrderCode().isBlank()) return "";
        return base.replaceAll("/+$", "") + "/shop/order/" + order.getOrderCode();
    }

    private void appendLine(StringBuilder body, String label, Object value) {
        String text = display(value);
        if (!StringUtils.hasText(text)) return;
        body.append(label).append(": ").append(text).append(System.lineSeparator());
    }

    private String money(BigDecimal value) {
        return value != null ? value.stripTrailingZeros().toPlainString() : "";
    }

    private String quantity(BigDecimal value) {
        return value != null ? value.stripTrailingZeros().toPlainString() : "1";
    }

    private String display(Object value) {
        return value != null ? String.valueOf(value).trim() : "";
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) return value.trim();
        }
        return "";
    }
}
