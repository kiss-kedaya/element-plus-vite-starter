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
    console.log('API响应成功:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    })
    return response.data
  },
  (error) => {
    console.error('API请求错误:', error)
    console.error('错误详细信息:', {
      message: error.message,
      response: error.response,
      request: error.request,
      config: error.config
    })

    // 统一错误处理
    if (error.response) {
      const { status, data } = error.response
      console.error(`HTTP错误 ${status}:`, data)

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

// 文件转换为base64的辅助函数
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 图片上传API（使用base64格式）
export const uploadImage = async (file: File, wxid: string, toWxid: string) => {
  const base64 = await fileToBase64(file)
  return api.post('/Msg/UploadImg', {
    Wxid: wxid,
    ToWxid: toWxid,
    Base64: base64
  })
}

// 注意：后端没有通用的文件上传接口
// 只支持图片上传和CDN文件转发
export const uploadFile = async (file: File, onProgress?: (progress: number) => void) => {
  // 检查文件类型
  if (file.type.startsWith('image/')) {
    throw new Error('图片文件请使用 uploadImage 函数')
  }

  // 对于非图片文件，后端暂不支持直接上传
  throw new Error('后端暂不支持非图片文件的直接上传，只支持CDN文件转发')
}

// 下载文件API
export const downloadFile = async (params: {
  Wxid: string
  AppID: string
  AttachId: string
  UserName: string
  DataLen: number
  Section: {
    StartPos: number
    DataLen: number
  }
}) => {
  console.log('发送下载文件请求:', {
    url: '/Tools/DownloadFile',
    params
  })

  try {
    const response = await api.post('/Tools/DownloadFile', params)
    console.log('下载文件API原始响应:', response)
    return response
  } catch (error: any) {
    console.error('下载文件API调用失败:', {
      error,
      message: error.message,
      response: error.response,
      status: error.response?.status,
      data: error.response?.data
    })
    throw error
  }
}
