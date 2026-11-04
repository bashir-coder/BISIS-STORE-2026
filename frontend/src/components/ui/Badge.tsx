import React from 'react'
import { cn } from '../../lib/utils'

export type BadgeVariant = 'default' | 'gold' | 'blue' | 'success' | 'info' | 'outline'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'badge badge-default',
  gold: 'badge badge-gold',
  blue: 'badge badge-blue',
  success: 'badge badge-success',
  info: 'badge badge-info',
  outline: 'badge badge-outline',
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
  ...props
}) => {
  return (
    <span
      className={cn(variantClasses[variant], className)}
      {...props}
    >
      {children}
    </span>
  )
}

Badge.displayName = 'Badge'
