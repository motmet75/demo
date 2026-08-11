package com.demo.security;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface QuickLoginTokenRepository extends JpaRepository<QuickLoginToken, UUID> {
    Optional<QuickLoginToken> findByTokenHash(String tokenHash);
}
