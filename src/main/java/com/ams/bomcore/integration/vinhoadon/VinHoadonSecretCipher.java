package com.ams.bomcore.integration.vinhoadon;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/** Encrypts each company's VIN-HOADON API password before it is persisted. */
@Component
public class VinHoadonSecretCipher {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final String masterKey;

    public VinHoadonSecretCipher(@Value("${vin-hoadon.master-key:}") String masterKey) {
        this.masterKey = masterKey == null ? "" : masterKey.trim();
    }

    public boolean isConfigured() { return masterKey.length() >= 32; }

    public String encrypt(String plainText, UUID tenantId, UUID companyId) {
        if (plainText == null || plainText.isBlank()) throw new IllegalArgumentException("VIN-HOADON API password is required");
        ensureConfigured();
        try {
            byte[] nonce = new byte[12];
            RANDOM.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(tenantId, companyId));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(nonce) + ":" + Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not encrypt VIN-HOADON credentials", exception);
        }
    }

    public String decrypt(String encoded, UUID tenantId, UUID companyId) {
        ensureConfigured();
        try {
            String[] parts = encoded == null ? new String[0] : encoded.split(":", 3);
            if (parts.length != 3 || !"v1".equals(parts[0])) throw new IllegalArgumentException("Unsupported encrypted credential format");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.getDecoder().decode(parts[1])));
            cipher.updateAAD(aad(tenantId, companyId));
            return new String(cipher.doFinal(Base64.getDecoder().decode(parts[2])), StandardCharsets.UTF_8);
        } catch (IllegalStateException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Could not decrypt VIN-HOADON credentials; verify VIN_HOADON_MASTER_KEY", exception);
        }
    }

    private SecretKeySpec key() throws Exception {
        return new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(masterKey.getBytes(StandardCharsets.UTF_8)), "AES");
    }
    private byte[] aad(UUID tenantId, UUID companyId) {
        return (tenantId + ":" + companyId).getBytes(StandardCharsets.UTF_8);
    }
    private void ensureConfigured() {
        if (!isConfigured()) throw new IllegalStateException("VIN_HOADON_MASTER_KEY must contain at least 32 characters");
    }
}
