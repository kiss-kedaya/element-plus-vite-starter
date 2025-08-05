/**
 * 统一的会话ID计算器
 * 解决不同地方会话ID计算逻辑不一致的问题
 */

import { log } from './logger'
import type { ChatMessage } from '@/types/chat'

// 消息类型枚举
enum MessageType {
  PRIVATE = 'private',
  GROUP = 'group',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

// 会话ID计算结果
interface SessionIdResult {
  sessionId: string
  messageType: MessageType
  isGroupMessage: boolean
  confidence: number // 0-1之间，表示计算结果的置信度
  reason: string
}

// 会话ID计算配置
interface SessionIdConfig {
  enableGroupDetection: boolean
  enableFallbackLogic: boolean
  groupChatSuffix: string
  unknownSessionPrefix: string
}

/**
 * 统一的会话ID计算器
 */
export class SessionIdCalculator {
  private static instance: SessionIdCalculator

  private readonly config: SessionIdConfig = {
    enableGroupDetection: true,
    enableFallbackLogic: true,
    groupChatSuffix: '@chatroom',
    unknownSessionPrefix: 'unknown_session_'
  }

  static getInstance(): SessionIdCalculator {
    if (!SessionIdCalculator.instance) {
      SessionIdCalculator.instance = new SessionIdCalculator()
    }
    return SessionIdCalculator.instance
  }

  private constructor() {
    log.debug('会话ID计算器初始化完成', undefined, 'SessionIdCalculator')
  }

  /**
   * 计算会话ID（主要入口）
   */
  calculateSessionId(message: ChatMessage, currentWxid?: string): SessionIdResult {
    try {
      log.startTimer(`sessionId_${message.id}`)

      // 1. 检查消息基本信息
      const validationResult = this.validateMessage(message)
      if (!validationResult.isValid) {
        return this.createUnknownSession(message, validationResult.reason)
      }

      // 2. 确定消息类型
      const messageType = this.determineMessageType(message)

      // 3. 根据消息类型计算会话ID
      let result: SessionIdResult

      switch (messageType) {
        case MessageType.GROUP:
          result = this.calculateGroupSessionId(message)
          break
        case MessageType.PRIVATE:
          result = this.calculatePrivateSessionId(message, currentWxid)
          break
        case MessageType.SYSTEM:
          result = this.calculateSystemSessionId(message)
          break
        default:
          result = this.calculateFallbackSessionId(message)
      }

      log.debug('会话ID计算完成', {
        messageId: message.id,
        sessionId: result.sessionId,
        messageType: result.messageType,
        confidence: result.confidence
      }, 'SessionIdCalculator')

      return result

    } catch (error) {
      log.error('会话ID计算失败', {
        messageId: message.id,
        error
      }, 'SessionIdCalculator')

      return this.createUnknownSession(message, `Calculation error: ${error}`)
    } finally {
      log.endTimer(`sessionId_${message.id}`)
    }
  }

  /**
   * 验证消息基本信息
   */
  private validateMessage(message: ChatMessage): { isValid: boolean; reason?: string } {
    if (!message) {
      return { isValid: false, reason: 'Message is null or undefined' }
    }

    if (!message.id) {
      return { isValid: false, reason: 'Message ID is missing' }
    }

    if (!message.fromUser && !message.toUser) {
      return { isValid: false, reason: 'Both fromUser and toUser are missing' }
    }

    return { isValid: true }
  }

  /**
   * 确定消息类型
   */
  private determineMessageType(message: ChatMessage): MessageType {
    // 1. 检查是否为群聊消息
    if (this.isGroupMessage(message)) {
      return MessageType.GROUP
    }

    // 2. 检查是否为系统消息
    if (this.isSystemMessage(message)) {
      return MessageType.SYSTEM
    }

    // 3. 检查是否为私聊消息
    if (this.isPrivateMessage(message)) {
      return MessageType.PRIVATE
    }

    return MessageType.UNKNOWN
  }

  /**
   * 检查是否为群聊消息
   */
  private isGroupMessage(message: ChatMessage): boolean {
    if (!this.config.enableGroupDetection) {
      return false
    }

    // 检查fromUser或toUser是否包含群聊标识
    const fromUser = message.fromUser || ''
    const toUser = message.toUser || ''

    return fromUser.includes(this.config.groupChatSuffix) ||
           toUser.includes(this.config.groupChatSuffix)
  }

  /**
   * 检查是否为系统消息
   */
  private isSystemMessage(message: ChatMessage): boolean {
    // 系统消息通常没有明确的发送者或接收者
    return message.type === 'system' ||
           (!message.fromUser && !message.toUser) ||
           message.fromUser === 'system' ||
           message.toUser === 'system'
  }

  /**
   * 检查是否为私聊消息
   */
  private isPrivateMessage(message: ChatMessage): boolean {
    // 有明确的发送者和接收者，且不是群聊
    return !!(message.fromUser && message.toUser) &&
           !this.isGroupMessage(message) &&
           !this.isSystemMessage(message)
  }

  /**
   * 计算群聊会话ID
   */
  private calculateGroupSessionId(message: ChatMessage): SessionIdResult {
    const fromUser = message.fromUser || ''
    const toUser = message.toUser || ''

    // 群聊会话ID就是群聊ID（包含@chatroom的那个）
    let sessionId: string

    if (fromUser.includes(this.config.groupChatSuffix)) {
      sessionId = fromUser
    } else if (toUser.includes(this.config.groupChatSuffix)) {
      sessionId = toUser
    } else {
      // 理论上不应该到这里，但提供回退逻辑
      sessionId = fromUser || toUser || this.generateUnknownSessionId()
    }

    return {
      sessionId,
      messageType: MessageType.GROUP,
      isGroupMessage: true,
      confidence: 0.95,
      reason: 'Group chat detected by chatroom suffix'
    }
  }

  /**
   * 计算私聊会话ID
   */
  private calculatePrivateSessionId(message: ChatMessage, currentWxid?: string): SessionIdResult {
    const fromUser = message.fromUser || ''
    const toUser = message.toUser || ''
    const fromMe = message.fromMe

    let sessionId: string
    let confidence = 0.9
    let reason = ''

    // 优先使用fromMe字段判断
    if (typeof fromMe === 'boolean') {
      if (fromMe) {
        // 我发送的消息，会话ID是接收者
        sessionId = toUser
        reason = 'Outgoing message, using toUser as sessionId'
      } else {
        // 我接收的消息，会话ID是发送者
        sessionId = fromUser
        reason = 'Incoming message, using fromUser as sessionId'
      }
    } else if (currentWxid) {
      // 使用当前微信ID判断
      if (fromUser === currentWxid) {
        sessionId = toUser
        reason = 'Current user is sender, using toUser as sessionId'
      } else if (toUser === currentWxid) {
        sessionId = fromUser
        reason = 'Current user is receiver, using fromUser as sessionId'
      } else {
        // 都不匹配，使用发送者作为会话ID
        sessionId = fromUser
        confidence = 0.7
        reason = 'Neither user matches current wxid, using fromUser as fallback'
      }
    } else {
      // 没有足够信息，使用发送者作为会话ID
      sessionId = fromUser
      confidence = 0.6
      reason = 'Insufficient information, using fromUser as fallback'
    }

    // 确保会话ID不为空
    if (!sessionId) {
      sessionId = toUser || this.generateUnknownSessionId()
      confidence = 0.3
      reason = 'Empty sessionId, using fallback logic'
    }

    return {
      sessionId,
      messageType: MessageType.PRIVATE,
      isGroupMessage: false,
      confidence,
      reason
    }
  }

  /**
   * 计算系统消息会话ID
   */
  private calculateSystemSessionId(message: ChatMessage): SessionIdResult {
    // 系统消息使用固定的会话ID
    const sessionId = 'system_messages'

    return {
      sessionId,
      messageType: MessageType.SYSTEM,
      isGroupMessage: false,
      confidence: 1.0,
      reason: 'System message with fixed sessionId'
    }
  }

  /**
   * 计算回退会话ID
   */
  private calculateFallbackSessionId(message: ChatMessage): SessionIdResult {
    const fromUser = message.fromUser || ''
    const toUser = message.toUser || ''

    // 回退逻辑：优先使用fromUser，然后toUser，最后生成未知会话ID
    let sessionId: string
    let confidence = 0.5
    let reason = ''

    if (fromUser) {
      sessionId = fromUser
      reason = 'Fallback to fromUser'
    } else if (toUser) {
      sessionId = toUser
      reason = 'Fallback to toUser'
    } else {
      sessionId = this.generateUnknownSessionId()
      confidence = 0.1
      reason = 'Generated unknown sessionId'
    }

    return {
      sessionId,
      messageType: MessageType.UNKNOWN,
      isGroupMessage: false,
      confidence,
      reason
    }
  }

  /**
   * 创建未知会话
   */
  private createUnknownSession(message: ChatMessage, reason: string): SessionIdResult {
    return {
      sessionId: this.generateUnknownSessionId(),
      messageType: MessageType.UNKNOWN,
      isGroupMessage: false,
      confidence: 0.0,
      reason
    }
  }

  /**
   * 生成未知会话ID
   */
  private generateUnknownSessionId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 6)
    return `${this.config.unknownSessionPrefix}${timestamp}_${random}`
  }

  /**
   * 批量计算会话ID（用于消息列表处理）
   */
  batchCalculateSessionIds(messages: ChatMessage[], currentWxid?: string): Map<string, SessionIdResult> {
    const results = new Map<string, SessionIdResult>()

    log.startTimer('batchSessionIdCalculation')

    try {
      for (const message of messages) {
        const result = this.calculateSessionId(message, currentWxid)
        results.set(message.id, result)
      }

      log.debug('批量会话ID计算完成', {
        messageCount: messages.length,
        resultCount: results.size
      }, 'SessionIdCalculator')

    } catch (error) {
      log.error('批量会话ID计算失败', { error }, 'SessionIdCalculator')
    } finally {
      log.endTimer('batchSessionIdCalculation')
    }

    return results
  }

  /**
   * 验证会话ID的一致性
   */
  validateSessionIdConsistency(messages: ChatMessage[], currentWxid?: string): {
    isConsistent: boolean
    inconsistencies: Array<{
      messageId: string
      expectedSessionId: string
      actualSessionId: string
      confidence: number
    }>
  } {
    const inconsistencies: Array<{
      messageId: string
      expectedSessionId: string
      actualSessionId: string
      confidence: number
    }> = []

    for (const message of messages) {
      const result = this.calculateSessionId(message, currentWxid)

      // 如果消息已经有会话ID，检查是否一致
      if (message.sessionId && message.sessionId !== result.sessionId) {
        // 只有在置信度较高时才认为是不一致
        if (result.confidence > 0.8) {
          inconsistencies.push({
            messageId: message.id,
            expectedSessionId: result.sessionId,
            actualSessionId: message.sessionId,
            confidence: result.confidence
          })
        }
      }
    }

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): any {
    return {
      config: this.config,
      supportedMessageTypes: Object.values(MessageType),
      version: '1.0.0'
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SessionIdConfig>): void {
    Object.assign(this.config, newConfig)
    log.info('会话ID计算器配置已更新', { config: this.config }, 'SessionIdCalculator')
  }
}

// 创建全局实例
export const sessionIdCalculator = SessionIdCalculator.getInstance()

// 便捷函数
export function calculateSessionId(message: ChatMessage, currentWxid?: string): string {
  const result = sessionIdCalculator.calculateSessionId(message, currentWxid)
  return result.sessionId
}

export function isGroupMessage(message: ChatMessage): boolean {
  const result = sessionIdCalculator.calculateSessionId(message)
  return result.isGroupMessage
}