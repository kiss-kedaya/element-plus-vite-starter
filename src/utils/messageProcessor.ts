/**
 * 消息处理工具类
 * 提供消息去重、会话ID计算、幂等性保证等功能
 */

import type { ChatMessage } from '@/types/chat'
import { log } from './logger'

// 消息处理状态
enum MessageProcessingState {
  PENDING = 'pending',
  PROCESSING = 'processing', 
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 消息处理记录
interface MessageProcessingRecord {
  messageId: string
  messageHash: string
  state: MessageProcessingState
  timestamp: number
  attempts: number
  wxid: string
  sessionId: string
}

// 消息唯一标识符
interface MessageIdentifier {
  id: string
  hash: string
  timestamp: number
  fromUser: string
  toUser: string
  content: string
}

/**
 * 消息处理器类
 */
export class MessageProcessor {
  private static instance: MessageProcessor
  private processingRecords = new Map<string, MessageProcessingRecord>()
  private readonly MAX_PROCESSING_TIME = 30000 // 30秒超时
  private readonly MAX_ATTEMPTS = 3
  private readonly CLEANUP_INTERVAL = 300000 // 5分钟清理一次

  private constructor() {
    // 定期清理过期的处理记录
    setInterval(() => {
      this.cleanupExpiredRecords()
    }, this.CLEANUP_INTERVAL)
  }

  /**
   * 获取单例实例
   */
  static getInstance(): MessageProcessor {
    if (!MessageProcessor.instance) {
      MessageProcessor.instance = new MessageProcessor()
    }
    return MessageProcessor.instance
  }

  /**
   * 生成消息的唯一标识符
   */
  generateMessageIdentifier(message: ChatMessage): MessageIdentifier {
    const content = message.content || ''
    const timestamp = message.timestamp?.getTime() || Date.now()
    
    // 生成内容哈希
    const hash = this.generateContentHash({
      id: message.id,
      content,
      timestamp,
      fromUser: message.fromUser || '',
      toUser: message.toUser || '',
      type: message.type || 'text'
    })

    return {
      id: message.id,
      hash,
      timestamp,
      fromUser: message.fromUser || '',
      toUser: message.toUser || '',
      content: content.substring(0, 100) // 只保留前100个字符用于调试
    }
  }

  /**
   * 生成内容哈希
   */
  private generateContentHash(data: any): string {
    const str = JSON.stringify(data, Object.keys(data).sort())
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 计算标准化的会话ID（使用统一的会话ID计算器）
   */
  calculateSessionId(message: ChatMessage, currentWxid: string): string {
    // 使用延迟导入避免循环依赖
    let sessionIdCalculator: any
    try {
      sessionIdCalculator = require('@/utils/sessionIdCalculator').sessionIdCalculator
      const result = sessionIdCalculator.calculateSessionId(message, currentWxid)
      return result.sessionId
    } catch (error) {
      log.warn('会话ID计算器导入失败，使用回退逻辑', { error }, 'MessageProcessor')

      // 回退到原有逻辑
      if (message.sessionId && message.sessionId.trim()) {
        return message.sessionId.trim()
      }

      // 根据消息方向计算会话ID
      if (message.fromMe) {
        return message.toUser || message.fromUser || 'unknown'
      } else {
        return message.fromUser || message.toUser || 'unknown'
      }
    }
  }

  /**
   * 检查消息是否已经处理过
   */
  isMessageProcessed(messageId: MessageIdentifier, wxid: string): boolean {
    const recordKey = `${wxid}_${messageId.id}_${messageId.hash}`
    const record = this.processingRecords.get(recordKey)
    
    if (!record) {
      return false
    }

    // 检查是否已完成处理
    if (record.state === MessageProcessingState.COMPLETED) {
      return true
    }

    // 检查是否正在处理中且未超时
    if (record.state === MessageProcessingState.PROCESSING) {
      const now = Date.now()
      if (now - record.timestamp < this.MAX_PROCESSING_TIME) {
        return true // 正在处理中，视为已处理
      } else {
        // 超时，重置状态
        record.state = MessageProcessingState.FAILED
        record.attempts++
        console.warn(`消息处理超时: ${messageId.id}`)
      }
    }

    // 检查重试次数
    if (record.attempts >= this.MAX_ATTEMPTS) {
      console.error(`消息处理失败次数过多: ${messageId.id}`)
      return true // 避免无限重试
    }

    return false
  }

  /**
   * 标记消息开始处理
   */
  markMessageProcessing(messageId: MessageIdentifier, wxid: string, sessionId: string): boolean {
    const recordKey = `${wxid}_${messageId.id}_${messageId.hash}`
    const existingRecord = this.processingRecords.get(recordKey)

    if (existingRecord && existingRecord.state === MessageProcessingState.PROCESSING) {
      const now = Date.now()
      if (now - existingRecord.timestamp < this.MAX_PROCESSING_TIME) {
        return false // 正在处理中
      }
    }

    // 创建或更新处理记录
    const record: MessageProcessingRecord = {
      messageId: messageId.id,
      messageHash: messageId.hash,
      state: MessageProcessingState.PROCESSING,
      timestamp: Date.now(),
      attempts: (existingRecord?.attempts || 0) + 1,
      wxid,
      sessionId
    }

    this.processingRecords.set(recordKey, record)
    return true
  }

  /**
   * 标记消息处理完成
   */
  markMessageCompleted(messageId: MessageIdentifier, wxid: string): void {
    const recordKey = `${wxid}_${messageId.id}_${messageId.hash}`
    const record = this.processingRecords.get(recordKey)
    
    if (record) {
      record.state = MessageProcessingState.COMPLETED
      record.timestamp = Date.now()
    }
  }

  /**
   * 标记消息处理失败
   */
  markMessageFailed(messageId: MessageIdentifier, wxid: string, error?: Error): void {
    const recordKey = `${wxid}_${messageId.id}_${messageId.hash}`
    const record = this.processingRecords.get(recordKey)
    
    if (record) {
      record.state = MessageProcessingState.FAILED
      record.timestamp = Date.now()
      console.error(`消息处理失败: ${messageId.id}`, error)
    }
  }

  /**
   * 检查消息是否属于指定账号
   */
  isMessageForAccount(message: ChatMessage, targetWxid: string, messageWxid?: string): boolean {
    // 如果明确指定了消息所属账号，直接比较
    if (messageWxid) {
      return messageWxid === targetWxid
    }

    // 如果消息中包含账号信息，使用消息中的信息
    if (message.wxid) {
      return message.wxid === targetWxid
    }

    // 如果没有明确的账号信息，根据消息内容推断
    // 这里可以添加更复杂的推断逻辑
    return true // 默认认为属于当前账号
  }

  /**
   * 验证消息数据完整性
   */
  validateMessage(message: ChatMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查必需字段
    if (!message.id || message.id.trim() === '') {
      errors.push('消息ID不能为空')
    }

    if (!message.content && !message.type) {
      errors.push('消息内容或类型不能为空')
    }

    if (!message.fromUser && !message.toUser) {
      errors.push('发送方或接收方不能为空')
    }

    // 检查时间戳
    if (message.timestamp && isNaN(message.timestamp.getTime())) {
      errors.push('时间戳格式无效')
    }

    // 检查消息类型
    const validTypes = ['text', 'image', 'video', 'audio', 'file', 'system']
    if (message.type && !validTypes.includes(message.type)) {
      errors.push(`无效的消息类型: ${message.type}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 清理过期的处理记录
   */
  private cleanupExpiredRecords(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    this.processingRecords.forEach((record, key) => {
      // 清理超过1小时的记录
      if (now - record.timestamp > 3600000) {
        expiredKeys.push(key)
      }
    })

    expiredKeys.forEach(key => {
      this.processingRecords.delete(key)
    })

    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期的消息处理记录`)
    }
  }

  /**
   * 获取处理统计信息
   */
  getProcessingStats(): any {
    const stats = {
      total: this.processingRecords.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    }

    this.processingRecords.forEach(record => {
      switch (record.state) {
        case MessageProcessingState.PENDING:
          stats.pending++
          break
        case MessageProcessingState.PROCESSING:
          stats.processing++
          break
        case MessageProcessingState.COMPLETED:
          stats.completed++
          break
        case MessageProcessingState.FAILED:
          stats.failed++
          break
      }
    })

    return stats
  }

  /**
   * 重置处理器状态
   */
  reset(): void {
    this.processingRecords.clear()
    console.log('消息处理器状态已重置')
  }
}

// 导出单例实例
export const messageProcessor = MessageProcessor.getInstance()
