import { describe, it, expect } from 'vitest'
import { resolveRole, VALID_ROLES } from '../roles'

describe('resolveRole', () => {
  it('returns all valid roles as-is', () => {
    VALID_ROLES.forEach((role) => expect(resolveRole(role)).toBe(role))
  })
  it('falls back to client for invalid strings', () => {
    expect(resolveRole('superadmin')).toBe('client')
    expect(resolveRole('ADMIN')).toBe('client')
    expect(resolveRole('Admin')).toBe('client')
    expect(resolveRole('unknown')).toBe('client')
    expect(resolveRole('')).toBe('client')
    expect(resolveRole(' admin ')).toBe('client')
  })
  it('falls back to client for non-string values', () => {
    expect(resolveRole(null)).toBe('client')
    expect(resolveRole(undefined)).toBe('client')
    expect(resolveRole(0)).toBe('client')
    expect(resolveRole(123)).toBe('client')
    expect(resolveRole(false)).toBe('client')
    expect(resolveRole(true)).toBe('client')
    expect(resolveRole({})).toBe('client')
    expect(resolveRole([])).toBe('client')
    expect(resolveRole(Symbol('x'))).toBe('client')
    expect(resolveRole(() => {})).toBe('client')
  })
})
