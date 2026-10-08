import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Globe,
  Sun,
  Moon,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useNavLinks } from '../lib/nav-links'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import { LANGUAGES } from '../utils/env'

interface UserProfile {
  id: string
  email: string
  fullName: string
  avatarUrl: string
  role: string
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, setMobileOpen }) => {
  const { t } = useTranslation()
  const { currentLang, changeLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const isRTL = currentLang === 'ar'

  const checkAuth = () => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserProfile({
          id: session.user.id,
          email: session.user.email || '',
          fullName:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            '',
          avatarUrl:
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture ||
            '',
          role:
            session.user.app_metadata?.role ||
            session.user.user_metadata?.role ||
            'client',
        })
      } else {
        setUserProfile(null)
      }
    })
  }

  useEffect(() => {
    checkAuth()

    const handleStorage = () => checkAuth()

    window.addEventListener('storage', handleStorage)
    window.addEventListener('auth-changed', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('auth-changed', handleStorage)
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, setMobileOpen])

  const isActive = (path: string) => location.pathname === path

  const handleLogout = () => {
    void supabase.auth.signOut()
    localStorage.removeItem('BİŞİŞ_token')
    localStorage.removeItem('BİŞİŞ_user')
    localStorage.removeItem('BİŞİŞ_human_verified')
    localStorage.removeItem('BİŞİŞ_introduction_shown')
    setUserProfile(null)
    window.dispatchEvent(new Event('auth-changed'))
  }

  const { publicLinks, authLinks, adminLink } = useNavLinks()

  const resolvedPublicLinks = publicLinks
  const resolvedAuthLinks = userProfile
    ? [
        ...authLinks,
        ...(userProfile.role === 'admin' ? [adminLink] : []),
      ]
    : []

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode)
    setLangDropdownOpen(false)
  }

  const handleMobileNavClose = () => setMobileOpen(false)

  const handleMobileClose = () => setMobileOpen(false)

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
            onClick={handleMobileClose}
          >
            <div className="absolute inset-0 bg-surface-inset backdrop-blur-sm" />
            <motion.div
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className={cn(
                'absolute top-0 h-full w-72 card card-default shadow-2xl shadow-black/80 flex flex-col overflow-y-auto',
                isRTL ? 'right-0 border-l border-gold/20' : 'left-0 border-r border-gold/20'
              )}
            >
              <div className="flex items-center justify-between p-4 border-b border-border-1">
                <Link
                  to="/"
                  onClick={handleMobileClose}
                  className="flex items-center gap-3 group"
                  aria-label="BİŞİŞ"
                >
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gold/50 neon-active-indicator">
                    <img
                      src="/BİŞİŞ-logo.jpg"
                      alt="BİŞİŞ"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xl font-bold font-outfit text-ink-0">
                    BİŞİŞ
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleMobileClose}
                  aria-label={t('nav.close_menu')}
                  className="p-2 text-ink-2 hover:text-ink-0 rounded-lg border border-border-1 bg-surface-1 hover:bg-surface-2 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1 px-3">
                {resolvedPublicLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={handleMobileNavClose}
                    aria-current={isActive(link.to) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      isActive(link.to)
                        ? 'text-gold bg-gold/10'
                         : 'text-ink-2 hover:text-ink-0 hover:bg-surface-1',
                    )}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                ))}

                {userProfile && (
                  <>
                     {resolvedAuthLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={handleMobileNavClose}
                        aria-current={isActive(link.to) ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                          isActive(link.to)
                            ? 'text-gold bg-gold/10'
                            : 'text-ink-2 hover:text-ink-0 hover:bg-surface-1',
                        )}
                      >
                        <link.icon className="w-4 h-4" />
                        {link.label}
                      </Link>
                    ))}
                  </>
                )}
              </nav>

              <div className="p-4 border-t border-border-1 space-y-2">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                      aria-expanded={langDropdownOpen}
                      aria-haspopup="menu"
                      aria-label={t('nav.language')}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-2 hover:text-ink-0 hover:bg-surface-1 transition-all"
                    >
                      <Globe className="w-4 h-4" />
                      <span>
                        {LANGUAGES.find((language) => language.code === currentLang)?.name}
                      </span>
                    </button>

                    <AnimatePresence>
                      {langDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                           className={cn(
                             'absolute top-full mt-2 w-48 glass rounded-xl overflow-hidden shadow-xl z-50',
                             isRTL ? 'left-0' : 'right-0'
                           )}
                        >
                          {LANGUAGES.map((lang) => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => handleLanguageChange(lang.code)}
                              className={cn(
                                'w-full px-4 py-3 text-sm text-left transition-colors flex items-center justify-between',
                                currentLang === lang.code
                                  ? 'text-gold bg-gold/10'
                                  : 'text-ink-2 hover:text-ink-0 hover:bg-surface-1',
                              )}
                            >
                              {lang.name}
                              {currentLang === lang.code && (
                                <span className="text-gold">✓</span>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                   className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-2 hover:text-ink-0 hover:bg-surface-1 transition-all"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {!collapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
                </button>

                {userProfile ? (
                  <>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gold/10 border border-gold/30">
                      {userProfile.avatarUrl ? (
                        <img
                          src={userProfile.avatarUrl}
                          alt={userProfile.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-gold/40"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-blue-deep text-ink-0 font-bold text-xs flex items-center justify-center">
                          {userProfile.fullName?.[0]?.toUpperCase() || userProfile.email?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-0 truncate">
                          {userProfile.fullName || userProfile.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-ink-3 truncate">
                          {userProfile.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={handleMobileClose}
                     className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-0 hover:bg-gold/10 transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    {t('nav.login')}
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.aside
          initial={{ width: collapsed ? '4rem' : '16rem' }}
          animate={{ width: collapsed ? '4rem' : '16rem' }}
          exit={{ width: '4rem' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className={cn(
            'fixed z-40 flex flex-col card card-default shadow-xl shadow-black/40 transition-all duration-300 overflow-visible',
            'bg-surface-inset backdrop-blur-xl',
            'hidden lg:flex',
            'top-1/2 -translate-y-1/2',
            isRTL ? 'right-4' : 'left-4',
          )}
        >
          <div className="flex flex-col h-full">
            <div className="relative flex items-center justify-between pt-2 pb-5 border-b border-border-1 min-h-[60px] px-4">
              <Link
                to="/"
                onClick={handleMobileClose}
                className="flex items-center gap-3 group flex-shrink-0"
                aria-label="BİŞİŞ"
              >
                <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gold/50 flex-shrink-0 neon-active-indicator">
                  <img
                    src="/BİŞİŞ-logo.jpg"
                    alt="BİŞİŞ"
                    className="w-full h-full object-cover"
                  />
                </div>
                {!collapsed && (
                  <span className="text-xl font-bold font-outfit text-ink-0 group-hover:text-gold transition-colors">
                    BİŞİŞ
                  </span>
                )}
              </Link>

              {!collapsed && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                    aria-expanded={langDropdownOpen}
                    aria-haspopup="menu"
                    aria-label={t('nav.language')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-2 hover:text-ink-0 hover:bg-surface-1 transition-all"
                  >
                    <Globe className="w-4 h-4" />
                    <span>
                      {LANGUAGES.find((language) => language.code === currentLang)?.name}
                    </span>
                  </button>

                  <AnimatePresence>
                    {langDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                         className={cn(
                           'absolute top-full mt-2 w-48 card card-default overflow-hidden shadow-2xl z-50',
                           isRTL ? 'left-0' : 'right-0'
                         )}
                      >
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => handleLanguageChange(lang.code)}
                            className={cn(
                              'w-full px-4 py-3 text-sm text-left transition-colors flex items-center justify-between',
                              currentLang === lang.code
                                ? 'text-gold bg-gold/10'
                                : 'text-ink-2 hover:text-ink-0 hover:bg-surface-1',
                            )}
                          >
                            {lang.name}
                            {currentLang === lang.code && (
                              <span className="text-gold">✓</span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

                <button
                  type="button"
                  onClick={onToggle}
                  aria-label={collapsed ? t('footer.expand') : t('footer.collapse')}
                  aria-expanded={!collapsed}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 z-50 p-2 text-ink-2 hover:text-ink-0 rounded-full border border-border-1 bg-surface-inset hover:bg-surface-2 transition-all min-w-[44px] min-h-[44px]',
                    isRTL ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
                  )}
                >
                {isRTL
                  ? (collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />)
                  : (collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />)
                }
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto" role="navigation" aria-label={t('nav.main_navigation')}>
               {resolvedPublicLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={handleMobileClose}
                  aria-current={isActive(link.to) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group neon-border-hover',
                    isActive(link.to)
                      ? 'text-gold bg-gold/10 neon-active-indicator'
                       : 'text-ink-2 hover:text-ink-0 hover:bg-surface-1',
                  )}
                  title={collapsed ? link.label : undefined}
                >
                  <link.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </Link>
              ))}

              {userProfile && (
                <>
                     {resolvedAuthLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={handleMobileClose}
                      aria-current={isActive(link.to) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group neon-border-hover',
                    isActive(link.to)
                      ? 'text-gold bg-gold/10 neon-active-indicator'
                      : 'text-ink-2 hover:text-ink-0 hover:bg-surface-1',
                    collapsed ? 'justify-center' : '',
                  )}
                      title={collapsed ? link.label : undefined}
                    >
                      <link.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{link.label}</span>}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="p-3 border-t border-border-1 flex-shrink-0 space-y-2">
              <button
                type="button"
                onClick={toggleTheme}
                 className={cn(
                   'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-2 hover:text-ink-0 hover:bg-surface-1 transition-all',
                   collapsed ? 'justify-center' : '',
                 )}
                title={collapsed ? 'Toggle theme' : undefined}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
                {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
              </button>

              {userProfile ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gold/10 border border-gold/30 mb-3">
                    {userProfile.avatarUrl ? (
                      <img
                        src={userProfile.avatarUrl}
                        alt={userProfile.fullName}
                        className="w-8 h-8 rounded-full object-cover border border-gold/40 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-blue-deep text-ink-0 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {userProfile.fullName?.[0]?.toUpperCase() || userProfile.email?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {!collapsed && (
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-medium text-ink-0 truncate">
                           {userProfile.fullName || userProfile.email.split('@')[0]}
                         </p>
                         <p className="text-xs text-ink-3 truncate">
                           {userProfile.email}
                         </p>
                       </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all',
                      collapsed ? 'justify-center' : '',
                    )}
                    title={collapsed ? t('nav.logout') : undefined}
                  >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>{t('nav.logout')}</span>}
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={handleMobileClose}
                  className={cn(
                     'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-0 hover:bg-gold/10 transition-all',
                    collapsed ? 'justify-center' : '',
                  )}
                  title={collapsed ? t('nav.login') : undefined}
                >
                  <LogIn className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{t('nav.login')}</span>}
                </Link>
              )}
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>
    </>
  )
}

export default Sidebar