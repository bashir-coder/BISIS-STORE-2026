import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useInView } from '../hooks/useInView'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { createSectionReveal, createStaggerReveal } from '../utils/gsapHelpers'

import AnimatedCounter from '../components/AnimatedCounter'

const About: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()
  const reducedMotion = useReducedMotion()
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const rightColumnRef = useRef<HTMLDivElement>(null)
  const statRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!isInView || reducedMotion) return

    const cleanup: Array<() => void> = []

    if (leftColumnRef.current) {
      const anim = createSectionReveal(leftColumnRef.current, {
        yOffset: 30,
        duration: 0.8,
      })
      if (anim) cleanup.push(() => anim.kill())
    }

    if (rightColumnRef.current) {
      const anim = createSectionReveal(rightColumnRef.current, {
        yOffset: 30,
        duration: 0.8,
        delay: 0.2,
      })
      if (anim) cleanup.push(() => anim.kill())
    }

    const statElements = statRefs.current.filter(Boolean) as HTMLElement[]
    if (statElements.length > 0) {
      const anim = createStaggerReveal(statElements, {
        stagger: 0.08,
        yOffset: 20,
        reducedMotion,
      })
      if (anim) cleanup.push(() => anim.kill())
    }

    return () => {
      cleanup.forEach((fn) => fn())
    }
  }, [isInView, reducedMotion])

  const stats = [
    { value: '18', label: t('stats.services') },
    { value: '3', label: t('stats.packages') },
    { value: '1', label: t('stats.categories') },
    { value: 'V1', label: t('stats.scope') },
  ]

  return (
    <section ref={ref} className="py-24 section-padding relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="grid lg:grid-cols-2 gap-16 items-center"
        >
          <div ref={leftColumnRef}>
            <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
              {t('about.eyebrow')}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-outfit text-white leading-tight mb-6">
              {t('about.title').split('<br />').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i === 0 && <br />}
                </React.Fragment>
              ))}
            </h2>
            <p className="text-white/60 text-lg leading-relaxed">
              {t('about.text')}
            </p>
          </div>
          <div ref={rightColumnRef} className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/20 via-emerald/10 to-transparent rounded-3xl blur-3xl" />
            <div className="relative glass rounded-3xl p-8 border border-gold/20 shadow-2xl shadow-gold/5">
              <div className="grid grid-cols-2 gap-6">
                {stats.map((item, i) => (
                  <div
                    key={i}
                    ref={(el) => (statRefs.current[i] = el)}
                    className="text-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-gold/30 hover:bg-gold/[0.04] transition-all duration-300"
                  >
                    <div className="text-3xl sm:text-4xl font-bold gold-gradient-text font-outfit">
                      <AnimatedCounter value={item.value} isVisible={isInView} />
                    </div>
                    <div className="text-sm text-white/50 mt-1.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default About
