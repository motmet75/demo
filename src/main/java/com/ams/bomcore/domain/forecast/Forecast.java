package com.ams.bomcore.domain.forecast;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.material.Material;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "forecast")
public class Forecast {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "company_id")
    private Company company;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    @Column(name = "forecast_date")
    private Instant forecastDate;

    @Column(name = "quantity")
    private Double quantity;

    @Column(name = "created_at")
    private Instant createdAt;

    public Forecast() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Company getCompany() { return company; }
    public void setCompany(Company company) { this.company = company; }

    public Material getMaterial() { return material; }
    public void setMaterial(Material material) { this.material = material; }

    public Instant getForecastDate() { return forecastDate; }
    public void setForecastDate(Instant forecastDate) { this.forecastDate = forecastDate; }

    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    @PrePersist
    private void prePersist() {
        if (id == null) {
			id = UUID.randomUUID();
		}
        if (createdAt == null) {
			createdAt = Instant.now();
		}
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
			return true;
		}
        if (o == null || getClass() != o.getClass()) {
			return false;
		}
        Forecast forecast = (Forecast) o;
        return Objects.equals(id, forecast.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "Forecast{" +
                "id=" + id +
                ", company=" + (company != null ? company.getId() : null) +
                ", material=" + (material != null ? material.getId() : null) +
                ", forecastDate=" + forecastDate +
                ", quantity=" + quantity +
                ", createdAt=" + createdAt +
                '}';
    }
}
