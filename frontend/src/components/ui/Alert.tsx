import React from 'react'
import { cn } from '../../lib/utils'

export type AlertVariant = 'default' | 'info' | 'success' | 'error'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
  icon?: React.ReactNode
}

const variantClasses: Record<AlertVariant, string> = {
  default: 'alert alert-default',
  info: 'alert alert-info',
  success: 'alert alert-success',
  error: 'alert alert-error',
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'default',
  title,
  dismissible = false,
  onDismiss,
  icon,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(variantClasses[variant], 'alert-dismissible', className)}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {icon || (
        <span
          className="alert-icon shrink-0 flex items-center justify-center rounded-full"
          aria-hidden="true"
        >
          {variant === 'success' ? (
            <svg className="w-5 h-5 text-status-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : variant === 'error' ? (
            <svg className="w-5 h-5 text-ink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : variant === 'info' ? (
            <svg className="w-5 h-5 text-blue-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-ink-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
              <line x1="12" y1="12" x2="12.01" y2="12" />
            </svg>
          )}
        </span>
      )}
      <div className="alert-body">
        {title && (
          <h3 className="alert-title text-sm font-semibold text-ink-0">
            {title}
          </h3>
        )}
        <div className="text-sm text-ink-1">{children}</div>
      </div>
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 w-6 h-6 rounded-full flex items-center justify-center text-ink-3 hover:text-ink-0 transition-colors"
          aria-label="Dismiss alert"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

Alert.displayName = 'Alert'
