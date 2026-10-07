import { useTranslation } from 'react-i18next'
import { Home, Package, Info, BookOpen, Briefcase, ShoppingCart, Gift, Phone, MessageSquare } from 'lucide-react'

export type NavLink = {
  to: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  requiresAuth?: boolean
  adminOnly?: boolean
}

export const publicNavLinks: NavLink[] = [
  { to: '/', labelKey: 'nav.home', icon: Home },
  { to: '/packages', labelKey: 'nav.packages', icon: Package },
  { to: '/about', labelKey: 'nav.about', icon: Info },
  { to: '/blog', labelKey: 'nav.blog', icon: BookOpen },
  { to: '/portfolio', labelKey: 'nav.portfolio', icon: Briefcase },
  { to: '/digital-products', labelKey: 'nav.digital_products', icon: ShoppingCart },
  { to: '/donation', labelKey: 'nav.donation', icon: Gift },
  { to: '/contact', labelKey: 'nav.contact', icon: Phone },
]

export const chatNavLink: NavLink = { to: '/chat', labelKey: 'nav.chat', icon: MessageSquare }

export const authNavLinks: NavLink[] = [
  { to: '/dashboard', labelKey: 'dashboard.title', icon: Home },
  { to: '/clients', labelKey: 'nav.clients', icon: Phone },
  { to: '/workbench', labelKey: 'nav.workbench', icon: Package },
]

export const adminNavLink: NavLink = { to: '/admin', labelKey: 'admin.admin', icon: Home, adminOnly: true }

export function useNavLinks() {
  const { t } = useTranslation()

  const translatedPublic = publicNavLinks.map((link) => ({
    ...link,
    label: t(link.labelKey),
  }))

  const translatedChat = {
    ...chatNavLink,
    label: t(chatNavLink.labelKey),
  }

  const translatedAuth = authNavLinks.map((link) => ({
    ...link,
    label: t(link.labelKey),
  }))

  const translatedAdmin = {
    ...adminNavLink,
    label: t(adminNavLink.labelKey),
  }

  return {
    publicLinks: translatedPublic,
    chatLink: translatedChat,
    authLinks: translatedAuth,
    adminLink: translatedAdmin,
  }
}
