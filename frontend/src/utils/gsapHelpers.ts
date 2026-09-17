import { gsap } from 'gsap'

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const createHeroTimeline = (
  refs: Record<string, HTMLElement | null>,
  options?: {
    reducedMotion?: boolean
    onComplete?: () => void
  },
) => {
  const { reducedMotion = false, onComplete } = options || {}

  const tl = gsap.timeline({
    defaults: {
      ease: 'power3.out',
    },
    onComplete,
  })

  if (reducedMotion) {
    Object.values(refs).forEach((ref) => {
      if (ref) {
        gsap.set(ref, { opacity: 1, y: 0 })
      }
    })
    return tl
  }

  if (refs.background) {
    tl.to(
      refs.background,
      {
        opacity: 1,
        scale: 1,
        duration: 0.8,
      },
      0,
    )
  }

  if (refs.badge) {
    tl.to(
      refs.badge,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
      },
      0.2,
    )
  }

  if (refs.headline) {
    tl.to(
      refs.headline,
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
      },
      0.4,
    )
  }

  if (refs.subtitle) {
    tl.to(
      refs.subtitle,
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
      },
      0.6,
    )
  }

  if (refs.description) {
    tl.to(
      refs.description,
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
      },
      0.8,
    )
  }

  if (refs.cta) {
    tl.to(
      refs.cta,
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
      },
      1.0,
    )
  }

  if (refs.stats) {
    tl.to(
      refs.stats,
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
      },
      1.2,
    )
  }

  return tl
}

export const createSectionReveal = (
  element: HTMLElement | SVGElement,
  options?: {
    yOffset?: number
    duration?: number
    delay?: number
    reducedMotion?: boolean
  },
) => {
  const {
    yOffset = 30,
    duration = 0.8,
    delay = 0,
    reducedMotion = false,
  } = options || {}

  if (reducedMotion) {
    gsap.set(element, { opacity: 1, y: 0 })
    return null
  }

  gsap.set(element, { opacity: 0, y: yOffset })

  return gsap.timeline({
    scrollTrigger: {
      trigger: element,
      start: 'top 82%',
      toggleActions: 'play none none reverse',
    },
  }).to(element, {
    opacity: 1,
    y: 0,
    duration,
    delay,
    ease: 'power3.out',
  })
}

export const createStaggerReveal = (
  elements: Array<HTMLElement | SVGElement>,
  options?: {
    stagger?: number
    yOffset?: number
    reducedMotion?: boolean
  },
) => {
  const {
    stagger = 0.12,
    yOffset = 25,
    reducedMotion = false,
  } = options || {}

  if (reducedMotion || elements.length === 0) {
    elements.forEach((el) => gsap.set(el, { opacity: 1, y: 0 }))
    return null
  }

  elements.forEach((el) => {
    gsap.set(el, { opacity: 0, y: yOffset })
  })

  return gsap.to(elements, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    stagger,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: elements[0],
      start: 'top 85%',
      toggleActions: 'play none none reverse',
    },
  })
}

export const createParallax = (
  element: HTMLElement,
  depth: number = 0.1,
) => {
  if (typeof window === 'undefined') return null

  const parallax = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5

    gsap.to(element, {
      x: x * 100 * depth,
      y: y * 100 * depth,
      duration: 0.6,
      ease: 'power2.out',
    })
  }

  const reset = () => {
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
    })
  }

  element.addEventListener('mousemove', parallax, { passive: true })
  element.addEventListener('mouseleave', reset)

  return () => {
    element.removeEventListener('mousemove', parallax)
    element.removeEventListener('mouseleave', reset)
  }
}
