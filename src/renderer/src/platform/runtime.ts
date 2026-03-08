export function isDesktopRuntime() {
  return typeof window !== 'undefined' && typeof window.desktopApp !== 'undefined'
}

export function getRemoteApiBase() {
  return import.meta.env.VITE_REMOTE_API_BASE || 'http://127.0.0.1:8000/api'
}

export function getCurrentRoutePath() {
  if (!isDesktopRuntime()) return window.location.pathname
  const hash = window.location.hash.replace(/^#/, '')
  return hash || '/'
}

export function redirectToLogin(fromPath: string) {
  if (isDesktopRuntime()) {
    window.location.hash = `/login?from=${encodeURIComponent(fromPath)}`
    return
  }
  window.location.href = '/login?from=' + encodeURIComponent(fromPath)
}
