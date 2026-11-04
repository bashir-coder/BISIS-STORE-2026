/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'
import { Button } from '../Button'

describe('Button (accessibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets aria-busy when loading', () => {
    const { container } = render(<Button loading>Submit</Button>)
    const button = within(container).getByRole('button', { name: /Loading…/ })
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('does not set aria-busy when not loading', () => {
    const { container } = render(<Button>Submit</Button>)
    const button = within(container).getByRole('button', { name: /Submit/ })
    expect(button).not.toHaveAttribute('aria-busy')
  })

  it('announces loading text to screen readers', () => {
    const { container } = render(
      <Button loading variant="primary">Submit</Button>,
    )
    const button = within(container).getByRole('button', { name: /Loading…/ })
    expect(button.textContent).toContain('Loading…')
  })

  it('keeps spinner decorative (aria-hidden)', () => {
    const { container } = render(
      <Button loading variant="primary">Submit</Button>,
    )
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('is disabled when loading', () => {
    const { container } = render(<Button loading>Submit</Button>)
    const button = within(container).getByRole('button', { name: /Loading/ })
    expect(button).toBeDisabled()
  })

  it('is disabled when disabled prop is set', () => {
    const { container } = render(<Button disabled>Submit</Button>)
    const button = within(container).getByRole('button', { name: /Submit/ })
    expect(button).toBeDisabled()
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    const { container } = render(
      <Button disabled onClick={onClick}>Submit</Button>,
    )
    fireEvent.click(within(container).getByRole('button', { name: /Submit/ }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not call onClick when loading', () => {
    const onClick = vi.fn()
    const { container } = render(<Button loading onClick={onClick}>Submit</Button>)
    fireEvent.click(within(container).getByRole('button', { name: /Loading/ }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick when enabled and not loading', () => {
    const onClick = vi.fn()
    const { container } = render(<Button onClick={onClick}>Submit</Button>)
    fireEvent.click(within(container).getByRole('button', { name: /Submit/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not render aria-disabled attribute (native disabled is used)', () => {
    const { container } = render(<Button disabled>Submit</Button>)
    const button = within(container).getByRole('button', { name: /Submit/ })
    expect(button).not.toHaveAttribute('aria-disabled')
  })
})

describe('Button (variant isolation)', () => {
  const allVariantClasses = [
    'btn-primary',
    'btn-secondary',
    'btn-ghost-gold',
    'btn-blue',
  ]

  it('applies only btn-primary for primary variant', () => {
    const { container } = render(<Button variant="primary">X</Button>)
    const button = within(container).getByRole('button', { name: /X/ })
    expect(button).toHaveClass('btn-primary')
    allVariantClasses.filter((c) => c !== 'btn-primary').forEach((c) =>
      expect(button).not.toHaveClass(c),
    )
  })

  it('applies only btn-secondary for secondary variant', () => {
    const { container } = render(<Button variant="secondary">X</Button>)
    const button = within(container).getByRole('button', { name: /X/ })
    expect(button).toHaveClass('btn-secondary')
    allVariantClasses.filter((c) => c !== 'btn-secondary').forEach((c) =>
      expect(button).not.toHaveClass(c),
    )
  })

  it('applies only btn-ghost-gold for outline variant', () => {
    const { container } = render(<Button variant="outline">X</Button>)
    const button = within(container).getByRole('button', { name: /X/ })
    expect(button).toHaveClass('btn-ghost-gold')
    allVariantClasses.filter((c) => c !== 'btn-ghost-gold').forEach((c) =>
      expect(button).not.toHaveClass(c),
    )
  })

  it('applies only btn-ghost-gold for ghost variant', () => {
    const { container } = render(<Button variant="ghost">X</Button>)
    const button = within(container).getByRole('button', { name: /X/ })
    expect(button).toHaveClass('btn-ghost-gold')
    allVariantClasses.filter((c) => c !== 'btn-ghost-gold').forEach((c) =>
      expect(button).not.toHaveClass(c),
    )
  })

  it('keeps selected variant classes when loading', () => {
    const { container } = render(
      <Button variant="secondary" loading>X</Button>,
    )
    const button = within(container).getByRole('button')
    expect(button).toHaveClass('btn-secondary')
    expect(button).not.toHaveClass('btn-primary')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps selected variant classes when disabled', () => {
    const { container } = render(
      <Button variant="ghost" disabled>X</Button>,
    )
    const button = within(container).getByRole('button', { name: /X/ })
    expect(button).toHaveClass('btn-ghost-gold')
    expect(button).not.toHaveClass('btn-primary')
    expect(button).toBeDisabled()
  })

  it('applies size classes for sm, md, lg', () => {
    const { container: cSm } = render(<Button size="sm">X</Button>)
    expect(
      within(cSm).getByRole('button', { name: /X/ }),
    ).toHaveClass('px-4 py-2.5 text-xs')

    const { container: cMd } = render(<Button size="md">X</Button>)
    expect(
      within(cMd).getByRole('button', { name: /X/ }),
    ).toHaveClass('px-6 py-3')

    const { container: cLg } = render(<Button size="lg">X</Button>)
    expect(
      within(cLg).getByRole('button', { name: /X/ }),
    ).toHaveClass('px-8 py-3.5 text-base')
  })

  it('renders left and right icons as decorative', () => {
    const { container } = render(
      <Button leftIcon={<span>L</span>} rightIcon={<span>R</span>}>
        X
      </Button>,
    )
    const button = within(container).getByRole('button', { name: /X/ })
    const icons = button.querySelectorAll('span[aria-hidden="true"]')
    expect(icons).toHaveLength(2)
    Array.from(icons).forEach((icon) =>
      expect(icon).toHaveAttribute('aria-hidden', 'true'),
    )
  })
})
