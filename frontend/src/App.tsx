import React, { Suspense, lazy, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { useLanguage } from './contexts/LanguageContext'

import Header from './components/Header'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import FloatingButtons from './components/FloatingButtons'
import LiveStatusRibbon from './components/LiveStatusRibbon'

const HUMAN_VERIFIED_KEY = 'BİŞİŞ_human_verified'
const LabPage = lazy(() => import('./pages/LabPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PackagesPage = lazy(() => import('./pages/PackagesPage'))
const LifePlanPage = lazy(() => import('./pages/LifePlanPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const PaymentPage = lazy(() => import('./pages/PaymentPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const ClientPortal = lazy(() => import('./pages/ClientPortal'))
const Client360Page = lazy(() => import('./pages/Client360Page'))
const WorkbenchPage = lazy(() => import('./pages/WorkbenchPage'))
const ProjectWorkspacePage = lazy(
  () => import('./pages/ProjectWorkspacePage'),
)

const App: React.FC = () => {
  const { currentLang } = useLanguage()
  const location = useLocation()

  const [verified, setVerified] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HUMAN_VERIFIED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const dir = currentLang === 'ar' ? 'rtl' : 'ltr'

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
        className="min-h-screen bg-[#050505] text-white"
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
    <div
      className="relative min-h-screen text-white"
      dir={dir}
    >
      <div className="grid-pattern" />

      <ScrollProgress />
      <Header />

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
            className="min-h-screen"
          >
            <Routes location={location}>
              <Route
                path="/"
                element={<HomePage />}
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
<Route path="/lab" element={<LabPage />} />
              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              <Route
                path="/admin"
                element={<AdminPanel />}
              />

              <Route
                path="/clients"
                element={<Client360Page />}
              />

              <Route
                path="/workbench"
                element={<WorkbenchPage />}
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
                path="/chat"
                element={<ChatPage />}
              />

              <Route
                path="/faq"
                element={<FAQPage />}
              />

              <Route
                path="/contact"
                element={<ContactPage />}
              />

              <Route
                path="/portal"
                element={<ClientPortal />}
              />

              <Route
                path="*"
                element={<NotFoundPage />}
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>

      <LiveStatusRibbon />
      <Footer />
      <FloatingButtons />
    </div>
  )
}

export default App