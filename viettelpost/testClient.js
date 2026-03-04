// Example client for testing Viettel Post API
// Run this file with: node testClient.js

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

// Replace with your credentials
const USERNAME = 'YOUR_PHONE_NUMBER';
const PASSWORD = 'YOUR_PASSWORD';

class ViettelPostClient {
    constructor() {
        this.token = null;
        this.userId = null;
    }

    // Login and store token
    async login(username, password) {
        console.log('\n🔐 Logging in...');
        try {
            const response = await axios.post(`${API_URL}/login`, {
                username,
                password
            });

            if (response.data.success) {
                this.token = response.data.token;
                this.userId = response.data.userId;
                console.log('✅ Login successful!');
                console.log(`   User ID: ${this.userId}`);
                console.log(`   Token: ${this.token.substring(0, 50)}...`);
                console.log(`   From Cache: ${response.data.fromCache}`);
                return true;
            } else {
                console.log('❌ Login failed:', response.data.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Login error:', error.response?.data?.message || error.message);
            return false;
        }
    }

    // Check if token is valid
    async checkToken() {
        console.log('\n🔍 Checking token validity...');
        try {
            const response = await axios.get(`${API_URL}/check-token/${this.userId}`);
            console.log(`✅ Token is ${response.data.isValid ? 'valid' : 'invalid'}`);
            return response.data.isValid;
        } catch (error) {
            console.error('❌ Check token error:', error.message);
            return false;
        }
    }

    // Get all provinces
    async getProvinces() {
        console.log('\n📍 Fetching provinces...');
        try {
            const response = await axios.get(`${API_URL}/provinces`, {
                headers: { 'Authorization': this.token }
            });

            if (response.data.status === 200) {
                console.log(`✅ Found ${response.data.data.length} provinces`);
                console.log('   First 5 provinces:');
                response.data.data.slice(0, 5).forEach(p => {
                    console.log(`   - ${p.PROVINCE_NAME} (ID: ${p.PROVINCE_ID})`);
                });
                return response.data.data;
            }
        } catch (error) {
            console.error('❌ Get provinces error:', error.message);
            return [];
        }
    }

    // Get districts by province
    async getDistricts(provinceId) {
        console.log(`\n📍 Fetching districts for province ${provinceId}...`);
        try {
            const response = await axios.get(`${API_URL}/districts/${provinceId}`, {
                headers: { 'Authorization': this.token }
            });

            if (response.data.status === 200) {
                console.log(`✅ Found ${response.data.data.length} districts`);
                response.data.data.slice(0, 5).forEach(d => {
                    console.log(`   - ${d.DISTRICT_NAME} (ID: ${d.DISTRICT_ID})`);
                });
                return response.data.data;
            }
        } catch (error) {
            console.error('❌ Get districts error:', error.message);
            return [];
        }
    }

    // Get wards by district
    async getWards(districtId) {
        console.log(`\n📍 Fetching wards for district ${districtId}...`);
        try {
            const response = await axios.get(`${API_URL}/wards/${districtId}`, {
                headers: { 'Authorization': this.token }
            });

            if (response.data.status === 200) {
                console.log(`✅ Found ${response.data.data.length} wards`);
                response.data.data.slice(0, 5).forEach(w => {
                    console.log(`   - ${w.WARDS_NAME} (ID: ${w.WARDS_ID})`);
                });
                return response.data.data;
            }
        } catch (error) {
            console.error('❌ Get wards error:', error.message);
            return [];
        }
    }

    // Get complete address
    async getCompleteAddress(provinceId, districtId, wardId) {
        console.log('\n🗺️ Fetching complete address...');
        try {
            const response = await axios.get(`${API_URL}/address/complete`, {
                params: { provinceId, districtId, wardId },
                headers: { 'Authorization': this.token }
            });

            if (response.data.success) {
                console.log('✅ Complete address:');
                console.log(`   ${response.data.data.fullAddress}`);
                return response.data.data;
            }
        } catch (error) {
            console.error('❌ Get complete address error:', error.message);
            return null;
        }
    }

    // Calculate shipping with raw response
    async calculatePrice(shipmentData) {
        console.log('\n💰 Calculating shipping price (raw)...');
        try {
            const response = await axios.post(`${API_URL}/calculate-price`, shipmentData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                }
            });

            if (response.data.status === 200) {
                console.log(`✅ Found ${response.data.data.length} shipping services`);
                response.data.data.forEach(service => {
                    console.log(`   - ${service.TEN_DICHVU || service.MA_DV_CHINH}`);
                    console.log(`     Price: ${service.TONG_CUOC.toLocaleString('vi-VN')} VND`);
                    console.log(`     Time: ${service.THOI_GIAN || 'N/A'}`);
                });
                return response.data.data;
            }
        } catch (error) {
            console.error('❌ Calculate price error:', error.message);
            return [];
        }
    }

    // Get shipment options with enhanced response
    async getShipmentOptions(shipmentData) {
        console.log('\n📦 Getting shipment options (enhanced)...');
        try {
            const response = await axios.post(`${API_URL}/shipment-options`, shipmentData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                }
            });

            if (response.data.success) {
                console.log(`✅ Found ${response.data.count} shipping options`);
                response.data.data.forEach(option => {
                    console.log(`\n   Service: ${option.serviceName} (${option.serviceCode})`);
                    console.log(`   Base Fee: ${option.baseFee.toLocaleString('vi-VN')} VND`);
                    console.log(`   Extra Services: ${option.extraServicesFee.toLocaleString('vi-VN')} VND`);
                    console.log(`   Insurance: ${option.insuranceFee.toLocaleString('vi-VN')} VND`);
                    console.log(`   Remote Fee: ${option.remoteFee.toLocaleString('vi-VN')} VND`);
                    console.log(`   Total: ${option.totalFee.toLocaleString('vi-VN')} VND`);
                    console.log(`   Delivery Time: ${option.deliveryTime}`);
                });
                return response.data.data;
            }
        } catch (error) {
            console.error('❌ Get shipment options error:', error.message);
            return [];
        }
    }

    // Logout
    async logout() {
        console.log('\n🚪 Logging out...');
        try {
            const response = await axios.post(`${API_URL}/logout`, {
                userId: this.userId
            });

            if (response.data.success) {
                console.log('✅ Logged out successfully');
                this.token = null;
                this.userId = null;
                return true;
            }
        } catch (error) {
            console.error('❌ Logout error:', error.message);
            return false;
        }
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Viettel Post API Client Test');
    console.log('================================\n');

    const client = new ViettelPostClient();

    // Test 1: Login
    const loggedIn = await client.login(USERNAME, PASSWORD);
    if (!loggedIn) {
        console.log('\n⚠️ Please update USERNAME and PASSWORD in testClient.js');
        return;
    }

    // Test 2: Check token
    await client.checkToken();

    // Test 3: Get provinces
    const provinces = await client.getProvinces();
    if (provinces.length === 0) return;

    // Use first two provinces for testing
    const senderProvinceId = provinces[0].PROVINCE_ID;
    const receiverProvinceId = provinces[1] ? provinces[1].PROVINCE_ID : provinces[0].PROVINCE_ID;

    // Test 4: Get districts
    const senderDistricts = await client.getDistricts(senderProvinceId);
    const receiverDistricts = await client.getDistricts(receiverProvinceId);

    if (senderDistricts.length === 0 || receiverDistricts.length === 0) return;

    const senderDistrictId = senderDistricts[0].DISTRICT_ID;
    const receiverDistrictId = receiverDistricts[0].DISTRICT_ID;

    // Test 5: Get wards
    await client.getWards(senderDistrictId);

    // Test 6: Get complete address
    await client.getCompleteAddress(senderProvinceId, senderDistrictId);

    // Test 7: Calculate shipping price
    const shipmentData = {
        PRODUCT_WEIGHT: 1000,           // 1kg
        PRODUCT_PRICE: 500000,          // 500,000 VND
        MONEY_COLLECTION: 500000,       // COD 500,000 VND
        SENDER_PROVINCE: senderProvinceId,
        SENDER_DISTRICT: senderDistrictId,
        RECEIVER_PROVINCE: receiverProvinceId,
        RECEIVER_DISTRICT: receiverDistrictId,
        PRODUCT_TYPE: 'HH',             // Hàng hóa
        NATIONAL_TYPE: 1                // Nội địa
    };

    console.log('\n📋 Shipment Details:');
    console.log(`   Weight: ${shipmentData.PRODUCT_WEIGHT}g`);
    console.log(`   Value: ${shipmentData.PRODUCT_PRICE.toLocaleString('vi-VN')} VND`);
    console.log(`   COD: ${shipmentData.MONEY_COLLECTION.toLocaleString('vi-VN')} VND`);
    console.log(`   From Province: ${senderProvinceId}`);
    console.log(`   To Province: ${receiverProvinceId}`);

    await client.calculatePrice(shipmentData);

    // Test 8: Get enhanced shipment options
    await client.getShipmentOptions(shipmentData);

    // Test 9: Logout
    await client.logout();

    console.log('\n✅ All tests completed!');
    console.log('================================\n');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

// Export for use in other files
module.exports = ViettelPostClient;
