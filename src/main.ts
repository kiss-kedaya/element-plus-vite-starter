import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { pinia } from './stores'

// 强制禁用夜间模式
document.documentElement.classList.remove('dark')
document.documentElement.classList.add('light')
document.documentElement.setAttribute('data-theme', 'light')
document.body.classList.remove('dark')
document.body.classList.add('light')
document.body.setAttribute('data-theme', 'light')

// 监听并阻止夜间模式切换
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' &&
        (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')) {
      const target = mutation.target as HTMLElement
      if (target.classList.contains('dark')) {
        target.classList.remove('dark')
        target.classList.add('light')
        target.setAttribute('data-theme', 'light')
      }
    }
  })
})

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class', 'data-theme']
})
observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['class', 'data-theme']
})

import './styles/index.scss'
import './styles/theme.scss'
import 'uno.css'
import 'element-plus/theme-chalk/src/message.scss'
import 'element-plus/theme-chalk/src/message-box.scss'
import './styles/element-override.scss'

// 路由配置
const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('./pages/dashboard.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('./pages/login.vue')
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('./pages/chat.vue')
  },
  {
    path: '/friends',
    name: 'Friends',
    component: () => import('./pages/friends.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
