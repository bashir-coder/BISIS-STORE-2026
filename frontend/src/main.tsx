import './i18n'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'

import { LanguageProvider } from './contexts/LanguageContext'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'

import './index.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_OAUTH_ENABLED =
  import.meta.env.VITE_ENABLE_GOOGLE_OAUTH === 'true' &&
  Boolean(GOOGLE_CLIENT_ID)

const RECAPTCHA_SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''

const RECAPTCHA_ENABLED = Boolean(RECAPTCHA_SITE_KEY)

const application = (
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <LanguageProvider>
      <AuthProvider>
        <App />
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