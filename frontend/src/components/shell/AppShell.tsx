import React from 'react'
import BisisWebGL from '../../visual/BisisWebGL'

interface AppShellProps {
  navigation: React.ReactNode
  children: React.ReactNode
  globalUI: React.ReactNode
  overlays?: React.ReactNode
  dir?: string
}

const AppShell: React.FC<AppShellProps> = ({ navigation, children, globalUI, overlays, dir }) => {
  return (
    <div className="relative min-h-screen text-ink-0" dir={dir}>
      {/* Background Layer — one persistent WebGL scene for the whole app.
          Mounted here, outside <main> and outside any motion.div, so route
          changes never recreate the renderer. */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <BisisWebGL className="z-0" intensity="medium" />
        <div className="grid-pattern" />
        <div className="grain-layer" />
      </div>

      {/* Navigation Layer */}
      {navigation}

      {/* Content Layer */}
      <main className="relative z-10">
        {children}
      </main>

      {/* Global UI Layer */}
      {globalUI}

      {/* Overlay Layer */}
      {overlays && (
        <div className="relative z-50">
          {overlays}
        </div>
      )}
    </div>
  )
}

AppShell.displayName = 'AppShell'

export default AppShell
