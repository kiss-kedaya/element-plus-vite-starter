import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { pinia } from './stores'
import { cleanOldAccountBasedCache } from '@/utils/fileCache'
import { initPresetFileCache } from '@/utils/presetFileCache'
// 暂时注释掉懒加载相关导入，避免启动错误
// import { lazy, lazyContainer } from './directives/lazy'
// import { componentPreloader, smartPreloader } from './utils/lazyLoad'

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

// 暂时注释掉全局指令注册
// app.directive('lazy', lazy)
// app.directive('lazy-container', lazyContainer)

// 清理旧的文件缓存
cleanOldAccountBasedCache()

app.use(pinia)
app.use(router)

app.mount('#app')

// 初始化预置文件缓存
try {
  initPresetFileCache()
  console.log('预置文件缓存初始化完成')
} catch (error) {
  console.error('预置文件缓存初始化失败:', error)
}

// 暂时注释掉智能预加载
// setTimeout(() => {
//   try {
//     smartPreloader.smartPreload({
//       Dashboard: () => import('./pages/dashboard.vue'),
//       ChatInterface: () => import('./components/ChatInterface.vue'),
//       FriendManagement: () => import('./components/FriendManagement.vue')
//     })
//   } catch (error) {
//     console.warn('智能预加载失败:', error)
//   }
// }, 3000)
