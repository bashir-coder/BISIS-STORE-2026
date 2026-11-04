import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const check = () => {
      setReduced(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      )
    }

    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )
    mediaQuery.addEventListener('change', check)

    return () => mediaQuery.removeEventListener('change', check)
  }, [])

  return reduced
}
