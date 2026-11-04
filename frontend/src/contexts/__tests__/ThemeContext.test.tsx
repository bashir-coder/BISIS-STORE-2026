import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../ThemeContext'

afterEach(() => cleanup())

const ThemeReader: React.FC = () => {
  const { theme } = useTheme()
  return <div data-testid="theme-value">{theme}</div>
}

describe('ThemeContext (dark + light)', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem('BİŞİŞ_theme')
    } catch {
      // ignore
    }
    document.documentElement.removeAttribute('data-theme')
  })

  it('initializes in dark mode and sets data-theme="dark"', () => {
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    )
    expect(document.querySelector('[data-testid="theme-value"]')?.textContent).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists and restores the selected theme from localStorage', () => {
    localStorage.setItem('BİŞİŞ_theme', 'light')
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    )
    expect(localStorage.getItem('BİŞİŞ_theme')).toBe('light')
    expect(document.querySelector('[data-testid="theme-value"]')?.textContent).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('switches theme via setTheme', () => {
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    )
    expect(document.querySelector('[data-testid="theme-value"]')?.textContent).toBe('dark')
  })
})
