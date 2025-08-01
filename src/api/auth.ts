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
      Car: '/Login/LoginGetQRCar',
    }

    const endpoint = endpoints[deviceType] || endpoints.iPad
    const response = await request.post<QRCodeResponse>(endpoint, params)
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as QRCodeResponse
  },

  // 62数据登录
  loginWithData62: async (params: Data62LoginRequest): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Login/Data62Login', params)
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as LoginResponse
  },

  // A16登录
  loginWithA16: async (params: A16LoginRequest): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Login/A16Data', params)
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as LoginResponse
  },

  // 检查二维码状态
  checkQRCodeStatus: async (params: { Uuid: string }): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>(`/Login/LoginCheckQR?uuid=${encodeURIComponent(params.Uuid)}`)
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as LoginResponse
  },

  // 退出登录
  logout: async (wxid: string): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Login/Logout', { Wxid: wxid })
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as LoginResponse
  },

  // 获取已登录账号列表
  getLoggedAccounts: async (): Promise<LoginResponse> => {
    const response = await request.get<any>('/Login/GetLoggedAccounts', { api_key: 'api_kedaya' })
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as LoginResponse
  },

  // 设置代理
  setProxy: async (params: SetProxyRequest): Promise<LoginResponse> => {
    const response = await request.post<LoginResponse>('/Tools/setproxy', params)
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as LoginResponse
  },

  // 设备复用登录 - 生成二维码
  getQRCodeForDeviceReuse: async (params: QRCodeLoginRequest): Promise<QRCodeResponse> => {
    const response = await request.post<QRCodeResponse>('/Login/LoginGetQRCar', params)
    // response 已经是后端返回的格式 {Code, Success, Message, Data}
    return response as QRCodeResponse
  },
}
