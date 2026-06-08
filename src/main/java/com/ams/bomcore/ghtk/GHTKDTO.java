package com.ams.bomcore.ghtk;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

public class GHTKDTO {

    public static class FeeRequest {
        @JsonProperty("pick_province")
        private String pickProvince;
        @JsonProperty("pick_district")
        private String pickDistrict;
        @JsonProperty("province")
        private String province;
        @JsonProperty("district")
        private String district;
        @JsonProperty("weight")
        private int weight;
        @JsonProperty("value")
        private long value;
        @JsonProperty("transport")
        private String transport;
        @JsonProperty("deliver_option")
        private String deliverOption;
        @JsonProperty("tags")
        private int[] tags;

        public String getPickProvince() { return pickProvince; }
        public void setPickProvince(String pickProvince) { this.pickProvince = pickProvince; }
        public String getPickDistrict() { return pickDistrict; }
        public void setPickDistrict(String pickDistrict) { this.pickDistrict = pickDistrict; }
        public String getProvince() { return province; }
        public void setProvince(String province) { this.province = province; }
        public String getDistrict() { return district; }
        public void setDistrict(String district) { this.district = district; }
        public int getWeight() { return weight; }
        public void setWeight(int weight) { this.weight = weight; }
        public long getValue() { return value; }
        public void setValue(long value) { this.value = value; }
        public String getTransport() { return transport; }
        public void setTransport(String transport) { this.transport = transport; }
        public String getDeliverOption() { return deliverOption; }
        public void setDeliverOption(String deliverOption) { this.deliverOption = deliverOption; }
        public int[] getTags() { return tags; }
        public void setTags(int[] tags) { this.tags = tags; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FeeData {
        @JsonProperty("name")
        private String name;
        @JsonProperty("fee")
        private long fee;
        @JsonProperty("insurance_fee")
        private long insuranceFee;
        @JsonProperty("include_vat")
        private long includeVat;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public long getFee() { return fee; }
        public void setFee(long fee) { this.fee = fee; }
        public long getInsuranceFee() { return insuranceFee; }
        public void setInsuranceFee(long insuranceFee) { this.insuranceFee = insuranceFee; }
        public long getIncludeVat() { return includeVat; }
        public void setIncludeVat(long includeVat) { this.includeVat = includeVat; }
    }

    public static class ShipmentOption {
        private String transport;
        private String name;
        private long fee;
        private long includeVat;
        private FeeData rawData;

        public ShipmentOption(String transport, String name, FeeData data) {
            this.transport = transport;
            this.name = name;
            this.fee = data.getFee();
            this.includeVat = data.getIncludeVat();
            this.rawData = data;
        }

        public String getTransport() { return transport; }
        public String getName() { return name; }
        public long getFee() { return fee; }
        public long getIncludeVat() { return includeVat; }
        public FeeData getRawData() { return rawData; }
    }
}
