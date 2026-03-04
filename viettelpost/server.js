// Viettel Post API Server - Enhanced Version
// Install dependencies: npm install express cors axios

const express = require('express');
const cors = require('cors');
const tokenManager = require('./tokenManager');
const viettelPostService = require('./viettelPostService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Clean expired tokens every hour
setInterval(() => {
    tokenManager.cleanExpiredTokens();
}, 60 * 60 * 1000);

// ========== AUTHENTICATION ENDPOINTS ==========

// Pre-configured token - Your Viettel Post Token
const DEFAULT_TOKEN = '41A7F86612D4357C125529D1878BBE38';

// Get stored token (use without login)
app.get('/api/token', (req, res) => {
    try {
        // Return the default pre-configured token
        res.json({
            success: true,
            token: DEFAULT_TOKEN,
            message: 'Using pre-configured Viettel Post token'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Set/update token manually
app.post('/api/token', async (req, res) => {
    try {
        const { token, userId = 'default' } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        // Store the token
        await tokenManager.storeToken(userId, {
            token: token,
            userId: userId,
            username: 'manual_token'
        });

        res.json({
            success: true,
            token: token,
            userId: userId,
            message: 'Token stored successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Login endpoint with token storage
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Check if user already has a valid token
        if (tokenManager.hasValidToken(username)) {
            const tokenData = tokenManager.getTokenData(username);
            return res.json({
                success: true,
                token: tokenData.token,
                userId: tokenData.userId,
                message: 'Using existing valid token',
                fromCache: true
            });
        }

        // Login and get new token
        const authData = await viettelPostService.login(username, password);

        // Store token
        await tokenManager.storeToken(username, authData);

        res.json({
            success: true,
            token: authData.token,
            userId: authData.userId,
            username: authData.username,
            message: 'Login successful',
            fromCache: false
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (userId) {
            await tokenManager.removeToken(userId);
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Check token validity
app.get('/api/check-token/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const isValid = tokenManager.hasValidToken(userId);
        
        res.json({
            success: true,
            isValid: isValid,
            tokenData: isValid ? tokenManager.getTokenData(userId) : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== ADDRESS ENDPOINTS ==========

// Get provinces
app.get('/api/provinces', async (req, res) => {
    try {
        const token = req.headers.authorization;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        const response = await viettelPostService.getProvinces(token);
        res.json(response);
    } catch (error) {
        console.error('Provinces error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get districts by province
app.get('/api/districts/:provinceId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const { provinceId } = req.params;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        const response = await viettelPostService.getDistricts(token, provinceId);
        res.json(response);
    } catch (error) {
        console.error('Districts error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get wards by district
app.get('/api/wards/:districtId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const { districtId } = req.params;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        const response = await viettelPostService.getWards(token, districtId);
        res.json(response);
    } catch (error) {
        console.error('Wards error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get complete address (province, district, ward in one call)
app.get('/api/address/complete', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const { provinceId, districtId, wardId } = req.query;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        if (!provinceId) {
            return res.status(400).json({
                success: false,
                message: 'Province ID is required'
            });
        }

        const address = await viettelPostService.getCompleteAddress(
            token, 
            provinceId, 
            districtId, 
            wardId
        );

        res.json({
            success: true,
            data: address
        });
    } catch (error) {
        console.error('Complete address error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== SHIPPING CALCULATION ENDPOINTS ==========

// Calculate shipping price (raw response)
app.post('/api/calculate-price', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const priceData = req.body;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        const response = await viettelPostService.calculatePrice(token, priceData);
        res.json(response);
    } catch (error) {
        console.error('Calculate price error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get shipment options (enhanced response)
app.post('/api/shipment-options', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const shipmentData = req.body;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        // Validate required fields
        const requiredFields = [
            'PRODUCT_WEIGHT',
            'SENDER_PROVINCE',
            'SENDER_DISTRICT',
            'RECEIVER_PROVINCE',
            'RECEIVER_DISTRICT'
        ];

        for (const field of requiredFields) {
            if (!shipmentData[field]) {
                return res.status(400).json({
                    success: false,
                    message: `${field} is required`
                });
            }
        }

        const options = await viettelPostService.getShipmentOptions(token, shipmentData);

        res.json({
            success: true,
            count: options.length,
            data: options
        });
    } catch (error) {
        console.error('Shipment options error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== ORDER ENDPOINTS (Optional) ==========

// Create order
app.post('/api/order/create', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const orderData = req.body;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        const response = await viettelPostService.createOrder(token, orderData);
        res.json(response);
    } catch (error) {
        console.error('Create order error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get order info
app.get('/api/order/:orderNumber', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const { orderNumber } = req.params;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        const response = await viettelPostService.getOrderInfo(token, orderNumber);
        res.json(response);
    } catch (error) {
        console.error('Get order error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== ADMIN ENDPOINTS ==========

// Get all stored tokens (for debugging)
app.get('/api/admin/tokens', (req, res) => {
    try {
        const tokens = tokenManager.getAllTokens();
        
        // Hide sensitive data
        const sanitized = Object.keys(tokens).map(userId => ({
            userId,
            createdAt: tokens[userId].createdAt,
            lastUsed: tokens[userId].lastUsed,
            hasToken: !!tokens[userId].token
        }));

        res.json({
            success: true,
            count: sanitized.length,
            tokens: sanitized
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Clean expired tokens manually
app.post('/api/admin/clean-tokens', async (req, res) => {
    try {
        const cleaned = await tokenManager.cleanExpiredTokens();
        res.json({
            success: true,
            message: `Cleaned ${cleaned} expired tokens`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Viettel Post API Server running on http://localhost:${PORT}`);
    console.log(`📝 Enhanced features enabled:`);
    console.log(`   - Persistent token storage`);
    console.log(`   - Automatic token cleanup`);
    console.log(`   - Address fetching`);
    console.log(`   - Shipment options calculation`);
    console.log(`   - Order management`);
    console.log(`\n📡 Available endpoints:`);
    console.log(`   POST   /api/login`);
    console.log(`   POST   /api/logout`);
    console.log(`   GET    /api/check-token/:userId`);
    console.log(`   GET    /api/provinces`);
    console.log(`   GET    /api/districts/:provinceId`);
    console.log(`   GET    /api/wards/:districtId`);
    console.log(`   GET    /api/address/complete`);
    console.log(`   POST   /api/calculate-price`);
    console.log(`   POST   /api/shipment-options`);
    console.log(`   POST   /api/order/create`);
    console.log(`   GET    /api/order/:orderNumber`);
    console.log(`   GET    /api/admin/tokens`);
    console.log(`   POST   /api/admin/clean-tokens`);
});