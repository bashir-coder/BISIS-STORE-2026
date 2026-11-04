import React, { useId } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  disabled?: boolean
  required?: boolean
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  disabled,
  required,
  className,
  id,
  ...props
}) => {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="input-label"
        >
          {label}{required && <span className="text-gold ml-1" aria-hidden="true"> *</span>}
        </label>
      )}

      <input
        id={inputId}
        className={cn(
          'input',
          error ? 'input-error' : '',
          disabled && 'input:disabled',
          className,
        )}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        {...props}
      />

      {error && (
        <p id={errorId} className="input-error-text" role="alert">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={helperId} className="input-helper">
          {helperText}
        </p>
      )}
    </div>
  )
}

Input.displayName = 'Input'
