/**
 * 内存泄漏修复工具
 * 提供自动清理事件监听器、定时器等资源的解决方案
 */

import { log } from './logger'

// 资源类型枚举
enum ResourceType {
  EVENT_LISTENER = 'event_listener',
  TIMER = 'timer',
  WEBSOCKET = 'websocket',
  OBSERVER = 'observer',
  REACTIVE_EFFECT = 'reactive_effect'
}

// 资源记录接口
interface ResourceRecord {
  id: string
  type: ResourceType
  target?: any
  cleanup: () => void
  createdAt: number
  context?: string
}

/**
 * 资源管理器 - 自动跟踪和清理资源
 */
export class ResourceManager {
  private static instance: ResourceManager
  private resources = new Map<string, ResourceRecord>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private isDestroyed = false

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager()
    }
    return ResourceManager.instance
  }

  private constructor() {
    this.startPeriodicCleanup()
    this.setupGlobalCleanup()
  }

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performPeriodicCleanup()
    }, 5 * 60 * 1000) // 每5分钟清理一次
  }

  /**
   * 设置全局清理
   */
  private setupGlobalCleanup(): void {
    if (typeof window !== 'undefined') {
      // 页面卸载时清理所有资源
      window.addEventListener('beforeunload', () => {
        this.destroyAll()
      })

      // 页面隐藏时清理部分资源
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.cleanupInactiveResources()
        }
      })
    }
  }

  /**
   * 注册事件监听器
   */
  addEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
    context?: string
  ): string
  addEventListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
    context?: string
  ): string
  addEventListener<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
    context?: string
  ): string
  addEventListener(
    target: any,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
    context?: string
  ): string {
    const id = this.generateId()

    // 添加事件监听器
    target.addEventListener(type, listener, options)

    // 记录资源
    this.resources.set(id, {
      id,
      type: ResourceType.EVENT_LISTENER,
      target,
      cleanup: () => {
        try {
          target.removeEventListener(type, listener, options)
          log.debug('清理事件监听器', { type, context }, 'ResourceManager')
        } catch (error) {
          log.warn('清理事件监听器失败', { type, error, context }, 'ResourceManager')
        }
      },
      createdAt: Date.now(),
      context
    })

    log.debug('注册事件监听器', { type, context, resourceId: id }, 'ResourceManager')
    return id
  }

  /**
   * 注册定时器
   */
  addTimer(
    callback: () => void,
    delay: number,
    type: 'timeout' | 'interval' = 'timeout',
    context?: string
  ): string {
    const id = this.generateId()

    // 创建定时器
    const timerId = type === 'timeout'
      ? setTimeout(callback, delay)
      : setInterval(callback, delay)

    // 记录资源
    this.resources.set(id, {
      id,
      type: ResourceType.TIMER,
      cleanup: () => {
        try {
          if (type === 'timeout') {
            clearTimeout(timerId)
          } else {
            clearInterval(timerId)
          }
          log.debug('清理定时器', { type, context }, 'ResourceManager')
        } catch (error) {
          log.warn('清理定时器失败', { type, error, context }, 'ResourceManager')
        }
      },
      createdAt: Date.now(),
      context
    })

    log.debug('注册定时器', { type, delay, context, resourceId: id }, 'ResourceManager')
    return id
  }

  /**
   * 注册WebSocket连接
   */
  addWebSocket(ws: WebSocket, context?: string): string {
    const id = this.generateId()

    this.resources.set(id, {
      id,
      type: ResourceType.WEBSOCKET,
      target: ws,
      cleanup: () => {
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close()
          }
          log.debug('清理WebSocket连接', { context }, 'ResourceManager')
        } catch (error) {
          log.warn('清理WebSocket连接失败', { error, context }, 'ResourceManager')
        }
      },
      createdAt: Date.now(),
      context
    })

    log.debug('注册WebSocket连接', { context, resourceId: id }, 'ResourceManager')
    return id
  }

  /**
   * 注册观察者（如MutationObserver、IntersectionObserver等）
   */
  addObserver(observer: { disconnect: () => void }, context?: string): string {
    const id = this.generateId()

    this.resources.set(id, {
      id,
      type: ResourceType.OBSERVER,
      target: observer,
      cleanup: () => {
        try {
          observer.disconnect()
          log.debug('清理观察者', { context }, 'ResourceManager')
        } catch (error) {
          log.warn('清理观察者失败', { error, context }, 'ResourceManager')
        }
      },
      createdAt: Date.now(),
      context
    })

    log.debug('注册观察者', { context, resourceId: id }, 'ResourceManager')
    return id
  }

  /**
   * 手动清理指定资源
   */
  cleanup(resourceId: string): boolean {
    const resource = this.resources.get(resourceId)
    if (resource) {
      try {
        resource.cleanup()
        this.resources.delete(resourceId)
        log.debug('手动清理资源成功', { resourceId, type: resource.type }, 'ResourceManager')
        return true
      } catch (error) {
        log.error('手动清理资源失败', { resourceId, error }, 'ResourceManager')
        return false
      }
    }
    return false
  }

  /**
   * 按上下文清理资源
   */
  cleanupByContext(context: string): number {
    let cleanedCount = 0
    const resourcesToClean: string[] = []

    // 找到所有匹配上下文的资源
    this.resources.forEach((resource, id) => {
      if (resource.context === context) {
        resourcesToClean.push(id)
      }
    })

    // 清理资源
    resourcesToClean.forEach(id => {
      if (this.cleanup(id)) {
        cleanedCount++
      }
    })

    log.info('按上下文清理资源完成', { context, cleanedCount }, 'ResourceManager')
    return cleanedCount
  }

  /**
   * 清理不活跃的资源
   */
  private cleanupInactiveResources(): void {
    const now = Date.now()
    const maxAge = 30 * 60 * 1000 // 30分钟
    const resourcesToClean: string[] = []

    this.resources.forEach((resource, id) => {
      if (now - resource.createdAt > maxAge) {
        resourcesToClean.push(id)
      }
    })

    let cleanedCount = 0
    resourcesToClean.forEach(id => {
      if (this.cleanup(id)) {
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      log.info('清理不活跃资源完成', { cleanedCount }, 'ResourceManager')
    }
  }

  /**
   * 定期清理
   */
  private performPeriodicCleanup(): void {
    if (this.isDestroyed) return

    const resourceCount = this.resources.size

    // 清理不活跃的资源
    this.cleanupInactiveResources()

    // 检查内存使用情况
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usedMB = memory.usedJSHeapSize / 1024 / 1024

      if (usedMB > 100) { // 超过100MB时强制清理
        log.warn('内存使用过高，执行强制清理', { usedMB, resourceCount }, 'ResourceManager')
        this.forceCleanup()
      }
    }

    log.debug('定期清理完成', {
      totalResources: this.resources.size,
      originalCount: resourceCount
    }, 'ResourceManager')
  }

  /**
   * 强制清理部分资源
   */
  private forceCleanup(): void {
    const resourcesToClean: string[] = []
    const now = Date.now()
    const forceCleanupAge = 10 * 60 * 1000 // 10分钟

    // 清理超过10分钟的资源
    this.resources.forEach((resource, id) => {
      if (now - resource.createdAt > forceCleanupAge) {
        resourcesToClean.push(id)
      }
    })

    let cleanedCount = 0
    resourcesToClean.forEach(id => {
      if (this.cleanup(id)) {
        cleanedCount++
      }
    })

    log.warn('强制清理完成', { cleanedCount }, 'ResourceManager')
  }

  /**
   * 销毁所有资源
   */
  destroyAll(): void {
    if (this.isDestroyed) return

    log.info('开始销毁所有资源', { totalResources: this.resources.size }, 'ResourceManager')

    // 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 清理所有资源
    let cleanedCount = 0
    const resourceIds = Array.from(this.resources.keys())

    resourceIds.forEach(id => {
      if (this.cleanup(id)) {
        cleanedCount++
      }
    })

    this.resources.clear()
    this.isDestroyed = true

    log.info('所有资源销毁完成', { cleanedCount }, 'ResourceManager')
  }

  /**
   * 获取资源统计信息
   */
  getStats(): any {
    const stats = {
      total: this.resources.size,
      byType: {} as Record<string, number>,
      byContext: {} as Record<string, number>,
      oldestResource: null as any,
      newestResource: null as any
    }

    let oldestTime = Infinity
    let newestTime = 0

    this.resources.forEach(resource => {
      // 按类型统计
      stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1

      // 按上下文统计
      const context = resource.context || 'unknown'
      stats.byContext[context] = (stats.byContext[context] || 0) + 1

      // 找到最老和最新的资源
      if (resource.createdAt < oldestTime) {
        oldestTime = resource.createdAt
        stats.oldestResource = {
          id: resource.id,
          type: resource.type,
          context: resource.context,
          age: Date.now() - resource.createdAt
        }
      }

      if (resource.createdAt > newestTime) {
        newestTime = resource.createdAt
        stats.newestResource = {
          id: resource.id,
          type: resource.type,
          context: resource.context,
          age: Date.now() - resource.createdAt
        }
      }
    })

    return stats
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// 创建全局实例
export const resourceManager = ResourceManager.getInstance()

// 便捷的全局函数
export const addEventListenerSafe = resourceManager.addEventListener.bind(resourceManager)
export const addTimerSafe = resourceManager.addTimer.bind(resourceManager)
export const addWebSocketSafe = resourceManager.addWebSocket.bind(resourceManager)
export const addObserverSafe = resourceManager.addObserver.bind(resourceManager)
export const cleanupResource = resourceManager.cleanup.bind(resourceManager)
export const cleanupByContext = resourceManager.cleanupByContext.bind(resourceManager)