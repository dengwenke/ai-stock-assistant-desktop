/**
 * Vue 3 组合式函数：可在多个组件/页面复用的有状态逻辑。
 * 命名以 use 开头，如 usePagination、useTableSort。
 * 与 stores 区别：composables 无全局单例，按实例复用；stores 为全局状态。
 */

export { useCopy, useGlobalCopy } from './useCopy'
export { useStockData } from './useStockData'
