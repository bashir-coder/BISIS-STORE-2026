import { motion, useScroll, useSpring } from 'framer-motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll()
  const reducedMotion = useReducedMotion()

  const scaleX = useSpring(scrollYProgress, {
    stiffness: reducedMotion ? 2000 : 100,
    damping: reducedMotion ? 40 : 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold via-gold-light to-gold z-[60] origin-left"
      style={{ scaleX }}
    />
  )
}

export default ScrollProgress
