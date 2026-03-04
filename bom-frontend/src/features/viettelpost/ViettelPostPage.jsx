import React, { useState, useEffect } from 'react'
import * as viettelpostApi from '../../api/viettelpostApi'

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  card: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  cardTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    borderBottom: '2px solid #e74c3c',
    paddingBottom: '10px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  formGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: '500',
    color: '#555'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: '#fff'
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed'
  },
  buttonSecondary: {
    backgroundColor: '#3498db'
  },
  alert: {
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '15px'
  },
  alertError: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb'
  },
  alertSuccess: {
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb'
  },
  alertInfo: {
    backgroundColor: '#d1ecf1',
    color: '#0c5460',
    border: '1px solid #bee5eb'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '15px'
  },
  th: {
    backgroundColor: '#e74c3c',
    color: '#fff',
    padding: '12px',
    textAlign: 'left',
    fontWeight: 'bold'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #ddd'
  },
  trHover: {
    backgroundColor: '#f8f9fa'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  badgeSuccess: {
    backgroundColor: '#28a745',
    color: '#fff'
  },
  tokenDisplay: {
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
    wordBreak: 'break-all'
  }
}

export default function ViettelPostPage() {
  // Token state
  const [token, setToken] = useState('')
  const [tokenLoading, setTokenLoading] = useState(false)

  // Address state
  const [provinces, setProvinces] = useState([])
  const [senderDistricts, setSenderDistricts] = useState([])
  const [receiverDistricts, setReceiverDistricts] = useState([])

  // Form state
  const [formData, setFormData] = useState({
    senderProvince: '',
    senderDistrict: '',
    receiverProvince: '',
    receiverDistrict: '',
    productWeight: 1000,
    productPrice: 500000,
    moneyCollection: 0,
    productType: 'HH'
  })

  // Results state
  const [shipmentOptions, setShipmentOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Load token on mount
  useEffect(() => {
    loadToken()
  }, [])

  // Load provinces when token is available
  useEffect(() => {
    if (token) {
      loadProvinces()
    }
  }, [token])

  // Load sender districts when sender province changes
  useEffect(() => {
    if (token && formData.senderProvince) {
      loadDistricts(formData.senderProvince, 'sender')
    }
  }, [token, formData.senderProvince])

  // Load receiver districts when receiver province changes
  useEffect(() => {
    if (token && formData.receiverProvince) {
      loadDistricts(formData.receiverProvince, 'receiver')
    }
  }, [token, formData.receiverProvince])

  async function loadToken() {
    setTokenLoading(true)
    try {
      const result = await viettelpostApi.getToken()
      setToken(result.token)
      setSuccess('Token loaded successfully')
    } catch (err) {
      setError('Failed to load token: ' + err.message)
    } finally {
      setTokenLoading(false)
    }
  }

  async function loadProvinces() {
    try {
      const data = await viettelpostApi.getProvinces(token)
      setProvinces(data)
    } catch (err) {
      setError('Failed to load provinces: ' + err.message)
    }
  }

  async function loadDistricts(provinceId, type) {
    try {
      const data = await viettelpostApi.getDistricts(token, provinceId)
      if (type === 'sender') {
        setSenderDistricts(data)
      } else {
        setReceiverDistricts(data)
      }
    } catch (err) {
      setError('Failed to load districts: ' + err.message)
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Reset districts when province changes
    if (name === 'senderProvince') {
      setFormData(prev => ({ ...prev, senderDistrict: '' }))
      setSenderDistricts([])
    }
    if (name === 'receiverProvince') {
      setFormData(prev => ({ ...prev, receiverDistrict: '' }))
      setReceiverDistricts([])
    }
  }

  async function handleCalculate(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setShipmentOptions([])
    setLoading(true)

    try {
      // Validate form
      if (!formData.senderProvince || !formData.senderDistrict ||
          !formData.receiverProvince || !formData.receiverDistrict) {
        throw new Error('Please select all address fields')
      }

      const requestData = {
        PRODUCT_WEIGHT: parseInt(formData.productWeight),
        PRODUCT_PRICE: parseInt(formData.productPrice),
        MONEY_COLLECTION: parseInt(formData.moneyCollection || 0),
        SENDER_PROVINCE: parseInt(formData.senderProvince),
        SENDER_DISTRICT: parseInt(formData.senderDistrict),
        RECEIVER_PROVINCE: parseInt(formData.receiverProvince),
        RECEIVER_DISTRICT: parseInt(formData.receiverDistrict),
        PRODUCT_TYPE: formData.productType,
        NATIONAL_TYPE: 1
      }

      const result = await viettelpostApi.getShipmentOptions(token, requestData)
      
      if (result.success && result.data) {
        setShipmentOptions(result.data)
        setSuccess(`Found ${result.count} shipping options`)
      } else {
        throw new Error('No shipping options available')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={{ color: '#e74c3c', marginBottom: '20px' }}>
        🚚 Viettel Post Shipping Calculator
      </h2>

      {/* Token Card */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🔐 Authentication Token</h3>
        {tokenLoading ? (
          <p>Loading token...</p>
        ) : token ? (
          <div>
            <div style={{ ...styles.alert, ...styles.alertSuccess }}>
              ✅ Token loaded successfully
            </div>
            <div style={styles.tokenDisplay}>
              {token}
            </div>
          </div>
        ) : (
          <div style={{ ...styles.alert, ...styles.alertError }}>
            ❌ No token available. Please configure token in backend.
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{ ...styles.alert, ...styles.alertError }}>
          ❌ {error}
        </div>
      )}
      {success && !error && (
        <div style={{ ...styles.alert, ...styles.alertSuccess }}>
          ✅ {success}
        </div>
      )}

      {/* Shipping Calculator Form */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📦 Shipping Information</h3>
        <form onSubmit={handleCalculate}>
          <div style={styles.grid}>
            {/* Sender Address */}
            <div>
              <h4 style={{ marginBottom: '15px', color: '#e74c3c' }}>📍 Sender Address</h4>
              <div style={styles.formGroup}>
                <label style={styles.label}>Province/City *</label>
                <select
                  name="senderProvince"
                  value={formData.senderProvince}
                  onChange={handleInputChange}
                  style={styles.select}
                  disabled={!token}
                >
                  <option value="">-- Select Province --</option>
                  {provinces.map(p => (
                    <option key={p.PROVINCE_ID} value={p.PROVINCE_ID}>
                      {p.PROVINCE_NAME}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>District *</label>
                <select
                  name="senderDistrict"
                  value={formData.senderDistrict}
                  onChange={handleInputChange}
                  style={styles.select}
                  disabled={!formData.senderProvince}
                >
                  <option value="">-- Select District --</option>
                  {senderDistricts.map(d => (
                    <option key={d.DISTRICT_ID} value={d.DISTRICT_ID}>
                      {d.DISTRICT_NAME}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Receiver Address */}
            <div>
              <h4 style={{ marginBottom: '15px', color: '#e74c3c' }}>📍 Receiver Address</h4>
              <div style={styles.formGroup}>
                <label style={styles.label}>Province/City *</label>
                <select
                  name="receiverProvince"
                  value={formData.receiverProvince}
                  onChange={handleInputChange}
                  style={styles.select}
                  disabled={!token}
                >
                  <option value="">-- Select Province --</option>
                  {provinces.map(p => (
                    <option key={p.PROVINCE_ID} value={p.PROVINCE_ID}>
                      {p.PROVINCE_NAME}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>District *</label>
                <select
                  name="receiverDistrict"
                  value={formData.receiverDistrict}
                  onChange={handleInputChange}
                  style={styles.select}
                  disabled={!formData.receiverProvince}
                >
                  <option value="">-- Select District --</option>
                  {receiverDistricts.map(d => (
                    <option key={d.DISTRICT_ID} value={d.DISTRICT_ID}>
                      {d.DISTRICT_NAME}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Package Details */}
          <h4 style={{ marginTop: '20px', marginBottom: '15px', color: '#e74c3c' }}>
            📋 Package Details
          </h4>
          <div style={styles.grid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Weight (grams) *</label>
              <input
                type="number"
                name="productWeight"
                value={formData.productWeight}
                onChange={handleInputChange}
                style={styles.input}
                min="1"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Product Value (VND)</label>
              <input
                type="number"
                name="productPrice"
                value={formData.productPrice}
                onChange={handleInputChange}
                style={styles.input}
                min="0"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>COD Amount (VND)</label>
              <input
                type="number"
                name="moneyCollection"
                value={formData.moneyCollection}
                onChange={handleInputChange}
                style={styles.input}
                min="0"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Product Type</label>
              <select
                name="productType"
                value={formData.productType}
                onChange={handleInputChange}
                style={styles.select}
              >
                <option value="HH">Goods (Hàng hóa)</option>
                <option value="TL">Documents (Tài liệu)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              type="submit"
              style={{
                ...styles.button,
                ...(loading || !token ? styles.buttonDisabled : {})
              }}
              disabled={loading || !token}
            >
              {loading ? '⏳ Calculating...' : '🧮 Calculate Shipping'}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {shipmentOptions.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📊 Available Shipping Options</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Service</th>
                <th style={styles.th}>Base Fee</th>
                <th style={styles.th}>VAT</th>
                <th style={styles.th}>Total Fee</th>
                <th style={styles.th}>Delivery Time</th>
              </tr>
            </thead>
            <tbody>
              {shipmentOptions.map((option, index) => (
                <tr key={index} style={index % 2 === 0 ? {} : styles.trHover}>
                  <td style={styles.td}>
                    <strong>{option.serviceName}</strong>
                    <br />
                    <small style={{ color: '#666' }}>{option.serviceCode}</small>
                  </td>
                  <td style={styles.td}>
                    {viettelpostApi.formatVND(option.baseFee)}
                  </td>
                  <td style={styles.td}>
                    {viettelpostApi.formatVND(option.vatFee)}
                  </td>
                  <td style={styles.td}>
                    <strong style={{ color: '#e74c3c' }}>
                      {viettelpostApi.formatVND(option.totalFee)}
                    </strong>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...styles.badgeSuccess }}>
                      {option.deliveryTime}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Card */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>ℹ️ Information</h3>
        <div style={{ ...styles.alert, ...styles.alertInfo }}>
          <strong>Service Codes:</strong>
          <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
            <li><strong>VCN</strong> - Chuyển phát nhanh</li>
            <li><strong>VCBO</strong> - Chuyển phát nhanh theo bộ</li>
            <li><strong>VHT</strong> - Phát hỏa tốc</li>
            <li><strong>PTN</strong> - Phát trong ngày</li>
            <li><strong>VBS</strong> - Chuyển phát tiêu chuẩn</li>
            <li><strong>SCOD</strong> - Dịch vụ thu hộ COD</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
