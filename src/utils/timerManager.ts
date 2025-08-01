// 全局定时器管理器
class TimerManager {
  private timers = new Map<string, NodeJS.Timeout>()
  private static instance: TimerManager | null = null

  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager()
    }
    return TimerManager.instance
  }

  // 创建定时器
  createTimer(
    key: string,
    callback: () => void,
    delay: number,
    type: 'interval' | 'timeout' = 'timeout'
  ): NodeJS.Timeout {
    // 清除已存在的定时器
    this.clearTimer(key)

    const timer = type === 'interval' 
      ? setInterval(callback, delay)
      : setTimeout(callback, delay)

    this.timers.set(key, timer)
    console.log(`创建定时器: ${key} (${type})`)
    return timer
  }

  // 清除指定定时器
  clearTimer(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      clearInterval(timer)
      this.timers.delete(key)
      console.log(`清除定时器: ${key}`)
    }
  }

  // 清除所有定时器
  clearAllTimers(): void {
    console.log(`清除所有定时器，共 ${this.timers.size} 个`)
    this.timers.forEach((timer, key) => {
      clearTimeout(timer)
      clearInterval(timer)
      console.log(`清除定时器: ${key}`)
    })
    this.timers.clear()
  }

  // 检查定时器是否存在
  hasTimer(key: string): boolean {
    return this.timers.has(key)
  }

  // 获取所有定时器键名
  getTimerKeys(): string[] {
    return Array.from(this.timers.keys())
  }

  // 获取定时器数量
  getTimerCount(): number {
    return this.timers.size
  }
}

// 导出单例实例
export const timerManager = TimerManager.getInstance()

// 页面卸载时清理所有定时器
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    timerManager.clearAllTimers()
  })
}

// Vue组合式函数
export function useTimerManager() {
  const createTimer = (
    key: string,
    callback: () => void,
    delay: number,
    type: 'interval' | 'timeout' = 'timeout'
  ) => {
    return timerManager.createTimer(key, callback, delay, type)
  }

  const clearTimer = (key: string) => {
    timerManager.clearTimer(key)
  }

  const clearAllTimers = () => {
    timerManager.clearAllTimers()
  }

  const hasTimer = (key: string) => {
    return timerManager.hasTimer(key)
  }

  return {
    createTimer,
    clearTimer,
    clearAllTimers,
    hasTimer,
    getTimerCount: () => timerManager.getTimerCount(),
    getTimerKeys: () => timerManager.getTimerKeys()
  }
}
