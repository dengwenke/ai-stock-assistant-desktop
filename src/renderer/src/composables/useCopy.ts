import { ref } from 'vue'

/**
 * 复制到剪贴板组合式函数
 * 提供复制功能和复制状态管理
 */
export function useCopy(timeout = 1500) {
  const copiedText = ref<string | null>(null)
  const copyTimerId = ref<number | null>(null)

  /**
   * 复制文本到剪贴板
   * @param text 要复制的文本
   * @returns 是否复制成功
   */
  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      copiedText.value = text
      
      // 清除之前的定时器
      if (copyTimerId.value !== null) {
        clearTimeout(copyTimerId.value)
      }
      
      // 设置自动重置
      copyTimerId.value = window.setTimeout(() => {
        copiedText.value = null
        copyTimerId.value = null
      }, timeout)
      
      return true
    } catch (err) {
      console.error('复制失败:', err)
      return false
    }
  }

  /**
   * 检查指定文本是否刚被复制
   */
  function isCopied(text: string): boolean {
    return copiedText.value === text
  }

  return {
    copiedText,
    copy,
    isCopied
  }
}

/**
 * 全局共享的复制状态（用于跨组件提示）
 */
const globalCopiedText = ref<string | null>(null)
let globalTimerId: number | null = null

export function useGlobalCopy(timeout = 1500) {
  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      globalCopiedText.value = text
      
      if (globalTimerId !== null) {
        clearTimeout(globalTimerId)
      }
      
      globalTimerId = window.setTimeout(() => {
        globalCopiedText.value = null
        globalTimerId = null
      }, timeout)
      
      return true
    } catch (err) {
      console.error('复制失败:', err)
      return false
    }
  }

  function isCopied(text: string): boolean {
    return globalCopiedText.value === text
  }

  return {
    copiedText: globalCopiedText,
    copy,
    isCopied
  }
}
