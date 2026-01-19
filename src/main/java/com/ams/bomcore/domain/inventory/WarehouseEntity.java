package com.ams.bomcore.domain.inventory;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Entity mapping for table `warehouse`.
 */
@Entity
@Table(name = "warehouse")
public class WarehouseEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "name", nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(name = "location", length = 200)
    private String location;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "created_at")
    private Instant createdAt;

    // new fields
    @Column(name = "contact_name", length = 100)
    private String contactName;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "capacity", precision = 18, scale = 2)
    private BigDecimal capacity;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    public WarehouseEntity() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    // new getters/setters
    public String getContactName() {
        return contactName;
    }

    public void setContactName(String contactName) {
        this.contactName = contactName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public BigDecimal getCapacity() {
        return capacity;
    }

    public void setCapacity(BigDecimal capacity) {
        this.capacity = capacity;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    // Convenience getters matching frontend naming
    public String getWarehouseCode() {
        return this.code;
    }

    public String getWarehouseName() {
        return this.name;
    }

    @PrePersist
    private void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (isActive == null) {
            isActive = Boolean.TRUE;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        WarehouseEntity that = (WarehouseEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "WarehouseEntity{" +
                "id=" + id +
                ", code='" + code + "'" +
                ", name='" + name + "'" +
                ", location='" + location + "'" +
                ", isActive=" + isActive +
                ", createdAt=" + createdAt +
                ", contactName='" + contactName + "'" +
                ", phone='" + phone + "'" +
                ", email='" + email + "'" +
                ", capacity=" + capacity +
                ", note='" + note + "'" +
                '}';
    }
}