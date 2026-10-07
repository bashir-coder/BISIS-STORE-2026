/// <reference types="vite/client" />

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: Record<string, unknown>) => void
        prompt: (callback?: (notification: Record<string, unknown>) => void) => void
        renderButton: (parent: HTMLElement, options?: Record<string, unknown>) => void
        cancel: () => void
        disableAutoSelect: () => void
      }
    }
  }
}

declare global {
  interface Window {
    __gsi_guarded?: boolean
    __gsi_initialized?: boolean
    __gsi_init_called?: boolean
  }
}
