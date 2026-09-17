import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const check = () => {
      setReduced(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      )
    }

    check()

    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )
    mediaQuery.addEventListener('change', check)

    return () => mediaQuery.removeEventListener('change', check)
  }, [])

  return reduced
}
