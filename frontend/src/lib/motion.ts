import { type Variants, type Transition } from 'framer-motion'

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const EASING = {
  premium: [0.22, 1, 0.36, 1] as const,
  standard: [0.4, 0, 0.2, 1] as const,
  emphatic: [0.34, 1.56, 0.64, 1] as const,
} as const

export const DURATION = {
  fast: 0.18,
  base: 0.28,
  normal: 0.42,
  slow: 0.65,
  slower: 0.9,
} as const

export const STAGGER = {
  tight: 0.05,
  normal: 0.08,
  loose: 0.12,
} as const

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0 },
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0 },
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
}

export const containerVariants = (stagger: number = STAGGER.normal, delay: number = 0): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren: delay,
    },
  },
})

export const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
} as const

export const transition = {
  fast: { duration: DURATION.fast, ease: EASING.premium },
  base: { duration: DURATION.base, ease: EASING.standard },
  normal: { duration: DURATION.normal, ease: EASING.premium },
  slow: { duration: DURATION.slow, ease: EASING.premium },
  scale: { type: 'spring', stiffness: 320, damping: 26, mass: 0.4 },
} as const

export const getReducedTransition = <T extends Transition>(
  t: T
): T | { duration: number } =>
  prefersReducedMotion() ? { duration: 0.01 } : t

export const fadeInUpTransition = (delay = 0): Transition => ({
  opacity: { duration: DURATION.base, ease: EASING.premium, delay },
  y: { duration: DURATION.slow, ease: EASING.premium, delay },
})

export const staggerItem = (delay = 0): Transition => ({
  opacity: { duration: DURATION.base, ease: EASING.premium, delay },
  y: { duration: DURATION.slow, ease: EASING.premium, delay },
})
