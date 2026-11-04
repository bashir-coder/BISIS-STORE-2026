import React from 'react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-ghost-gold',
  ghost: 'btn-ghost-gold',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2.5 text-xs',
  md: 'px-6 py-3',
  lg: 'px-8 py-3.5 text-base',
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  onClick,
  ...props
}) => {
  const isDisabled = disabled || loading

  return (
    <button
      type="button"
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && 'opacity-42 cursor-not-allowed',
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={isDisabled ? undefined : onClick}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg
            className="w-4 h-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" />
          </svg>
          {variant === 'primary' || variant === 'secondary' || variant === 'ghost'
            ? 'Loading…'
            : null}
        </span>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  )
}

Button.displayName = 'Button'
