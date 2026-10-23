export const VALID_ROLES = ['client', 'manager', 'editor', 'admin', 'super_admin'] as const

export type Role = (typeof VALID_ROLES)[number]

export const resolveRole = (raw: unknown): Role => {
  if (typeof raw === 'string' && VALID_ROLES.includes(raw as Role)) {
    return raw as Role
  }
  return 'client'
}
