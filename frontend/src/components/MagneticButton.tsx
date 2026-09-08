import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

type MagneticButtonProps = {
  children: React.ReactNode
  className?: string
  strength?: number
}

const MagneticButton: React.FC<MagneticButtonProps> = ({ children, className, strength = 10 }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return
    setOffset({
      x: ((event.clientX - bounds.left) / bounds.width - 0.5) * strength,
      y: ((event.clientY - bounds.top) / bounds.height - 0.5) * strength,
    })
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.35 }}
      className={cn('inline-flex', className)}
    >
      {children}
    </motion.div>
  )
}

export default MagneticButton

