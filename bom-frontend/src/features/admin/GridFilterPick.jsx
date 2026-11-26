import React from 'react'
import { Autocomplete, TextField } from '@mui/material'

/** Pick-list of { value, count } items; shows "label (count)". Empty value = no filter. */
export default function GridFilterPick({ label, value, onChange, items, labelFor = v => v, minWidth = 200 }) {
  const selected = items.find(i => i.value === value) || null
  return <Autocomplete size="small" sx={{ minWidth }} options={items} value={selected}
    getOptionLabel={i => `${labelFor(i.value)} (${i.count})`} isOptionEqualToValue={(a, b) => a.value === b.value}
    onChange={(_, next) => onChange(next?.value || '')}
    renderInput={params => <TextField {...params} label={label} />} />
}
