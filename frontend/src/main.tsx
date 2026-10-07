import './i18n'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'

import { LanguageProvider } from './contexts/LanguageContext'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'

import './index.css'

const THEME_KEY = 'BİŞİŞ_theme'

const savedTheme = (() => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  }
  return 'dark'
})()

if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme)
}

document.documentElement.classList.add('theme-transition')

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_OAUTH_ENABLED =
  import.meta.env.VITE_ENABLE_GOOGLE_OAUTH === 'true' &&
  Boolean(GOOGLE_CLIENT_ID)

const RECAPTCHA_SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''

const RECAPTCHA_ENABLED = Boolean(RECAPTCHA_SITE_KEY)

function guardGSIInitialization() {
  const check = () => {
    const id = window.google?.accounts?.id
    if (id?.initialize) {
      const original = id.initialize
      let called = false
      id.initialize = function (config: Record<string, unknown>) {
        if (called) return
        called = true
        return original.call(this, config)
      }
    } else {
      setTimeout(check, 200)
    }
  }
  if (typeof window !== 'undefined') check()
}

if (GOOGLE_OAUTH_ENABLED) guardGSIInitialization()

const application = (
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <LanguageProvider>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
)

const withRecaptcha = RECAPTCHA_ENABLED ? (
  <GoogleReCaptchaProvider
    reCaptchaKey={RECAPTCHA_SITE_KEY}
    scriptProps={{
      async: true,
      defer: true,
      appendTo: 'body',
    }}
  >
    {application}
  </GoogleReCaptchaProvider>
) : (
  application
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  GOOGLE_OAUTH_ENABLED ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {withRecaptcha}
    </GoogleOAuthProvider>
  ) : (
    withRecaptcha
  ),
)
