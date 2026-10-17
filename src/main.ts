import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { Buffer } from 'buffer'
import { vReveal } from './directives/reveal'

window.Buffer = Buffer

const app = createApp(App)

app.use(router)
app.directive('reveal', vReveal)
app.mount('#app')
