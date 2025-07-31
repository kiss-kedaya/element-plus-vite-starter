import type {
  A16LoginRequest,
  Data62LoginRequest,
  LoginResponse,
  ProxyConfig,
  QRCodeLoginRequest,
  QRCodeResponse,
  SetProxyRequest,
} from '@/types/auth'
import { api } from './index'

export const loginApi = {
  // 获取二维码登录
  getQRCode: (deviceType: string, params: QRCodeLoginRequest): Promise<QRCodeResponse> => {
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
    return api.post(endpoint, params)
  },

  // 62数据登录
  loginWithData62: (params: Data62LoginRequest): Promise<LoginResponse> => {
    return api.post('/Login/Data62Login', params)
  },

  // A16登录
  loginWithA16: (params: A16LoginRequest): Promise<LoginResponse> => {
    return api.post('/Login/A16Data', params)
  },

  // 检查二维码状态
  checkQRCodeStatus: (params: { Wxid: string, Uuid: string }): Promise<LoginResponse> => {
    return api.post('/Login/CheckLogin', params)
  },

  // 确认登录
  confirmLogin: (params: { Wxid: string, Uuid: string }): Promise<LoginResponse> => {
    return api.post('/Login/ConfirmLogin', params)
  },

  // 获取登录状态
  getLoginStatus: (wxid: string): Promise<LoginResponse> => {
    return api.post('/Login/GetLoginStatus', { Wxid: wxid })
  },

  // 退出登录
  logout: (wxid: string): Promise<LoginResponse> => {
    return api.post('/Login/Logout', { Wxid: wxid })
  },

  // 获取已登录账号列表
  getLoggedAccounts: (): Promise<{ data: any[] }> => {
    return api.get('/Login/GetLoggedAccounts?api_key=api_kedaya')
  },

  // 设置代理
  setProxy: (params: SetProxyRequest): Promise<LoginResponse> => {
    return api.post('/Tools/setproxy', params)
  },

  // 设备复用登录 - 生成二维码
  getQRCodeForDeviceReuse: (params: QRCodeLoginRequest): Promise<QRCodeResponse> => {
    return api.post('/Login/LoginGetQRCar', params)
  },
}
