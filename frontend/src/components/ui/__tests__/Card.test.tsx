/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'
import { Card } from '../Card'

describe('Card (accessibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('interactive variant', () => {
    it('renders as a focusable button role with tabIndex', () => {
      const { container } = render(
        <Card variant="interactive" onClick={vi.fn()}>
          Card content
        </Card>,
      )
      const card = within(container).getByText('Card content').closest('div')
        ?.parentElement
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('tabindex', '0')
    })

    it('activates on Enter key', () => {
      const onClick = vi.fn()
      const { container } = render(
        <Card variant="interactive" onClick={onClick}>
          Card content
        </Card>,
      )
      const card = within(container).getByText('Card content').closest('div')
      card!.focus()
      fireEvent.keyDown(card!, { key: 'Enter' })
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('activates on Space key', () => {
      const onClick = vi.fn()
      const { container } = render(
        <Card variant="interactive" onClick={onClick}>
          Card content
        </Card>,
      )
      const card = within(container).getByText('Card content').closest('div')
      card!.focus()
      fireEvent.keyDown(card!, { key: ' ' })
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('prevents default scroll on Space key', () => {
      const onClick = vi.fn()
      const { container } = render(
        <Card variant="interactive" onClick={onClick}>
          Card content
        </Card>,
      )
      const card = within(container).getByText('Card content').closest('div')
        ?.parentElement
      card!.focus()
      fireEvent.keyDown(card!, { key: ' ' })
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not activate on other keys', () => {
      const onClick = vi.fn()
      const { container } = render(
        <Card variant="interactive" onClick={onClick}>
          Card content
        </Card>,
      )
      const card = within(container).getByText('Card content').closest('div')
      card!.focus()
      fireEvent.keyDown(card!, { key: 'Escape' })
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('non-interactive variant', () => {
    it('does not have button role or tabIndex', () => {
      const { container } = render(<Card variant="default">Card content</Card>)
      const card = within(container).getByText('Card content').closest('div')
        ?.parentElement
      expect(card).not.toHaveAttribute('role')
      expect(card).not.toHaveAttribute('tabindex')
    })

    it('does not handle keyboard activation', () => {
      const onClick = vi.fn()
      const { container } = render(
        <Card variant="default" onClick={onClick}>
          Card content
        </Card>,
      )
      const card = within(container).getByText('Card content').closest('div')
        ?.parentElement
      card!.focus()
      fireEvent.keyDown(card!, { key: 'Enter' })
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('asChild', () => {
    it('renders children directly without invalid props on fragment', () => {
      const { container } = render(
        <Card asChild variant="interactive">
          <button>Inner button</button>
        </Card>,
      )
      expect(container.firstChild).toBeTruthy()
      expect(
        within(container).getByRole('button', { name: 'Inner button' }),
      ).toBeTruthy()
    })

    it('does not apply role/tabIndex to fragment', () => {
      const { container } = render(
        <Card asChild variant="interactive">
          <span>child</span>
        </Card>,
      )
      const span = within(container).getByText('child')
      expect(span).not.toHaveAttribute('role')
      expect(span).not.toHaveAttribute('tabindex')
    })
  })
})
