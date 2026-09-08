const RECAPTCHA_VERIFY_URL =
  'https://www.google.com/recaptcha/api/siteverify'

const MIN_SCORE = 0.5
const EXPECTED_ACTION = 'pre_entry'

const verifyRecaptcha = async (req, res, next) => {
  try {
    const { recaptchaToken } = req.body || {}

    if (
      !recaptchaToken ||
      typeof recaptchaToken !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA token required',
      })
    }

    const secret =
      process.env.RECAPTCHA_SECRET_KEY

    if (!secret) {
      console.error(
        '[reCAPTCHA] RECAPTCHA_SECRET_KEY is not configured',
      )

      return res.status(500).json({
        success: false,
        message: 'reCAPTCHA is not configured',
      })
    }

    const body = new URLSearchParams({
      secret,
      response: recaptchaToken,
    })

    const controller = new AbortController()

    const timeout = setTimeout(
      () => controller.abort(),
      10000,
    )

    let response

    try {
      response = await fetch(
        RECAPTCHA_VERIFY_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },
          body: body.toString(),
          signal: controller.signal,
        },
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      console.error(
        `[reCAPTCHA] Google returned HTTP ${response.status}`,
      )

      return res.status(502).json({
        success: false,
        message:
          'reCAPTCHA verification service unavailable',
      })
    }

    const result =
      await response.json()

    if (
      !result ||
      result.success !== true
    ) {
      console.warn(
        '[reCAPTCHA] Google verification failed:',
        result,
      )

      return res.status(403).json({
        success: false,
        message:
          'reCAPTCHA verification failed',
      })
    }

    const score =
      typeof result.score === 'number'
        ? result.score
        : 0

    if (score < MIN_SCORE) {
      console.warn(
        `[reCAPTCHA] Low score: ${score}`,
      )

      return res.status(403).json({
        success: false,
        message:
          'Security verification rejected',
      })
    }

    if (
      result.action !== EXPECTED_ACTION
    ) {
      console.warn(
        `[reCAPTCHA] Invalid action: ${result.action}`,
      )

      return res.status(403).json({
        success: false,
        message:
          'Invalid reCAPTCHA action',
      })
    }

    return next()
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'Google reCAPTCHA request timed out'
        : error?.message ||
          'Unknown reCAPTCHA error'

    console.error(
      '[reCAPTCHA] Verification error:',
      message,
    )

    return res.status(502).json({
      success: false,
      message:
        'reCAPTCHA verification service unavailable',
    })
  }
}

module.exports = {
  verifyRecaptcha,
}