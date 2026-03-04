# Viettel Post API - Enhanced Backend Documentation

## Overview
Enhanced Node.js backend for Viettel Post API integration with persistent token storage, address management, and shipment calculation.

## Features
- ✅ Persistent token storage (survives server restarts)
- ✅ Automatic token expiration and cleanup
- ✅ Complete address hierarchy fetching
- ✅ Enhanced shipment options calculation
- ✅ Order creation and tracking
- ✅ Admin endpoints for token management

## Installation

```bash
npm install
```

## Running the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## API Endpoints

### Authentication Endpoints

#### POST /api/login
Login and get authentication token. Token is automatically stored and can be reused.

**Request Body:**
```json
{
  "username": "0123456789",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "0123456789",
  "username": "0123456789",
  "message": "Login successful",
  "fromCache": false
}
```

#### POST /api/logout
Logout and remove stored token.

**Request Body:**
```json
{
  "userId": "0123456789"
}
```

#### GET /api/check-token/:userId
Check if a user has a valid stored token.

**Response:**
```json
{
  "success": true,
  "isValid": true,
  "tokenData": {
    "token": "...",
    "userId": "0123456789",
    "createdAt": "2026-02-13T10:00:00.000Z",
    "lastUsed": "2026-02-13T11:30:00.000Z"
  }
}
```

### Address Endpoints

All address endpoints require the `Authorization` header with your token.

#### GET /api/provinces
Get all provinces in Vietnam.

**Headers:**
```
Authorization: YOUR_TOKEN
```

**Response:**
```json
{
  "status": 200,
  "data": [
    {
      "PROVINCE_ID": 1,
      "PROVINCE_NAME": "Hà Nội",
      "PROVINCE_CODE": "01"
    }
  ]
}
```

#### GET /api/districts/:provinceId
Get all districts in a province.

**Headers:**
```
Authorization: YOUR_TOKEN
```

**Response:**
```json
{
  "status": 200,
  "data": [
    {
      "DISTRICT_ID": 1,
      "DISTRICT_NAME": "Ba Đình",
      "PROVINCE_ID": 1
    }
  ]
}
```

#### GET /api/wards/:districtId
Get all wards in a district.

**Headers:**
```
Authorization: YOUR_TOKEN
```

**Response:**
```json
{
  "status": 200,
  "data": [
    {
      "WARDS_ID": 1,
      "WARDS_NAME": "Phường Phúc Xá",
      "DISTRICT_ID": 1
    }
  ]
}
```

#### GET /api/address/complete
Get complete address hierarchy in one call.

**Headers:**
```
Authorization: YOUR_TOKEN
```

**Query Parameters:**
- `provinceId` (required): Province ID
- `districtId` (optional): District ID
- `wardId` (optional): Ward ID

**Example:**
```
GET /api/address/complete?provinceId=1&districtId=1&wardId=1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "province": {
      "PROVINCE_ID": 1,
      "PROVINCE_NAME": "Hà Nội"
    },
    "district": {
      "DISTRICT_ID": 1,
      "DISTRICT_NAME": "Ba Đình"
    },
    "ward": {
      "WARDS_ID": 1,
      "WARDS_NAME": "Phường Phúc Xá"
    },
    "fullAddress": "Phường Phúc Xá, Ba Đình, Hà Nội"
  }
}
```

### Shipping Calculation Endpoints

#### POST /api/calculate-price
Calculate shipping price (returns raw Viettel Post response).

**Headers:**
```
Authorization: YOUR_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "PRODUCT_WEIGHT": 1000,
  "PRODUCT_PRICE": 500000,
  "MONEY_COLLECTION": 500000,
  "SENDER_PROVINCE": 1,
  "SENDER_DISTRICT": 1,
  "RECEIVER_PROVINCE": 2,
  "RECEIVER_DISTRICT": 5,
  "PRODUCT_TYPE": "HH",
  "NATIONAL_TYPE": 1
}
```

**Response:**
```json
{
  "status": 200,
  "data": [
    {
      "MA_DV_CHINH": "VCN",
      "TEN_DICHVU": "Viettel Chuyển Nhanh",
      "GIA_CUOC": 25000,
      "THOI_GIAN": "2-3 ngày",
      "TONG_CUOC": 27500
    }
  ]
}
```

#### POST /api/shipment-options
Get shipment options with enhanced, structured data.

**Headers:**
```
Authorization: YOUR_TOKEN
Content-Type: application/json
```

**Request Body:** (same as calculate-price)

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "serviceCode": "VCN",
      "serviceName": "Viettel Chuyển Nhanh",
      "baseFee": 25000,
      "extraServicesFee": 1000,
      "insuranceFee": 500,
      "remoteFee": 1000,
      "totalFee": 27500,
      "deliveryTime": "2-3 ngày",
      "rawData": { ... }
    }
  ]
}
```

### Order Endpoints

#### POST /api/order/create
Create a new shipment order.

**Headers:**
```
Authorization: YOUR_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "ORDER_NUMBER": "ORDER123",
  "SENDER_FULLNAME": "Nguyen Van A",
  "SENDER_ADDRESS": "123 Street",
  "SENDER_PHONE": "0123456789",
  "SENDER_PROVINCE": 1,
  "SENDER_DISTRICT": 1,
  "RECEIVER_FULLNAME": "Tran Van B",
  "RECEIVER_ADDRESS": "456 Avenue",
  "RECEIVER_PHONE": "0987654321",
  "RECEIVER_PROVINCE": 2,
  "RECEIVER_DISTRICT": 5,
  "PRODUCT_WEIGHT": 1000,
  "PRODUCT_PRICE": 500000,
  "MONEY_COLLECTION": 500000,
  "PRODUCT_TYPE": "HH",
  "ORDER_SERVICE": "VCN"
}
```

#### GET /api/order/:orderNumber
Get order information by order number.

**Headers:**
```
Authorization: YOUR_TOKEN
```

**Example:**
```
GET /api/order/ORDER123
```

### Admin Endpoints

#### GET /api/admin/tokens
Get all stored tokens (sanitized).

**Response:**
```json
{
  "success": true,
  "count": 2,
  "tokens": [
    {
      "userId": "0123456789",
      "createdAt": "2026-02-13T10:00:00.000Z",
      "lastUsed": "2026-02-13T11:30:00.000Z",
      "hasToken": true
    }
  ]
}
```

#### POST /api/admin/clean-tokens
Manually clean expired tokens.

**Response:**
```json
{
  "success": true,
  "message": "Cleaned 3 expired tokens"
}
```

## Token Storage

Tokens are stored in `tokens.json` file in the following format:

```json
{
  "userId": {
    "token": "long_term_token",
    "tempToken": "temporary_token",
    "userId": "0123456789",
    "username": "0123456789",
    "createdAt": "2026-02-13T10:00:00.000Z",
    "lastUsed": "2026-02-13T11:30:00.000Z",
    "fullData": { ... }
  }
}
```

- Tokens are automatically saved to disk
- Tokens expire after 24 hours
- Expired tokens are cleaned every hour automatically
- Token storage survives server restarts

## Usage Example

### JavaScript/Frontend

```javascript
const API_URL = 'http://localhost:3000/api';

// Login
const loginResponse = await fetch(`${API_URL}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: '0123456789',
    password: 'your_password'
  })
});
const { token } = await loginResponse.json();

// Get provinces
const provincesResponse = await fetch(`${API_URL}/provinces`, {
  headers: { 'Authorization': token }
});
const provinces = await provincesResponse.json();

// Calculate shipping
const shipmentResponse = await fetch(`${API_URL}/shipment-options`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': token
  },
  body: JSON.stringify({
    PRODUCT_WEIGHT: 1000,
    PRODUCT_PRICE: 500000,
    MONEY_COLLECTION: 500000,
    SENDER_PROVINCE: 1,
    SENDER_DISTRICT: 1,
    RECEIVER_PROVINCE: 2,
    RECEIVER_DISTRICT: 5,
    PRODUCT_TYPE: 'HH',
    NATIONAL_TYPE: 1
  })
});
const options = await shipmentResponse.json();
```

### Node.js

```javascript
const axios = require('axios');
const API_URL = 'http://localhost:3000/api';

async function calculateShipping() {
  // Login
  const { data: { token } } = await axios.post(`${API_URL}/login`, {
    username: '0123456789',
    password: 'your_password'
  });

  // Get shipment options
  const { data } = await axios.post(
    `${API_URL}/shipment-options`,
    {
      PRODUCT_WEIGHT: 1000,
      PRODUCT_PRICE: 500000,
      MONEY_COLLECTION: 500000,
      SENDER_PROVINCE: 1,
      SENDER_DISTRICT: 1,
      RECEIVER_PROVINCE: 2,
      RECEIVER_DISTRICT: 5,
      PRODUCT_TYPE: 'HH',
      NATIONAL_TYPE: 1
    },
    {
      headers: { 'Authorization': token }
    }
  );

  console.log('Shipment options:', data);
}
```

## Environment Variables

You can configure the server using environment variables:

```bash
PORT=3000  # Server port (default: 3000)
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (missing parameters)
- `401` - Unauthorized (missing or invalid token)
- `500` - Internal server error

## Security Considerations

- **Production**: Use HTTPS instead of HTTP
- **Production**: Implement rate limiting
- **Production**: Add authentication for admin endpoints
- **Production**: Use environment variables for sensitive configuration
- **Production**: Consider using Redis or database for token storage instead of JSON file

## Support

For Viettel Post API documentation:
- Website: https://viettelpost.vn
- Partner Portal: https://partner.viettelpost.vn
