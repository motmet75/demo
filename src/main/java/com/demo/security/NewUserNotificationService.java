package com.demo.security;

import java.time.Instant;

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

import com.ams.bomcore.domain.user.User;

@Service
public class NewUserNotificationService {

    private static final Logger log = LoggerFactory.getLogger(NewUserNotificationService.class);
    private static final String DEFAULT_RECIPIENT = "services@anhmedia.vn";

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String recipient;
    private final String from;
    private final String hostBaseUrl;

    public NewUserNotificationService(ObjectProvider<JavaMailSender> mailSenderProvider,
                                      Environment environment) {
        this.mailSenderProvider = mailSenderProvider;
        this.recipient = valueOrDefault(
                environment.getProperty("app.notifications.new-user.recipient"),
                DEFAULT_RECIPIENT);
        this.from = valueOrDefault(
                environment.getProperty("app.notifications.new-user.from"),
                environment.getProperty("spring.mail.username"));
        this.hostBaseUrl = environment.getProperty("hostbaseurl", "");
    }

    public void notifyNewUser(User user, String source) {
        if (user == null) {
            return;
        }
        NewUserRegistration registration = NewUserRegistration.from(user, source);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(registration);
                }
            });
            return;
        }
        send(registration);
    }

    private void send(NewUserRegistration registration) {
        if (!StringUtils.hasText(recipient)) {
            log.warn("New user notification email skipped because app.notifications.new-user.recipient is empty");
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("New user notification email skipped because no JavaMailSender is configured");
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) {
            message.setFrom(from);
        }
        message.setTo(recipient);
        message.setSubject("New user registered: " + registration.username());
        message.setText(buildBody(registration));

        try {
            mailSender.send(message);
        } catch (MailException ex) {
            log.warn("Failed to send new user notification email for user id {}", registration.id(), ex);
        }
    }

    private String buildBody(NewUserRegistration registration) {
        StringBuilder body = new StringBuilder();
        body.append("A new userTB record was created.").append(System.lineSeparator()).append(System.lineSeparator());
        appendLine(body, "Source", registration.source());
        appendLine(body, "User ID", registration.id());
        appendLine(body, "Username", registration.username());
        appendLine(body, "Email", registration.email());
        appendLine(body, "First name", registration.firstName());
        appendLine(body, "Last name", registration.lastName());
        appendLine(body, "Assigned tenant ID", registration.assignedTenantId());
        appendLine(body, "Assigned company ID", registration.assignedCompanyId());
        appendLine(body, "Last tenant ID", registration.lastTenantId());
        appendLine(body, "Last company ID", registration.lastCompanyId());
        appendLine(body, "Notification time", registration.notifiedAt());
        appendLine(body, "Host", hostBaseUrl);
        return body.toString();
    }

    private void appendLine(StringBuilder body, String label, Object value) {
        body.append(label).append(": ").append(display(value)).append(System.lineSeparator());
    }

    private String display(Object value) {
        if (value == null) {
            return "";
        }
        String text = value.toString();
        return StringUtils.hasText(text) ? text : "";
    }

    private static String valueOrDefault(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value.trim() : defaultValue;
    }

    private record NewUserRegistration(
            Integer id,
            String username,
            String email,
            String firstName,
            String lastName,
            String assignedTenantId,
            String assignedCompanyId,
            String lastTenantId,
            String lastCompanyId,
            String source,
            Instant notifiedAt) {

        private static NewUserRegistration from(User user, String source) {
            return new NewUserRegistration(
                    user.getId(),
                    user.getUsername(),
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getAssignedTenantId(),
                    user.getAssignedCompanyId(),
                    user.getLastTenantId(),
                    user.getLastCompanyId(),
                    source,
                    Instant.now());
        }
    }
}
