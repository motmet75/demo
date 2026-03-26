package com.ams.bomcore.viettelpost;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * DTO classes for Viettel Post API responses
 */
public class ViettelPostDTO {

    // Base response wrapper
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ApiResponse<T> {
        private int status;
        private boolean error;
        private String message;
        private T data;

        public int getStatus() { return status; }
        public void setStatus(int status) { this.status = status; }
        public boolean isError() { return error; }
        public void setError(boolean error) { this.error = error; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public T getData() { return data; }
        public void setData(T data) { this.data = data; }
    }

    // Province
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Province {
        @JsonProperty("PROVINCE_ID")
        private int provinceId;
        @JsonProperty("PROVINCE_CODE")
        private String provinceCode;
        @JsonProperty("PROVINCE_NAME")
        private String provinceName;

        public int getProvinceId() { return provinceId; }
        public void setProvinceId(int provinceId) { this.provinceId = provinceId; }
        public String getProvinceCode() { return provinceCode; }
        public void setProvinceCode(String provinceCode) { this.provinceCode = provinceCode; }
        public String getProvinceName() { return provinceName; }
        public void setProvinceName(String provinceName) { this.provinceName = provinceName; }
    }

    // District
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class District {
        @JsonProperty("DISTRICT_ID")
        private int districtId;
        @JsonProperty("DISTRICT_VALUE")
        private String districtValue;
        @JsonProperty("DISTRICT_NAME")
        private String districtName;
        @JsonProperty("PROVINCE_ID")
        private int provinceId;

        public int getDistrictId() { return districtId; }
        public void setDistrictId(int districtId) { this.districtId = districtId; }
        public String getDistrictValue() { return districtValue; }
        public void setDistrictValue(String districtValue) { this.districtValue = districtValue; }
        public String getDistrictName() { return districtName; }
        public void setDistrictName(String districtName) { this.districtName = districtName; }
        public int getProvinceId() { return provinceId; }
        public void setProvinceId(int provinceId) { this.provinceId = provinceId; }
    }

    // Ward
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Ward {
        @JsonProperty("WARDS_ID")
        private int wardsId;
        @JsonProperty("WARDS_NAME")
        private String wardsName;
        @JsonProperty("DISTRICT_ID")
        private int districtId;

        public int getWardsId() { return wardsId; }
        public void setWardsId(int wardsId) { this.wardsId = wardsId; }
        public String getWardsName() { return wardsName; }
        public void setWardsName(String wardsName) { this.wardsName = wardsName; }
        public int getDistrictId() { return districtId; }
        public void setDistrictId(int districtId) { this.districtId = districtId; }
    }

    // Price calculation request
    public static class PriceRequest {
        @JsonProperty("PRODUCT_WEIGHT")
        private int productWeight;
        @JsonProperty("PRODUCT_PRICE")
        private long productPrice;
        @JsonProperty("MONEY_COLLECTION")
        private long moneyCollection;
        @JsonProperty("SENDER_PROVINCE")
        private int senderProvince;
        @JsonProperty("SENDER_DISTRICT")
        private int senderDistrict;
        @JsonProperty("RECEIVER_PROVINCE")
        private int receiverProvince;
        @JsonProperty("RECEIVER_DISTRICT")
        private int receiverDistrict;
        @JsonProperty("PRODUCT_TYPE")
        private String productType = "HH";
        @JsonProperty("NATIONAL_TYPE")
        private int nationalType = 1;
        @JsonProperty("ORDER_SERVICE")
        private String orderService;

        // Getters and setters
        public int getProductWeight() { return productWeight; }
        public void setProductWeight(int productWeight) { this.productWeight = productWeight; }
        public long getProductPrice() { return productPrice; }
        public void setProductPrice(long productPrice) { this.productPrice = productPrice; }
        public long getMoneyCollection() { return moneyCollection; }
        public void setMoneyCollection(long moneyCollection) { this.moneyCollection = moneyCollection; }
        public int getSenderProvince() { return senderProvince; }
        public void setSenderProvince(int senderProvince) { this.senderProvince = senderProvince; }
        public int getSenderDistrict() { return senderDistrict; }
        public void setSenderDistrict(int senderDistrict) { this.senderDistrict = senderDistrict; }
        public int getReceiverProvince() { return receiverProvince; }
        public void setReceiverProvince(int receiverProvince) { this.receiverProvince = receiverProvince; }
        public int getReceiverDistrict() { return receiverDistrict; }
        public void setReceiverDistrict(int receiverDistrict) { this.receiverDistrict = receiverDistrict; }
        public String getProductType() { return productType; }
        public void setProductType(String productType) { this.productType = productType; }
        public int getNationalType() { return nationalType; }
        public void setNationalType(int nationalType) { this.nationalType = nationalType; }
        public String getOrderService() { return orderService; }
        public void setOrderService(String orderService) { this.orderService = orderService; }
    }

    // Price response from Viettel Post
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PriceData {
        @JsonProperty("MONEY_TOTAL_OLD")
        private long moneyTotalOld;
        @JsonProperty("MONEY_TOTAL")
        private long moneyTotal;
        @JsonProperty("MONEY_TOTAL_FEE")
        private long moneyTotalFee;
        @JsonProperty("MONEY_FEE")
        private long moneyFee;
        @JsonProperty("MONEY_COLLECTION_FEE")
        private long moneyCollectionFee;
        @JsonProperty("MONEY_OTHER_FEE")
        private long moneyOtherFee;
        @JsonProperty("MONEY_VAS")
        private long moneyVas;
        @JsonProperty("MONEY_VAT")
        private long moneyVat;
        @JsonProperty("KPI_HT")
        private double kpiHt;

        // Getters and setters
        public long getMoneyTotalOld() { return moneyTotalOld; }
        public void setMoneyTotalOld(long moneyTotalOld) { this.moneyTotalOld = moneyTotalOld; }
        public long getMoneyTotal() { return moneyTotal; }
        public void setMoneyTotal(long moneyTotal) { this.moneyTotal = moneyTotal; }
        public long getMoneyTotalFee() { return moneyTotalFee; }
        public void setMoneyTotalFee(long moneyTotalFee) { this.moneyTotalFee = moneyTotalFee; }
        public long getMoneyFee() { return moneyFee; }
        public void setMoneyFee(long moneyFee) { this.moneyFee = moneyFee; }
        public long getMoneyCollectionFee() { return moneyCollectionFee; }
        public void setMoneyCollectionFee(long moneyCollectionFee) { this.moneyCollectionFee = moneyCollectionFee; }
        public long getMoneyOtherFee() { return moneyOtherFee; }
        public void setMoneyOtherFee(long moneyOtherFee) { this.moneyOtherFee = moneyOtherFee; }
        public long getMoneyVas() { return moneyVas; }
        public void setMoneyVas(long moneyVas) { this.moneyVas = moneyVas; }
        public long getMoneyVat() { return moneyVat; }
        public void setMoneyVat(long moneyVat) { this.moneyVat = moneyVat; }
        public double getKpiHt() { return kpiHt; }
        public void setKpiHt(double kpiHt) { this.kpiHt = kpiHt; }
    }

    // Shipment option (formatted response for frontend)
    public static class ShipmentOption {
        private String serviceCode;
        private String serviceName;
        private long baseFee;
        private long vatFee;
        private long collectionFee;
        private long otherFee;
        private long totalFee;
        private String deliveryTime;
        private PriceData rawData;

        public ShipmentOption() {}

        public ShipmentOption(String serviceCode, String serviceName, PriceData data) {
            this.serviceCode = serviceCode;
            this.serviceName = serviceName;
            this.baseFee = data.getMoneyTotalFee();
            this.vatFee = data.getMoneyVat();
            this.collectionFee = data.getMoneyCollectionFee();
            this.otherFee = data.getMoneyOtherFee();
            this.totalFee = data.getMoneyTotal();
            this.deliveryTime = data.getKpiHt() > 0 ? data.getKpiHt() + " giờ" : "N/A";
            this.rawData = data;
        }

        // Getters and setters
        public String getServiceCode() { return serviceCode; }
        public void setServiceCode(String serviceCode) { this.serviceCode = serviceCode; }
        public String getServiceName() { return serviceName; }
        public void setServiceName(String serviceName) { this.serviceName = serviceName; }
        public long getBaseFee() { return baseFee; }
        public void setBaseFee(long baseFee) { this.baseFee = baseFee; }
        public long getVatFee() { return vatFee; }
        public void setVatFee(long vatFee) { this.vatFee = vatFee; }
        public long getCollectionFee() { return collectionFee; }
        public void setCollectionFee(long collectionFee) { this.collectionFee = collectionFee; }
        public long getOtherFee() { return otherFee; }
        public void setOtherFee(long otherFee) { this.otherFee = otherFee; }
        public long getTotalFee() { return totalFee; }
        public void setTotalFee(long totalFee) { this.totalFee = totalFee; }
        public String getDeliveryTime() { return deliveryTime; }
        public void setDeliveryTime(String deliveryTime) { this.deliveryTime = deliveryTime; }
        public PriceData getRawData() { return rawData; }
        public void setRawData(PriceData rawData) { this.rawData = rawData; }
    }

    // Complete address response
    public static class CompleteAddress {
        private Province province;
        private District district;
        private Ward ward;
        private String fullAddress;

        public Province getProvince() { return province; }
        public void setProvince(Province province) { this.province = province; }
        public District getDistrict() { return district; }
        public void setDistrict(District district) { this.district = district; }
        public Ward getWard() { return ward; }
        public void setWard(Ward ward) { this.ward = ward; }
        public String getFullAddress() { return fullAddress; }
        public void setFullAddress(String fullAddress) { this.fullAddress = fullAddress; }
    }

    // Login request
    public static class LoginRequest {
        private String username;
        private String password;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    // Token request (for manual token setting)
    public static class TokenRequest {
        private String token;
        private String userId;

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
    }
}
