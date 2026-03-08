import * as echarts from 'echarts/core'
import { LineChart, BarChart, CandlestickChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  TitleComponent,
  AxisPointerComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  CandlestickChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  TitleComponent,
  AxisPointerComponent,
  CanvasRenderer,
])

export { echarts }
