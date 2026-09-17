import * as THREE from 'three'

export const createScene = () => {
  const scene = new THREE.Scene()

  const black = new THREE.Color(0x020304)
  scene.background = black
  scene.fog = new THREE.FogExp2(black, 0.0015)

  return scene
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

export const createRenderer = (canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })

  const dpr = Math.min(pixelRatio, 2)

  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x020304, 0)

  return renderer
}

export const createParticles = (count: number = 800) => {
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
  const emerald = new THREE.Color(0x00a878)

  const colors = []
  for (let i = 0; i < count; i++) {
    const r = Math.random()
    if (r < 0.7) {
      colors.push(gold.r, gold.g, gold.b)
    } else {
      colors.push(emerald.r, emerald.g, emerald.b)
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
    opacity: 0.5,
    sizeAttenuation: true,
    depthWrite: false,
  })

  const particles = new THREE.Points(geometry, material)
  particles.position.z = -5

  return particles
}

export const createGridPlanes = () => {
  const group = new THREE.Group()

  const goldColor = new THREE.Color(0xd4af37)
  const emeraldColor = new THREE.Color(0x00a878)

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
    gridHelper.material.opacity = 0.06
    gridHelper.material.transparent = true
    gridHelper.position.z = zOffset
    gridHelper.rotation.x = rotationX

    return gridHelper
  }

  group.add(createGrid(50, 20, goldColor, -15, Math.PI / 2))
  group.add(createGrid(40, 12, emeraldColor, -20, Math.PI / 2))

  return group
}

export const createGeometricNodes = (count: number = 40) => {
  const group = new THREE.Group()

  const gold = new THREE.Color(0xd4af37)
  const emerald = new THREE.Color(0x00a878)

  const geometries = [
    new THREE.TetrahedronGeometry(0.3, 0),
    new THREE.OctahedronGeometry(0.25, 0),
    new THREE.IcosahedronGeometry(0.2, 0),
  ]

  for (let i = 0; i < count; i++) {
    const geomIndex = Math.floor(Math.random() * geometries.length)
    const geometry = geometries[geomIndex]

    const isGold = Math.random() > 0.4
    const color = isGold ? gold : emerald

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

export const createRings = (count: number = 6) => {
  const group = new THREE.Group()

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
    }

    group.add(ring)
  }

  return group
}

export const createAmbientLights = () => {
  const group = new THREE.Group()

  const goldLight = new THREE.DirectionalLight(
    new THREE.Color(0xd4af37),
    0.3,
  )
  goldLight.position.set(10, 15, 10)
  group.add(goldLight)

  const emeraldLight = new THREE.DirectionalLight(
    new THREE.Color(0x00a878),
    0.25,
  )
  emeraldLight.position.set(-12, -10, 8)
  group.add(emeraldLight)

  const ambient = new THREE.AmbientLight(
    new THREE.Color(0xffffff),
    0.4,
  )
  group.add(ambient)

  return group
}

export const createGlowSprite = () => {
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
  sprite.scale.set(6, 6, 1)
  sprite.position.set(0, 0, -10)

  return sprite
}
