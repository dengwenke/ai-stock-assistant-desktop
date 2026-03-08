import type { DesktopBridgeApi } from '@shared/desktop-api'

export function getDesktopApi(): DesktopBridgeApi {
  if (!window.desktopApp) {
    throw new Error('Desktop bridge is unavailable in current runtime')
  }
  return window.desktopApp
}
