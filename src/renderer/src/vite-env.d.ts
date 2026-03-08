/// <reference types="vite/client" />
import type { DesktopBridgeApi } from '@shared/desktop-api'

interface ImportMetaEnv {
  readonly VITE_REMOTE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    desktopApp?: DesktopBridgeApi
  }
}

export {}
