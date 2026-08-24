package com.ams.bomcore.domain.company;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.ams.bomcore.domain.tenant.Tenant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Client / Company (warehouse owner)
 */
@Entity
@Table(name = "company")
public class Company {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "company_code", nullable = false, length = 100)
    private String companyCode;

    @Column(name = "company_name", nullable = false, columnDefinition = "TEXT")
    private String companyName;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "last_order_number")
    private Integer lastOrderNumber = 0;

    @Column(name = "bank_bin", length = 20)
    private String bankBin;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_account_name", length = 100)
    private String bankAccountName;

    @Column(name = "prepaid_menu")
    private Boolean prepaidMenu = false;

    @Column(name = "shop_logo_url", columnDefinition = "TEXT")
    private String shopLogoUrl;

    @Column(name = "shop_name", columnDefinition = "TEXT")
    private String shopName;

    @Column(name = "shop_address", columnDefinition = "TEXT")
    private String shopAddress;

    @Column(name = "shop_phone", length = 60)
    private String shopPhone;

    @Column(name = "realtime_inventory")
    private Boolean realtimeInventory = false;

    @Column(name = "shop_processing_inventory_recheck")
    private Boolean shopProcessingInventoryRecheck = true;

    @Column(name = "valid_until")
    private Instant validUntil;

    @Column(name = "points_conversion_rate")
    private Integer pointsConversionRate = 10000;

    @Column(name = "points_round_up")
    private Boolean pointsRoundUp = false;

    @Column(name = "loyalty_discount_point_threshold")
    private Integer loyaltyDiscountPointThreshold = 0;

    @Column(name = "loyalty_discount_percent", columnDefinition = "numeric")
    private BigDecimal loyaltyDiscountPercent = BigDecimal.ZERO;

    @Column(name = "voucher_secret", length = 100)
    private String voucherSecret;

    @Column(name = "shop_counter_public_ip", length = 100)
    private String shopCounterPublicIp;

    @Column(name = "shop_counter_public_ip_updated_at")
    private Instant shopCounterPublicIpUpdatedAt;

    @Column(name = "shop_allowed_public_ips", columnDefinition = "TEXT")
    private String shopAllowedPublicIps;

    @Column(name = "shop_allow_all_networks")
    private Boolean shopAllowAllNetworks = false;

    @Column(name = "shop_counter_network_rules", columnDefinition = "TEXT")
    private String shopCounterNetworkRules;

    @Column(name = "new_order_notification_emails", columnDefinition = "TEXT")
    private String newOrderNotificationEmails;

    @Column(name = "new_order_notification_enabled")
    private Boolean newOrderNotificationEnabled = false;

    public Company() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Tenant getTenant() { return tenant; }
    public void setTenant(Tenant tenant) { this.tenant = tenant; }

    public String getCompanyCode() { return companyCode; }
    public void setCompanyCode(String companyCode) { this.companyCode = companyCode; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Integer getLastOrderNumber() { return lastOrderNumber; }
    public void setLastOrderNumber(Integer lastOrderNumber) { this.lastOrderNumber = lastOrderNumber; }
    public String getBankBin() { return bankBin; }
    public void setBankBin(String bankBin) { this.bankBin = bankBin; }

    public String getBankAccountNumber() { return bankAccountNumber; }
    public void setBankAccountNumber(String bankAccountNumber) { this.bankAccountNumber = bankAccountNumber; }

    public String getBankAccountName() { return bankAccountName; }
    public void setBankAccountName(String bankAccountName) { this.bankAccountName = bankAccountName; }

    public Boolean getPrepaidMenu() { return prepaidMenu; }
    public void setPrepaidMenu(Boolean prepaidMenu) { this.prepaidMenu = prepaidMenu; }
    public String getShopLogoUrl() { return shopLogoUrl; }
    public void setShopLogoUrl(String shopLogoUrl) { this.shopLogoUrl = shopLogoUrl; }
    public String getShopName() { return shopName; }
    public void setShopName(String shopName) { this.shopName = shopName; }
    public String getShopAddress() { return shopAddress; }
    public void setShopAddress(String shopAddress) { this.shopAddress = shopAddress; }
    public String getShopPhone() { return shopPhone; }
    public void setShopPhone(String shopPhone) { this.shopPhone = shopPhone; }
    public Boolean getRealtimeInventory() { return Boolean.TRUE.equals(realtimeInventory); }
    public void setRealtimeInventory(Boolean realtimeInventory) { this.realtimeInventory = realtimeInventory; }
    public Boolean getShopProcessingInventoryRecheck() { return !Boolean.FALSE.equals(shopProcessingInventoryRecheck); }
    public void setShopProcessingInventoryRecheck(Boolean shopProcessingInventoryRecheck) { this.shopProcessingInventoryRecheck = shopProcessingInventoryRecheck; }

    public Instant getValidUntil() { return validUntil; }
    public void setValidUntil(Instant validUntil) { this.validUntil = validUntil; }
    public Integer getPointsConversionRate() { return pointsConversionRate != null ? pointsConversionRate : 10000; }
    public void setPointsConversionRate(Integer pointsConversionRate) { this.pointsConversionRate = pointsConversionRate; }
    public Boolean getPointsRoundUp() { return Boolean.TRUE.equals(pointsRoundUp); }
    public void setPointsRoundUp(Boolean pointsRoundUp) { this.pointsRoundUp = pointsRoundUp; }
    public Integer getLoyaltyDiscountPointThreshold() { return loyaltyDiscountPointThreshold != null ? loyaltyDiscountPointThreshold : 0; }
    public void setLoyaltyDiscountPointThreshold(Integer loyaltyDiscountPointThreshold) { this.loyaltyDiscountPointThreshold = loyaltyDiscountPointThreshold; }
    public BigDecimal getLoyaltyDiscountPercent() { return loyaltyDiscountPercent != null ? loyaltyDiscountPercent : BigDecimal.ZERO; }
    public void setLoyaltyDiscountPercent(BigDecimal loyaltyDiscountPercent) { this.loyaltyDiscountPercent = loyaltyDiscountPercent; }
    public String getVoucherSecret() { return voucherSecret; }
    public void setVoucherSecret(String voucherSecret) { this.voucherSecret = voucherSecret; }
    public String getShopCounterPublicIp() { return shopCounterPublicIp; }
    public void setShopCounterPublicIp(String shopCounterPublicIp) { this.shopCounterPublicIp = shopCounterPublicIp; }
    public Instant getShopCounterPublicIpUpdatedAt() { return shopCounterPublicIpUpdatedAt; }
    public void setShopCounterPublicIpUpdatedAt(Instant shopCounterPublicIpUpdatedAt) { this.shopCounterPublicIpUpdatedAt = shopCounterPublicIpUpdatedAt; }
    public String getShopAllowedPublicIps() { return shopAllowedPublicIps; }
    public void setShopAllowedPublicIps(String shopAllowedPublicIps) { this.shopAllowedPublicIps = shopAllowedPublicIps; }
    public Boolean getShopAllowAllNetworks() { return Boolean.TRUE.equals(shopAllowAllNetworks); }
    public void setShopAllowAllNetworks(Boolean shopAllowAllNetworks) { this.shopAllowAllNetworks = shopAllowAllNetworks; }
    public String getShopCounterNetworkRules() { return shopCounterNetworkRules; }
    public void setShopCounterNetworkRules(String shopCounterNetworkRules) { this.shopCounterNetworkRules = shopCounterNetworkRules; }
    public String getNewOrderNotificationEmails() { return newOrderNotificationEmails; }
    public void setNewOrderNotificationEmails(String newOrderNotificationEmails) { this.newOrderNotificationEmails = newOrderNotificationEmails; }
    public Boolean getNewOrderNotificationEnabled() { return Boolean.TRUE.equals(newOrderNotificationEnabled); }
    public void setNewOrderNotificationEnabled(Boolean newOrderNotificationEnabled) { this.newOrderNotificationEnabled = newOrderNotificationEnabled; }

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
        Company company = (Company) o;
        return Objects.equals(id, company.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "Company{" +
                "id=" + id +
                ", tenant=" + (tenant != null ? tenant.getId() : null) +
                ", companyCode='" + companyCode + '\'' +
                ", companyName='" + companyName + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
