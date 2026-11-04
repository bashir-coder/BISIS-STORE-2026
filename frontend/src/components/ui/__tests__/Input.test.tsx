/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'
import { Input } from '../Input'

describe('Input (accessibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('associates label with input via htmlFor', () => {
    const { container } = render(<Input label="Email address" />)
    const input = within(container).getByLabelText('Email address')
    expect(input).toBeTruthy()
    expect(input.tagName).toBe('INPUT')
  })

  it('uses explicitly supplied id', () => {
    const { container } = render(<Input id="custom-email-id" label="Email" />)
    const input = within(container).getByLabelText('Email')
    expect(input).toHaveAttribute('id', 'custom-email-id')
    const label = screenLabel(container, 'Email')
    expect(label).toHaveAttribute('for', 'custom-email-id')
  })

  it('generates a fallback id when no id is supplied', () => {
    const { container } = render(<Input label="Email" />)
    const input = within(container).getByLabelText('Email')
    const label = screenLabel(container, 'Email')
    const inputId = input.getAttribute('id')
    expect(inputId).toBeTruthy()
    expect(inputId).not.toBe('')
    expect(label).toHaveAttribute('for', inputId)
  })

  it('generates unique ids across multiple instances', () => {
    const { container: c1 } = render(<Input label="First input" />)
    const { container: c2 } = render(<Input label="Second input" />)
    const firstInput = within(c1).getByLabelText('First input')
    const secondInput = within(c2).getByLabelText('Second input')
    expect(firstInput.getAttribute('id')).not.toBe(
      secondInput.getAttribute('id'),
    )
  })

  it('associates error message with input via aria-errormessage', () => {
    const { container } = render(<Input label="Email" error="Invalid email" />)
    const input = within(container).getByLabelText('Email')
    const inputId = input.getAttribute('id')!
    const errorId = `${inputId}-error`
    expect(input).toHaveAttribute('aria-errormessage', errorId)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(within(container).getByText('Invalid email')).toHaveAttribute(
      'id',
      errorId,
    )
    expect(within(container).getByText('Invalid email')).toHaveAttribute(
      'role',
      'alert',
    )
  })

  it('associates helper text with input via aria-describedby', () => {
    const { container } = render(
      <Input label="Email" helperText="We never share your email" />,
    )
    const input = within(container).getByLabelText('Email')
    const inputId = input.getAttribute('id')!
    const helperId = `${inputId}-helper`
    expect(input).toHaveAttribute('aria-describedby', helperId)
    expect(
      within(container).getByText('We never share your email'),
    ).toHaveAttribute('id', helperId)
  })

  it('does not show helper text when error is present', () => {
    const { container } = render(
      <Input
        label="Email"
        error="Invalid email"
        helperText="We never share your email"
      />,
    )
    expect(
      within(container).queryByText('We never share your email'),
    ).not.toBeTruthy()
    expect(within(container).getByText('Invalid email')).toBeTruthy()
  })

  it('marks input as required when required prop is set', () => {
    const { container } = render(<Input label="Email" required />)
    const input = within(container).getByLabelText(/Email/)
    expect(input).toHaveAttribute('required', '')
  })

  it('disables input when disabled prop is set', () => {
    const { container } = render(<Input label="Email" disabled />)
    const input = within(container).getByLabelText('Email')
    expect(input).toBeDisabled()
  })
})

function screenLabel(container: HTMLElement, text: string) {
  const label = Array.from(
    container.querySelectorAll('label'),
  ).find((el) => el.textContent === text)
  return label as HTMLElement
}
