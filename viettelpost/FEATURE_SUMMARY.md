# Viettel Post Backend - Feature Summary

## Overview
This enhanced backend system provides a complete solution for integrating with Viettel Post API, including persistent token storage, address management, and shipment calculation.

## File Structure

```
viettelpost/
├── server.js                  # Main Express server with all endpoints
├── tokenManager.js            # Token storage and lifecycle management
├── viettelPostService.js      # Business logic for Viettel Post API
├── testClient.js              # Test client for API verification
├── tokens.json                # Token storage file (auto-generated)
├── index.html                 # Frontend UI
├── package.json               # Dependencies
├── README.md                  # User guide
├── API_DOCUMENTATION.md       # Complete API reference
└── .gitignore                 # Git ignore rules
```

## Key Components

### 1. Token Manager (`tokenManager.js`)
**Purpose:** Manages authentication tokens with persistent storage

**Features:**
- Saves tokens to `tokens.json` file
- Survives server restarts
- Automatic expiration after 24 hours
- Auto-cleanup of expired tokens
- Last-used timestamp tracking

**Methods:**
- `storeToken(userId, tokenData)` - Store a new token
- `getToken(userId)` - Get token by user ID
- `getTokenData(userId)` - Get complete token data
- `removeToken(userId)` - Delete a token
- `hasValidToken(userId)` - Check if token exists and is valid
- `cleanExpiredTokens()` - Remove expired tokens
- `getAllTokens()` - Get all stored tokens (admin)

### 2. Viettel Post Service (`viettelPostService.js`)
**Purpose:** Encapsulates all Viettel Post API interactions

**Features:**
- Clean API abstraction
- Error handling
- Data transformation
- Enhanced response formatting

**Methods:**
- `login(username, password)` - Login and get tokens
- `getProvinces(token)` - Get all provinces
- `getDistricts(token, provinceId)` - Get districts by province
- `getWards(token, districtId)` - Get wards by district
- `getCompleteAddress(token, provinceId, districtId, wardId)` - Get full address
- `calculatePrice(token, priceData)` - Calculate shipping price
- `getShipmentOptions(token, shipmentData)` - Get enhanced shipment options
- `createOrder(token, orderData)` - Create a shipment order
- `getOrderInfo(token, orderNumber)` - Track an order

### 3. Server (`server.js`)
**Purpose:** Main Express application with REST API endpoints

**Features:**
- CORS enabled
- JSON body parsing
- Static file serving
- Automatic token cleanup (every hour)
- Comprehensive error handling

## API Endpoints

### Authentication Endpoints

#### POST /api/login
Login and get authentication token. Automatically stores token for reuse.

**Benefits:**
- Token reuse on subsequent logins
- Persistent storage
- No need to re-authenticate if token is still valid

#### POST /api/logout
Remove stored token for a user.

#### GET /api/check-token/:userId
Verify if a stored token is still valid.

**Use case:** Check token validity before making API calls

### Address Endpoints

#### GET /api/provinces
Get all provinces in Vietnam.

#### GET /api/districts/:provinceId
Get all districts in a specific province.

#### GET /api/wards/:districtId
Get all wards in a specific district.

#### GET /api/address/complete
**NEW FEATURE:** Get complete address hierarchy in a single API call.

**Benefits:**
- Reduces number of API calls
- Returns formatted full address
- Fetches province, district, and ward information simultaneously

**Example Usage:**
```javascript
GET /api/address/complete?provinceId=1&districtId=1&wardId=1

Response:
{
  "province": {...},
  "district": {...},
  "ward": {...},
  "fullAddress": "Phường Phúc Xá, Ba Đình, Hà Nội"
}
```

### Shipping Calculation Endpoints

#### POST /api/calculate-price
Calculate shipping price with raw Viettel Post API response.

**Use case:** When you need the original API response

#### POST /api/shipment-options
**NEW FEATURE:** Get enhanced, structured shipment options.

**Benefits:**
- Cleaner data structure
- Fee breakdown (base, extra services, insurance, remote)
- Consistent field names
- Easy to display in UI

**Example Response:**
```javascript
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
      "rawData": {...}
    }
  ]
}
```

### Order Endpoints

#### POST /api/order/create
Create a new shipment order with Viettel Post.

#### GET /api/order/:orderNumber
Track an existing order.

### Admin Endpoints

#### GET /api/admin/tokens
View all stored tokens (sanitized, without actual token values).

**Use case:** Monitor token usage, see who's logged in

#### POST /api/admin/clean-tokens
Manually trigger cleanup of expired tokens.

## Token Storage

### Storage Format (`tokens.json`)
```json
{
  "userId": {
    "token": "long_term_token_string",
    "tempToken": "temporary_token_string",
    "userId": "0123456789",
    "username": "0123456789",
    "createdAt": "2026-02-13T10:00:00.000Z",
    "lastUsed": "2026-02-13T11:30:00.000Z",
    "fullData": {...}
  }
}
```

### Token Lifecycle
1. **Creation:** When user logs in via `/api/login`
2. **Storage:** Saved to `tokens.json` immediately
3. **Usage:** Retrieved for authenticated API calls
4. **Update:** `lastUsed` timestamp updated on each use
5. **Expiration:** Automatically expires after 24 hours
6. **Cleanup:** Removed during automatic hourly cleanup or manual cleanup

## Usage Examples

### Example 1: Login and Store Token
```javascript
const response = await fetch('http://localhost:3000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: '0123456789',
    password: 'your_password'
  })
});

const { token, userId } = await response.json();
// Token is now stored on the server
// Can be reused even after server restart
```

### Example 2: Get Complete Address
```javascript
const response = await fetch(
  'http://localhost:3000/api/address/complete?provinceId=1&districtId=1&wardId=1',
  {
    headers: { 'Authorization': token }
  }
);

const { data } = await response.json();
console.log(data.fullAddress); // "Phường Phúc Xá, Ba Đình, Hà Nội"
```

### Example 3: Get Enhanced Shipment Options
```javascript
const response = await fetch('http://localhost:3000/api/shipment-options', {
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

const { data } = await response.json();
data.forEach(option => {
  console.log(`${option.serviceName}: ${option.totalFee.toLocaleString()} VND`);
});
```

## Benefits of This Architecture

### 1. Persistent Token Storage
- Tokens survive server restarts
- No need to re-login frequently
- Reduced API calls to Viettel Post

### 2. Modular Design
- Easy to maintain
- Clear separation of concerns
- Testable components

### 3. Enhanced Data
- Structured responses
- Consistent naming
- Fee breakdowns

### 4. Developer-Friendly
- Complete documentation
- Test client included
- Error handling
- Logging

### 5. Production-Ready Features
- Automatic cleanup
- Token expiration
- Error responses
- CORS support

## Security Considerations

### Current Implementation
- Tokens stored in JSON file
- No encryption on tokens (relies on Viettel Post's token security)
- Basic token validation
- Admin endpoints unprotected

### Production Recommendations
1. **Use HTTPS** - Always use HTTPS in production
2. **Environment Variables** - Store sensitive configuration in env vars
3. **Database Storage** - Use Redis or database instead of JSON file
4. **Rate Limiting** - Add rate limiting to prevent abuse
5. **Admin Authentication** - Protect admin endpoints with authentication
6. **Token Encryption** - Encrypt tokens at rest
7. **Audit Logging** - Log all token operations

## Testing

### Run Test Client
```bash
# Edit testClient.js with your credentials
node testClient.js
```

This tests all endpoints and provides detailed output.

### Manual Testing
Use the included `index.html` file or any HTTP client (Postman, curl, etc.)

See `API_DOCUMENTATION.md` for detailed endpoint documentation.

## Deployment

### Local Development
```bash
npm install
npm start
```

### Production Deployment
1. Set environment variables:
   ```bash
   export PORT=3000
   ```

2. Use process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js --name viettelpost-api
   ```

3. Set up reverse proxy (nginx) for HTTPS

4. Monitor logs:
   ```bash
   pm2 logs viettelpost-api
   ```

## Future Enhancements

Potential improvements:
- [ ] Redis for token storage
- [ ] WebSocket support for real-time updates
- [ ] Rate limiting
- [ ] Authentication for admin endpoints
- [ ] Webhook support for order status updates
- [ ] Bulk order creation
- [ ] Order history tracking
- [ ] Email notifications
- [ ] Multi-user support with user management
- [ ] API key authentication

## Support

For issues or questions:
- Check `API_DOCUMENTATION.md` for endpoint details
- Run `testClient.js` to verify functionality
- Review server logs for errors

For Viettel Post API support:
- Website: https://viettelpost.vn
- Partner Portal: https://partner.viettelpost.vn
