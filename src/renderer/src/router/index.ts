import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isDesktopRuntime } from '@/platform/runtime'

const router = createRouter({
  history: isDesktopRuntime() ? createWebHashHistory(import.meta.env.BASE_URL) : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      name: 'today-watch',
      component: () => import('@/views/TodayWatchView.vue'),
      meta: { title: '当日看盘' },
    },
    {
      path: '/announcements',
      name: 'announcements',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '公告分析' },
    },
    {
      path: '/ema-tracker',
      name: 'ema-tracker',
      component: () => import('@/views/EmaTrackerView.vue'),
      meta: { title: 'EMA指标追踪' },
    },
    {
      path: '/stock/:stockCode',
      name: 'stock-detail',
      component: () => import('@/views/StockDetailView.vue'),
      meta: { title: '股票详情' },
    },
    {
      path: '/stock/:stockCode/quote',
      name: 'stock-quote',
      component: () => import('@/views/StockQuoteView.vue'),
      meta: { title: '股票行情' },
    },
    {
      path: '/analysis/:id',
      name: 'analysis-detail',
      component: () => import('@/views/AnalysisDetailView.vue'),
      meta: { title: '解析详情' },
    },
    {
      path: '/desktop/data',
      name: 'desktop-data',
      component: () => import('@/views/DesktopDataView.vue'),
      meta: { title: '本地数据' },
    },
    {
      path: '/trade-calendar',
      redirect: '/',
    },
    {
      path: '/notice-original',
      name: 'notice-original',
      component: () => import('@/views/NoticeOriginalView.vue'),
      meta: { title: '公告原文' },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  auth.initFromStorage()
  const isPublic = (to.meta?.public as boolean) === true
  if (isPublic) {
    if (auth.isLoggedIn && to.name === 'login') {
      next({ path: '/' })
    } else {
      next()
    }
    return
  }
  if (!auth.isLoggedIn) {
    next({ name: 'login', query: to.path !== '/' ? { from: to.fullPath } : undefined })
  } else {
    next()
  }
})

router.afterEach((to) => {
  const title = (to.meta?.title as string) || '公告助手'
  document.title = title ? `${title} · 公告助手` : '公告助手'
})

export default router
