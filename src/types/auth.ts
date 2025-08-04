export interface ProxyConfig {
  Host?: string
  Port?: number
  ProxyIp?: string
  ProxyUser?: string
  ProxyPassword?: string
  Type?: string
}

export interface SetProxyRequest {
  Wxid: string
  Proxy: ProxyConfig
}

export interface LoginAccount {
  wxid: string
  nickname: string
  avatar: string
  deviceType: string
  deviceId?: string
  deviceName: string
  status: 'online' | 'offline' | 'connecting'
  loginTime?: Date | string
  refreshTokenDate?: Date | string
  proxy?: ProxyConfig
  uin?: number
  alias?: string
  email?: string
  mobile?: string
  headUrl?: string
  imei?: string
  loginMode?: string
  osVersion?: string
  romModel?: string
  softType?: string
}

export interface QRCodeLoginRequest {
  DeviceID: string
  DeviceName: string
  Proxy?: ProxyConfig
}

export interface Data62LoginRequest {
  Data62: string
  DeviceName: string
  Password: string
  UserName: string
  Proxy?: ProxyConfig
}

export interface A16LoginRequest {
  UserName: string
  Password: string
  A16: string
  DeviceName: string
  Proxy?: ProxyConfig
}

export interface LoginResponse {
  Code: number
  Success: boolean
  Message: string
  Data?: any
  Data62?: string
  Debug?: string
}

export interface QRCodeResponse {
  QrUrl?: string
  QrBase64?: string
  Uuid?: string
  DeviceId?: string
  // 保持向后兼容
  QRCodeUrl?: string
  QRCodeData?: string
}
