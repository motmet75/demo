import React from 'react'
import TextField from '@mui/material/TextField'
import {
  formatIntegerInput,
  formatQuantityInput,
  parseIntegerInput,
  parseQuantityInput,
} from '../utils/numberInput'

/**
 * TextField for quantities and money.
 * State remains an unformatted numeric string,
 * while the operator sees US thousands separators as they type.
 *
 * Examples:
 * 1000 -> 1,000
 * 1234.56 -> 1,234.56
 */
export default function FormattedNumberField({
                                               value,
                                               onChange,
                                               kind = 'quantity',
                                               allowNegative = false,
                                               maximumFractionDigits,
                                               inputProps,
                                               ...props
                                             }) {
  const integer = kind === 'integer'
  const fractionDigits = maximumFractionDigits ?? (kind === 'money' ? 2 : 4)

  const displayed = integer
      ? formatIntegerInput(value)
      : formatQuantityInput(value, fractionDigits)

  const handleChange = event => {
    const parsed = integer
        ? parseIntegerInput(event.target.value, allowNegative)
        : parseQuantityInput(event.target.value, {
          allowNegative,
          maximumFractionDigits: fractionDigits,
        })

    onChange?.({
      ...event,
      target: {
        name: event.target.name,
        id: event.target.id,
        value: parsed,
      },
      currentTarget: {
        name: event.target.name,
        id: event.target.id,
        value: parsed,
      },
    })
  }

  return (
      <TextField
          {...props}
          type="text"
          value={displayed}
          onChange={handleChange}
          inputProps={{
            ...inputProps,
            inputMode: fractionDigits > 0 && !integer ? 'decimal' : 'numeric',
          }}
      />
  )
}