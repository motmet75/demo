package com.ams.bomcore.domain.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "service_bom")
public class ServiceBom {
    @Id @Column(nullable = false) private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "company_id", nullable = false) private UUID companyId;
    @Column(name = "service_code", nullable = false, length = 50) private String serviceCode;
    @Column(name = "service_name", nullable = false, columnDefinition = "TEXT") private String serviceName;
    @Column(name = "service_type", nullable = false, length = 40) private String serviceType = "CAMERA_INSTALLATION";
    @Column(nullable = false) private Boolean active = true;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "created_at") private Instant createdAt;
    @OneToMany(mappedBy = "serviceBom", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ServiceBomItem> items = new ArrayList<>();
    @PrePersist private void init() { if (id == null) id = UUID.randomUUID(); if (createdAt == null) createdAt = Instant.now(); }
    public UUID getId(){return id;} public void setId(UUID v){id=v;}
    public UUID getTenantId(){return tenantId;} public void setTenantId(UUID v){tenantId=v;}
    public UUID getCompanyId(){return companyId;} public void setCompanyId(UUID v){companyId=v;}
    public String getServiceCode(){return serviceCode;} public void setServiceCode(String v){serviceCode=v;}
    public String getServiceName(){return serviceName;} public void setServiceName(String v){serviceName=v;}
    public String getServiceType(){return serviceType;} public void setServiceType(String v){serviceType=v;}
    public Boolean getActive(){return active;} public void setActive(Boolean v){active=v;}
    public String getNotes(){return notes;} public void setNotes(String v){notes=v;}
    public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
    public List<ServiceBomItem> getItems(){return items;} public void setItems(List<ServiceBomItem> v){items=v;}
}
