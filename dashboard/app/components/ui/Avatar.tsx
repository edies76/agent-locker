'use client'

interface AvatarProps {
  src?: string
  alt?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Avatar({
  src,
  alt,
  name,
  size = 'md',
  className = '',
}: AvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium ${className}`}
      style={{
        background: 'var(--accent-muted)',
        color: 'var(--accent-primary)',
      }}
    >
      {name ? getInitials(name) : '?'}
    </div>
  )
}
