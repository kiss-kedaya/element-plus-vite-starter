/**
 * 设备相关工具函数
 */

// 生成随机设备ID
export const generateDeviceId = () => {
  // 生成类似车载设备的ID格式
  const prefix = 'CAR'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substr(2, 6).toUpperCase()
  return `${prefix}_${timestamp}_${random}`
}

// 生成随机车载设备名称
export const generateCarDeviceName = () => {
  const carBrands = ['奔驰', '宝马', '奥迪', '特斯拉', '蔚来', '理想', '小鹏', '比亚迪', '吉利', '长城']
  const carModels = ['智能座舱', '车载系统', '中控屏', '智能终端', '车机']
  const versions = ['Pro', 'Max', 'Plus', 'Elite', 'Premium']

  const brand = carBrands[Math.floor(Math.random() * carBrands.length)]
  const model = carModels[Math.floor(Math.random() * carModels.length)]
  const version = versions[Math.floor(Math.random() * versions.length)]

  return `${brand}${model}${version}`
}

// 生成随机设备信息
export const generateRandomDeviceInfo = () => {
  return {
    deviceId: generateDeviceId(),
    deviceName: generateCarDeviceName()
  }
}

// 代理配置接口
export interface ProxyConfig {
  ProxyIp: string
  ProxyPort: number
  ProxyUser: string
  ProxyPass: string
}

// 创建默认代理配置
export const createDefaultProxyConfig = (): ProxyConfig => ({
  ProxyIp: '',
  ProxyPort: 1080,
  ProxyUser: '',
  ProxyPass: ''
})

// 构建API代理参数
export const buildProxyParams = (proxy: ProxyConfig) => {
  if (!proxy.ProxyIp) return undefined
  
  return {
    Host: proxy.ProxyIp,
    Port: proxy.ProxyPort,
    ProxyUser: proxy.ProxyUser || undefined,
    ProxyPassword: proxy.ProxyPass || undefined,
    Type: 'SOCKS5'
  }
}

// 构建设置代理的参数
export const buildSetProxyParams = (wxid: string, proxy: ProxyConfig) => {
  return {
    Wxid: wxid,
    Proxy: {
      Host: proxy.ProxyIp,
      Port: proxy.ProxyPort,
      ProxyIp: proxy.ProxyIp,
      ProxyUser: proxy.ProxyUser || '',
      ProxyPassword: proxy.ProxyPass || '',
      Type: 'SOCKS5'
    }
  }
}
