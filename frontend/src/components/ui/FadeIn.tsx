import React from 'react'
import { motion, type Variants, type Transition } from 'framer-motion'
import { useInView } from '../../hooks/useInView'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { cn } from '../../lib/utils'
import {
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  containerVariants,
  STAGGER,
} from '../../lib/motion'

type Direction = 'up' | 'down' | 'left' | 'right' | 'scale' | 'none'

const directionVariants: Record<Direction, Variants> = {
  up: fadeInUp,
  down: fadeInDown,
  left: fadeInLeft,
  right: fadeInRight,
  scale: scaleIn,
  none: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
}

interface FadeInProps {
  children: React.ReactNode
  className?: string
  direction?: Direction
  delay?: number
  stagger?: boolean
  staggerAmount?: number
}

const baseTransition: Transition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1],
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  className,
  direction = 'up',
  delay = 0,
  stagger = false,
  staggerAmount = STAGGER.normal,
}) => {
  const { ref, isInView } = useInView({ threshold: 0.08 })
  const reducedMotion = useReducedMotion()

  if (stagger) {
    return (
      <motion.div
        ref={ref}
        variants={containerVariants(staggerAmount, delay)}
        initial="hidden"
        animate={reducedMotion || isInView ? 'visible' : 'hidden'}
        className={cn(className)}
      >
        {children}
      </motion.div>
    )
  }

  const transition: Transition = {
    ...baseTransition,
    delay,
  }

  return (
    <motion.div
      ref={ref}
      variants={directionVariants[direction]}
      initial="hidden"
      animate={reducedMotion || isInView ? 'visible' : 'hidden'}
      transition={transition}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

FadeIn.displayName = 'FadeIn'
