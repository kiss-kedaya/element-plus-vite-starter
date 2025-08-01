// 全局二维码状态管理器
import { loginApi } from '@/api/auth'

interface QRCodeCheckConfig {
  uuid: string
  onSuccess?: (data: any) => void
  onStatusChange?: (status: string, data?: any) => void
  onError?: (error: string) => void
  onExpired?: () => void
  onCancelled?: () => void
  interval?: number
  timeout?: number
}

class QRCodeManager {
  private static instance: QRCodeManager | null = null
  private activeCheckers = new Map<string, {
    config: QRCodeCheckConfig
    intervalTimer: NodeJS.Timeout | null
    timeoutTimer: NodeJS.Timeout | null
  }>()

  static getInstance(): QRCodeManager {
    if (!QRCodeManager.instance) {
      QRCodeManager.instance = new QRCodeManager()
    }
    return QRCodeManager.instance
  }

  // 开始检查二维码状态
  startCheck(key: string, config: QRCodeCheckConfig): void {
    console.log(`[QRCodeManager] 开始检查二维码: ${key}, UUID: ${config.uuid}`)
    
    // 停止之前的检查
    this.stopCheck(key)

    const interval = config.interval || 2000 // 默认2秒
    const timeout = config.timeout || 300000 // 默认5分钟

    // 创建间隔检查定时器
    const intervalTimer = setInterval(async () => {
      try {
        await this.checkStatus(key, config)
      } catch (error) {
        console.error(`[QRCodeManager] 检查状态失败 ${key}:`, error)
        if (config.onError) {
          config.onError(error instanceof Error ? error.message : '检查失败')
        }
      }
    }, interval)

    // 创建超时定时器
    const timeoutTimer = setTimeout(() => {
      console.log(`[QRCodeManager] 二维码超时: ${key}`)
      this.stopCheck(key)
      if (config.onExpired) {
        config.onExpired()
      }
      if (config.onStatusChange) {
        config.onStatusChange('二维码已过期，请刷新')
      }
    }, timeout)

    // 保存检查器信息
    this.activeCheckers.set(key, {
      config,
      intervalTimer,
      timeoutTimer
    })

    console.log(`[QRCodeManager] 活跃检查器数量: ${this.activeCheckers.size}`)
  }

  // 停止检查二维码状态
  stopCheck(key: string): void {
    const checker = this.activeCheckers.get(key)
    if (checker) {
      console.log(`[QRCodeManager] 停止检查二维码: ${key}`)
      
      if (checker.intervalTimer) {
        clearInterval(checker.intervalTimer)
      }
      if (checker.timeoutTimer) {
        clearTimeout(checker.timeoutTimer)
      }
      
      this.activeCheckers.delete(key)
      console.log(`[QRCodeManager] 活跃检查器数量: ${this.activeCheckers.size}`)
    }
  }

  // 停止所有检查
  stopAllChecks(): void {
    console.log(`[QRCodeManager] 停止所有检查，共 ${this.activeCheckers.size} 个`)
    this.activeCheckers.forEach((_, key) => {
      this.stopCheck(key)
    })
  }

  // 检查指定UUID的状态
  private async checkStatus(key: string, config: QRCodeCheckConfig): Promise<void> {
    const response = await loginApi.checkQRCodeStatus({ Uuid: config.uuid })

    if (response.Success && response.Message === "登录成功") {
      // 登录成功
      console.log(`[QRCodeManager] 登录成功: ${key}`)
      this.stopCheck(key)
      
      if (config.onSuccess) {
        config.onSuccess(response.Data)
      }
      if (config.onStatusChange) {
        config.onStatusChange('登录成功！正在初始化...', response.Data)
      }

    } else if (response.Success && response.Data) {
      // API调用成功，根据Data中的状态判断
      const data = response.Data

      if (data.expiredTime <= 0) {
        // 二维码已过期
        console.log(`[QRCodeManager] 二维码过期: ${key}`)
        this.stopCheck(key)
        
        if (config.onExpired) {
          config.onExpired()
        }
        if (config.onStatusChange) {
          config.onStatusChange('二维码已过期，请刷新')
        }

      } else if (data.status === 0) {
        // 等待扫码
        if (config.onStatusChange) {
          config.onStatusChange(`等待扫码... (${data.expiredTime}秒后过期)`, data)
        }

      } else if (data.status === 1) {
        // 已扫码，等待确认
        if (config.onStatusChange) {
          config.onStatusChange(`${data.nickName || '用户'}已扫码，请在手机上确认登录 (${data.expiredTime}秒后过期)`, data)
        }

      } else if (data.status === 4) {
        // 用户取消登录
        console.log(`[QRCodeManager] 用户取消登录: ${key}`)
        this.stopCheck(key)
        
        if (config.onCancelled) {
          config.onCancelled()
        }
        if (config.onStatusChange) {
          config.onStatusChange('用户取消登录')
        }

      } else {
        // 其他状态
        if (config.onStatusChange) {
          config.onStatusChange(`状态: ${data.status} (${data.expiredTime}秒后过期)`, data)
        }
      }

    } else {
      // API调用失败
      console.error(`[QRCodeManager] API调用失败 ${key}:`, response)
      if (config.onError) {
        config.onError(response.Message || '未知错误')
      }
      if (config.onStatusChange) {
        config.onStatusChange(`检测失败: ${response.Message || '未知错误'}`)
      }
    }
  }

  // 获取活跃检查器数量
  getActiveCount(): number {
    return this.activeCheckers.size
  }

  // 获取活跃检查器列表
  getActiveKeys(): string[] {
    return Array.from(this.activeCheckers.keys())
  }

  // 检查是否有指定的检查器
  hasChecker(key: string): boolean {
    return this.activeCheckers.has(key)
  }
}

// 导出单例实例
export const qrCodeManager = QRCodeManager.getInstance()

// 页面卸载时清理所有检查器
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    qrCodeManager.stopAllChecks()
  })
}

// Vue组合式函数
export function useQRCodeManager() {
  const startCheck = (key: string, config: QRCodeCheckConfig) => {
    qrCodeManager.startCheck(key, config)
  }

  const stopCheck = (key: string) => {
    qrCodeManager.stopCheck(key)
  }

  const stopAllChecks = () => {
    qrCodeManager.stopAllChecks()
  }

  const hasChecker = (key: string) => {
    return qrCodeManager.hasChecker(key)
  }

  return {
    startCheck,
    stopCheck,
    stopAllChecks,
    hasChecker,
    getActiveCount: () => qrCodeManager.getActiveCount(),
    getActiveKeys: () => qrCodeManager.getActiveKeys()
  }
}
