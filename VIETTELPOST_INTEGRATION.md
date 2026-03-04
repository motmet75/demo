# Viettel Post Integration - Java Spring Boot + React

## Overview

This integration adds Viettel Post shipping calculator functionality to the BOM System demo application using:
- **Backend**: Java Spring Boot
- **Frontend**: React

## Project Structure

### Backend (Java Spring Boot)

```
src/main/java/com/demo/viettelpost/
├── ViettelPostController.java   # REST API endpoints
├── ViettelPostService.java      # Business logic & API calls
├── ViettelPostDTO.java          # Data Transfer Objects
└── ViettelPostToken.java        # Token entity
```

### Frontend (React)

```
bom-frontend/src/
├── api/
│   └── viettelpostApi.js        # API client functions
├── features/
│   └── viettelpost/
│       └── ViettelPostPage.jsx  # Shipping calculator page
└── App.jsx                      # Updated with new route
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/viettelpost/token` | Get stored token |
| POST | `/api/viettelpost/token` | Set/update token |
| POST | `/api/viettelpost/login` | Login to Viettel Post |
| GET | `/api/viettelpost/check-token/{userId}` | Check token validity |

### Address Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/viettelpost/provinces` | Get all provinces |
| GET | `/api/viettelpost/districts/{provinceId}` | Get districts |
| GET | `/api/viettelpost/wards/{districtId}` | Get wards |
| GET | `/api/viettelpost/address/complete` | Get complete address |

### Shipping
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/viettelpost/calculate-price` | Calculate single service price |
| POST | `/api/viettelpost/shipment-options` | Get all shipping options |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/viettelpost/admin/tokens` | View all tokens |
| POST | `/api/viettelpost/admin/clean-tokens` | Clean expired tokens |

## Token Configuration

Your Viettel Post token is pre-configured in `ViettelPostService.java`:

```java
private static final String DEFAULT_TOKEN = "41A7F86612D4357C125529D1878BBE38";
```

## Running the Application

### 1. Start Spring Boot Backend

```bash
cd /opt/tuonghoa/demo
mvn spring-boot:run
```

### 2. Start React Frontend (Development)

```bash
cd /opt/tuonghoa/demo/bom-frontend
npm run dev
```

### 3. Access the Application

- Frontend: http://localhost:5173 (or configured port)
- Backend API: http://localhost:8080/api/viettelpost

## Frontend Navigation

The new page is accessible via:
- Navigation link: **🚚 Viettel Post** (highlighted in red)
- Direct URL: `/viettelpost`

## Features

### Shipping Calculator Page
1. **Token Display** - Shows the configured token status
2. **Sender Address** - Select province and district
3. **Receiver Address** - Select province and district
4. **Package Details**:
   - Weight (grams)
   - Product Value (VND)
   - COD Amount (VND)
   - Product Type (Goods/Documents)
5. **Results Table** - Shows available shipping options with:
   - Service name and code
   - Base fee
   - VAT
   - Total fee
   - Delivery time

## Available Shipping Services

| Code | Service Name |
|------|--------------|
| VCN | Chuyển phát nhanh |
| VCBO | Chuyển phát nhanh theo bộ |
| VHT | Phát hỏa tốc |
| PTN | Phát trong ngày |
| PHS | Phát hẹn giờ |
| VBS | Chuyển phát tiêu chuẩn |
| SCOD | Dịch vụ thu hộ COD |

## Usage Example

### API Request (from React)
```javascript
const result = await viettelpostApi.getShipmentOptions(token, {
  PRODUCT_WEIGHT: 1000,      // 1kg
  PRODUCT_PRICE: 500000,     // 500,000 VND
  MONEY_COLLECTION: 0,       // No COD
  SENDER_PROVINCE: 1,        // Hà Nội
  SENDER_DISTRICT: 1,        // Quận Hoàn Kiếm
  RECEIVER_PROVINCE: 2,      // Hồ Chí Minh
  RECEIVER_DISTRICT: 34,     // Quận 3
  PRODUCT_TYPE: 'HH',        // Goods
  NATIONAL_TYPE: 1           // Domestic
})
```

### API Response
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "serviceCode": "VCBO",
      "serviceName": "Chuyển phát nhanh theo bộ",
      "baseFee": 34259,
      "vatFee": 2741,
      "totalFee": 37000,
      "deliveryTime": "72 giờ"
    }
  ]
}
```

## Files Created/Modified

### New Files
- `/src/main/java/com/demo/viettelpost/ViettelPostController.java`
- `/src/main/java/com/demo/viettelpost/ViettelPostService.java`
- `/src/main/java/com/demo/viettelpost/ViettelPostDTO.java`
- `/src/main/java/com/demo/viettelpost/ViettelPostToken.java`
- `/bom-frontend/src/api/viettelpostApi.js`
- `/bom-frontend/src/features/viettelpost/ViettelPostPage.jsx`

### Modified Files
- `/bom-frontend/src/App.jsx` - Added import, navigation link, and route

## Security Notes

- CSRF is disabled in SecurityConfig (for API access)
- All endpoints under `/api/viettelpost/**` are public
- Token is stored in-memory (use database for production)
- Consider adding authentication for admin endpoints in production

## Troubleshooting

### Token not loading
- Check if backend is running
- Verify token is set in ViettelPostService.java

### Provinces/Districts not loading
- Ensure token is valid
- Check network connectivity to Viettel Post API

### No shipping options returned
- Verify sender/receiver addresses are complete
- Some routes may not have all services available

## Dependencies

### Backend (pom.xml)
- Spring Boot Starter Web (already included)
- Jackson Databind (already included)

### Frontend (package.json)
- React Router DOM (already included)
