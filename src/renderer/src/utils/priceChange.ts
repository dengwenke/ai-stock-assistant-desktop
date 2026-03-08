/**
 * 涨跌幅计算工具
 * 提供标准化的涨跌幅计算方法
 */

export interface PriceChangeData {
  /** 基准价格 */
  basePrice: number
  /** 当前价格 */
  currentPrice: number
  /** 时间周期描述 */
  period?: string
}

export interface PriceChangeResult {
  /** 涨跌幅百分比 */
  percentage: number
  /** 涨跌额 */
  amount: number
  /** 是否上涨 */
  isUp: boolean
  /** 格式化后的涨跌幅字符串 */
  formatted: string
  /** 格式化后的涨跌额字符串 */
  formattedAmount: string
}

/**
 * 计算涨跌幅
 * @param data 价格数据
 * @returns 涨跌幅结果
 */
export function calculatePriceChange(data: PriceChangeData): PriceChangeResult {
  const { basePrice, currentPrice } = data

  // 异常值处理
  if (!isValidPrice(basePrice) || !isValidPrice(currentPrice)) {
    return {
      percentage: 0,
      amount: 0,
      isUp: false,
      formatted: '-',
      formattedAmount: '-',
    }
  }

  // 计算涨跌额
  const amount = currentPrice - basePrice

  // 计算涨跌幅百分比
  const percentage = (amount / basePrice) * 100

  // 判断是否上涨
  const isUp = amount >= 0

  return {
    percentage: roundTo(percentage, 2),
    amount: roundTo(amount, 2),
    isUp,
    formatted: formatPercentage(percentage),
    formattedAmount: formatAmount(amount),
  }
}

/**
 * 验证价格是否有效
 * @param price 价格
 * @returns 是否有效
 */
function isValidPrice(price: number | null | undefined): boolean {
  if (price === null || price === undefined) return false
  if (typeof price !== 'number') return false
  if (isNaN(price)) return false
  if (price <= 0) return false
  if (!isFinite(price)) return false
  return true
}

/**
 * 四舍五入到指定小数位
 * @param value 数值
 * @param decimals 小数位数
 * @returns 四舍五入后的值
 */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * 格式化百分比
 * @param percentage 百分比数值
 * @returns 格式化后的字符串
 */
function formatPercentage(percentage: number): string {
  const sign = percentage >= 0 ? '+' : ''
  return `${sign}${percentage.toFixed(2)}%`
}

/**
 * 格式化涨跌额
 * @param amount 涨跌额
 * @returns 格式化后的字符串
 */
function formatAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : ''
  return `${sign}${amount.toFixed(2)}`
}

/**
 * 计算公告效应涨跌幅（公告发布后到当前）
 * @param noticeClose 公告日收盘价
 * @param currentClose 当前收盘价
 * @returns 涨跌幅结果
 */
export function calculateNoticeEffect(
  noticeClose: number,
  currentClose: number
): PriceChangeResult {
  return calculatePriceChange({
    basePrice: noticeClose,
    currentPrice: currentClose,
    period: '公告后',
  })
}

/**
 * 计算多日累计涨跌幅
 * @param dailyChanges 每日涨跌幅数组
 * @returns 累计涨跌幅
 */
export function calculateCumulativeChange(dailyChanges: number[]): number {
  if (!dailyChanges || dailyChanges.length === 0) return 0

  // 使用复利计算: (1+r1)*(1+r2)*... - 1
  let cumulative = 1
  for (const change of dailyChanges) {
    cumulative *= (1 + change / 100)
  }

  return roundTo((cumulative - 1) * 100, 2)
}

/**
 * 计算加权平均涨跌幅
 * @param changes 涨跌幅数组
 * @param weights 权重数组
 * @returns 加权平均涨跌幅
 */
export function calculateWeightedChange(
  changes: number[],
  weights: number[]
): number {
  if (!changes || !weights || changes.length !== weights.length) return 0
  if (changes.length === 0) return 0

  let totalWeight = 0
  let weightedSum = 0

  for (let i = 0; i < changes.length; i++) {
    const weight = weights[i] || 0
    totalWeight += weight
    weightedSum += changes[i] * weight
  }

  if (totalWeight === 0) return 0

  return roundTo(weightedSum / totalWeight, 2)
}

/**
 * 涨跌幅颜色判断
 * @param percentage 涨跌幅
 * @returns 颜色值
 */
export function getChangeColor(percentage: number): 'up' | 'down' | 'neutral' {
  if (percentage > 0) return 'up'
  if (percentage < 0) return 'down'
  return 'neutral'
}

/**
 * 涨跌幅强度判断
 * @param percentage 涨跌幅
 * @returns 强度等级
 */
export function getChangeIntensity(percentage: number): 'weak' | 'moderate' | 'strong' | 'extreme' {
  const absPercentage = Math.abs(percentage)
  if (absPercentage < 1) return 'weak'
  if (absPercentage < 5) return 'moderate'
  if (absPercentage < 10) return 'strong'
  return 'extreme'
}
