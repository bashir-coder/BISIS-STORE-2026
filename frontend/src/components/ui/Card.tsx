import React from 'react'
import { cn } from '../../lib/utils'

export type CardVariant = 'default' | 'elevated' | 'interactive'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padded?: boolean
  paddingSize?: 'sm' | 'lg'
  onClick?: React.MouseEventHandler
  asChild?: boolean
  className?: string
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padded = false,
  paddingSize = 'sm',
  onClick,
  asChild = false,
  className,
  ...props
}) => {
  const isInteractive = variant === 'interactive'

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.(e as unknown as React.MouseEvent)
    }
  }

  if (asChild) {
    return <>{children}</>
  }

  return (
    <div
      className={cn(
        'card',
        {
          'card-default': variant === 'default',
          'card-interactive': isInteractive,
        },
        padded && (paddingSize === 'lg' ? 'card-pad-lg' : 'card-pad'),
        isInteractive && 'cursor-pointer',
        className,
      )}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      {...props}
    >
      <div className="">{children}</div>
    </div>
  )
}

Card.displayName = 'Card'
