import React, { Suspense, lazy, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { useLanguage } from './contexts/LanguageContext'
import { cn } from './lib/utils'
import { RequireRole } from './components/RequireRole'
import AppShell from './components/shell/AppShell'

import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import FloatingButtons from './components/FloatingButtons'
import LiveStatusRibbon from './components/LiveStatusRibbon'

const HUMAN_VERIFIED_KEY = 'BİŞİŞ_human_verified'
const HomePage = lazy(() => import('./pages/HomePage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PackagesPage = lazy(() => import('./pages/PackagesPage'))
const LifePlanPage = lazy(() => import('./pages/LifePlanPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const IntroductionPage = lazy(() => import('./pages/IntroductionPage'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const PaymentPage = lazy(() => import('./pages/PaymentPage'))
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'))
const PaymentCancelled = lazy(() => import('./pages/PaymentCancelled'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const BlogResourcesPage = lazy(() => import('./pages/BlogResourcesPage'))
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'))
const DigitalProductsPage = lazy(() => import('./pages/DigitalProductsPage'))
const DonationPage = lazy(() => import('./pages/DonationPage'))
const Client360Page = lazy(() => import('./pages/Client360Page'))
const WorkbenchPage = lazy(() => import('./pages/WorkbenchPage'))
const ProjectWorkspacePage = lazy(
  () => import('./pages/ProjectWorkspacePage'),
)

const App: React.FC = () => {
  const { t } = useTranslation()
  const { currentLang } = useLanguage()
  const location = useLocation()

  const [verified, setVerified] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HUMAN_VERIFIED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const dir = currentLang === 'ar' ? 'rtl' : 'ltr'
  const isRTL = currentLang === 'ar'

  /*
   * /verify is the one-time human verification page.
   */
  if (location.pathname === '/verify') {
    return (
      <div dir={dir}>
        <Suspense fallback={null}>
          {verified ? (
            <Navigate to="/" replace />
          ) : (
            <VerifyPage
              onVerified={() => {
                setVerified(true)
              }}
            />
          )}
        </Suspense>
      </div>
    )
  }

  /*
   * Keep Supabase email verification accessible.
   */
  if (location.pathname === '/verify-email') {
    return (
      <div
        dir={dir}
        className="min-h-screen bg-dark text-ink-0"
      >
        <Suspense fallback={null}>
          <VerifyEmailPage />
        </Suspense>
      </div>
    )
  }

  /*
   * Every normal route requires one-time human verification.
   */
  if (!verified) {
    return (
      <Navigate
        to="/verify"
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    )
  }

  return (
    <AppShell
      navigation={
        <>
          <ScrollProgress />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t('nav.open_menu')}
            className={cn(
              'lg:hidden fixed top-4 z-50 p-2 text-ink-2 hover:text-ink-0 rounded-lg border border-border-1 bg-surface-1 hover:bg-surface-2 transition-all',
              isRTL ? 'right-4' : 'left-4'
            )}
          >
            <Menu className="w-6 h-6" />
          </button>
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
          />
        </>
      }
      globalUI={
        <>
          <LiveStatusRibbon />
          <Footer />
          <FloatingButtons />
        </>
      }
      overlays={null}
      dir={dir}
    >
      <Suspense fallback={null}>
        <AnimatePresence
          mode="wait"
          initial={false}
        >
          <motion.div
            key={`${location.pathname}${location.search}${location.hash}`}
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            transition={{
              duration: 0.22,
              ease: 'easeOut',
            }}
            className={cn(
              'min-h-screen pt-6 transition-all duration-300',
            )}
          >
            <Routes location={location}>
              <Route
                path="/"
                element={<HomePage />}
              />

              <Route
                path="/introduction"
                element={<IntroductionPage />}
              />

              <Route
                path="/packages"
                element={<PackagesPage />}
              />

              <Route
                path="/life-plan"
                element={<LifePlanPage />}
              />

              <Route
                path="/services/life-plan"
                element={<LifePlanPage />}
              />

              <Route
                path="/services"
                element={
                  <Navigate
                    to="/packages"
                    replace
                  />
                }
              />

              <Route
                path="/about"
                element={<AboutPage />}
              />

              <Route
                path="/login"
                element={<LoginPage />}
              />

              <Route
                path="/register"
                element={<LoginPage />}
              />

              <Route
                path="/verify-email"
                element={<VerifyEmailPage />}
              />

              <Route
                path="/admin"
                element={
                  <RequireRole allowedRoles={['admin']}>
                    <AdminPanel />
                  </RequireRole>
                }
              />

              <Route
                path="/clients"
                element={
                  <RequireRole allowedRoles={['admin']}>
                    <Client360Page />
                  </RequireRole>
                }
              />

              <Route
                path="/workbench"
                element={
                  <RequireRole allowedRoles={['admin']}>
                    <WorkbenchPage />
                  </RequireRole>
                }
              />

              <Route
                path="/projects/:id"
                element={<ProjectWorkspacePage />}
              />

              <Route
                path="/payment"
                element={<PaymentPage />}
              />

              <Route
                path="/payment/success"
                element={<PaymentSuccess />}
              />

              <Route
                path="/payment/cancelled"
                element={<PaymentCancelled />}
              />

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              <Route
                path="/blog"
                element={<BlogResourcesPage />}
              />

              <Route
                path="/portfolio"
                element={<PortfolioPage />}
              />

              <Route
                path="/digital-products"
                element={<DigitalProductsPage />}
              />

              <Route
                path="/donation"
                element={<DonationPage />}
              />

              <Route
                path="/contact"
                element={<ContactPage />}
              />

              <Route
                path="*"
                element={<NotFoundPage />}
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </AppShell>
  )
}

export default App