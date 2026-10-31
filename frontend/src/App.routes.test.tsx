import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { act, Suspense, type ReactNode } from 'react'
import App from './App'

vi.mock('./pages/LifePlanPage', () => ({ default: () => <div data-testid='lifeplan-page'>LifePlan</div> }))

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock('./contexts/LanguageContext', () => ({
  LanguageProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLanguage: () => ({ language: 'en', setLanguage: vi.fn(), t: (s: string) => s }),
}))

vi.mock('./contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: 'dark' }),
}))

describe('App routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('BİŞİŞ_human_verified', 'true')
  })
  it('renders life plan page on /life-plan', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/life-plan']}>
          <Suspense fallback={<div>loading</div>}>
            <App />
          </Suspense>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getAllByTestId('lifeplan-page').length).toBeGreaterThan(0))
  })

  it('renders life plan page on /services/life-plan', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/services/life-plan']}>
          <Suspense fallback={<div>loading</div>}>
            <App />
          </Suspense>
        </MemoryRouter>
      )
    })
    await waitFor(() => expect(screen.getAllByTestId('lifeplan-page').length).toBeGreaterThan(0))
  })
})
