/**
 * 内存监控工具
 * 用于在开发和生产环境中监控内存使用情况
 */

import { memoryManager } from './memoryManager'

// 在全局作用域暴露内存监控工具
declare global {
  interface Window {
    memoryMonitor: {
      getReport: () => any
      triggerCleanup: () => void
      startMonitoring: () => void
      stopMonitoring: () => void
      getStats: () => any
    }
  }
}

/**
 * 内存监控工具类
 */
export class MemoryMonitor {
  /**
   * 获取详细的内存报告
   */
  static getDetailedReport(): any {
    const report = memoryManager.getMemoryReport()
    
    // 添加额外的统计信息
    const additionalStats = {
      // DOM节点数量
      domNodes: document.querySelectorAll('*').length,
      
      // 事件监听器数量（估算）
      eventListeners: this.estimateEventListeners(),
      
      // localStorage使用情况
      localStorage: this.getLocalStorageStats(),
      
      // 计算属性和响应式数据（Vue相关）
      vueStats: this.getVueStats()
    }
    
    return {
      ...report,
      additional: additionalStats,
      recommendations: this.getRecommendations(report, additionalStats)
    }
  }

  /**
   * 估算事件监听器数量
   */
  private static estimateEventListeners(): number {
    // 这是一个粗略的估算，实际数量可能更多
    const elements = document.querySelectorAll('*')
    let count = 0
    
    // 检查常见的事件监听器
    const commonEvents = ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'input', 'change']
    
    elements.forEach(element => {
      commonEvents.forEach(event => {
        if ((element as any)[`on${event}`]) {
          count++
        }
      })
    })
    
    return count
  }

  /**
   * 获取localStorage统计信息
   */
  private static getLocalStorageStats(): any {
    let totalSize = 0
    let itemCount = 0
    const items: { key: string; size: number }[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value) {
          const size = key.length + value.length
          totalSize += size
          itemCount++
          items.push({ key, size })
        }
      }
    }
    
    // 按大小排序
    items.sort((a, b) => b.size - a.size)
    
    return {
      totalSize: Math.round(totalSize / 1024), // KB
      itemCount,
      largestItems: items.slice(0, 5).map(item => ({
        key: item.key,
        size: Math.round(item.size / 1024) // KB
      }))
    }
  }

  /**
   * 获取Vue相关统计信息
   */
  private static getVueStats(): any {
    // 这里只能获取一些基本信息，因为Vue的内部状态不容易访问
    return {
      components: document.querySelectorAll('[data-v-]').length,
      // 可以添加更多Vue相关的统计
    }
  }

  /**
   * 生成优化建议
   */
  private static getRecommendations(memoryReport: any, additionalStats: any): string[] {
    const recommendations: string[] = []
    
    // 内存使用建议
    if (memoryReport.current.usage > 80) {
      recommendations.push('内存使用率过高，建议立即清理')
    } else if (memoryReport.current.usage > 60) {
      recommendations.push('内存使用率较高，建议定期清理')
    }
    
    // localStorage建议
    if (additionalStats.localStorage.totalSize > 4096) { // 4MB
      recommendations.push('localStorage使用过多，建议清理旧数据')
    }
    
    // DOM节点建议
    if (additionalStats.domNodes > 5000) {
      recommendations.push('DOM节点过多，可能存在内存泄漏')
    }
    
    // 事件监听器建议
    if (additionalStats.eventListeners > 1000) {
      recommendations.push('事件监听器过多，检查是否有未清理的监听器')
    }
    
    // 趋势建议
    if (memoryReport.trend === 'increasing') {
      recommendations.push('内存使用呈上升趋势，需要关注')
    }
    
    return recommendations
  }

  /**
   * 开始内存监控
   */
  static startMonitoring(): void {
    console.log('开始内存监控')
    
    // 每30秒输出一次内存状态
    setInterval(() => {
      const report = memoryManager.getMemoryReport()
      if (report.current.usage > 70) {
        console.warn(`内存使用率: ${report.current.usage}%`)
      }
    }, 30000)
    
    // 每5分钟输出详细报告
    setInterval(() => {
      const report = this.getDetailedReport()
      console.log('内存监控报告:', report)
    }, 300000)
  }

  /**
   * 手动触发内存清理
   */
  static triggerCleanup(): void {
    console.log('手动触发内存清理')
    memoryManager.manualCleanup()
    
    // 等待一秒后显示清理效果
    setTimeout(() => {
      const report = memoryManager.getMemoryReport()
      console.log('清理后内存状态:', report.current)
    }, 1000)
  }

  /**
   * 获取简化的统计信息
   */
  static getSimpleStats(): any {
    const report = memoryManager.getMemoryReport()
    const localStorage = this.getLocalStorageStats()
    
    return {
      memory: {
        used: report.current.used,
        usage: report.current.usage,
        trend: report.trend
      },
      localStorage: {
        size: localStorage.totalSize,
        items: localStorage.itemCount
      },
      domNodes: document.querySelectorAll('*').length,
      lastCleanup: report.lastCleanup
    }
  }
}

// 在浏览器环境中暴露到全局
if (typeof window !== 'undefined') {
  window.memoryMonitor = {
    getReport: () => MemoryMonitor.getDetailedReport(),
    triggerCleanup: () => MemoryMonitor.triggerCleanup(),
    startMonitoring: () => MemoryMonitor.startMonitoring(),
    stopMonitoring: () => memoryManager.stopMonitoring(),
    getStats: () => MemoryMonitor.getSimpleStats()
  }
  
  console.log('内存监控工具已加载，可使用 window.memoryMonitor')
}

// 导出监控工具
export const memoryMonitor = MemoryMonitor
