'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  className = '',
  disabled,
  ...props
}, ref) => {
  const baseClasses = 'btn'
  const variantClasses = `btn-${variant}`
  const sizeClasses = size !== 'md' ? `btn-${size}` : ''
  
  return (
    <button
      ref={ref}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="w-4 h-4 spinner" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
      {iconRight && !loading && iconRight}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
