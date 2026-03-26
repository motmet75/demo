package com.ams.bomcore.viettelpost;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * Entity to store Viettel Post API tokens
 */
public class ViettelPostToken {
    
    private String userId;
    private String token;
    private String username;
    private LocalDateTime createdAt;
    private LocalDateTime lastUsed;
    
    public ViettelPostToken() {}
    
    public ViettelPostToken(String userId, String token, String username) {
        this.userId = userId;
        this.token = token;
        this.username = username;
        this.createdAt = LocalDateTime.now();
        this.lastUsed = LocalDateTime.now();
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getLastUsed() {
        return lastUsed;
    }

    public void setLastUsed(LocalDateTime lastUsed) {
        this.lastUsed = lastUsed;
    }
    
    public void updateLastUsed() {
        this.lastUsed = LocalDateTime.now();
    }
    
    public boolean isExpired() {
        // Token expires after 24 hours
        return createdAt != null && createdAt.plusHours(24).isBefore(LocalDateTime.now());
    }
}
