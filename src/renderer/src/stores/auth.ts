import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin } from '@/api/client'
import type { LoginRequest } from '@/api/types'
import { STORAGE_KEYS } from '@/constants'
import { getDesktopApi } from '@/platform/desktop/bridge'
import { isDesktopRuntime } from '@/platform/runtime'

const TOKEN_KEY = STORAGE_KEYS.TOKEN
const USERNAME_KEY = STORAGE_KEYS.USERNAME

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const username = ref<string | null>(localStorage.getItem(USERNAME_KEY))

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(t: string, u: string) {
    token.value = t
    username.value = u
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USERNAME_KEY, u)
    if (isDesktopRuntime()) {
      void getDesktopApi().settings.setAuthToken(t)
    }
  }

  function clearAuth() {
    token.value = null
    username.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    if (isDesktopRuntime()) {
      void getDesktopApi().settings.setAuthToken(null)
    }
  }

  function initFromStorage() {
    const t = localStorage.getItem(TOKEN_KEY)
    const u = localStorage.getItem(USERNAME_KEY)
    if (t) token.value = t
    if (u) username.value = u
    if (isDesktopRuntime()) {
      void getDesktopApi().settings.setAuthToken(t)
    }
  }

  async function login(req: LoginRequest) {
    const res = await apiLogin(req)
    setAuth(res.token, res.username)
  }

  return {
    token,
    username,
    isLoggedIn,
    setAuth,
    clearAuth,
    initFromStorage,
    login,
  }
})
