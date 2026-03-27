'use client'

import { useEffect, useCallback, HTMLAttributes } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showClose?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
}: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative w-full ${sizeClasses[size]} animate-scale-in`}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        {(title || showClose) && (
          <div 
            className="flex items-start justify-between p-4"
            style={{ borderBottom: '1px solid var(--border-primary)' }}
          >
            <div>
              {title && (
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Modal Footer helper
export function ModalFooter({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={`flex items-center justify-end gap-3 mt-4 pt-4 ${className}`}
      style={{ borderTop: '1px solid var(--border-primary)' }}
      {...props}
    >
      {children}
    </div>
  )
}
