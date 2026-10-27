package com.ams.bomcore.domain.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "service_bom_item")
public class ServiceBomItem {
    @Id @Column(nullable = false) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "service_bom_id", nullable = false) private ServiceBom serviceBom;
    @Column(name = "cost_type", nullable = false, length = 30) private String costType;
    @Column(nullable = false, columnDefinition = "TEXT") private String description;
    @Column(nullable = false, precision = 14, scale = 4) private BigDecimal quantity = BigDecimal.ONE;
    @Column(nullable = false, length = 20) private String unit = "job";
    @Column(name = "unit_cost", nullable = false, precision = 18, scale = 4) private BigDecimal unitCost = BigDecimal.ZERO;
    @Column(name = "material_id") private UUID materialId;
    @Column(nullable = false) private Boolean optional = false;
    @Column(name = "created_at") private Instant createdAt;
    @PrePersist private void init(){if(id==null)id=UUID.randomUUID();if(createdAt==null)createdAt=Instant.now();}
    public UUID getId(){return id;} public void setId(UUID v){id=v;} public ServiceBom getServiceBom(){return serviceBom;} public void setServiceBom(ServiceBom v){serviceBom=v;}
    public String getCostType(){return costType;} public void setCostType(String v){costType=v;} public String getDescription(){return description;} public void setDescription(String v){description=v;}
    public BigDecimal getQuantity(){return quantity;} public void setQuantity(BigDecimal v){quantity=v;} public String getUnit(){return unit;} public void setUnit(String v){unit=v;}
    public BigDecimal getUnitCost(){return unitCost;} public void setUnitCost(BigDecimal v){unitCost=v;} public UUID getMaterialId(){return materialId;} public void setMaterialId(UUID v){materialId=v;}
    public Boolean getOptional(){return optional;} public void setOptional(Boolean v){optional=v;}
    public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
}
