import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireRole } from '../RequireRole'
import type { ReactNode } from 'react'

const mockUseAuth = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRouter(ui: ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path='/protected' element={ui} />
        <Route path='/login' element={<div>login</div>} />
        <Route path='/dashboard' element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    const { container } = renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div>secret</div>
      </RequireRole>
    )
    expect(container.children.length).toBe(0)
  })
  it('redirects to login if unauthenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div>secret</div>
      </RequireRole>
    )
    expect(screen.getByText('login')).toBeTruthy()
  })
  it('renders children if user has allowed role', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'admin' }, loading: false })
    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div>secret</div>
      </RequireRole>
    )
    expect(screen.getByText('secret')).toBeTruthy()
  })
  it('redirects to fallback if unauthorized', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'client' }, loading: false })
    renderWithRouter(
      <RequireRole allowedRoles={['admin']} fallbackPath='/dashboard'>
        <div>secret</div>
      </RequireRole>
    )
    expect(screen.getByText('dashboard')).toBeTruthy()
  })
})
