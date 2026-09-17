import { useEffect, useRef } from 'react'

export function useDeviceDetection() {
  const isMobile = useRef(false)
  const isTouch = useRef(false)

  useEffect(() => {
    isMobile.current = window.matchMedia(
      '(max-width: 768px)',
    ).matches
    isTouch.current = 'ontouchstart' in window
  }, [])

  return {
    isMobile: isMobile.current,
    isTouch: isTouch.current,
    isDesktop: !isMobile.current,
  }
}
