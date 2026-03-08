import type { Directive, DirectiveBinding } from 'vue'

type HeightMode = 'max-height' | 'height'

interface AdaptiveHeightOptions {
  min?: number | string
  bottom?: number | string
  mode?: HeightMode
}

interface ResolvedOptions {
  min?: number
  bottom?: number
  mode: HeightMode
}

interface AdaptiveState {
  rafId: number | null
  resizeObserver: ResizeObserver | null
  onWindowResize: () => void
  onVisualViewportChange: () => void
  options: ResolvedOptions
}

const DEFAULT_MIN = 240
const DEFAULT_BOTTOM = 24
const MIN_BOUND = 0
const states = new WeakMap<HTMLElement, AdaptiveState>()
const CSS_VAR_MIN = '--adaptive-height-min'
const CSS_VAR_BOTTOM = '--adaptive-height-bottom'

function toSafeNumber(value: unknown, fallback?: number): number | undefined {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(n)) return fallback
  return Math.max(MIN_BOUND, n)
}

function resolveOptions(binding: DirectiveBinding<AdaptiveHeightOptions | undefined>): ResolvedOptions {
  const value = binding.value ?? {}
  const mode: HeightMode = value.mode === 'max-height' ? 'max-height' : 'height'
  return {
    min: toSafeNumber(value.min),
    bottom: toSafeNumber(value.bottom),
    mode,
  }
}

function viewportBottom(): number {
  if (typeof window === 'undefined') return 0
  const vv = window.visualViewport
  if (!vv) return window.innerHeight
  return vv.offsetTop + vv.height
}

function applyHeight(el: HTMLElement, options: ResolvedOptions): void {
  const style = getComputedStyle(el)
  const minFromCss = toSafeNumber(style.getPropertyValue(CSS_VAR_MIN), DEFAULT_MIN) ?? DEFAULT_MIN
  const bottomFromCss = toSafeNumber(style.getPropertyValue(CSS_VAR_BOTTOM), DEFAULT_BOTTOM) ?? DEFAULT_BOTTOM
  const resolvedMin = options.min ?? minFromCss
  const resolvedBottom = options.bottom ?? bottomFromCss
  const rect = el.getBoundingClientRect()
  const available = viewportBottom() - rect.top - resolvedBottom
  const resolved = Math.max(resolvedMin, Math.floor(available))
  const value = `${resolved}px`

  el.style.setProperty('--adaptive-table-height', value)
  if (options.mode === 'height') {
    el.style.height = value
    el.style.maxHeight = ''
  } else {
    el.style.maxHeight = value
    el.style.height = ''
  }
}

function schedule(el: HTMLElement): void {
  const state = states.get(el)
  if (!state) return
  if (state.rafId != null) {
    cancelAnimationFrame(state.rafId)
  }
  state.rafId = requestAnimationFrame(() => {
    state.rafId = null
    applyHeight(el, state.options)
  })
}

function bind(el: HTMLElement, binding: DirectiveBinding<AdaptiveHeightOptions | undefined>): void {
  const onWindowResize = () => schedule(el)
  const onVisualViewportChange = () => schedule(el)

  const state: AdaptiveState = {
    rafId: null,
    resizeObserver: null,
    onWindowResize,
    onVisualViewportChange,
    options: resolveOptions(binding),
  }

  states.set(el, state)

  if (typeof ResizeObserver !== 'undefined') {
    state.resizeObserver = new ResizeObserver(() => schedule(el))
    state.resizeObserver.observe(document.body)
    if (el.parentElement) {
      state.resizeObserver.observe(el.parentElement)
    }
  }

  window.addEventListener('resize', onWindowResize, { passive: true })
  window.addEventListener('orientationchange', onWindowResize, { passive: true })

  const vv = window.visualViewport
  if (vv) {
    vv.addEventListener('resize', onVisualViewportChange, { passive: true })
    vv.addEventListener('scroll', onVisualViewportChange, { passive: true })
  }

  schedule(el)
}

function unbind(el: HTMLElement): void {
  const state = states.get(el)
  if (!state) return

  if (state.rafId != null) {
    cancelAnimationFrame(state.rafId)
  }

  window.removeEventListener('resize', state.onWindowResize)
  window.removeEventListener('orientationchange', state.onWindowResize)

  const vv = window.visualViewport
  if (vv) {
    vv.removeEventListener('resize', state.onVisualViewportChange)
    vv.removeEventListener('scroll', state.onVisualViewportChange)
  }

  if (state.resizeObserver) {
    state.resizeObserver.disconnect()
  }

  states.delete(el)
}

export const adaptiveHeightDirective: Directive<HTMLElement, AdaptiveHeightOptions | undefined> = {
  mounted(el, binding) {
    bind(el, binding)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.options = resolveOptions(binding)
    schedule(el)
  },
  unmounted(el) {
    unbind(el)
  },
}
