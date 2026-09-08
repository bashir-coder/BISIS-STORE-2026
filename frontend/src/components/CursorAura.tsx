import React, { useEffect, useRef } from 'react'

const CursorAura: React.FC = () => {
  const auraRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const aura = auraRef.current
    if (!aura) return

    let frame = 0
    let x = -240
    let y = -240

    const render = () => {
      aura.style.transform = `translate3d(${x - 160}px, ${y - 160}px, 0)`
      frame = 0
    }

    const handlePointerMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      if (!frame) frame = window.requestAnimationFrame(render)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={auraRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[1] hidden h-96 w-96 rounded-full blur-3xl transition-opacity duration-500 lg:block"
      style={{
        background: 'radial-gradient(circle, rgba(212,175,55,0.16) 0%, rgba(0,168,120,0.10) 42%, transparent 72%)',
      }}
    />
  )
}

export default CursorAura

