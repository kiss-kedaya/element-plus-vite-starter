import type {
  A16LoginRequest,
  Data62LoginRequest,
  LoginResponse,
  ProxyConfig,
  QRCodeLoginRequest,
  QRCodeResponse,
  SetProxyRequest,
} from '@/types/auth'
import request from './request'

export const loginApi = {
  // 获取二维码登录
  getQRCode: async (deviceType: string, params: QRCodeLoginRequest): Promise<QRCodeResponse> => {
    const endpoints: Record<string, string> = {
      iPad: '/Login/LoginGetQR',
      iPadX: '/Login/LoginGetQRx',
      Windows: '/Login/LoginGetQRWin',
      WindowsUwp: '/Login/LoginGetQRWinUwp',
      WindowsUnified: '/Login/LoginGetQRWinUnified',
      Mac: '/Login/LoginGetQRMac',
      AndroidPad: '/Login/LoginGetQRPad',
      AndroidPadX: '/Login/LoginGetQRPadx',
    }

    const endpoint = endpoints[deviceType] || endpoints.iPad
    const response = await request.post<any>(endpoint, params)
    return {
      Code: response.code,
      Success: response.success,
      Message: response.message,
      Data: response.data
    }
  },

  // 62数据登录
  loginWithData62: async (params: Data62LoginRequest): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Login/Data62Login', params)
    return {
      Code: response.code,
      Success: response.success,
      Message: response.message,
      Data: response.data
    }
  },

  // A16登录
  loginWithA16: async (params: A16LoginRequest): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Login/A16Data', params)
    return {
      Code: response.code,
      Success: response.success,
      Message: response.message,
      Data: response.data
    }
  },

  // 检查二维码状态
  checkQRCodeStatus: async (params: { Uuid: string }): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Login/LoginCheckQR', params)
    return {
      Code: response.code,
      Success: response.success,
      Message: response.message,
      Data: response.data
    }
  },

  // 退出登录
  logout: async (wxid: string): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Login/Logout', { Wxid: wxid })
    return {
      Code: response.code,
      Success: response.success,
      Message: response.message,
      Data: response.data
    }
  },

  // 获取已登录账号列表
  getLoggedAccounts: async (): Promise<any> => {
    const response = await request.get<any>('/Login/GetLoggedAccounts', { api_key: 'api_kedaya' })
    return response
  },

  // 设置代理
  setProxy: async (params: SetProxyRequest): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Tools/setproxy', params)
    return {
      Code: response.code,
      Success: response.success,
      Message: response.message,
      Data: response.data
    }
  },

  // 设备复用登录 - 生成二维码
  getQRCodeForDeviceReuse: async (params: QRCodeLoginRequest): Promise<QRCodeResponse> => {
    const response = await request.post<any>('/Login/LoginGetQRCar', params)

    // 直接返回原始响应，因为API返回的字段就是大写的
    return response
  },
}
