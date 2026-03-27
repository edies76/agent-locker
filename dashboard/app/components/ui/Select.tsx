'use client'

import { forwardRef, SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  hint,
  options,
  placeholder,
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || `select-${Math.random().toString(36).slice(2)}`
  
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={selectId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`input select ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select
