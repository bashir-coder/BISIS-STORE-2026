import React from 'react'
import { cn } from '../../lib/utils'
import { FadeIn } from './FadeIn'

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'center' | 'left'
  className?: string
  delay?: number
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
  delay = 0,
}) => {
  const textAlign = align === 'center' ? 'text-center mx-auto' : 'text-left'

  return (
    <FadeIn
      className={cn('mb-12 max-w-3xl', align === 'center' && 'mx-auto', textAlign, className)}
      delay={delay}
      direction="up"
    >
      {eyebrow && (
        <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          {eyebrow}
        </span>
      )}

      <h2 className={`text-3xl font-bold font-outfit text-white sm:text-4xl ${align === 'center' ? 'lg:text-5xl' : ''}`}>
        {title}
      </h2>

      {subtitle && (
        <p className={`mt-4 text-base text-white/55 sm:text-lg ${align === 'center' ? 'max-w-2xl' : 'max-w-xl'}`}>
          {subtitle}
        </p>
      )}
    </FadeIn>
  )
}

SectionHeader.displayName = 'SectionHeader'
