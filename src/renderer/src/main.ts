import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElButton, ElInputNumber, ElPopover, ElRate, ElSlider, ElTag } from 'element-plus'
import App from './App.vue'
import router from './router'
import { adaptiveHeightDirective } from './directives/adaptiveHeight'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/popover/style/css'
import 'element-plus/es/components/rate/style/css'
import 'element-plus/es/components/slider/style/css'
import 'element-plus/es/components/tag/style/css'
import './styles/index.css'
import './styles/element-vars.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.component('ElButton', ElButton)
app.component('ElInputNumber', ElInputNumber)
app.component('ElPopover', ElPopover)
app.component('ElRate', ElRate)
app.component('ElSlider', ElSlider)
app.component('ElTag', ElTag)
app.directive('adaptive-height', adaptiveHeightDirective)
app.mount('#app')
