/**
 * 数据缓存工具 - 支持内存缓存和 localStorage 持久化
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class DataCache {
  private memoryCache = new Map<string, CacheEntry<any>>()
  private readonly storageKey = 'stock_assistant_cache'

  /**
   * 生成缓存键
   */
  static generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    return `${prefix}:${sortedParams}`
  }

  /**
   * 从缓存获取数据
   */
  get<T>(key: string): T | null {
    // 先检查内存缓存
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.data as T
    }

    // 再检查 localStorage
    try {
      const stored = localStorage.getItem(`${this.storageKey}:${key}`)
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored)
        if (!this.isExpired(entry)) {
          // 同步到内存缓存
          this.memoryCache.set(key, entry)
          return entry.data
        }
        // 过期则删除
        localStorage.removeItem(`${this.storageKey}:${key}`)
      }
    } catch {
      // 解析失败，忽略
    }

    return null
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }

    // 存入内存缓存
    this.memoryCache.set(key, entry)

    // 存入 localStorage（仅存储非大数据量内容）
    try {
      const serialized = JSON.stringify(entry)
      // 限制单条缓存大小不超过 1MB
      if (serialized.length < 1024 * 1024) {
        localStorage.setItem(`${this.storageKey}:${key}`, serialized)
      }
    } catch {
      // 存储失败（如容量不足），仅保留内存缓存
    }
  }

  /**
   * 清除缓存
   * @param pattern 可选，匹配模式（字符串包含匹配）
   */
  clear(pattern?: string): void {
    if (pattern) {
      // 清除匹配的内存缓存
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key)
        }
      }

      // 清除匹配的 localStorage
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key?.startsWith(`${this.storageKey}:`) && key.includes(pattern)) {
            localStorage.removeItem(key)
          }
        }
      } catch {
        // 忽略错误
      }
    } else {
      // 清除所有缓存
      this.memoryCache.clear()
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key?.startsWith(`${this.storageKey}:`)) {
            localStorage.removeItem(key)
          }
        }
      } catch {
        // 忽略错误
      }
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }
}

// 导出单例实例
export const dataCache = new DataCache()

// 缓存键前缀
export const CACHE_KEYS = {
  STOCK_HISTORY: 'stock:history',
  STOCK_INDICATOR: 'stock:indicator',
  STOCK_INFO: 'stock:info',
  NOTICE_LIST: 'notice:list',
  NOTICE_DETAIL: 'notice:detail',
}

// 缓存时间（毫秒）
export const CACHE_TTL = {
  STOCK_HISTORY: 30 * 60 * 1000, // 30分钟
  STOCK_INDICATOR: 30 * 60 * 1000, // 30分钟
  STOCK_INFO: 60 * 60 * 1000, // 1小时
  NOTICE_LIST: 5 * 60 * 1000, // 5分钟
  NOTICE_DETAIL: 10 * 60 * 1000, // 10分钟
}
