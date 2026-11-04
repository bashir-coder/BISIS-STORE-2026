/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'
import { Alert } from '../Alert'

describe('Alert (accessibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has role alert and polite live region', () => {
    const { container } = render(
      <Alert variant="info">Something happened</Alert>,
    )
    const alert = within(container).getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'polite')
    expect(alert).toHaveTextContent('Something happened')
  })

  it('renders default variant without title', () => {
    const { container } = render(<Alert>Default alert</Alert>)
    const alert = within(container).getByRole('alert')
    expect(alert).toHaveClass('alert-default')
    expect(alert).toHaveTextContent('Default alert')
  })

  it('renders title as alert title', () => {
    const { container } = render(
      <Alert variant="error" title="Error occurred">Failed to save.</Alert>,
    )
    const alert = within(container).getByRole('alert')
    expect(alert).toHaveClass('alert-error')
    expect(within(container).getByText('Error occurred')).toHaveClass(
      'alert-title',
    )
    expect(alert).toHaveTextContent('Failed to save.')
  })

  it('hides decorative icons from screen readers', () => {
    const { container } = render(<Alert variant="success">Saved</Alert>)
    const icon = container.querySelector('.alert-icon')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not render dismiss button when not dismissible', () => {
    const { container } = render(<Alert>Not dismissible</Alert>)
    expect(
      within(container).queryByRole('button', { name: /Dismiss alert/ }),
    ).not.toBeTruthy()
  })

  it('renders dismiss button with aria-label when dismissible', () => {
    const onDismiss = vi.fn()
    const { container } = render(
      <Alert dismissible onDismiss={onDismiss}>Dismissible</Alert>,
    )
    const dismissButton = within(container).getByRole('button', {
      name: /Dismiss alert/,
    })
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss alert')
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    const { container } = render(
      <Alert dismissible onDismiss={onDismiss}>Dismissible</Alert>,
    )
    fireEvent.click(
      within(container).getByRole('button', { name: /Dismiss alert/ }),
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
