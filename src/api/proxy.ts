import { api } from './index'

// 代理信息接口
export interface ProxyInfo {
  id: number
  ip: string
  port: number
  username: string
  password: string
  expire_date: string
  status: string
  last_test: string
  response_time: number
  country: string
  region: string
  create_time: string
  update_time: string
}

// 代理导入请求
export interface ProxyImportRequest {
  proxy_list: string
  format: string
}

// 代理列表请求
export interface ProxyListRequest {
  page?: number
  page_size?: number
  status?: string
  country?: string
  keyword?: string
}

// 代理列表响应
export interface ProxyListResponse {
  code: number
  message: string
  data: {
    list: ProxyInfo[]
    total: number
    page: number
    page_size: number
    total_pages: number
  }
}

// 代理统计响应
export interface ProxyStatsResponse {
  code: number
  message: string
  data: {
    total: number
    active: number
    inactive: number
    testing: number
    error: number
  }
}

// 代理测试请求
export interface ProxyTestRequest {
  proxy_ids: number[]
}

// 基础响应
export interface BaseResponse {
  code: number
  message: string
  data?: any
}

// 代理管理API
export const proxyApi = {
  // 批量导入代理
  importProxies: (params: ProxyImportRequest): Promise<BaseResponse> => {
    return api.post('/Proxy/ImportProxies', params)
  },

  // 获取代理列表
  getProxyList: (params?: ProxyListRequest): Promise<ProxyListResponse> => {
    return api.get('/Proxy/GetProxyList', { params })
  },

  // 获取代理统计
  getProxyStats: (): Promise<ProxyStatsResponse> => {
    return api.get('/Proxy/GetProxyStats')
  },

  // 测试代理连接
  testProxies: (params: ProxyTestRequest): Promise<BaseResponse> => {
    return api.post('/Proxy/TestProxies', params)
  },

  // 删除代理
  deleteProxy: (id: number): Promise<BaseResponse> => {
    return api.delete(`/Proxy/DeleteProxy/${id}`)
  },

  // 清空所有代理
  clearProxies: (): Promise<BaseResponse> => {
    return api.post('/Proxy/ClearProxies')
  },

  // 获取可用代理列表（用于账号添加时选择）
  getAvailableProxies: (country?: string): Promise<ProxyListResponse> => {
    return api.get('/Proxy/GetProxyList', {
      params: {
        status: 'active',
        country: country,
        page_size: 100
      }
    })
  }
}

// 代理状态映射
export const proxyStatusMap = {
  active: { label: '可用', color: 'success', icon: '🟢' },
  inactive: { label: '未测试', color: 'info', icon: '⚪' },
  testing: { label: '测试中', color: 'warning', icon: '🟡' },
  error: { label: '错误', color: 'danger', icon: '🔴' }
}

// 获取代理显示名称
export const getProxyDisplayName = (proxy: ProxyInfo): string => {
  const statusInfo = proxyStatusMap[proxy.status as keyof typeof proxyStatusMap] || proxyStatusMap.inactive
  const responseTime = proxy.response_time > 0 ? ` (${proxy.response_time}ms)` : ''
  const country = proxy.country ? ` [${proxy.country}]` : ''
  
  return `${statusInfo.icon} ${proxy.ip}:${proxy.port}${country}${responseTime}`
}

// 格式化代理URL
export const formatProxyUrl = (proxy: ProxyInfo): string => {
  return `socks5://${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`
}

// 检查代理是否过期
export const isProxyExpired = (proxy: ProxyInfo): boolean => {
  const expireDate = new Date(proxy.expire_date)
  return new Date() > expireDate
}

// 获取代理地区列表
export const getProxyCountries = (proxies: ProxyInfo[]): string[] => {
  const countries = new Set<string>()
  proxies.forEach(proxy => {
    if (proxy.country) {
      countries.add(proxy.country)
    }
  })
  return Array.from(countries).sort()
}
