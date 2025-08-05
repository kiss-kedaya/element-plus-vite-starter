/**
 * 内存管理工具类
 * 用于监控和管理应用内存使用，防止内存泄漏
 */

// 内存使用统计接口
interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  timestamp: number
}

// 内存清理策略配置
interface MemoryConfig {
  maxAccountsInMemory: number // 内存中最大账号数
  maxMessagesPerSession: number // 每个会话最大消息数
  maxSessionsPerAccount: number // 每个账号最大会话数
  memoryCheckInterval: number // 内存检查间隔(ms)
  memoryThreshold: number // 内存使用阈值(MB)
  autoCleanupEnabled: boolean // 是否启用自动清理
}

// 默认配置
const DEFAULT_CONFIG: MemoryConfig = {
  maxAccountsInMemory: 3,
  maxMessagesPerSession: 500,
  maxSessionsPerAccount: 50,
  memoryCheckInterval: 30000, // 30秒
  memoryThreshold: 100, // 100MB
  autoCleanupEnabled: true
}

/**
 * 内存管理器类
 */
export class MemoryManager {
  private static instance: MemoryManager
  private config: MemoryConfig
  private memoryHistory: MemoryStats[] = []
  private cleanupCallbacks: Map<string, () => void> = new Map()
  private monitoringInterval: number | null = null
  private lastCleanupTime = 0

  private constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startMonitoring()
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<MemoryConfig>): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager(config)
    }
    return MemoryManager.instance
  }

  /**
   * 获取当前内存使用情况
   */
  getCurrentMemoryStats(): MemoryStats | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        timestamp: Date.now()
      }
    }
    return null
  }

  /**
   * 开始内存监控
   */
  private startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = window.setInterval(() => {
      this.checkMemoryUsage()
    }, this.config.memoryCheckInterval)

    console.log('内存监控已启动')
  }

  /**
   * 停止内存监控
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('内存监控已停止')
    }
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage() {
    const stats = this.getCurrentMemoryStats()
    if (!stats) return

    // 记录内存历史
    this.memoryHistory.push(stats)
    
    // 只保留最近100次记录
    if (this.memoryHistory.length > 100) {
      this.memoryHistory = this.memoryHistory.slice(-100)
    }

    const usedMB = stats.usedJSHeapSize / 1024 / 1024
    const totalMB = stats.totalJSHeapSize / 1024 / 1024
    const limitMB = stats.jsHeapSizeLimit / 1024 / 1024

    // 检查是否需要清理
    if (this.config.autoCleanupEnabled && this.shouldTriggerCleanup(usedMB)) {
      console.warn(`内存使用过高: ${Math.round(usedMB)}MB / ${Math.round(limitMB)}MB，触发自动清理`)
      this.triggerCleanup()
    }

    // 定期输出内存状态（每5分钟）
    if (Date.now() - this.lastCleanupTime > 300000) {
      console.log(`内存状态: 已用 ${Math.round(usedMB)}MB / 总计 ${Math.round(totalMB)}MB / 限制 ${Math.round(limitMB)}MB`)
    }
  }

  /**
   * 判断是否应该触发清理
   */
  private shouldTriggerCleanup(usedMB: number): boolean {
    // 超过阈值
    if (usedMB > this.config.memoryThreshold) {
      return true
    }

    // 检查内存增长趋势
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10)
      const growth = recent[recent.length - 1].usedJSHeapSize - recent[0].usedJSHeapSize
      const growthMB = growth / 1024 / 1024

      // 如果10次检查内存增长超过20MB，触发清理
      if (growthMB > 20) {
        console.warn(`检测到内存快速增长: +${Math.round(growthMB)}MB`)
        return true
      }
    }

    return false
  }

  /**
   * 注册清理回调函数
   */
  registerCleanupCallback(name: string, callback: () => void) {
    this.cleanupCallbacks.set(name, callback)
    console.log(`注册内存清理回调: ${name}`)
  }

  /**
   * 注销清理回调函数
   */
  unregisterCleanupCallback(name: string) {
    this.cleanupCallbacks.delete(name)
    console.log(`注销内存清理回调: ${name}`)
  }

  /**
   * 触发内存清理
   */
  triggerCleanup() {
    const now = Date.now()
    
    // 防止频繁清理（至少间隔1分钟）
    if (now - this.lastCleanupTime < 60000) {
      console.log('清理间隔太短，跳过本次清理')
      return
    }

    this.lastCleanupTime = now
    console.log('开始执行内存清理')

    const beforeStats = this.getCurrentMemoryStats()
    let callbacksExecuted = 0

    // 执行所有注册的清理回调
    this.cleanupCallbacks.forEach((callback, name) => {
      try {
        callback()
        callbacksExecuted++
        console.log(`执行清理回调: ${name}`)
      } catch (error) {
        console.error(`清理回调执行失败: ${name}`, error)
      }
    })

    // 强制垃圾回收（如果支持）
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc()
        console.log('执行强制垃圾回收')
      } catch (error) {
        console.warn('强制垃圾回收失败:', error)
      }
    }

    // 统计清理效果
    setTimeout(() => {
      const afterStats = this.getCurrentMemoryStats()
      if (beforeStats && afterStats) {
        const freedMB = (beforeStats.usedJSHeapSize - afterStats.usedJSHeapSize) / 1024 / 1024
        console.log(`内存清理完成: 执行了${callbacksExecuted}个回调，释放了${Math.round(freedMB)}MB内存`)
      }
    }, 1000)
  }

  /**
   * 手动触发清理
   */
  manualCleanup() {
    console.log('手动触发内存清理')
    this.triggerCleanup()
  }

  /**
   * 获取内存使用报告
   */
  getMemoryReport(): any {
    const current = this.getCurrentMemoryStats()
    if (!current) {
      return { error: '浏览器不支持内存监控' }
    }

    const usedMB = current.usedJSHeapSize / 1024 / 1024
    const totalMB = current.totalJSHeapSize / 1024 / 1024
    const limitMB = current.jsHeapSizeLimit / 1024 / 1024

    // 计算内存趋势
    let trend = 'stable'
    if (this.memoryHistory.length >= 5) {
      const recent = this.memoryHistory.slice(-5)
      const oldUsage = recent[0].usedJSHeapSize
      const newUsage = recent[recent.length - 1].usedJSHeapSize
      const change = (newUsage - oldUsage) / oldUsage

      if (change > 0.1) trend = 'increasing'
      else if (change < -0.1) trend = 'decreasing'
    }

    return {
      current: {
        used: Math.round(usedMB),
        total: Math.round(totalMB),
        limit: Math.round(limitMB),
        usage: Math.round((usedMB / limitMB) * 100)
      },
      trend,
      config: this.config,
      registeredCallbacks: Array.from(this.cleanupCallbacks.keys()),
      lastCleanup: this.lastCleanupTime ? new Date(this.lastCleanupTime).toLocaleString() : 'Never'
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryConfig>) {
    this.config = { ...this.config, ...newConfig }
    console.log('内存管理配置已更新:', this.config)

    // 重启监控以应用新配置
    if (this.config.autoCleanupEnabled) {
      this.startMonitoring()
    } else {
      this.stopMonitoring()
    }
  }

  /**
   * 销毁内存管理器
   */
  destroy() {
    this.stopMonitoring()
    this.cleanupCallbacks.clear()
    this.memoryHistory = []
    console.log('内存管理器已销毁')
  }
}

/**
 * 内存使用装饰器
 * 用于监控函数的内存使用情况
 */
export function memoryMonitor(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value

  descriptor.value = function (...args: any[]) {
    const manager = MemoryManager.getInstance()
    const beforeStats = manager.getCurrentMemoryStats()
    
    const result = method.apply(this, args)
    
    // 如果是Promise，等待完成后检查内存
    if (result instanceof Promise) {
      return result.then((res) => {
        setTimeout(() => {
          const afterStats = manager.getCurrentMemoryStats()
          if (beforeStats && afterStats) {
            const diff = afterStats.usedJSHeapSize - beforeStats.usedJSHeapSize
            if (diff > 1024 * 1024) { // 超过1MB
              console.warn(`方法 ${propertyName} 使用了 ${Math.round(diff / 1024 / 1024)}MB 内存`)
            }
          }
        }, 100)
        return res
      })
    } else {
      // 同步方法立即检查
      setTimeout(() => {
        const afterStats = manager.getCurrentMemoryStats()
        if (beforeStats && afterStats) {
          const diff = afterStats.usedJSHeapSize - beforeStats.usedJSHeapSize
          if (diff > 1024 * 1024) { // 超过1MB
            console.warn(`方法 ${propertyName} 使用了 ${Math.round(diff / 1024 / 1024)}MB 内存`)
          }
        }
      }, 100)
      return result
    }
  }

  return descriptor
}

// 导出默认实例
export const memoryManager = MemoryManager.getInstance()
