/**
 * 公告原文链接规范化：
 * - 去除首尾空白
 * - 将 http 协议升级为 https，避免 https 页面内嵌 iframe 时触发 Mixed Content
 */
export function normalizeNoticeLink(link?: string | null): string {
  if (typeof link !== 'string') return ''
  const trimmed = link.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:'
    }
    return parsed.toString()
  } catch {
    return trimmed.replace(/^http:\/\//i, 'https://')
  }
}
