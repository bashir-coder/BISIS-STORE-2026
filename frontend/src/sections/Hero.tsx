import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, TrendingUp, Layers } from 'lucide-react'
import { useTranslate } from '../hooks/useTranslate'
import { useInView } from '../hooks/useInView'
import MagneticButton from '../components/MagneticButton'
import AnimatedCounter from '../components/AnimatedCounter'
import BisisWebGL from '../visual/BisisWebGL'

const Hero: React.FC = () => {
  const { t } = useTranslate()
  const { ref, isInView } = useInView()
  const heroRef = useRef<HTMLElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isInView) return

    const elements = [badgeRef.current, titleRef.current, subtitleRef.current, descriptionRef.current]
    const validElements = elements.filter(Boolean) as HTMLElement[]

    const tl = gsap.timeline({
      delay: 0.3,
    })

    if (validElements.length > 0) {
      tl.to(
        validElements,
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
        },
        0,
      )
    }

    if (ctaRef.current) {
      tl.to(
        ctaRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
        },
        0.5,
      )
    }

    if (statsRef.current) {
      tl.to(
        statsRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
        },
        0.8,
      )
    }

    return () => {
      tl.kill()
    }
  }, [isInView])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  }

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden pt-20"
    >
      <div
        ref={ref}
        className="absolute inset-0 z-0 bg-transparent"
      />

      <BisisWebGL
        className="z-0"
        intensity="high"
        interactive={true}
        showParticles={true}
        showGeometry={true}
        showRings={true}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden bg-transparent"
      >
        <motion.div
          className="absolute bottom-[12%] right-[8%] h-[30rem] w-[30rem] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(0,168,120,0.06) 0%, rgba(0,168,120,0.012) 38%, transparent 72%)',
            filter: 'blur(52px)',
          }}
          animate={{
            x: [0, -48, 22, 0],
            y: [0, 34, -26, 0],
            scale: [1, 0.92, 1.1, 1],
          }}
          transition={{
            duration: 24,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />

        <motion.div
          className="absolute top-[20%] left-[10%] h-[20rem] w-[20rem] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(212,175,55,0.05) 0%, rgba(212,175,55,0.01) 42%, transparent 74%)',
            filter: 'blur(48px)',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -24, 18, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />

        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `
              linear-gradient(rgba(212,175,55,0.022) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,168,120,0.016) 1px, transparent 1px)
            `,
            backgroundSize: '84px 84px',
            maskImage:
              'radial-gradient(ellipse at center, black 15%, transparent 76%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 15%, transparent 76%)',
          }}
        />

        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{
            background:
              'linear-gradient(to top, rgba(0,168,120,0.025), transparent)',
          }}
        />
      </div>

      <div className="relative z-20 mx-auto w-full max-w-7xl section-padding">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center"
        >
          <motion.div
            ref={badgeRef}
            variants={itemVariants}
            className="glass mb-8 inline-flex items-center gap-2.5 rounded-full border border-gold/30 bg-gold/[0.06] px-4 py-2 shadow-lg shadow-gold/10 opacity-0"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-light opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
            </span>
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-gold-light">
              {String(t('hero.badge'))}
            </span>
          </motion.div>

          <motion.h1
            ref={titleRef}
            variants={itemVariants}
            className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl lg:text-7xl opacity-0"
          >
            <span className="text-white">
              {String(t('hero.title'))}
            </span>
            <span className="relative ml-2 text-transparent bg-clip-text bg-gradient-to-r from-gold via-emerald-light to-gold-light">
              <span className="bg-gradient-to-r from-gold via-emerald-light to-gold-light bg-clip-text text-transparent animate-pulse">
                <Sparkles className="inline-block h-8 w-8 text-gold-light" />
              </span>
            </span>
          </motion.h1>

          <motion.p
            ref={subtitleRef}
            variants={itemVariants}
            className="mb-4 text-xl font-medium text-gold-light/80 sm:text-2xl opacity-0"
            style={{
              textShadow:
                '0 0 14px rgba(212,175,55,0.14), 0 0 24px rgba(0,168,120,0.08)',
            }}
          >
            {String(t('hero.subtitle'))}
          </motion.p>

          <motion.p
            ref={descriptionRef}
            variants={itemVariants}
            className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/50 sm:text-lg opacity-0"
          >
            {String(t('hero.description'))}
          </motion.p>

          <motion.div
            ref={ctaRef}
            variants={itemVariants}
            className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row opacity-0"
          >
            <MagneticButton>
              <Link
                to="/packages"
                className="btn-primary flex items-center gap-2 px-8 py-4 text-base"
              >
                {String(t('hero.cta'))}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </MagneticButton>

            <MagneticButton>
              <Link
                to="/contact"
                className="btn-secondary flex items-center gap-2 px-8 py-4 text-base"
              >
                {String(t('hero.cta2'))}
              </Link>
            </MagneticButton>
          </motion.div>

          <motion.div
            ref={statsRef}
            variants={itemVariants}
            className="mx-auto grid max-w-3xl grid-cols-2 gap-6 md:grid-cols-4 opacity-0"
          >
            {[
              {
                icon: Layers,
                value: '18',
                label: t('stats.services'),
              },
              {
                icon: TrendingUp,
                value: '3',
                label: t('stats.packages'),
              },
              {
                icon: Sparkles,
                value: '1',
                label: t('stats.categories'),
              },
              {
                icon: TrendingUp,
                value: 'V1',
                label: t('stats.scope'),
              },
            ].map((stat, index) => (
              <motion.div
                key={index}
                whileHover={{
                  scale: 1.06,
                  rotateX: 4,
                  rotateY: index % 2 === 0 ? -3 : 3,
                  y: -5,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 280,
                  damping: 18,
                }}
                className="glass relative rounded-xl border border-gold/10 p-4 transition-all hover:border-gold/30"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.018), 0 0 18px rgba(212,175,55,0.025)',
                }}
              >
                <stat.icon className="mx-auto mb-2 h-5 w-5 text-gold" />

                <div className="text-2xl font-bold font-outfit text-white gold-gradient-text">
                  <AnimatedCounter value={stat.value} isVisible={isInView} />
                </div>

                <div className="mt-1 text-xs text-white/50">
                  {String(stat.label)}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-36"
        style={{
          background:
            'linear-gradient(to top, #020304 0%, rgba(2,3,4,0.72) 35%, transparent 100%)',
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[72%] -translate-x-1/2"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(212,175,55,0.65), rgba(0,168,120,0.5), transparent)',
          boxShadow:
            '0 0 7px rgba(212,175,55,0.28), 0 0 16px rgba(0,168,120,0.12)',
        }}
      />
    </section>
  )
}

export default Hero
