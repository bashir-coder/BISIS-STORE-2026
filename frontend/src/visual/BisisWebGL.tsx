import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  applySceneTheme,
  createAmbientLights,
  createCamera,
  createGlowSprite,
  createGeometricNodes,
  createGridPlanes,
  createParticles,
  createRenderer,
  createRings,
  createScene,
  type BisisSceneTheme,
} from './threejs-scene'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useDeviceDetection } from '../hooks/useDeviceDetection'
import { useTheme } from '../contexts/ThemeContext'

type BisisWebGLProps = {
  className?: string
  intensity?: 'low' | 'medium' | 'high'
  interactive?: boolean
  showParticles?: boolean
  showGeometry?: boolean
  showRings?: boolean
  reducedMotionFallback?: React.ReactNode
}

type Tier = 'low' | 'medium' | 'high'

const CAMERA_BASE_Z = 30
const CAMERA_TRAVEL = 12
const CAMERA_SCROLL_RATE = 0.004

const PARTICLE_COUNT: Record<Tier, number> = {
  low: 260,
  medium: 800,
  high: 1200,
}

const NODE_COUNT: Record<Tier, number> = {
  low: 24,
  medium: 40,
  high: 60,
}

const RING_COUNT: Record<Tier, number> = {
  low: 4,
  medium: 6,
  high: 8,
}

const MAX_PIXEL_RATIO: Record<Tier, number> = {
  low: 1.5,
  medium: 2,
  high: 2,
}

type SceneBundle = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  particles: THREE.Points | null
  geometry: THREE.Group | null
  rings: THREE.Group | null
  sprite: THREE.Sprite | null
  frameId: number | null
  running: boolean
}

/**
 * Single persistent global visual layer.
 *
 * The scene is created once for the lifetime of the mount. Theme, reduced
 * motion, device tier and loop state are all applied by mutating the existing
 * bundle, never by rebuilding it. Resources are disposed only on real unmount.
 */
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
  const bundleRef = useRef<SceneBundle | null>(null)
  const [webglAvailable, setWebglAvailable] = useState(true)

  const reducedMotion = useReducedMotion()
  const device = useDeviceDetection()
  const { theme } = useTheme()

  /* Tier is resolved once. Changing it later must never rebuild the scene. */
  const tierRef = useRef<Tier | null>(null)
  if (tierRef.current === null) {
    tierRef.current = device.isLowEnd
      ? 'low'
      : intensity === 'high'
        ? 'high'
        : intensity === 'medium'
          ? 'medium'
          : 'low'
  }
  const tier = tierRef.current

  /* Live flags. Read by the loop; never keys for initialisation. */
  const reducedMotionRef = useRef(reducedMotion)
  const interactiveRef = useRef(interactive)
  const pausedRef = useRef(false)
  reducedMotionRef.current = reducedMotion
  interactiveRef.current = interactive

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || window.innerWidth))
    const height = Math.max(1, Math.round(rect.height || window.innerHeight))

    let bundle: SceneBundle

    try {
      const sceneTheme: BisisSceneTheme = theme === 'light' ? 'light' : 'dark'

      const scene = createScene(sceneTheme)
      const camera = createCamera(width / height)
      const renderer = createRenderer(
        canvas,
        width,
        height,
        window.devicePixelRatio,
        MAX_PIXEL_RATIO[tier],
      )

      const lights = createAmbientLights()
      scene.add(lights)

      const grid = createGridPlanes(sceneTheme)
      scene.add(grid)

      const particles = showParticles
        ? createParticles(PARTICLE_COUNT[tier], sceneTheme)
        : null
      if (particles) scene.add(particles)

      const geometry = showGeometry
        ? createGeometricNodes(NODE_COUNT[tier])
        : null
      if (geometry) scene.add(geometry)

      const rings = showRings ? createRings(RING_COUNT[tier], sceneTheme) : null
      if (rings) scene.add(rings)

      const sprite = createGlowSprite(sceneTheme)
      if (sprite) scene.add(sprite)

      bundle = {
        scene,
        camera,
        renderer,
        particles,
        geometry,
        rings,
        sprite,
        frameId: null,
        running: false,
      }
      bundleRef.current = bundle
    } catch (err) {
      console.warn('[BisisWebGL] Initialization failed, falling back to CSS:', err)
      setWebglAvailable(false)
      return
    }

    const updateCameraFromScroll = () => {
      if (reducedMotionRef.current) return

      const travelled = Math.min(
        CAMERA_TRAVEL,
        Math.max(0, window.scrollY * CAMERA_SCROLL_RATE),
      )
      bundle.camera.position.z = CAMERA_BASE_Z + travelled
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!interactiveRef.current || reducedMotionRef.current) return
      if (event.pointerType === 'touch') return

      const x = (event.clientX / window.innerWidth - 0.5) * 0.5
      const y = (event.clientY / window.innerHeight - 0.5) * 0.5

      bundle.camera.position.x += (x * 3 - bundle.camera.position.x) * 0.03
      bundle.camera.position.y += (y * -3 - bundle.camera.position.y) * 0.03
      bundle.camera.lookAt(0, 0, 0)
    }

    const handleResize = () => {
      const nextWidth = Math.max(1, window.innerWidth)
      const nextHeight = Math.max(1, window.innerHeight)

      bundle.renderer.setSize(nextWidth, nextHeight)
      bundle.camera.aspect = nextWidth / nextHeight
      bundle.camera.updateProjectionMatrix()
    }

    const renderOnce = () => {
      bundle.renderer.render(bundle.scene, bundle.camera)
    }

    const animate = () => {
      bundle.frameId = null

      const staticFrame = reducedMotionRef.current
      const time = staticFrame ? 0 : Date.now() * 0.001

      if (!staticFrame) {
        updateCameraFromScroll()
      }

      if (bundle.particles) {
        bundle.particles.rotation.y = time * 0.02
        bundle.particles.rotation.x = time * 0.01

        if (!staticFrame) {
          const positions = bundle.particles.geometry.attributes.position
          for (let i = 0; i < positions.count; i++) {
            const idx = i * 3
            positions.setZ(idx + 2, positions.getZ(idx + 2) + 0.0005)

            if (positions.getZ(idx + 2) > 20) {
              positions.setZ(idx + 2, -30)
            }
          }
          positions.needsUpdate = true
        }
      }

      if (bundle.geometry && !staticFrame) {
        bundle.geometry.children.forEach((child: THREE.Object3D) => {
          if (child.userData.rotationSpeed) {
            child.rotation.x += child.userData.rotationSpeed.x
            child.rotation.y += child.userData.rotationSpeed.y
            child.rotation.z += child.userData.rotationSpeed.z
            child.position.y =
              child.userData.targetY +
              Math.sin(
                time * child.userData.floatSpeed + child.userData.floatOffset,
              ) * 0.3
          }
        })
      }

      if (bundle.rings && !staticFrame) {
        bundle.rings.children.forEach((child: THREE.Object3D) => {
          if (child.userData.rotationSpeed) {
            child.rotation.z += child.userData.rotationSpeed
            const themeScale = child.userData.themeScale ?? 1
            const pulse = 0.08 + Math.sin(time * child.userData.pulseSpeed) * 0.04
            const lineChild = child as THREE.Line
            if (Array.isArray(lineChild.material)) {
              lineChild.material.forEach(
                (m: THREE.Material) => (m.opacity = pulse * themeScale),
              )
            } else if (lineChild.material) {
              lineChild.material.opacity = pulse * themeScale
            }
          }
        })
      }

      if (bundle.sprite) {
        const themeScale = bundle.sprite.userData.themeScale ?? 1
        const base = interactiveRef.current
          ? 0.4 + Math.sin(time * 0.5) * 0.2
          : 0.6
        bundle.sprite.material.opacity = base * themeScale
      }

      renderOnce()

      if (!staticFrame) {
        bundle.frameId = requestAnimationFrame(animate)
      } else {
        bundle.running = false
      }
    }

    const start = () => {
      if (bundle.running) return
      bundle.running = true
      animate()
    }

    const stop = () => {
      if (bundle.frameId !== null) {
        cancelAnimationFrame(bundle.frameId)
        bundle.frameId = null
      }
      bundle.running = false
    }

    const syncLoop = () => {
      if (pausedRef.current || reducedMotionRef.current) {
        stop()
        return
      }
      start()
    }

    const handleVisibility = () => {
      pausedRef.current = document.visibilityState === 'hidden'
      syncLoop()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('scroll', updateCameraFromScroll, { passive: true })
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    document.addEventListener('visibilitychange', handleVisibility)

    updateCameraFromScroll()
    syncLoop()

    const dispose = () => {
      stop()

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('scroll', updateCameraFromScroll)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      document.removeEventListener('visibilitychange', handleVisibility)

      bundle.scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.Points ||
          child instanceof THREE.LineLoop ||
          child instanceof THREE.LineSegments ||
          child instanceof THREE.Sprite
        ) {
          child.geometry?.dispose()

          const material = (child as THREE.Mesh).material
          if (Array.isArray(material)) {
            material.forEach((m) => m.dispose())
          } else {
            material?.dispose()
          }
        }
      })

      bundle.renderer.dispose()
      bundleRef.current = null
    }

    return dispose
  }, [])

  /* Theme switches mutate the live scene; geometry is never rebuilt. */
  useEffect(() => {
    const bundle = bundleRef.current
    if (!bundle) return
    applySceneTheme(bundle.scene, theme === 'light' ? 'light' : 'dark')
  }, [theme])

  /* Reduced motion and tab visibility only control the loop, not the scene. */
  useEffect(() => {
    const bundle = bundleRef.current
    if (!bundle) return

    if (pausedRef.current || reducedMotionRef.current) {
      if (bundle.frameId !== null) {
        cancelAnimationFrame(bundle.frameId)
        bundle.frameId = null
      }
      bundle.running = false
      bundle.renderer.render(bundle.scene, bundle.camera)
      return
    }

    if (!bundle.running) {
      bundle.running = true
      bundle.renderer.render(bundle.scene, bundle.camera)
    }
  }, [reducedMotion])

  if (!webglAvailable && reducedMotionFallback) {
    return <>{reducedMotionFallback}</>
  }

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ display: 'block' }}
      />
      {!webglAvailable && (
        <div
          className="absolute inset-0"
          style={
            theme === 'light'
              ? {
                  background:
                    'linear-gradient(to bottom, rgba(140,106,30,0.16), rgba(29,95,216,0.14), transparent)',
                }
              : {
                  background:
                    'linear-gradient(to bottom, rgba(212,175,55,0.10), rgba(47,123,255,0.08), transparent)',
                }
          }
        />
      )}
    </div>
  )
}

export default BisisWebGL