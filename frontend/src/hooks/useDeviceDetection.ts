import { useEffect, useState } from 'react'

export type DeviceProfile = {
  isMobile: boolean
  isTouch: boolean
  isCoarsePointer: boolean
  isDesktop: boolean
  isLowEnd: boolean
}

const MOBILE_QUERY = '(max-width: 768px)'
const COARSE_QUERY = '(pointer: coarse)'

const hasTouchEvents = (): boolean =>
  typeof window !== 'undefined' && 'ontouchstart' in window

const readProfile = (): DeviceProfile => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTouch: false,
      isCoarsePointer: false,
      isDesktop: true,
      isLowEnd: false,
    }
  }

  const isMobile = window.matchMedia(MOBILE_QUERY).matches
  const isCoarsePointer = window.matchMedia(COARSE_QUERY).matches
  const isTouch = isCoarsePointer || hasTouchEvents()

  return {
    isMobile,
    isTouch,
    isCoarsePointer,
    isDesktop: !isMobile,
    isLowEnd: isMobile || isCoarsePointer,
  }
}

const sameProfile = (a: DeviceProfile, b: DeviceProfile): boolean =>
  a.isMobile === b.isMobile &&
  a.isTouch === b.isTouch &&
  a.isCoarsePointer === b.isCoarsePointer &&
  a.isDesktop === b.isDesktop &&
  a.isLowEnd === b.isLowEnd

export function useDeviceDetection(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(readProfile)

  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY)
    const coarse = window.matchMedia(COARSE_QUERY)

    const sync = () => {
      const next = readProfile()
      setProfile((prev) => (sameProfile(prev, next) ? prev : next))
    }

    const handleTouchChange = () => {
      sync()
    }

    sync()

    mobile.addEventListener('change', sync)
    coarse.addEventListener('change', sync)
    window.addEventListener('touchstart', handleTouchChange, { passive: true })
    window.addEventListener('touchend', handleTouchChange, { passive: true })

    return () => {
      mobile.removeEventListener('change', sync)
      coarse.removeEventListener('change', sync)
      window.removeEventListener('touchstart', handleTouchChange)
      window.removeEventListener('touchend', handleTouchChange)
    }
  }, [])

  return profile
}