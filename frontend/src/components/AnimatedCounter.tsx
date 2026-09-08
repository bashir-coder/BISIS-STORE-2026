import React, { useEffect, useState } from 'react'
import { motion, useInView } from 'framer-motion'

type AnimatedCounterProps = {
  value: string
  isVisible: boolean
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, isVisible }) => {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (!isVisible || !inView || value === 'V1') {
      if (value === 'V1') setDisplay(value)
      return
    }

    const target = Number(value)
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 850, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(String(Math.max(1, Math.round(target * eased))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, isVisible, value])

  return <motion.span ref={ref} initial={{ opacity: 0 }} animate={isVisible ? { opacity: 1 } : {}}>{display}</motion.span>
}

export default AnimatedCounter

