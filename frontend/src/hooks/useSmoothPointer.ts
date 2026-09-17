import { useEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion'

interface PointerState {
  x: number
  y: number
}

export function useSmoothPointer(
  damping: number = 0.08,
): [React.RefObject<HTMLDivElement>, PointerState] {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const state = useRef<PointerState>({ x: 0, y: 0 })
  const target = useRef<PointerState>({ x: 0, y: 0 })

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (reducedMotion) return
      if (!ref.current) return

      const rect = ref.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2

      target.current = { x, y }
    }

    const animate = () => {
      if (reducedMotion) {
        state.current = { x: 0, y: 0 }
        return
      }

      state.current.x += (target.current.x - state.current.x) * damping
      state.current.y += (target.current.y - state.current.y) * damping

      if (
        Math.abs(state.current.x - target.current.x) > 0.001 ||
        Math.abs(state.current.y - target.current.y) > 0.001
      ) {
        requestAnimationFrame(animate)
      }
    }

    const element = ref.current
    if (element) {
      element.addEventListener('mousemove', handleMove, { passive: true })
    }

    requestAnimationFrame(animate)

    return () => {
      if (element) {
        element.removeEventListener('mousemove', handleMove)
      }
    }
  }, [damping, reducedMotion])

  return [ref, state.current]
}
