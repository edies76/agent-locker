'use client'

import { forwardRef, InputHTMLAttributes, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const generatedId = useId()
  const inputId = id || generatedId
  
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${error ? 'border-danger' : ''} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
