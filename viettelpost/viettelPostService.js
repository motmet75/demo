// Viettel Post Service - Business logic for Viettel Post API
const axios = require('axios');

const API_BASE = 'https://partner.viettelpost.vn/v2';

class ViettelPostService {
    constructor() {
        this.apiBase = API_BASE;
    }

    // Login and get tokens
    async login(username, password) {
        try {
            // Step 1: Login to get temporary token
            const loginResponse = await axios.post(`${this.apiBase}/user/Login`, {
                USERNAME: username,
                PASSWORD: password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (loginResponse.data.status !== 200 || !loginResponse.data.data?.token) {
                throw new Error('Invalid credentials');
            }

            const tempToken = loginResponse.data.data.token;

            // Step 2: Get long-term token
            const connectResponse = await axios.post(`${this.apiBase}/user/ownerconnect`, {}, {
                headers: {
                    'Content-Type': 'application/json',
                    'Token': tempToken
                }
            });

            if (connectResponse.data.status !== 200 || !connectResponse.data.data?.token) {
                throw new Error('Failed to get long-term token');
            }

            const longTermToken = connectResponse.data.data.token;
            const userData = connectResponse.data.data;

            return {
                token: longTermToken,
                tempToken: tempToken,
                userId: userData.userId || username,
                username: username,
                fullData: userData
            };
        } catch (error) {
            console.error('Login error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message || 'Login failed');
        }
    }

    // Get all provinces
    async getProvinces(token) {
        try {
            const response = await axios.get(`${this.apiBase}/categories/listProvince`, {
                headers: { 'Token': token }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to fetch provinces: ' + error.message);
        }
    }

    // Get districts by province ID
    async getDistricts(token, provinceId) {
        try {
            const response = await axios.get(`${this.apiBase}/categories/listDistrict?provinceId=${provinceId}`, {
                headers: { 'Token': token }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to fetch districts: ' + error.message);
        }
    }

    // Get wards by district ID
    async getWards(token, districtId) {
        try {
            const response = await axios.get(`${this.apiBase}/categories/listWards?districtId=${districtId}`, {
                headers: { 'Token': token }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to fetch wards: ' + error.message);
        }
    }

    // Get complete address hierarchy
    async getCompleteAddress(token, provinceId, districtId, wardId) {
        try {
            const [provinces, districts, wards] = await Promise.all([
                this.getProvinces(token),
                districtId ? this.getDistricts(token, provinceId) : Promise.resolve({ data: [] }),
                wardId ? this.getWards(token, districtId) : Promise.resolve({ data: [] })
            ]);

            const province = provinces.data?.find(p => p.PROVINCE_ID == provinceId);
            const district = districts.data?.find(d => d.DISTRICT_ID == districtId);
            const ward = wards.data?.find(w => w.WARDS_ID == wardId);

            return {
                province: province || null,
                district: district || null,
                ward: ward || null,
                fullAddress: [ward?.WARDS_NAME, district?.DISTRICT_NAME, province?.PROVINCE_NAME]
                    .filter(Boolean)
                    .join(', ')
            };
        } catch (error) {
            throw new Error('Failed to fetch complete address: ' + error.message);
        }
    }

    // Calculate shipping price for a single service
    async calculatePrice(token, priceData) {
        try {
            const response = await axios.post(`${this.apiBase}/order/getPrice`, priceData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Token': token
                }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to calculate price: ' + error.message);
        }
    }

    // Calculate prices for all available services
    async calculateAllPrices(token, priceData) {
        try {
            const response = await axios.post(`${this.apiBase}/order/getPriceAll`, priceData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Token': token
                }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to calculate all prices: ' + error.message);
        }
    }

    // Get all shipment options with enhanced data
    async getShipmentOptions(token, shipmentData) {
        try {
            // Try to get all prices first
            const priceResponse = await this.calculateAllPrices(token, shipmentData);
            
            if (priceResponse.status === 200 && priceResponse.data) {
                // Enhance shipment options with additional info
                const services = Array.isArray(priceResponse.data) ? priceResponse.data : [priceResponse.data];
                
                return services.map(service => ({
                    serviceCode: service.MA_DV_CHINH,
                    serviceName: service.TEN_DICHVU || service.MA_DV_CHINH,
                    baseFee: service.GIA_CUOC || 0,
                    extraServicesFee: service.GIA_CUOC_DV_CON || 0,
                    insuranceFee: service.PHI_BAO_HIEM || 0,
                    remoteFee: service.PHI_XA_TRAM || 0,
                    totalFee: service.TONG_CUOC || service.MONEY_TOTAL || 0,
                    deliveryTime: service.THOI_GIAN || 'N/A',
                    rawData: service
                }));
            }

            // If getPriceAll doesn't work, try individual services
            const services = ['VCN', 'VCBO', 'VHT', 'PTN', 'PHS', 'VBS', 'SCOD'];
            const results = [];

            for (const serviceCode of services) {
                try {
                    const singlePrice = await this.calculatePrice(token, {
                        ...shipmentData,
                        ORDER_SERVICE: serviceCode
                    });
                    
                    if (singlePrice.status === 200 && singlePrice.data) {
                        results.push({
                            serviceCode: serviceCode,
                            serviceName: this.getServiceName(serviceCode),
                            baseFee: singlePrice.data.MONEY_TOTAL_FEE || 0,
                            vatFee: singlePrice.data.MONEY_VAT || 0,
                            collectionFee: singlePrice.data.MONEY_COLLECTION_FEE || 0,
                            otherFee: singlePrice.data.MONEY_OTHER_FEE || 0,
                            totalFee: singlePrice.data.MONEY_TOTAL || 0,
                            deliveryTime: singlePrice.data.KPI_HT ? `${singlePrice.data.KPI_HT} giờ` : 'N/A',
                            rawData: singlePrice.data
                        });
                    }
                } catch (e) {
                    // Service not available for this route, skip
                }
            }

            if (results.length === 0) {
                throw new Error('No shipment options available for this route');
            }

            return results;
        } catch (error) {
            throw new Error('Failed to get shipment options: ' + error.message);
        }
    }

    // Get service name from code
    getServiceName(code) {
        const serviceNames = {
            'VCN': 'Chuyển phát nhanh',
            'VCBO': 'Chuyển phát nhanh theo bộ',
            'VHT': 'Phát hỏa tốc',
            'PTN': 'Phát trong ngày',
            'PHS': 'Phát hẹn giờ',
            'VBS': 'Chuyển phát tiêu chuẩn',
            'SCOD': 'Dịch vụ thu hộ COD',
            'LCOD': 'COD Lite',
            'VTK': 'Tiết kiệm',
            'VBE': 'Chuyển phát tiết kiệm',
            'PHT': 'Phát hàng thu tiền'
        };
        return serviceNames[code] || code;
    }

    // Create order (if you want to extend functionality)
    async createOrder(token, orderData) {
        try {
            const response = await axios.post(`${this.apiBase}/order/createOrder`, orderData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Token': token
                }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to create order: ' + error.message);
        }
    }

    // Get order info
    async getOrderInfo(token, orderNumber) {
        try {
            const response = await axios.get(`${this.apiBase}/order/getOrderInfoByCode?orderNumber=${orderNumber}`, {
                headers: { 'Token': token }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to get order info: ' + error.message);
        }
    }
}

module.exports = new ViettelPostService();
