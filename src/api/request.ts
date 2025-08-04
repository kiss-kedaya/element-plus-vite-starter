import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '../types/index'

// 响应数据接口 - 移除重复定义，使用 @/types 中的定义

// 分页参数接口
export interface PaginationParams {
  page: number
  pageSize: number
  total?: number
}

// 分页响应接口
export interface ListResponse<T> {
  list: T[]
  pagination: PaginationParams
}

// 请求配置接口
export interface RequestConfig extends AxiosRequestConfig {
  showError?: boolean
  showLoading?: boolean
  timeout?: number
}

class ApiRequest {
  private instance: AxiosInstance
  private baseURL: string
  private timeout: number

  constructor() {
    this.baseURL = 'http://localhost:8059/api'
    this.timeout = 10000
    
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        // 添加时间戳防止缓存
        if (config.method === 'get') {
          config.params = {
            ...config.params,
            _t: Date.now()
          }
        }

        // 添加认证token（如果有的话）
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        return config
      },
      (error) => {
        console.error('Request interceptor error:', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>): AxiosResponse<ApiResponse> | Promise<never> => {
        const { data } = response
        
        // 如果是文件下载等特殊响应，直接返回
        if (response.config.responseType === 'blob') {
          return response
        }

        // 检查业务状态码
        if (data.Success === false) {
          const errorMessage = data.Message || '请求失败'
          console.error('API Error:', errorMessage)
          
          // 根据错误码进行特殊处理
          if (data.Code === 401) {
            // 未授权，清除token并跳转登录
            localStorage.removeItem('auth_token')
            window.location.href = '/login'
            return Promise.reject(new Error('未授权访问'))
          }
          
          return Promise.reject(new Error(errorMessage))
        }

        return response
      },
      (error) => {
        console.error('Response interceptor error:', error)
        
        let errorMessage = '网络请求失败'
        
        if (error.response) {
          // 服务器响应了错误状态码
          const { status, data } = error.response
          
          switch (status) {
            case 400:
              errorMessage = data?.message || '请求参数错误'
              break
            case 401:
              errorMessage = '未授权访问'
              localStorage.removeItem('auth_token')
              window.location.href = '/login'
              break
            case 403:
              errorMessage = '禁止访问'
              break
            case 404:
              errorMessage = '请求的资源不存在'
              break
            case 500:
              errorMessage = '服务器内部错误'
              break
            case 502:
              errorMessage = '网关错误'
              break
            case 503:
              errorMessage = '服务不可用'
              break
            default:
              errorMessage = data?.message || `请求失败 (${status})`
          }
        } else if (error.request) {
          // 请求已发出但没有收到响应
          if (error.code === 'ECONNABORTED') {
            errorMessage = '请求超时，请稍后重试'
          } else {
            errorMessage = '网络连接异常，请检查网络设置'
          }
        }

        return Promise.reject(new Error(errorMessage))
      }
    )
  }

  // GET 请求
  async get<T = any>(url: string, params?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.get(url, {
        params,
        ...config
      })
      return response.data as ApiResponse<T>
    } catch (error: unknown) {
      if (config?.showError !== false) {
        ElMessage.error((error as Error).message)
      }
      throw error
    }
  }

  // POST 请求
  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.post(url, data, config)
      return response.data as ApiResponse<T>
    } catch (error: unknown) {
      if (config?.showError !== false) {
        ElMessage.error((error as Error).message)
      }
      throw error
    }
  }

  // PUT 请求
  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.put(url, data, config)
      return response.data as ApiResponse<T>
    } catch (error: unknown) {
      if (config?.showError !== false) {
        ElMessage.error((error as Error).message)
      }
      throw error
    }
  }

  // DELETE 请求
  async delete<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.delete(url, config)
      return response.data as ApiResponse<T>
    } catch (error: unknown) {
      if (config?.showError !== false) {
        ElMessage.error((error as Error).message)
      }
      throw error
    }
  }

  // 文件上传
  async upload<T = any>(url: string, file: File, config?: RequestConfig): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await this.instance.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        ...config
      })
      return response.data as ApiResponse<T>
    } catch (error: unknown) {
      if (config?.showError !== false) {
        ElMessage.error((error as Error).message)
      }
      throw error
    }
  }

  // 文件下载
  async download(url: string, filename?: string, config?: RequestConfig): Promise<void> {
    try {
      const response = await this.instance.get(url, {
        responseType: 'blob',
        ...config
      })
      
      const blob = new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error: unknown) {
      if (config?.showError !== false) {
        ElMessage.error((error as Error).message)
      }
      throw error
    }
  }

  // 设置基础URL
  setBaseURL(baseURL: string) {
    this.baseURL = baseURL
    this.instance.defaults.baseURL = baseURL
  }

  // 设置超时时间
  setTimeout(timeout: number) {
    this.timeout = timeout
    this.instance.defaults.timeout = timeout
  }

  // 获取实例（用于特殊需求）
  getInstance(): AxiosInstance {
    return this.instance
  }
}

// 创建单例实例
const request = new ApiRequest()

export default request
export { request }
