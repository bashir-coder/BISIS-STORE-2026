import React from 'react'
import { motion, type Variants } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { cn } from '../../lib/utils'
import { STAGGER, DURATION, EASING } from '../../lib/motion'

interface StaggerItemProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale'
}

const itemVariants: Record<string, Variants> = {
  up: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  },
  down: {
    hidden: { opacity: 0, y: -16 },
    visible: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1 },
  },
}

export const StaggerItem: React.FC<StaggerItemProps> = ({
  children,
  className,
  delay = 0,
  direction = 'up',
}) => {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      variants={itemVariants[direction]}
      initial="hidden"
      animate={reducedMotion ? 'visible' : undefined}
      transition={{
        duration: DURATION.normal,
        ease: EASING.premium,
        delay,
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

StaggerItem.displayName = 'StaggerItem'

interface StaggerContainerProps {
  children: React.ReactNode
  className?: string
  stagger?: number
  delay?: number
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className,
  stagger = STAGGER.normal,
  delay = 0,
}) => {
  const reducedMotion = useReducedMotion()

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={reducedMotion ? 'visible' : undefined}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

StaggerContainer.displayName = 'StaggerContainer'
