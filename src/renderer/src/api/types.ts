/** 与后端 NoticeRecordResDTO 对齐。解析结果在 analysisResult（JSON 字符串）中，由前端解析。 */
export interface NoticeRecord {
  id?: number
  stockCode: string
  stockName: string
  /** 发布时间 */
  publishTime: string
  noticeTitle: string
  /** 公告链接 */
  noticeLink?: string
  /** 行业 */
  industry?: string
  /** 行业2 */
  industry2?: string
  /** T日（交易日）yyyy-MM-dd */
  tDate?: string
  /** T日（后端下划线格式兼容） */
  t_date?: string
  /** T日（后端小写格式兼容） */
  tdate?: string
  /** 公告唯一键 */
  uniqueKey?: string
  /** 状态：PENDING=待执行，DONE=已完成 */
  status?: string
  /** 大模型返回的解析结果 JSON 原文，由前端解析展示 */
  analysisResult?: string
  /** 基本面分数 1-5 */
  scoreFundamental?: number
  scoreNovelty?: number
  scoreBusiness?: number
  scoreElasticity?: number
  /** 受益行业/业务方向 */
  beneficialDirection?: string
  /** 深度报告内容 */
  deepReport?: string
  /** 深度报告生成时间 */
  deepReportTime?: string
  /** 深度报告状态：NONE=未生成，PENDING=已提交待执行，PROCESSING=执行中，DONE=已生成 */
  deepReportStatus?: string
  /** 用户评分 1-5 */
  userRating?: number
  /** 创建时间 */
  createTime?: string
  /** 总市值（亿元） */
  marketCap?: string
  /** T日涨幅（%） */
  pctT?: number
  /** T日涨幅（后端下划线格式兼容） */
  pct_t?: number

  // T日行情指标
  /** T日开盘价 */
  tOpen?: number
  /** T日开盘价（后端下划线格式兼容） */
  t_open?: number
  /** T日收盘价 */
  tClose?: number
  /** T日收盘价（后端下划线格式兼容） */
  t_close?: number
  /** T日最高价 */
  tHigh?: number
  /** T日最高价（后端下划线格式兼容） */
  t_high?: number
  /** T日最低价 */
  tLow?: number
  /** T日最低价（后端下划线格式兼容） */
  t_low?: number
  /** T日成交量 */
  tVolume?: number
  /** T日成交量（后端下划线格式兼容） */
  t_volume?: number

  // TT日指标
  /** TT日（第一个非涨停交易日） */
  ttDate?: string
  /** TT日（后端下划线格式兼容） */
  tt_date?: string
  /** TT日收盘价 */
  ttClose?: number
  /** TT日收盘价（后端下划线格式兼容） */
  tt_close?: number
  /** TT日成交量 */
  ttVolume?: number
  /** TT日成交量（后端下划线格式兼容） */
  tt_volume?: number
  /** TT日100日最大成交量 */
  ttVolMax100d?: number
  /** TT日100日最大成交量（后端下划线格式兼容） */
  tt_vol_max_100d?: number
  /** TT日240日最大成交量 */
  ttVolMax240d?: number
  /** TT日240日最大成交量（后端下划线格式兼容） */
  tt_vol_max_240d?: number
  /** TT日100日异常成交量 0/1 */
  ttVolAnomaly100d?: number
  /** TT日100日异常成交量（后端下划线格式兼容） */
  tt_vol_anomaly_100d?: number
  /** TT日240日异常成交量 0/1 */
  ttVolAnomaly240d?: number
  /** TT日240日异常成交量（后端下划线格式兼容） */
  tt_vol_anomaly_240d?: number
  /** 240日最高涨幅异常 0/1 */
  ttYearHighAnomaly?: number
  /** 240日最高涨幅异常（后端下划线格式兼容） */
  tt_year_high_anomaly?: number

  // 价格衍生指标
  /** 3日均价涨幅（%） */
  avgPrice3dPct?: number
  /** 3日均价涨幅（后端下划线格式兼容） */
  avg_price_3d_pct?: number
  /** 3日均价异常 0/1 */
  avgPrice3dAnomaly?: number
  /** 3日均价异常（后端下划线格式兼容） */
  avg_price_3d_anomaly?: number

  // 技术指标
  /** 240日最高收盘价 */
  yearHighPrice?: number
  /** 240日最高收盘价（后端下划线格式兼容） */
  year_high_price?: number
  /** @deprecated 后端已改名为 ttYearHighAnomaly */
  yearHighAnomaly?: number
  /** @deprecated 后端已改名为 tt_year_high_anomaly */
  year_high_anomaly?: number
  /** 异常分数（0-4） */
  anomalyScore?: number
  /** 公告数量 */
  noticeCount?: number

  // ---- 兼容旧字段（后端已移除，保留兼容） ----
  /** @deprecated 后端已移除，兼容旧代码 */
  score?: number
  /** @deprecated 后端已移除，兼容旧代码 */
  pctT3?: number
  /** @deprecated 后端已移除，兼容旧代码 */
  pctT10?: number
  /** @deprecated 后端已移除，兼容旧代码 */
  trackDateT3?: string
  /** @deprecated 后端已移除，兼容旧代码 */
  trackDateT10?: string
  /** @deprecated 使用 ttClose */
  ttClosePrice?: number
  /** @deprecated 使用 avgPrice3dPct */
  avgPriceChangePct?: number
  /** @deprecated 使用 avgPrice3dAnomaly */
  isAvgPriceAnomaly?: number
  /** @deprecated 使用 ttYearHighAnomaly */
  isYearHigh?: number
  /** @deprecated 使用 ttVolAnomaly100d */
  isVolumeAnomaly100d?: number
  /** @deprecated 使用 ttVolAnomaly240d */
  isVolumeAnomaly240d?: number
}

/** 股票基本信息（行情页展示）。对应后端 StockBasicInfoResDTO。 */
export interface StockBasicInfo {
  stockCode: string
  stockName: string
  market: string
  industry: string
  marketCap: string
  pe: string
  pb: string
}

/** 个股单日历史行情（K 线）。对应后端 StockHistoryItemRes。 */
export interface StockHistoryItem {
  /** 交易日期，yyyy-MM-dd */
  date: string
  /** 开盘 */
  open: number
  /** 最高 */
  high: number
  /** 最低 */
  low: number
  /** 收盘 */
  close: number
  /** 成交量 */
  volume: number
  /** 涨跌幅（百分比） */
  pctChange: number
}

/** 个股日内分时行情（分钟级）。对应后端 IfindIntradayQuoteRes。 */
export interface IntradayQuoteItem {
  /** 时间戳，yyyy-MM-dd HH:mm:ss */
  time: string
  /** 开盘 */
  open: number
  /** 最高 */
  high: number
  /** 最低 */
  low: number
  /** 收盘 */
  close: number
  /** 成交量 */
  volume: number
  /** 成交额 */
  amount: number
}

/** 解析后的分析结果（与 PROMPT 输出 JSON 字段一致） */
export interface AnalysisResultJson {
  行业?: string
  公告核心新催化?: string
  基本面边际变化?: string
  '股价正反馈的核心矛盾'?: string
  成长逻辑验证?: string
  投资看点?: string
  风险提示?: string
  '受益行业/业务方向'?: string
  评分_基本面?: number
  评分_逻辑新颖?: number
  评分_商业模式竞争力?: number
  评分_弹性确定性?: number
}

/** 上传 Excel 结果 */
export interface UploadResultVO {
  message: string
  addedCount: number
  totalFiles?: number
  successFiles?: number
  failedFiles?: number
  fileDetails?: FileUploadDetail[]
}

/** 单个文件上传详情 */
export interface FileUploadDetail {
  filename: string
  success: boolean
  addedCount: number
  errorMessage?: string
}

/** 上传预览结果 */
export interface UploadPreviewVO {
  batchId: string
  totalFiles: number
  fileDetails: FilePreviewDetail[]
  totalParsedCount: number
  totalNewCount: number
}

/** 单个文件预览详情 */
export interface FilePreviewDetail {
  filename: string
  success: boolean
  parsedCount: number
  newCount: number
  duplicateCount: number
  errorMessage?: string
  preview?: NoticeRecord[]
  parseErrors?: string[]
}

/** iFinD 公告同步结果：本次拉取条数与新增入库条数 */
export interface NoticeSyncResultVO {
  fetched: number
  added: number
}

/** 公告原文查询结果 */
export interface NoticeOriginalRecord {
  id: number
  textid: number
  secname: string
  recid: number
  f001d: string
  rectime: string
  seccode: string
  f005n: number
  objectid: number
  f009v: string
  f008v: string
  f007v: string
  f006v: string
  f004v: string
  f003v: string
  f002v: string
  f010v: string
  stockCode: string
  publishTime: string
  noticeTitle: string
  noticeLink: string
  categoryCode: string
  createTime: string
  updateTime: string
}

/** 实时行情 */
export interface SpotQuote {
  stockCode: string
  stockName: string
  currentPrice: number
  pctChange: number
  change: number
  open: number
  high: number
  low: number
  preClose: number
  volume: number
  amount: number
  updateTime: string
}

/** 当日看盘数据（新接口格式 - PageResultResDTO<NoticeWithIndicatorsVO>） */
export interface TodayWatchData {
  /** 记录列表 */
  records?: NoticeWithIndicatorsVO[]
  /** 记录列表（兼容字段） */
  list?: NoticeWithIndicatorsVO[]
  /** 总记录数 */
  total?: number
  /** 总页数 */
  pages?: number
  /** 每页大小 */
  size?: number
  /** 当前页码 */
  current?: number
  /** 交易日 */
  tradingDay?: string
  /** 更新时间 */
  updateTime?: string

  // 兼容旧格式
  totalCount?: number
  notices?: NoticeRecord[]
  page?: number
}

/** 公告+指标VO（当日看盘主数据类型） */
export interface NoticeWithIndicatorsVO {
  /** 指标记录ID */
  id?: number
  /** 证券代码 */
  stockCode: string
  /** 证券简称 */
  stockName: string
  /** 行业 */
  industry?: string
  /** 市值（亿元） */
  marketCap?: number

  // T日行情
  /** T日 */
  tDate?: string
  /** T日开盘价 */
  tOpen?: number
  /** T日收盘价 */
  tClose?: number
  /** T日最高价 */
  tHigh?: number
  /** T日最低价 */
  tLow?: number
  /** T日成交量 */
  tVolume?: number
  /** T日涨幅（%） */
  tPctChg?: number

  // TT日指标
  /** TT日 */
  ttDate?: string
  /** TT日收盘价 */
  ttClose?: number
  /** TT日成交量 */
  ttVolume?: number
  /** TT日100日最大成交量 */
  ttVolMax100d?: number
  /** TT日240日最大成交量 */
  ttVolMax240d?: number
  /** TT日100日异常成交量 */
  ttVolAnomaly100d?: number
  /** TT日240日异常成交量 */
  ttVolAnomaly240d?: number
  /** 240日最高涨幅异常 */
  ttYearHighAnomaly?: number
  /** 240日最高涨幅异常（后端下划线格式兼容） */
  tt_year_high_anomaly?: number

  // T3日指标
  /** T3日 */
  t3Date?: string
  /** T3日收盘价 */
  t3Close?: number
  /** T3日涨幅（%） */
  t3Pct?: number

  // 均价指标
  /** 3日前3日平均价 */
  avgPrice3dBefore?: number
  /** 3日后3日平均价 */
  avgPrice3dAfter?: number
  /** 3日平均价涨幅（%） */
  avgPrice3dPct?: number
  /** 3日平均价异常 */
  avgPrice3dAnomaly?: number

  // 综合指标
  /** 异常分数（0-4） */
  anomalyScore?: number

  /** 公告列表 */
  notices?: NoticeRecord[]
}

/** EMA 追踪项：一周内回踩 M120 附近的股票 */
export interface EmaTrackerItem {
  stockCode: string
  stockName: string
  market: 'A' | 'H' | 'U'
  tradeDate: string
  closePrice: number
  ema120: number
  deviationPct: number
}

/** EMA 追踪分页结果 */
export interface EmaTrackerData {
  list: EmaTrackerItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface LlmLogItem {
  id: number
  prompt: string
  rawResponse: string
  source: string
  accountName: string
  requestType: string
  requestKey: string
  createTime: string
}

/** 后端成功码，与后端 ApiCodeConstants.CODE_SUCCESS 一致 */
export const API_CODE_SUCCESS = '0'

/** 后端统一返回 DTO：通过 code 表示成功（API_CODE_SUCCESS），失败时 code 为错误码、message 为说明 */
export interface ApiResult<T = unknown> {
  code: string
  message?: string
  data?: T
}

/** 后端错误体（code !== API_CODE_SUCCESS 或异常时 response.data） */
export interface ApiErrorResponse {
  code?: string
  message?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
}

export interface TradeCalendarItem {
  calDate: string
  isOpen: number
  holidayName?: string
}

export interface StockTechIndicator {
  tradeDate: string
  dif?: number
  dea?: number
  macd?: number
  kdjK?: number
  kdjD?: number
  kdjJ?: number
  bollUpper?: number
  bollMiddle?: number
  bollLower?: number
  rsi6?: number
  rsi12?: number
  rsi24?: number
  wr6?: number
  wr10?: number
  cci?: number
  bias6?: number
  bias12?: number
  bias24?: number
  psa?: number
  psma?: number
  roc?: number
  rocma?: number
  dmiPdi?: number
  dmiMdi?: number
  dmiAdx?: number
  dmiAdxr?: number
  cr?: number
  ema5?: number
  ema10?: number
  ema13?: number
  ema20?: number
  ema30?: number
  ema34?: number
  ema60?: number
  ema120?: number
  ma5?: number
  ma10?: number
  ma20?: number
  ma30?: number
  ma60?: number
}
