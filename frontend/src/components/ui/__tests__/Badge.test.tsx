/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'
import { Badge } from '../Badge'

describe('Badge (accessibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a span with no implicit role', () => {
    const { container } = render(<Badge>New</Badge>)
    const badge = within(container).getByText('New')
    expect(badge.tagName).toBe('SPAN')
    expect(badge).not.toHaveAttribute('role')
  })

  it('applies default variant class', () => {
    const { container } = render(<Badge>Default</Badge>)
    expect(within(container).getByText('Default')).toHaveClass('badge-default')
  })

  it('applies gold variant class', () => {
    const { container } = render(<Badge variant="gold">Gold</Badge>)
    expect(within(container).getByText('Gold')).toHaveClass('badge-gold')
  })

  it('applies blue variant class', () => {
    const { container } = render(<Badge variant="blue">Blue</Badge>)
    expect(within(container).getByText('Blue')).toHaveClass('badge-blue')
  })

  it('applies success variant class', () => {
    const { container } = render(<Badge variant="success">Success</Badge>)
    expect(within(container).getByText('Success')).toHaveClass('badge-success')
  })

  it('applies info variant class', () => {
    const { container } = render(<Badge variant="info">Info</Badge>)
    expect(within(container).getByText('Info')).toHaveClass('badge-info')
  })

  it('applies outline variant class', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>)
    expect(within(container).getByText('Outline')).toHaveClass('badge-outline')
  })

  it('forwards extra props to the span', () => {
    const { container } = render(<Badge data-testid="badge-1">Custom</Badge>)
    expect(within(container).getByTestId('badge-1')).toHaveTextContent('Custom')
  })
})
