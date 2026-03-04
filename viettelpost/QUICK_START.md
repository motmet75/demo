# Quick Start Guide - Viettel Post Backend

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
cd /opt/tuonghoa/demo/viettelpost
npm install
```

### 2. Start the Server

```bash
npm start
```

You should see:
```
🚀 Viettel Post API Server running on http://localhost:3000
📝 Enhanced features enabled:
   - Persistent token storage
   - Automatic token cleanup
   - Address fetching
   - Shipment options calculation
   - Order management
```

### 3. Open the Frontend

Open your browser and go to:
```
http://localhost:3000
```

Or open the HTML file directly:
```
file:///opt/tuonghoa/demo/viettelpost/index.html
```

### 4. Login

1. Enter your Viettel Post phone number
2. Enter your password
3. Click "Login & Get Token"

**Note:** Your token will be stored on the server. Next time you login with the same credentials, it will reuse the stored token if still valid.

### 5. Calculate Shipping

1. Select sender province and district
2. Select receiver province and district
3. Enter package weight (grams)
4. Enter product value (VND)
5. Enter COD amount (VND)
6. Click "Calculate Shipping Costs"

## 📝 Testing the API

### Option 1: Use the Web Interface
Just open the HTML file in your browser and use the UI.

### Option 2: Use the Test Client

Edit `testClient.js` and add your credentials:
```javascript
const USERNAME = '0123456789';  // Your phone number
const PASSWORD = 'your_password';  // Your password
```

Then run:
```bash
node testClient.js
```

### Option 3: Use curl

```bash
# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"0123456789","password":"your_password"}'

# Get provinces (use the token from login)
curl http://localhost:3000/api/provinces \
  -H "Authorization: YOUR_TOKEN"

# Calculate shipping
curl -X POST http://localhost:3000/api/shipment-options \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_TOKEN" \
  -d '{
    "PRODUCT_WEIGHT": 1000,
    "PRODUCT_PRICE": 500000,
    "MONEY_COLLECTION": 500000,
    "SENDER_PROVINCE": 1,
    "SENDER_DISTRICT": 1,
    "RECEIVER_PROVINCE": 2,
    "RECEIVER_DISTRICT": 5,
    "PRODUCT_TYPE": "HH",
    "NATIONAL_TYPE": 1
  }'
```

## 🎯 Key Features to Try

### 1. Token Storage (Automatic)
- Login once, your token is stored
- Restart the server, your token is still there
- No need to login again for 24 hours

### 2. Complete Address API
Get province, district, and ward in one call:
```bash
curl "http://localhost:3000/api/address/complete?provinceId=1&districtId=1&wardId=1" \
  -H "Authorization: YOUR_TOKEN"
```

### 3. Enhanced Shipment Options
Get structured shipping data with fee breakdown:
```bash
curl -X POST http://localhost:3000/api/shipment-options \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_TOKEN" \
  -d '{...shipment data...}'
```

### 4. Admin Token Management
View all stored tokens:
```bash
curl http://localhost:3000/api/admin/tokens
```

Clean expired tokens:
```bash
curl -X POST http://localhost:3000/api/admin/clean-tokens
```

## 📚 Documentation

- **API Reference:** See `API_DOCUMENTATION.md`
- **Feature Details:** See `FEATURE_SUMMARY.md`
- **Full Guide:** See `README.md`

## 🔧 Configuration

### Change Port
Set environment variable:
```bash
export PORT=8080
npm start
```

Or edit `server.js`:
```javascript
const PORT = process.env.PORT || 8080;
```

### Token Expiration
Edit `tokenManager.js`:
```javascript
// Change from 24 hours to 48 hours
if (hoursSinceCreation > 48) {
    // ...
}
```

## 🐛 Troubleshooting

### Server won't start
- Make sure port 3000 is available
- Check if dependencies are installed: `npm install`
- Check for errors in the console

### Login fails
- Verify your Viettel Post credentials
- Check internet connection
- Make sure Viettel Post API is accessible

### Token not working
- Check if token has expired (24 hours)
- Try logging in again
- Check token in `tokens.json` file

### Can't load provinces/districts
- Make sure you're logged in first
- Check if token is valid
- Verify internet connection

## 💡 Pro Tips

1. **Keep the server running**: Use `pm2` or `nodemon` for auto-restart
2. **Check logs**: Look at console output for errors
3. **View stored tokens**: Check `tokens.json` file
4. **Use test client**: Run `node testClient.js` for comprehensive testing
5. **Read docs**: See `API_DOCUMENTATION.md` for all endpoints

## 🎉 You're Ready!

Your Viettel Post backend is now running with:
- ✅ Persistent token storage
- ✅ Complete address API
- ✅ Enhanced shipment options
- ✅ Order management
- ✅ Admin tools

Start building your integration!
