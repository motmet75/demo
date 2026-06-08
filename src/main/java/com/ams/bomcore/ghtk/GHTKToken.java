package com.ams.bomcore.ghtk;

import java.time.LocalDateTime;

public class GHTKToken {

    private String userId;
    private String token;
    private String username;
    private LocalDateTime createdAt;
    private LocalDateTime lastUsed;

    public GHTKToken() {}

    public GHTKToken(String userId, String token, String username) {
        this.userId = userId;
        this.token = token;
        this.username = username;
        this.createdAt = LocalDateTime.now();
        this.lastUsed = LocalDateTime.now();
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getLastUsed() { return lastUsed; }
    public void setLastUsed(LocalDateTime lastUsed) { this.lastUsed = lastUsed; }

    public void updateLastUsed() { this.lastUsed = LocalDateTime.now(); }

    public boolean isExpired() {
        return createdAt != null && createdAt.plusHours(24).isBefore(LocalDateTime.now());
    }
}
