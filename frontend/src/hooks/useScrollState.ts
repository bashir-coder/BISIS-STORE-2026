import { useEffect, useRef } from 'react'

interface ScrollState {
  progress: number
  y: number
  direction: 'up' | 'down'
}

export function useScrollState(): [React.RefObject<HTMLDivElement>, ScrollState] {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRef<ScrollState>({
    progress: 0,
    y: 0,
    direction: 'down',
  })

  const lastY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const docHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight
      const progress = docHeight > 0 ? scrollY / docHeight : 0

      const direction: 'up' | 'down' =
        scrollY > lastY.current ? 'down' : 'up'

      state.current = { progress, y: scrollY, direction }
      lastY.current = scrollY
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return [ref, state.current]
}
