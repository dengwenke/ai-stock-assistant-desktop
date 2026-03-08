/**
 * 应用级常量：Storage 键、路由名、API 等。
 * 便于统一修改与 Tree-shaking。
 */

/** localStorage 键名 */
export const STORAGE_KEYS = {
  TOKEN: 'stock_assistant_token',
  USERNAME: 'stock_assistant_username',
  THEME: 'stock_assistant_theme',
  PRICE_COLOR_MODE: 'stock_assistant_price_color_mode',
  TODAY_WATCH_DATE: 'stock_assistant_today_watch_date',
} as const

/** 路由 name（与 router 中 name 一致，用于编程式导航与权限） */
export const ROUTE_NAMES = {
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  ANNOUNCEMENTS: 'announcements',
  STOCK_QUOTE: 'stock-quote',
  ANALYSIS_DETAIL: 'analysis-detail',
} as const

/** API 基础路径（与 vite proxy / nginx 一致） */
export const API_BASE = '/api'
