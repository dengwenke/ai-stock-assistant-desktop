import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 全局错误弹窗状态，供 API 响应错误时展示（登录页、上传区等已在页面直接展示的除外）。
 */
export const useGlobalErrorStore = defineStore('globalError', () => {
  const message = ref('')
  const visible = ref(false)

  function show(msg: string) {
    message.value = msg
    visible.value = true
  }

  function close() {
    visible.value = false
    message.value = ''
  }

  return { message, visible, show, close }
})
