/**
 * 纯函数工具：格式化、校验、通用逻辑。
 * 不依赖 Vue、router、api，便于单测与复用。
 */

/**
 * 将日期字符串格式化为显示用（如 yyyy-MM-dd HH:mm → MM-dd HH:mm）
 */
export function formatDateTimeDisplay(value: string | undefined | null): string {
  if (value == null || value === '') return '—'
  return value
}

/**
 * 安全解析 JSON，解析失败返回 null
 */
export function safeParseJson<T = unknown>(raw: string | undefined | null): T | null {
  if (raw == null || raw === '') return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
