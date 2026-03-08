/**
 * 涨跌幅计算工具测试
 */

import {
  calculatePriceChange,
  calculateNoticeEffect,
  calculateCumulativeChange,
  calculateWeightedChange,
  getChangeColor,
  getChangeIntensity,
} from './priceChange'

describe('涨跌幅计算工具', () => {
  describe('calculatePriceChange', () => {
    it('正常上涨情况', () => {
      const result = calculatePriceChange({
        basePrice: 100,
        currentPrice: 105,
      })
      expect(result.percentage).toBe(5)
      expect(result.amount).toBe(5)
      expect(result.isUp).toBe(true)
      expect(result.formatted).toBe('+5.00%')
    })

    it('正常下跌情况', () => {
      const result = calculatePriceChange({
        basePrice: 100,
        currentPrice: 95,
      })
      expect(result.percentage).toBe(-5)
      expect(result.amount).toBe(-5)
      expect(result.isUp).toBe(false)
      expect(result.formatted).toBe('-5.00%')
    })

    it('价格不变情况', () => {
      const result = calculatePriceChange({
        basePrice: 100,
        currentPrice: 100,
      })
      expect(result.percentage).toBe(0)
      expect(result.amount).toBe(0)
      expect(result.isUp).toBe(true)
      expect(result.formatted).toBe('+0.00%')
    })

    it('异常值处理 - 基准价格为0', () => {
      const result = calculatePriceChange({
        basePrice: 0,
        currentPrice: 100,
      })
      expect(result.formatted).toBe('-')
    })

    it('异常值处理 - 价格为负数', () => {
      const result = calculatePriceChange({
        basePrice: -100,
        currentPrice: 100,
      })
      expect(result.formatted).toBe('-')
    })

    it('异常值处理 - 价格为null', () => {
      const result = calculatePriceChange({
        basePrice: null as any,
        currentPrice: 100,
      })
      expect(result.formatted).toBe('-')
    })

    it('异常值处理 - 价格为undefined', () => {
      const result = calculatePriceChange({
        basePrice: undefined as any,
        currentPrice: 100,
      })
      expect(result.formatted).toBe('-')
    })

    it('异常值处理 - 价格为NaN', () => {
      const result = calculatePriceChange({
        basePrice: NaN,
        currentPrice: 100,
      })
      expect(result.formatted).toBe('-')
    })

    it('异常值处理 - 价格为Infinity', () => {
      const result = calculatePriceChange({
        basePrice: Infinity,
        currentPrice: 100,
      })
      expect(result.formatted).toBe('-')
    })

    it('剧烈波动情况 - 涨停', () => {
      const result = calculatePriceChange({
        basePrice: 100,
        currentPrice: 110,
      })
      expect(result.percentage).toBe(10)
      expect(result.formatted).toBe('+10.00%')
    })

    it('剧烈波动情况 - 跌停', () => {
      const result = calculatePriceChange({
        basePrice: 100,
        currentPrice: 90,
      })
      expect(result.percentage).toBe(-10)
      expect(result.formatted).toBe('-10.00%')
    })

    it('小数精度处理', () => {
      const result = calculatePriceChange({
        basePrice: 100.555,
        currentPrice: 105.678,
      })
      expect(result.percentage).toBe(5.09)
      expect(result.amount).toBe(5.12)
    })
  })

  describe('calculateNoticeEffect', () => {
    it('公告后上涨', () => {
      const result = calculateNoticeEffect(100, 108)
      expect(result.percentage).toBe(8)
      expect(result.formatted).toBe('+8.00%')
    })

    it('公告后下跌', () => {
      const result = calculateNoticeEffect(100, 92)
      expect(result.percentage).toBe(-8)
      expect(result.formatted).toBe('-8.00%')
    })
  })

  describe('calculateCumulativeChange', () => {
    it('多日累计涨幅', () => {
      // (1+0.05)*(1+0.03)*(1+0.02) - 1 = 10.31%
      const result = calculateCumulativeChange([5, 3, 2])
      expect(result).toBe(10.31)
    })

    it('多日累计跌幅', () => {
      // (1-0.05)*(1-0.03)*(1-0.02) - 1 = -9.69%
      const result = calculateCumulativeChange([-5, -3, -2])
      expect(result).toBe(-9.69)
    })

    it('空数组', () => {
      const result = calculateCumulativeChange([])
      expect(result).toBe(0)
    })

    it('单日复利', () => {
      const result = calculateCumulativeChange([10])
      expect(result).toBe(10)
    })
  })

  describe('calculateWeightedChange', () => {
    it('加权平均涨幅', () => {
      const result = calculateWeightedChange([5, 3, 2], [0.5, 0.3, 0.2])
      // 5*0.5 + 3*0.3 + 2*0.2 = 3.8
      expect(result).toBe(3.8)
    })

    it('等权重', () => {
      const result = calculateWeightedChange([5, 3, 2], [1, 1, 1])
      // (5+3+2)/3 = 3.33
      expect(result).toBe(3.33)
    })

    it('数组长度不匹配', () => {
      const result = calculateWeightedChange([5, 3], [0.5, 0.3, 0.2])
      expect(result).toBe(0)
    })

    it('空数组', () => {
      const result = calculateWeightedChange([], [])
      expect(result).toBe(0)
    })
  })

  describe('getChangeColor', () => {
    it('上涨', () => {
      expect(getChangeColor(5)).toBe('up')
    })

    it('下跌', () => {
      expect(getChangeColor(-5)).toBe('down')
    })

    it('持平', () => {
      expect(getChangeColor(0)).toBe('neutral')
    })
  })

  describe('getChangeIntensity', () => {
    it('微弱波动', () => {
      expect(getChangeIntensity(0.5)).toBe('weak')
      expect(getChangeIntensity(-0.5)).toBe('weak')
    })

    it('中等波动', () => {
      expect(getChangeIntensity(3)).toBe('moderate')
      expect(getChangeIntensity(-3)).toBe('moderate')
    })

    it('强烈波动', () => {
      expect(getChangeIntensity(7)).toBe('strong')
      expect(getChangeIntensity(-7)).toBe('strong')
    })

    it('极端波动', () => {
      expect(getChangeIntensity(15)).toBe('extreme')
      expect(getChangeIntensity(-15)).toBe('extreme')
    })
  })
})
