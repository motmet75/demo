import React, { useState, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'
import companyApi from '../../api/companyApi'

function toDateInputValueFromInstant(instantStr) {
  if (!instantStr) return ''
  try {
    const d = new Date(instantStr)
    if (isNaN(d.getTime())) return ''
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch {
    return ''
  }
}

function toISOStringAtMidnightUTC(dateInputValue) {
  if (!dateInputValue) return null
  // dateInputValue is YYYY-MM-DD
  // create a Date at UTC midnight and return ISO string
  const [y, m, d] = dateInputValue.split('-').map((s) => Number(s))
  if (![y, m, d].every(Number.isFinite)) return null
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  return dt.toISOString()
}

function defaultDates() {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const start = `${yyyy}-${mm}-${dd}`

  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()))
  const yyyy2 = nextYear.getUTCFullYear()
  const mm2 = String(nextYear.getUTCMonth() + 1).padStart(2, '0')
  const dd2 = String(nextYear.getUTCDate()).padStart(2, '0')
  const end = `${yyyy2}-${mm2}-${dd2}`
  return { start, end }
}

const STATUS_OPTIONS = ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'CLOSED']

export default function ContractEditModal({ open, contract, onClose, onSave, saving }) {
  const { tenantId, companyId } = useAppContext()
  const [form, setForm] = useState(null)
  const [companies, setCompanies] = useState([])

  useEffect(() => {
    if (contract) {
      // Normalize nested company ids for editing and convert instants to date-input strings
      // Backend DTO returns supplierCompany and purchasingCompany as objects with { id, companyCode, companyName }
      const supplierId = contract.supplierCompany?.id || contract.supplierCompanyId || ''
      const purchasingId = contract.purchasingCompany?.id || contract.purchasingCompanyId || ''
      console.log('ContractEditModal: Setting form from contract', {
        contract,
        supplierId,
        purchasingId,
        supplierCompany: contract.supplierCompany,
        purchasingCompany: contract.purchasingCompany
      })
      const startDate = toDateInputValueFromInstant(contract.startDate)
      const endDate = toDateInputValueFromInstant(contract.endDate)
      // support both camelCase and snake_case contract type names
      const ctype = contract.contractType || contract.contract_type || 'Purchasing'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        id: contract.id,
        contractNumber: contract.contractNumber || '',
        title: contract.title || '',
        description: contract.description || '',
        category: contract.category || '',
        status: contract.status || '',
        totalValue: contract.totalValue || '',
        currency: contract.currency || '',
        paymentTerms: contract.paymentTerms || '',
        isAutoRenew: contract.isAutoRenew,
        renewalNoticeDays: contract.renewalNoticeDays || '',
        attachmentPath: contract.attachmentPath || '',
        notes: contract.notes || '',
        supplierCompanyId: supplierId,
        purchasingCompanyId: purchasingId,
        startDate,
        endDate,
        contractType: ctype,
      })
    } else {
      const { start, end } = defaultDates()
      setForm({
        contractNumber: '',
        title: '',
        // default new contracts to DRAFT
        status: 'DRAFT',
        startDate: start,
        endDate: end,
        totalValue: '',
        currency: '',
        supplierCompanyId: companyId || '',
        purchasingCompanyId: '',
        contractType: 'Purchasing',
      })
    }
  }, [contract, companyId])

  useEffect(() => {
    let mounted = true
    if (!tenantId) return
    ;(async () => {
      try {
        const data = await companyApi.getCompanies(tenantId)
        if (!mounted) return
        const list = Array.isArray(data) ? data : (data && data.data ? data.data : [])
        setCompanies(list)
        // If creating new and supplierCompanyId is empty, default to current context company
        if (!contract && companyId && mounted) {
          setForm((f) => ({ ...(f || {}), supplierCompanyId: companyId }))
        }
      } catch {
        // ignore errors for now
      }
    })()
    return () => { mounted = false }
  }, [tenantId, companyId, contract])

  if (!open) return null
  if (!form) return null // Wait for form to be initialized

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const submit = async () => {
    // Normalize payload: convert date inputs to ISO instants at UTC midnight
    const payload = { ...form }
    payload.tenantId = tenantId
    payload.companyId = companyId
    
    if (payload.supplierCompanyId) payload.supplierCompany = { id: payload.supplierCompanyId }
    if (payload.purchasingCompanyId) payload.purchasingCompany = { id: payload.purchasingCompanyId }

    const startIso = toISOStringAtMidnightUTC(payload.startDate)
    const endIso = toISOStringAtMidnightUTC(payload.endDate)
    if (startIso) payload.startDate = startIso
    else delete payload.startDate
    if (endIso) payload.endDate = endIso
    else delete payload.endDate

    // ensure contractType is sent using camelCase; backend mapping will handle it
    if (!payload.contractType) payload.contractType = 'Purchasing'

    await onSave(payload)
  }

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right:0, bottom:0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 20, width: 800, maxHeight: '90vh', overflow: 'auto' }}>
        <h3>{form && form.id ? 'Edit Contract' : 'Add Contract'}</h3>
        <label>Contract Number<br/><input name="contractNumber" value={form.contractNumber||''} onChange={handleChange} /></label><br/>
        <label>Title<br/><input name="title" value={form.title||''} onChange={handleChange} style={{ width: '100%' }} /></label><br/>

        <label>Contract Type<br/>
          <select name="contractType" value={form.contractType||'Purchasing'} onChange={handleChange}>
            <option value="Purchasing">Purchasing</option>
            <option value="Sales">Sales</option>
            <option value="Service">Service</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <br/>

        <label>Supplier Company<br/>
          <select name="supplierCompanyId" value={form.supplierCompanyId||''} onChange={handleChange}>
            <option value="">-- Select supplier --</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>
        </label>
        <br/>

        <label>Purchasing Company<br/>
          <select name="purchasingCompanyId" value={form.purchasingCompanyId||''} onChange={handleChange}>
            <option value="">-- Select purchasing company --</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>
        </label>
        <br/>

        <label>Status<br/>
          <select name="status" value={form.status||''} onChange={handleChange}>
            <option value="">-- Select status --</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label><br/>
        <label>Start Date<br/><input type="date" name="startDate" value={form.startDate||''} onChange={handleChange} /></label><br/>
        <label>End Date<br/><input type="date" name="endDate" value={form.endDate||''} onChange={handleChange} /></label><br/>
        <label>Total Value<br/><input name="totalValue" value={form.totalValue||''} onChange={handleChange} /></label><br/>
        <label>Currency<br/><input name="currency" value={form.currency||''} onChange={handleChange} /></label><br/>
        <div style={{ marginTop: 12 }}>
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ marginLeft: 8 }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}