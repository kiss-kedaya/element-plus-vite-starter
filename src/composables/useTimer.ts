import { ref, onUnmounted, type Ref } from 'vue'

// 定时器类型
export type TimerType = 'interval' | 'timeout'

// 定时器状态
export interface TimerState {
  id: Ref<NodeJS.Timeout | null>
  isActive: Ref<boolean>
  count: Ref<number>
}

// 定时器选项
export interface TimerOptions {
  immediate?: boolean         // 是否立即执行
  autoStart?: boolean        // 是否自动开始
  maxCount?: number          // 最大执行次数
  onComplete?: () => void    // 完成回调
  onTick?: (count: number) => void  // 每次执行回调
}

// 定时器管理器
class TimerManager {
  private timers = new Map<string, NodeJS.Timeout>()

  // 创建定时器
  create(
    key: string,
    callback: () => void,
    delay: number,
    type: TimerType = 'timeout'
  ): NodeJS.Timeout {
    // 清除已存在的定时器
    this.clear(key)

    const timer = type === 'interval' 
      ? setInterval(callback, delay)
      : setTimeout(callback, delay)

    this.timers.set(key, timer)
    return timer
  }

  // 清除指定定时器
  clear(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      clearInterval(timer)
      this.timers.delete(key)
    }
  }

  // 清除所有定时器
  clearAll(): void {
    this.timers.forEach((timer) => {
      clearTimeout(timer)
      clearInterval(timer)
    })
    this.timers.clear()
  }

  // 检查定时器是否存在
  has(key: string): boolean {
    return this.timers.has(key)
  }

  // 获取所有定时器键名
  getKeys(): string[] {
    return Array.from(this.timers.keys())
  }
}

// 全局定时器管理器实例
const globalTimerManager = new TimerManager()

// 基础定时器Hook
export function useTimer(
  callback: () => void,
  delay: number,
  options: TimerOptions = {}
) {
  const {
    immediate = false,
    autoStart = false,
    maxCount,
    onComplete,
    onTick
  } = options

  const id = ref<NodeJS.Timeout | null>(null)
  const isActive = ref(false)
  const count = ref(0)

  // 执行回调
  const executeCallback = () => {
    count.value++
    
    if (onTick) {
      onTick(count.value)
    }

    callback()

    // 检查是否达到最大次数
    if (maxCount && count.value >= maxCount) {
      stop()
      if (onComplete) {
        onComplete()
      }
    }
  }

  // 开始定时器
  const start = () => {
    if (isActive.value) return

    if (immediate) {
      executeCallback()
    }

    id.value = setInterval(executeCallback, delay)
    isActive.value = true
  }

  // 停止定时器
  const stop = () => {
    if (id.value) {
      clearInterval(id.value)
      id.value = null
    }
    isActive.value = false
  }

  // 重置定时器
  const reset = () => {
    stop()
    count.value = 0
  }

  // 重启定时器
  const restart = () => {
    reset()
    start()
  }

  // 自动开始
  if (autoStart) {
    start()
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stop()
  })

  return {
    id,
    isActive,
    count,
    start,
    stop,
    reset,
    restart
  }
}

// 超时定时器Hook
export function useTimeout(
  callback: () => void,
  delay: number,
  options: Omit<TimerOptions, 'maxCount'> = {}
) {
  const {
    immediate = false,
    autoStart = false,
    onComplete
  } = options

  const id = ref<NodeJS.Timeout | null>(null)
  const isActive = ref(false)

  // 执行回调
  const executeCallback = () => {
    callback()
    isActive.value = false
    id.value = null
    
    if (onComplete) {
      onComplete()
    }
  }

  // 开始定时器
  const start = () => {
    if (isActive.value) return

    if (immediate) {
      executeCallback()
      return
    }

    id.value = setTimeout(executeCallback, delay)
    isActive.value = true
  }

  // 停止定时器
  const stop = () => {
    if (id.value) {
      clearTimeout(id.value)
      id.value = null
    }
    isActive.value = false
  }

  // 重启定时器
  const restart = () => {
    stop()
    start()
  }

  // 自动开始
  if (autoStart) {
    start()
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stop()
  })

  return {
    id,
    isActive,
    start,
    stop,
    restart
  }
}

// 倒计时Hook
export function useCountdown(
  initialTime: number,
  options: {
    interval?: number
    onTick?: (time: number) => void
    onComplete?: () => void
    autoStart?: boolean
  } = {}
) {
  const {
    interval = 1000,
    onTick,
    onComplete,
    autoStart = false
  } = options

  const time = ref(initialTime)
  const isActive = ref(false)
  const id = ref<NodeJS.Timeout | null>(null)

  // 倒计时逻辑
  const tick = () => {
    time.value--
    
    if (onTick) {
      onTick(time.value)
    }

    if (time.value <= 0) {
      stop()
      if (onComplete) {
        onComplete()
      }
    }
  }

  // 开始倒计时
  const start = () => {
    if (isActive.value || time.value <= 0) return

    id.value = setInterval(tick, interval)
    isActive.value = true
  }

  // 停止倒计时
  const stop = () => {
    if (id.value) {
      clearInterval(id.value)
      id.value = null
    }
    isActive.value = false
  }

  // 重置倒计时
  const reset = (newTime?: number) => {
    stop()
    time.value = newTime ?? initialTime
  }

  // 重启倒计时
  const restart = (newTime?: number) => {
    reset(newTime)
    start()
  }

  // 自动开始
  if (autoStart) {
    start()
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stop()
  })

  return {
    time,
    isActive,
    start,
    stop,
    reset,
    restart
  }
}

// 全局定时器管理Hook
export function useGlobalTimer() {
  // 创建全局定时器
  const createTimer = (
    key: string,
    callback: () => void,
    delay: number,
    type: TimerType = 'timeout'
  ) => {
    return globalTimerManager.create(key, callback, delay, type)
  }

  // 清除全局定时器
  const clearTimer = (key: string) => {
    globalTimerManager.clear(key)
  }

  // 清除所有全局定时器
  const clearAllTimers = () => {
    globalTimerManager.clearAll()
  }

  // 检查定时器是否存在
  const hasTimer = (key: string) => {
    return globalTimerManager.has(key)
  }

  // 获取所有定时器键名
  const getTimerKeys = () => {
    return globalTimerManager.getKeys()
  }

  // 组件卸载时清理所有定时器
  onUnmounted(() => {
    clearAllTimers()
  })

  return {
    createTimer,
    clearTimer,
    clearAllTimers,
    hasTimer,
    getTimerKeys
  }
}

// 轮询Hook
export function usePolling(
  callback: () => Promise<void> | void,
  interval: number,
  options: {
    immediate?: boolean
    autoStart?: boolean
    maxRetries?: number
    onError?: (error: Error) => void
  } = {}
) {
  const {
    immediate = false,
    autoStart = false,
    maxRetries,
    onError
  } = options

  const isActive = ref(false)
  const retryCount = ref(0)
  const id = ref<NodeJS.Timeout | null>(null)

  // 执行轮询
  const poll = async () => {
    try {
      await callback()
      retryCount.value = 0
    } catch (error) {
      retryCount.value++
      
      if (onError) {
        onError(error as Error)
      }

      // 达到最大重试次数时停止
      if (maxRetries && retryCount.value >= maxRetries) {
        stop()
        return
      }
    }

    // 继续下一次轮询
    if (isActive.value) {
      id.value = setTimeout(poll, interval)
    }
  }

  // 开始轮询
  const start = async () => {
    if (isActive.value) return

    isActive.value = true
    retryCount.value = 0

    if (immediate) {
      await poll()
    } else {
      id.value = setTimeout(poll, interval)
    }
  }

  // 停止轮询
  const stop = () => {
    isActive.value = false
    if (id.value) {
      clearTimeout(id.value)
      id.value = null
    }
  }

  // 重启轮询
  const restart = () => {
    stop()
    start()
  }

  // 自动开始
  if (autoStart) {
    start()
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stop()
  })

  return {
    isActive,
    retryCount,
    start,
    stop,
    restart
  }
}

// 导出所有Hook
export default {
  useTimer,
  useTimeout,
  useCountdown,
  useGlobalTimer,
  usePolling
}
