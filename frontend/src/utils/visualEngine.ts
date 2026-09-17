import { gsap } from 'gsap'

export const brandEasing = 'power3.out'

export const brandEase = (factor = 0.8) => `power${factor}.out`

export const staggerConfig = {
  amount: 0.6,
  from: 'start',
  ease: brandEasing,
}

export const fadeInUp = (
  element: HTMLElement | SVGElement,
  delay = 0,
  duration = 0.8,
) => {
  return gsap.from(element, {
    opacity: 0,
    y: 30,
    duration,
    delay,
    ease: brandEasing,
  })
}

export const fadeIn = (
  element: HTMLElement | SVGElement,
  delay = 0,
  duration = 0.8,
) => {
  return gsap.from(element, {
    opacity: 0,
    duration,
    delay,
    ease: brandEasing,
  })
}

export const scaleIn = (
  element: HTMLElement | SVGElement,
  delay = 0,
  duration = 0.8,
) => {
  return gsap.from(element, {
    opacity: 0,
    scale: 0.9,
    duration,
    delay,
    ease: 'back.out(1.7)',
  })
}

export const createEntranceTimeline = (
  targets: Array<HTMLElement | SVGElement>,
  options?: {
    stagger?: number
    delay?: number
    duration?: number
    ease?: string
  },
) => {
  const {
    stagger = 0.1,
    delay = 0,
    duration = 0.9,
    ease = brandEasing,
  } = options || {}

  const tl = gsap.timeline({ delay })

  targets.forEach((target, index) => {
    tl.to(
      target,
      {
        opacity: 1,
        y: 0,
        duration,
        ease,
      },
      index * stagger,
    )
  })

  return tl
}
