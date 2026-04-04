'use client'

import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const Card = forwardRef<HTMLDivElement, CardProps>(({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}, ref) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }
  
  const variantClasses = {
    default: 'card',
    interactive: 'card card-interactive cursor-pointer',
    outlined: 'border rounded-lg',
  }
  
  return (
    <div
      ref={ref}
      className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      style={variant === 'outlined' ? { borderColor: 'var(--border-primary)' } : undefined}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'

// Card Header
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export const CardHeader = ({ title, subtitle, action, className = '', ...props }: CardHeaderProps) => (
  <div className={`mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between ${className}`} {...props}>
    <div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
)

// Card Content
export const CardContent = ({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props}>{children}</div>
)

// Card Footer
export const CardFooter = ({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div 
    className={`mt-4 pt-4 flex items-center gap-3 ${className}`} 
    style={{ borderTop: '1px solid var(--border-primary)' }}
    {...props}
  >
    {children}
  </div>
)

export default Card
