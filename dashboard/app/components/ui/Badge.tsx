'use client'

import { HTMLAttributes } from 'react'

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'accent'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}: BadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-[11px] px-2 py-0.5',
  }
  
  return (
    <span
      className={`badge badge-${variant} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span 
          className={`status-dot status-dot-${variant === 'neutral' ? 'neutral' : variant} mr-1.5`}
        />
      )}
      {children}
    </span>
  )
}
