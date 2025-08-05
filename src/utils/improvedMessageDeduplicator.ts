/**
 * 改进的消息去重管理器
 * 解决基于时间窗口的去重机制缺陷
 */

import { log } from './logger'
import type { ChatMessage } from '@/types/chat'

// 消息指纹接口
interface MessageFingerprint {
  id: string
  contentHash: string
  timestamp: number
  fromUser: string
  toUser: string
  sessionId: string
  messageType: string
}

// 去重结果
interface DeduplicationResult {
  isDuplicate: boolean
  reason?: string
  existingMessageId?: string
  confidence: number // 0-1之间，表示去重的置信度
}

// 去重配置
interface DeduplicationConfig {
  enableIdMatching: boolean
  enableContentMatching: boolean
  enableTimestampMatching: boolean
  contentSimilarityThreshold: number
  timestampToleranceMs: number
  maxCacheSize: number
  cacheExpirationMs: number
}

/**
 * 改进的消息去重器
 */
export class ImprovedMessageDeduplicator {
  private static instance: ImprovedMessageDeduplicator
  private messageCache = new Map<string, MessageFingerprint>()
  private sessionCaches = new Map<string, Map<string, MessageFingerprint>>()

  private readonly config: DeduplicationConfig = {
    enableIdMatching: true,
    enableContentMatching: true,
    enableTimestampMatching: true,
    contentSimilarityThreshold: 0.95,
    timestampToleranceMs: 2000, // 2秒容差
    maxCacheSize: 1000,
    cacheExpirationMs: 24 * 60 * 60 * 1000 // 24小时
  }

  static getInstance(): ImprovedMessageDeduplicator {
    if (!ImprovedMessageDeduplicator.instance) {
      ImprovedMessageDeduplicator.instance = new ImprovedMessageDeduplicator()
    }
    return ImprovedMessageDeduplicator.instance
  }

  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.startPeriodicCleanup()

    // 在浏览器环境中监听页面卸载事件
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup()
      })
    }
  }

  /**
   * 检查消息是否重复
   */
  isDuplicate(message: ChatMessage, sessionId: string, existingMessages: ChatMessage[]): DeduplicationResult {
    try {
      log.startTimer(`deduplication_${message.id}`)

      // 生成消息指纹
      const fingerprint = this.generateFingerprint(message, sessionId)

      // 1. 精确ID匹配（最高优先级）
      if (this.config.enableIdMatching) {
        const idResult = this.checkIdDuplication(fingerprint, existingMessages)
        if (idResult.isDuplicate) {
          log.debug('消息ID重复检测', {
            messageId: message.id,
            reason: idResult.reason
          }, 'ImprovedMessageDeduplicator')
          return idResult
        }
      }

      // 2. 内容+时间戳匹配（中等优先级）
      if (this.config.enableContentMatching && this.config.enableTimestampMatching) {
        const contentTimeResult = this.checkContentTimestampDuplication(fingerprint, existingMessages)
        if (contentTimeResult.isDuplicate) {
          log.debug('消息内容+时间戳重复检测', {
            messageId: message.id,
            reason: contentTimeResult.reason
          }, 'ImprovedMessageDeduplicator')
          return contentTimeResult
        }
      }

      // 3. 内容相似度匹配（最低优先级）
      if (this.config.enableContentMatching) {
        const similarityResult = this.checkContentSimilarity(fingerprint, existingMessages)
        if (similarityResult.isDuplicate) {
          log.debug('消息内容相似度重复检测', {
            messageId: message.id,
            reason: similarityResult.reason,
            confidence: similarityResult.confidence
          }, 'ImprovedMessageDeduplicator')
          return similarityResult
        }
      }

      // 消息不重复，添加到缓存
      this.addToCache(fingerprint, sessionId)

      return {
        isDuplicate: false,
        confidence: 1.0
      }

    } catch (error) {
      log.error('消息去重检查失败', {
        messageId: message.id,
        error
      }, 'ImprovedMessageDeduplicator')

      // 出错时保守处理，认为不重复
      return {
        isDuplicate: false,
        confidence: 0.5,
        reason: 'Deduplication check failed'
      }
    } finally {
      log.endTimer(`deduplication_${message.id}`)
    }
  }

  /**
   * 生成消息指纹
   */
  private generateFingerprint(message: ChatMessage, sessionId: string): MessageFingerprint {
    return {
      id: message.id,
      contentHash: this.generateContentHash(message),
      timestamp: message.timestamp?.getTime() || Date.now(),
      fromUser: message.fromUser || '',
      toUser: message.toUser || '',
      sessionId,
      messageType: message.type || 'text'
    }
  }

  /**
   * 生成内容哈希（改进版）
   */
  private generateContentHash(message: ChatMessage): string {
    // 标准化内容
    const normalizedContent = this.normalizeContent(message.content || '')

    // 包含更多字段以提高唯一性
    const hashInput = {
      content: normalizedContent,
      type: message.type || 'text',
      fromMe: message.fromMe || false,
      // 对于特殊消息类型，包含额外信息
      ...(message.type === 'image' && {
        imageUrl: message.imageUrl,
        imageSize: message.imageSize
      }),
      ...(message.type === 'file' && {
        fileName: message.fileName,
        fileSize: message.fileSize
      })
    }

    return this.simpleHash(JSON.stringify(hashInput, Object.keys(hashInput).sort()))
  }

  /**
   * 标准化消息内容
   */
  private normalizeContent(content: string): string {
    return content
      .trim()
      .replace(/\s+/g, ' ') // 标准化空白字符
      .toLowerCase() // 转小写
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 检查ID重复
   */
  private checkIdDuplication(fingerprint: MessageFingerprint, existingMessages: ChatMessage[]): DeduplicationResult {
    const existingMessage = existingMessages.find(msg => msg.id === fingerprint.id)

    if (existingMessage) {
      return {
        isDuplicate: true,
        reason: 'Exact ID match',
        existingMessageId: existingMessage.id,
        confidence: 1.0
      }
    }

    return { isDuplicate: false, confidence: 1.0 }
  }

  /**
   * 检查内容+时间戳重复
   */
  private checkContentTimestampDuplication(fingerprint: MessageFingerprint, existingMessages: ChatMessage[]): DeduplicationResult {
    for (const existingMessage of existingMessages) {
      const existingFingerprint = this.generateFingerprint(existingMessage, fingerprint.sessionId)

      // 内容哈希完全匹配
      if (existingFingerprint.contentHash === fingerprint.contentHash) {
        const timeDiff = Math.abs(fingerprint.timestamp - existingFingerprint.timestamp)

        // 时间戳在容差范围内
        if (timeDiff <= this.config.timestampToleranceMs) {
          return {
            isDuplicate: true,
            reason: `Content hash match with timestamp tolerance (${timeDiff}ms)`,
            existingMessageId: existingMessage.id,
            confidence: 0.95
          }
        }
      }
    }

    return { isDuplicate: false, confidence: 1.0 }
  }

  /**
   * 检查内容相似度
   */
  private checkContentSimilarity(fingerprint: MessageFingerprint, existingMessages: ChatMessage[]): DeduplicationResult {
    const currentContent = fingerprint.contentHash

    for (const existingMessage of existingMessages) {
      const existingFingerprint = this.generateFingerprint(existingMessage, fingerprint.sessionId)

      // 计算内容相似度
      const similarity = this.calculateSimilarity(currentContent, existingFingerprint.contentHash)

      if (similarity >= this.config.contentSimilarityThreshold) {
        // 检查时间戳，避免误判正常的相似消息
        const timeDiff = Math.abs(fingerprint.timestamp - existingFingerprint.timestamp)

        // 只有在短时间内的相似消息才认为是重复
        if (timeDiff <= this.config.timestampToleranceMs * 2) {
          return {
            isDuplicate: true,
            reason: `High content similarity (${(similarity * 100).toFixed(1)}%) within time window`,
            existingMessageId: existingMessage.id,
            confidence: similarity
          }
        }
      }
    }

    return { isDuplicate: false, confidence: 1.0 }
  }

  /**
   * 计算字符串相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0
    if (str1.length === 0 || str2.length === 0) return 0.0

    // 使用简化的编辑距离算法
    const maxLength = Math.max(str1.length, str2.length)
    const distance = this.levenshteinDistance(str1, str2)

    return 1 - (distance / maxLength)
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * 添加到缓存
   */
  private addToCache(fingerprint: MessageFingerprint, sessionId: string): void {
    // 全局缓存
    this.messageCache.set(fingerprint.id, fingerprint)

    // 会话级缓存
    if (!this.sessionCaches.has(sessionId)) {
      this.sessionCaches.set(sessionId, new Map())
    }

    const sessionCache = this.sessionCaches.get(sessionId)!
    sessionCache.set(fingerprint.id, fingerprint)

    // 控制缓存大小
    this.limitCacheSize()
  }

  /**
   * 限制缓存大小
   */
  private limitCacheSize(): void {
    // 全局缓存大小控制
    if (this.messageCache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.messageCache.entries())
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp) // 按时间戳降序排序

      // 保留最新的一半
      const keepCount = Math.floor(this.config.maxCacheSize / 2)
      this.messageCache.clear()

      entries.slice(0, keepCount).forEach(([id, fingerprint]) => {
        this.messageCache.set(id, fingerprint)
      })
    }

    // 会话缓存大小控制
    this.sessionCaches.forEach((sessionCache, sessionId) => {
      if (sessionCache.size > this.config.maxCacheSize / 10) { // 每个会话最多缓存100条
        const entries = Array.from(sessionCache.entries())
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp)

        const keepCount = Math.floor(this.config.maxCacheSize / 20)
        sessionCache.clear()

        entries.slice(0, keepCount).forEach(([id, fingerprint]) => {
          sessionCache.set(id, fingerprint)
        })
      }
    })
  }

  /**
   * 定期清理过期缓存
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache()
    }, 60 * 60 * 1000) // 每小时清理一次
  }

  /**
   * 清理资源，防止内存泄漏
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    this.clearCache()
    log.debug('消息去重器资源已清理', undefined, 'ImprovedMessageDeduplicator')
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    const expiredThreshold = now - this.config.cacheExpirationMs

    // 清理全局缓存
    for (const [id, fingerprint] of this.messageCache.entries()) {
      if (fingerprint.timestamp < expiredThreshold) {
        this.messageCache.delete(id)
      }
    }

    // 清理会话缓存
    this.sessionCaches.forEach((sessionCache, sessionId) => {
      for (const [id, fingerprint] of sessionCache.entries()) {
        if (fingerprint.timestamp < expiredThreshold) {
          sessionCache.delete(id)
        }
      }

      // 如果会话缓存为空，删除整个会话缓存
      if (sessionCache.size === 0) {
        this.sessionCaches.delete(sessionId)
      }
    })

    log.debug('过期消息缓存清理完成', {
      globalCacheSize: this.messageCache.size,
      sessionCacheCount: this.sessionCaches.size
    }, 'ImprovedMessageDeduplicator')
  }

  /**
   * 获取统计信息
   */
  getStats(): any {
    return {
      globalCacheSize: this.messageCache.size,
      sessionCacheCount: this.sessionCaches.size,
      totalSessionMessages: Array.from(this.sessionCaches.values())
        .reduce((sum, cache) => sum + cache.size, 0),
      config: this.config
    }
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.messageCache.clear()
    this.sessionCaches.clear()
    log.info('消息去重缓存已清除', undefined, 'ImprovedMessageDeduplicator')
  }
}

// 创建全局实例
export const improvedMessageDeduplicator = ImprovedMessageDeduplicator.getInstance()