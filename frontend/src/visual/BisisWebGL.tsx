import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import {
  createScene,
  createCamera,
  createRenderer,
  createParticles,
  createGridPlanes,
  createGeometricNodes,
  createRings,
  createAmbientLights,
  createGlowSprite,
} from './threejs-scene'
import { useReducedMotion } from '../hooks/useReducedMotion'

type BisisWebGLProps = {
  className?: string
  intensity?: 'low' | 'medium' | 'high'
  interactive?: boolean
  showParticles?: boolean
  showGeometry?: boolean
  showRings?: boolean
  reducedMotionFallback?: React.ReactNode
}

const BisisWebGL: React.FC<BisisWebGLProps> = ({
  className = '',
  intensity = 'medium',
  interactive = true,
  showParticles = true,
  showGeometry = true,
  showRings = true,
  reducedMotionFallback = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const particlesRef = useRef<THREE.Points | null>(null)
  const gridRef = useRef<THREE.Group | null>(null)
  const geometryRef = useRef<THREE.Group | null>(null)
  const ringsRef = useRef<THREE.Group | null>(null)
  const lightsRef = useRef<THREE.Group | null>(null)
  const spriteRef = useRef<THREE.Sprite | null>(null)

  const reducedMotion = useReducedMotion()
  const [webglAvailable, setWebglAvailable] = useState(true)

  const particleCount = intensity === 'high' ? 1200 : intensity === 'medium' ? 800 : 400

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return

    const time = Date.now() * 0.001

    if (particlesRef.current) {
      particlesRef.current.rotation.y = time * 0.02
      particlesRef.current.rotation.x = time * 0.01

      const positions = particlesRef.current.geometry.attributes.position
      for (let i = 0; i < positions.count; i++) {
        const idx = i * 3
        positions.setZ(
          idx + 2,
          positions.getZ(idx + 2) + 0.0005,
        )

        if (positions.getZ(idx + 2) > 20) {
          positions.setZ(idx + 2, -30)
        }
      }
      positions.needsUpdate = true
    }

    if (geometryRef.current && showGeometry) {
      geometryRef.current.children.forEach((child: THREE.Object3D) => {
        if (child.userData.rotationSpeed) {
          child.rotation.x += child.userData.rotationSpeed.x
          child.rotation.y += child.userData.rotationSpeed.y
          child.rotation.z += child.userData.rotationSpeed.z
          child.position.y =
            child.userData.targetY +
            Math.sin(time * child.userData.floatSpeed + child.userData.floatOffset) * 0.3
        }
      })
    }

    if (ringsRef.current && showRings) {
      ringsRef.current.children.forEach((child: THREE.Object3D) => {
        if (child.userData.rotationSpeed) {
          child.rotation.z += child.userData.rotationSpeed
          const pulse = 0.08 + Math.sin(time * child.userData.pulseSpeed) * 0.04
          const lineChild = child as THREE.Line
          if (Array.isArray(lineChild.material)) {
            lineChild.material.forEach((m: THREE.Material) => (m.opacity = pulse))
          } else if (lineChild.material) {
            lineChild.material.opacity = pulse
          }
        }
      })
    }

    if (spriteRef.current && interactive) {
      spriteRef.current.material.opacity = 0.4 + Math.sin(time * 0.5) * 0.2
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current)
    frameIdRef.current = requestAnimationFrame(animate)
  }, [showGeometry, showRings, interactive])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !interactive || reducedMotion) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 0.5
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 0.5

      cameraRef.current.position.x += (x * 3 - cameraRef.current.position.x) * 0.03
      cameraRef.current.position.y += (y * -3 - cameraRef.current.position.y) * 0.03
      cameraRef.current.lookAt(0, 0, 0)
    },
    [interactive, reducedMotion],
  )

  const handleScroll = useCallback(() => {
    if (!cameraRef.current || reducedMotion) return
    const scrollY = window.scrollY
    cameraRef.current.position.z = 30 - scrollY * 0.005
  }, [reducedMotion])

  const initScene = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current

    try {
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight
      const pixelRatio = window.devicePixelRatio

      const scene = createScene()
      const camera = createCamera(width / height)
      const renderer = createRenderer(canvas, width, height, pixelRatio)

      sceneRef.current = scene
      cameraRef.current = camera
      rendererRef.current = renderer

      const lights = createAmbientLights()
      scene.add(lights)
      lightsRef.current = lights

      const grid = createGridPlanes()
      scene.add(grid)
      gridRef.current = grid

      if (showParticles) {
        const particles = createParticles(particleCount)
        scene.add(particles)
        particlesRef.current = particles
      }

      if (showGeometry) {
        const geometry = createGeometricNodes(
          intensity === 'high' ? 60 : 40,
        )
        scene.add(geometry)
        geometryRef.current = geometry
      }

      if (showRings) {
        const rings = createRings(intensity === 'high' ? 8 : 6)
        scene.add(rings)
        ringsRef.current = rings
      }

      const sprite = createGlowSprite()
      if (sprite) {
        scene.add(sprite)
        spriteRef.current = sprite
      }

      if (!reducedMotion && interactive) {
        containerRef.current?.addEventListener('mousemove', handleMouseMove, { passive: true })
        window.addEventListener('scroll', handleScroll, { passive: true })
      }

      animate()
    } catch (err) {
      console.warn('[BisisWebGL] Initialization failed, falling back to CSS:', err)
      setWebglAvailable(false)
    }
  }, [particleCount, showParticles, showGeometry, showRings, intensity, animate, handleMouseMove, handleScroll, reducedMotion, interactive])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (canvasRef.current && containerRef.current) {
        initScene()
      }
    }, 50)

    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current) return

      const width = containerRef.current?.offsetWidth || 1
      const height = containerRef.current?.offsetHeight || 1

      rendererRef.current.setSize(width, height)
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)

      if (containerRef.current && interactive && !reducedMotion) {
        containerRef.current.removeEventListener('mousemove', handleMouseMove)
      }
      window.removeEventListener('scroll', handleScroll)

      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }

      if (rendererRef.current) {
        rendererRef.current.dispose()
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineLoop) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose())
            } else {
              child.material.dispose()
            }
          }
        })
      }
    }
  }, [initScene, handleMouseMove, handleScroll, interactive, reducedMotion])

  if (reducedMotion && reducedMotionFallback) {
    return <>{reducedMotionFallback}</>
  }

  if (!webglAvailable && reducedMotionFallback) {
    return <>{reducedMotionFallback}</>
  }

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ display: 'block' }}
      />
      {!webglAvailable && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/90 to-black" />
      )}
    </div>
  )
}

export default BisisWebGL
