// BEŞİR — Centralized Design Tokens
// Single source of truth for all visual tokens.
// Values match index.css dark theme (default).
// Light theme overrides live in index.css [data-theme="light"].

// ┌─────────────────────────────────────────────────────────────────┐
// │ COLORS                                                          │
// └─────────────────────────────────────────────────────────────────┘

export const COLORS = {
  // Deep Navy · foundation & depth
  navy: {
    0: '#02040A',
    1: '#050914',
    2: '#081020',
    3: '#0B1428',
    elev: '#0F1A32',
  },

  // Gold · primary brand accent
  gold: {
    DEFAULT: '#D4AF37',
    light: '#F0C94A',
    bright: '#FFE58A',
    deep: '#9F7A18',
    glow: 'rgba(212, 175, 55, 0.30)',
    border: 'rgba(212, 175, 55, 0.28)',
    text: '#D4AF37',
  },

  // Electric Blue · secondary technology accent
  blue: {
    DEFAULT: '#2F7BFF',
    light: '#60A5FA',
    bright: '#93C5FD',
    deep: '#1D5FD8',
    glow: 'rgba(47, 123, 255, 0.32)',
    border: 'rgba(47, 123, 255, 0.25)',
    text: '#60A5FA',
  },

  // Text · primary text scale
  ink: {
    0: '#FFFFFF',
    1: '#F0EEE6',
    2: 'rgba(240, 238, 230, 0.78)',
    3: 'rgba(240, 238, 230, 0.52)',
    4: 'rgba(240, 238, 230, 0.34)',
    5: 'rgba(240, 238, 230, 0.16)',
  },

  // Surfaces
  surface: {
    1: 'rgba(255, 255, 255, 0.04)',
    2: 'rgba(255, 255, 255, 0.07)',
    3: 'rgba(255, 255, 255, 0.11)',
    inset: 'rgba(0, 0, 0, 0.35)',
  },

  // Borders
  border: {
    1: 'rgba(255, 255, 255, 0.08)',
    2: 'rgba(255, 255, 255, 0.14)',
    gold: 'rgba(212, 175, 55, 0.28)',
    blue: 'rgba(47, 123, 255, 0.25)',
  },

  // Ambient glows
  ambient: {
    gold: 'rgba(212, 175, 55, 0.14)',
    goldStrong: 'rgba(212, 175, 55, 0.24)',
    blue: 'rgba(47, 123, 255, 0.10)',
    blueStrong: 'rgba(47, 123, 255, 0.18)',
  },

  // Semantic status · cards only · never a brand accent
  status: {
    success: '#00A878',
    successSoft: 'rgba(0, 168, 120, 0.10)',
    successRing: 'rgba(0, 168, 120, 0.34)',
    info: '#2F7BFF',
    infoSoft: 'rgba(47, 123, 255, 0.10)',
    infoRing: 'rgba(47, 123, 255, 0.32)',
  },
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ TYPOGRAPHY                                                      │
// └─────────────────────────────────────────────────────────────────┘

export const FONT_FAMILY = {
  display: "'Outfit', 'Cairo', sans-serif", // English headings
  body: "'Inter', 'Cairo', sans-serif",      // English/Turkish body
  arabic: "'Cairo', sans-serif",             // Arabic
  bebas: "'Bebas Neue', sans-serif",
  serif: "'Fraunces', serif",
} as const

export const FONT_SIZE = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
} as const

export const FONT_WEIGHT = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export const LINE_HEIGHT = {
  none: 1,
  tight: 1.12,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const

export const LETTER_SPACING = {
  tight: '-0.022em',
  normal: '0.005em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.10em',
  eyebrow: '0.32em',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ SPACING                                                         │
// └─────────────────────────────────────────────────────────────────┘

export const SPACING = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  cardPad: '1.25rem',
  cardPadLg: '1.5rem',
  sectionSm: '1.25rem',
  sectionMd: '1.75rem',
  sectionLg: '3rem',
  sectionXl: '5rem',
  section2Xl: '6rem',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ GEOMETRY                                                        │
// └─────────────────────────────────────────────────────────────────┘

export const RADIUS = {
  xs: '0.5rem',
  sm: '0.65rem',
  md: '0.9rem',
  lg: '1.15rem',
  xl: '1.35rem',
  '2xl': '1.6rem',
  pill: '9999px',
  card: '1.35rem', // maps to --radius-xl
} as const

export const BORDER_WIDTH = {
  0: '0',
  1: '1px',
  2: '2px',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ SHADOWS & DEPTH                                                 │
// └─────────────────────────────────────────────────────────────────┘

export const SHADOW = {
  sm: '0 4px 14px rgba(0, 0, 0, 0.40)',
  md: '0 14px 36px rgba(0, 0, 0, 0.45)',
  lg: '0 24px 60px rgba(0, 0, 0, 0.55)',
  xl: '0 40px 90px rgba(0, 0, 0, 0.65)',
  glow: '0 0 26px rgba(212, 175, 55, 0.08)',
  card: 'inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 18px 52px rgba(0, 0, 0, 0.24)',
  cardHover: 'inset 0 1px 0 rgba(255, 255, 255, 0.025), 0 24px 60px rgba(0, 0, 0, 0.36)',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ MOTION                                                          │
// └─────────────────────────────────────────────────────────────────┘

export const EASING = {
  premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
} as const

export const DURATION = {
  fast: '0.22s',
  base: '0.35s',
  slow: '0.55s',
  xslow: '0.85s',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ GRID                                                            │
// └─────────────────────────────────────────────────────────────────┘

export const GRID = {
  gold: 'rgba(212, 175, 55, 0.022)',
  blue: 'rgba(47, 123, 255, 0.018)',
  size: '72px',
  sizeLg: '120px',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ CARD                                                            │
// └─────────────────────────────────────────────────────────────────┘

export const CARD = {
  pad: '1.25rem',
  padLg: '1.5rem',
  radius: '1.35rem',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ BUTTON                                                          │
// └─────────────────────────────────────────────────────────────────┘

export const BUTTON = {
  padX: '1.8rem',
  padY: '0.75rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  radius: '9999px',
} as const

// ┌─────────────────────────────────────────────────────────────────┐
// │ THEME KEYS                                                      │
// └─────────────────────────────────────────────────────────────────┘

export type Theme = 'dark' | 'light'
export const THEMES: Theme[] = ['dark', 'light']
export const DEFAULT_THEME: Theme = 'dark'
