import React, { useEffect, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
  Globe,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { LANGUAGES } from '../utils/env'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  email: string
  fullName: string
  avatarUrl: string
  role: string
}

const Header: React.FC = () => {
  const { t } = useTranslation()
  const { currentLang, changeLanguage } = useLanguage()

  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLangOpen, setIsLangOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const userMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Authentication
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
  }, [location.pathname])

  // Scroll state
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
    setIsLangOpen(false)
    setIsUserMenuOpen(false)
  }, [location.pathname])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Main navigation
  const navLinks = [
    {
      to: '/',
      label: t('nav.home'),
    },
    {
      to: '/packages',
      label: t('nav.packages'),
    },
    {
      to: '/lab',
      label: t('nav.lab', 'BİŠIŠ LAB'),
    },
    {
      to: '/chat',
      label: t('nav.chat'),
    },
    {
      to: '/contact',
      label: t('nav.contact'),
    },
  ]

  const isActive = (path: string) => location.pathname === path

  // Logout
  const handleLogout = () => {
    void supabase.auth.signOut()

    localStorage.removeItem('BİŞİŞ_token')
    localStorage.removeItem('BİŞİŞ_user')

    setUserProfile(null)
    setIsUserMenuOpen(false)

    window.dispatchEvent(new Event('auth-changed'))

    navigate('/login')
  }

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode)
    setIsLangOpen(false)
  }

  const displayName =
    userProfile?.fullName ||
    userProfile?.email?.split('@')[0] ||
    t('nav.dashboard')

  const initialLetter = (displayName || '?')[0].toUpperCase()

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        isScrolled
          ? 'bg-black/60 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40'
          : 'bg-transparent'
      )}
    >
      <div className="section-padding">
        <div className="flex items-center justify-between h-20">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
            aria-label="BİŠIŠ"
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-gold/40 shadow-md shadow-gold/20 group-hover:border-gold group-hover:shadow-gold/40 transition-all duration-300">
              <img
                src="/BİŞİŞ-logo.jpg"
                alt="BİŠIŠ"
                className="w-full h-full object-cover"
              />
            </div>

            <span className="text-xl font-bold font-outfit text-white tracking-wider group-hover:text-gold transition-colors">
              BİŠIŠ
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
                  isActive(link.to)
                    ? 'text-gold bg-gold/10'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangOpen(!isLangOpen)}
                aria-expanded={isLangOpen}
                aria-haspopup="menu"
                aria-label={t('nav.language')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
              >
                <Globe className="w-4 h-4" />

                <span className="hidden sm:inline">
                  {LANGUAGES.find((language) => language.code === currentLang)?.name}
                </span>

                <ChevronDown className="w-3 h-3" />
              </button>

              <AnimatePresence>
                {isLangOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full mt-2 right-0 w-48 glass rounded-xl overflow-hidden shadow-xl"
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
                            : 'text-white/70 hover:text-white hover:bg-white/5'
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

            {/* Auth / User Profile */}
            <div className="hidden md:flex items-center gap-2">
              {userProfile ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-gold/30 bg-gold/10 hover:border-gold/60 hover:bg-gold/15 transition-all shadow-sm shadow-gold/10"
                  >
                    {userProfile.avatarUrl ? (
                      <img
                        src={userProfile.avatarUrl}
                        alt={displayName}
                        className="w-7 h-7 rounded-full object-cover border border-gold/40"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-emerald-dark text-black font-bold text-xs flex items-center justify-center shadow-inner">
                        {initialLetter}
                      </div>
                    )}

                    <span className="text-sm font-medium text-white max-w-[120px] truncate">
                      {displayName}
                    </span>

                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 text-gold/70 transition-transform duration-200',
                        isUserMenuOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          y: 10,
                          scale: 0.95,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          y: 10,
                          scale: 0.95,
                        }}
                        transition={{ duration: 0.18 }}
                        className="absolute top-full mt-2 right-0 w-64 glass-card border border-gold/30 rounded-2xl p-2 shadow-2xl shadow-black/80 backdrop-blur-2xl z-50 text-start"
                      >
                        <div className="px-3 py-2.5 border-b border-white/10">
                          <p className="text-sm font-semibold text-white truncate">
                            {displayName}
                          </p>

                          <p className="text-xs text-white/40 truncate">
                            {userProfile.email}
                          </p>

                          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/20 text-[10px] text-emerald-light font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-light animate-pulse" />

                            {userProfile.role === 'admin'
                              ? t('admin.admin')
                              : t('nav.client', 'Client')}
                          </div>
                        </div>

                        <div className="py-1.5 space-y-0.5">
                          <Link
                            to="/dashboard"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-gold hover:bg-gold/10 rounded-xl transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4 text-gold/80" />
                            <span>{t('nav.dashboard')}</span>
                          </Link>

                          {userProfile.role === 'admin' && (
                            <Link
                              to="/admin"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-gold hover:bg-gold/10 rounded-xl transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4 text-emerald-light" />
                              <span>{t('admin.admin')}</span>
                            </Link>
                          )}
                        </div>

                        <div className="pt-1.5 border-t border-white/10">
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>{t('nav.logout')}</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    {t('nav.login')}
                  </Link>

                  <Link
                    to="/packages"
                    className="btn-primary text-sm"
                  >
                    {t('nav.start')}
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={
                isMobileMenuOpen
                  ? t('nav.close_menu')
                  : t('nav.open_menu')
              }
              className="lg:hidden p-2 text-white/70 hover:text-white"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            id="mobile-navigation"
            className="lg:hidden glass border-t border-white/5"
          >
            <div className="section-padding py-6 space-y-2">
              {userProfile && (
                <div className="mb-4 p-3 rounded-2xl border border-gold/20 bg-gold/[0.06] flex items-center gap-3">
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={displayName}
                      className="w-10 h-10 rounded-full object-cover border border-gold/40"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-emerald-dark text-black font-bold text-sm flex items-center justify-center">
                      {initialLetter}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {displayName}
                    </p>

                    <p className="text-xs text-white/40 truncate">
                      {userProfile.email}
                    </p>
                  </div>
                </div>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'block px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    isActive(link.to)
                      ? 'text-gold bg-gold/10'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-4 flex flex-col gap-2">
                {userProfile ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="btn-secondary text-center text-sm"
                    >
                      {t('nav.dashboard')}
                    </Link>

                    {userProfile.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="btn-secondary text-center text-sm"
                      >
                        {t('admin.admin')}
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        handleLogout()
                        setIsMobileMenuOpen(false)
                      }}
                      className="btn-primary text-center text-sm"
                    >
                      {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="btn-secondary text-center text-sm"
                    >
                      {t('nav.login')}
                    </Link>

                    <Link
                      to="/packages"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="btn-primary text-center text-sm"
                    >
                      {t('nav.start')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

export default Header