import * as THREE from 'three'

export type BisisSceneTheme = 'dark' | 'light'

export const NAME = {
  particles: 'bisis-particles',
  grid: 'bisis-grid',
  geometry: 'bisis-geometry',
  rings: 'bisis-rings',
  ring: 'bisis-ring',
  sprite: 'bisis-sprite',
  lights: 'bisis-lights',
} as const

type SceneThemeConfig = {
  fog: number
  fogDensity: number
  particleOpacity: number
  gridOpacity: number
  ringScale: number
  spriteScale: number
}

/**
 * Theme only ever shifts atmosphere. Brand hues are fixed in gold + blue;
 * nothing here introduces an accent colour.
 */
const SCENE_THEME: Record<BisisSceneTheme, SceneThemeConfig> = {
  dark: {
    fog: 0x020304,
    fogDensity: 0.0015,
    particleOpacity: 0.5,
    gridOpacity: 0.06,
    ringScale: 1,
    spriteScale: 1,
  },
  light: {
    fog: 0xf4efe4,
    fogDensity: 0.0011,
    particleOpacity: 0.28,
    gridOpacity: 0.045,
    ringScale: 0.7,
    spriteScale: 0.55,
  },
}

/**
 * The scene background stays transparent so the global canvas composites over
 * the AppShell background layer instead of blacking out the page.
 */
export const createScene = (theme: BisisSceneTheme = 'dark') => {
  const scene = new THREE.Scene()

  scene.background = null

  const { fog, fogDensity } = SCENE_THEME[theme]
  scene.fog = new THREE.FogExp2(new THREE.Color(fog), fogDensity)

  return scene
}

/**
 * Mutates atmosphere in place. Never rebuilds geometry, so a theme switch
 * cannot recreate the scene.
 */
export const applySceneTheme = (
  scene: THREE.Scene,
  theme: BisisSceneTheme,
) => {
  const cfg = SCENE_THEME[theme]

  if (scene.fog instanceof THREE.FogExp2) {
    scene.fog.color.setHex(cfg.fog)
    scene.fog.density = cfg.fogDensity
  }

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    const material = mesh.material as THREE.Material | undefined

    if (!material || Array.isArray(material)) return

    if (object.name === NAME.particles) {
      const pointsMaterial = material as THREE.PointsMaterial
      pointsMaterial.opacity = cfg.particleOpacity
      return
    }

    if (object.name === NAME.grid) {
      const lineMaterial = material as THREE.LineBasicMaterial
      lineMaterial.opacity = cfg.gridOpacity
      return
    }

    if (object.name === NAME.ring || object.name === NAME.sprite) {
      object.userData.themeScale =
        object.name === NAME.ring ? cfg.ringScale : cfg.spriteScale
    }
  })
}

export const createCamera = (aspect: number) => {
  const camera = new THREE.PerspectiveCamera(
    50,
    aspect,
    0.1,
    1000,
  )
  camera.position.set(0, 0, 30)

  return camera
}

export const createRenderer = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number,
  maxPixelRatio: number = 2,
) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })

  const dpr = Math.min(pixelRatio, maxPixelRatio)

  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height, false)

  // Fully transparent clear. The AppShell background layer shows through.
  renderer.setClearColor(0x000000, 0)

  return renderer
}

export const createParticles = (count: number = 800, theme: BisisSceneTheme = 'dark') => {
  const geometry = new THREE.BufferGeometry()

  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const alphas = new Float32Array(count)

  const range = 60

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * range
    positions[i * 3 + 1] = (Math.random() - 0.5) * range
    positions[i * 3 + 2] = (Math.random() - 0.5) * range - 20

    sizes[i] = Math.random() * 1.8 + 0.2
    alphas[i] = Math.random() * 0.5 + 0.15
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

  const gold = new THREE.Color(0xd4af37)
  const blue = new THREE.Color(0x2F7BFF)

  const colors = []
  for (let i = 0; i < count; i++) {
    const r = Math.random()
    if (r < 0.7) {
      colors.push(gold.r, gold.g, gold.b)
    } else {
      colors.push(blue.r, blue.g, blue.b)
    }
  }

  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(colors), 3),
  )

  const material = new THREE.PointsMaterial({
    size: 0.35,
    vertexColors: true,
    transparent: true,
    opacity: SCENE_THEME[theme].particleOpacity,
    sizeAttenuation: true,
    depthWrite: false,
  })

  const particles = new THREE.Points(geometry, material)
  particles.name = NAME.particles
  particles.position.z = -5

  return particles
}

export const createGridPlanes = (theme: BisisSceneTheme = 'dark') => {
  const group = new THREE.Group()
  group.name = NAME.grid

  const goldColor = new THREE.Color(0xd4af37)
  const blueColor = new THREE.Color(0x2F7BFF)

  const createGrid = (
    size: number,
    divisions: number,
    color: THREE.Color,
    zOffset: number,
    rotationX: number,
  ) => {
    const gridHelper = new THREE.GridHelper(
      size,
      divisions,
      color,
      color,
    )
    gridHelper.name = NAME.grid
    gridHelper.material.opacity = SCENE_THEME[theme].gridOpacity
    gridHelper.material.transparent = true
    gridHelper.position.z = zOffset
    gridHelper.rotation.x = rotationX

    return gridHelper
  }

  group.add(createGrid(50, 20, goldColor, -15, Math.PI / 2))
  group.add(createGrid(40, 12, blueColor, -20, Math.PI / 2))

  return group
}

export const createGeometricNodes = (count: number = 40) => {
  const group = new THREE.Group()
  group.name = NAME.geometry

  const gold = new THREE.Color(0xd4af37)
  const blue = new THREE.Color(0x2F7BFF)

  const geometries = [
    new THREE.TetrahedronGeometry(0.3, 0),
    new THREE.OctahedronGeometry(0.25, 0),
    new THREE.IcosahedronGeometry(0.2, 0),
  ]

  for (let i = 0; i < count; i++) {
    const geomIndex = Math.floor(Math.random() * geometries.length)
    const geometry = geometries[geomIndex]

    const isGold = Math.random() > 0.4
    const color = isGold ? gold : blue

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      wireframe: Math.random() > 0.5,
    })

    const mesh = new THREE.Mesh(geometry, material)

    mesh.position.set(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 20 - 10,
    )

    mesh.userData = {
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.002,
        y: (Math.random() - 0.5) * 0.002,
        z: (Math.random() - 0.5) * 0.001,
      },
      floatSpeed: Math.random() * 0.001 + 0.0005,
      floatOffset: Math.random() * Math.PI * 2,
      targetY: mesh.position.y,
    }

    group.add(mesh)
  }

  return group
}

export const createRings = (count: number = 6, theme: BisisSceneTheme = 'dark') => {
  const group = new THREE.Group()
  group.name = NAME.rings

  const gold = new THREE.Color(0xd4af37)

  for (let i = 0; i < count; i++) {
    const radius = 12 + i * 3
    const tube = 0.04
    const segments = 64

    const geometry = new THREE.TorusGeometry(
      radius,
      tube,
      8,
      segments,
    )

    const material = new THREE.LineBasicMaterial({
      color: gold,
      transparent: true,
      opacity: 0.08 + (i * 0.02),
      blending: THREE.AdditiveBlending,
    })

    const ring = new THREE.LineLoop(
      geometry,
      material,
    )

    ring.rotation.x = (Math.PI / 2) * (i % 2)
    ring.position.z = -15 - i * 2

    ring.userData = {
      rotationSpeed: 0.0005 + i * 0.0003,
      pulseSpeed: 0.0003 + i * 0.0002,
      themeScale: SCENE_THEME[theme].ringScale,
    }

    ring.name = NAME.ring

    group.add(ring)
  }

  return group
}

export const createAmbientLights = () => {
  const group = new THREE.Group()
  group.name = NAME.lights

  const goldLight = new THREE.DirectionalLight(
    new THREE.Color(0xd4af37),
    0.3,
  )
  goldLight.position.set(10, 15, 10)
  group.add(goldLight)

  const blueLight = new THREE.DirectionalLight(
    new THREE.Color(0x2F7BFF),
    0.25,
  )
  blueLight.position.set(-12, -10, 8)
  group.add(blueLight)

  const ambient = new THREE.AmbientLight(
    new THREE.Color(0xffffff),
    0.4,
  )
  group.add(ambient)

  return group
}

export const createGlowSprite = (theme: BisisSceneTheme = 'dark') => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  canvas.width = 64
  canvas.height = 64

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)')
  gradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.1)')
  gradient.addColorStop(1, 'rgba(212, 175, 55, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.6,
  })

  const sprite = new THREE.Sprite(material)
  sprite.name = NAME.sprite
  sprite.userData = { themeScale: SCENE_THEME[theme].spriteScale }
  sprite.scale.set(6, 6, 1)
  sprite.position.set(0, 0, -10)

  return sprite
}
