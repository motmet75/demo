package com.demo.security;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TrustedLoginDeviceRepository extends JpaRepository<TrustedLoginDevice, Long> {
    Optional<TrustedLoginDevice> findByUserIdAndFingerprintAndExpiresAtAfter(
            Integer userId, String fingerprint, Instant now);
    Optional<TrustedLoginDevice> findByUserIdAndFingerprint(Integer userId, String fingerprint);
}
