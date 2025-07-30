import axios from 'axios'
import type { ApiResponse } from '@/types'

// 创建axios实例
export const api = axios.create({
  baseURL: 'http://localhost:8059/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加token等认证信息
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('API请求错误:', error)
    
    // 统一错误处理
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 400:
          console.error('请求参数错误')
          break
        case 401:
          console.error('未授权访问')
          break
        case 403:
          console.error('禁止访问')
          break
        case 404:
          console.error('接口不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          console.error(`请求失败: ${status}`)
      }
      
      return Promise.reject(data || error.response)
    } else if (error.request) {
      console.error('网络连接错误')
      return Promise.reject(new Error('网络连接错误'))
    } else {
      console.error('请求配置错误:', error.message)
      return Promise.reject(error)
    }
  }
)

export * from './auth'
export * from './chat'
export * from './friend'
