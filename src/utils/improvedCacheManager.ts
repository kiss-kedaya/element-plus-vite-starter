/**
 * 改进的缓存管理系统
 * 解决页面刷新后消息不加载的问题
 */

import { ChunkedStorage } from './storageCompression'
import { log } from './logger'
import type { ChatSession, ChatMessage } from '@/types/chat'

// 缓存版本管理
const CACHE_VERSION = '3.0'
const CACHE_COMPATIBILITY_VERSIONS = ['2.0', '2.1', '2.2']

// 缓存键管理
export class CacheKeyManager {
  private static readonly PREFIX = 'wechat_app'
  private static readonly VERSION_KEY = `${CacheKeyManager.PREFIX}_version`

  static getAccountDataKey(wxid: string): string {
    return `${this.PREFIX}_account_${wxid}_v${CACHE_VERSION}`
  }

  static getSessionsKey(wxid: string): string {
    return `${this.PREFIX}_sessions_${wxid}_v${CACHE_VERSION}`
  }

  static getMessagesKey(wxid: string): string {
    return `${this.PREFIX}_messages_${wxid}_v${CACHE_VERSION}`
  }

  static getCurrentVersion(): string {
    return localStorage.getItem(this.VERSION_KEY) || '1.0'
  }

  static setCurrentVersion(): void {
    localStorage.setItem(this.VERSION_KEY, CACHE_VERSION)
  }

  static isVersionCompatible(version: string): boolean {
    return version === CACHE_VERSION || CACHE_COMPATIBILITY_VERSIONS.includes(version)
  }
}

// 账号数据接口
interface AccountCacheData {
  wxid: string
  sessions: ChatSession[]
  messages: Record<string, ChatMessage[]>
  currentSession: ChatSession | null
  lastUpdateTime: number
  version: string
  metadata: {
    totalMessages: number
    totalSessions: number
    lastAccess: number
  }
}

// 缓存操作结果
interface CacheOperationResult {
  success: boolean
  error?: string
  data?: any
  migrated?: boolean
}

/**
 * 改进的缓存管理器
 */
export class ImprovedCacheManager {
  private static instance: ImprovedCacheManager
  private migrationInProgress = new Set<string>()

  static getInstance(): ImprovedCacheManager {
    if (!ImprovedCacheManager.instance) {
      ImprovedCacheManager.instance = new ImprovedCacheManager()
    }
    return ImprovedCacheManager.instance
  }

  /**
   * 保存账号数据到缓存
   */
  async saveAccountData(
    wxid: string,
    sessions: ChatSession[],
    messages: Record<string, ChatMessage[]>,
    currentSession: ChatSession | null
  ): Promise<CacheOperationResult> {
    try {
      log.startTimer(`saveAccountData_${wxid}`)

      // 验证数据完整性
      const validationResult = this.validateAccountData(sessions, messages)
      if (!validationResult.success) {
        return validationResult
      }

      // 准备缓存数据
      const cacheData: AccountCacheData = {
        wxid,
        sessions: this.sanitizeSessions(sessions),
        messages: this.sanitizeMessages(messages),
        currentSession,
        lastUpdateTime: Date.now(),
        version: CACHE_VERSION,
        metadata: {
          totalMessages: Object.values(messages).reduce((sum, msgs) => sum + msgs.length, 0),
          totalSessions: sessions.length,
          lastAccess: Date.now()
        }
      }

      // 使用分页存储
      const cacheKey = CacheKeyManager.getAccountDataKey(wxid)
      const success = ChunkedStorage.saveChunked(cacheKey, cacheData)

      if (success) {
        // 更新版本信息
        CacheKeyManager.setCurrentVersion()

        log.info('账号数据保存成功', {
          wxid,
          dataSize: JSON.stringify(cacheData).length,
          sessionsCount: sessions.length,
          messagesCount: cacheData.metadata.totalMessages
        }, 'ImprovedCacheManager')

        return { success: true, data: cacheData }
      } else {
        // 降级处理
        return await this.handleSaveFailure(wxid, cacheData)
      }

    } catch (error) {
      log.error('保存账号数据失败', { wxid, error }, 'ImprovedCacheManager')
      return { success: false, error: String(error) }
    } finally {
      log.endTimer(`saveAccountData_${wxid}`)
    }
  }

  /**
   * 从缓存加载账号数据
   */
  async loadAccountData(wxid: string): Promise<CacheOperationResult> {
    try {
      log.startTimer(`loadAccountData_${wxid}`)

      // 检查是否正在迁移
      if (this.migrationInProgress.has(wxid)) {
        log.warn('账号数据正在迁移中', { wxid }, 'ImprovedCacheManager')
        return { success: false, error: 'Migration in progress' }
      }

      const cacheKey = CacheKeyManager.getAccountDataKey(wxid)

      // 尝试加载新格式数据
      let cacheData = ChunkedStorage.loadChunked(cacheKey) as AccountCacheData

      if (!cacheData) {
        // 尝试迁移旧格式数据
        const migrationResult = await this.migrateOldFormatData(wxid)
        if (migrationResult.success) {
          cacheData = migrationResult.data
        } else {
          log.info('没有找到可用的缓存数据', { wxid }, 'ImprovedCacheManager')
          return { success: false, error: 'No cache data found' }
        }
      }

      // 验证缓存数据
      const validationResult = this.validateCacheData(cacheData)
      if (!validationResult.success) {
        log.warn('缓存数据验证失败，尝试修复', { wxid, error: validationResult.error }, 'ImprovedCacheManager')
        const repairResult = await this.repairCacheData(wxid, cacheData)
        if (repairResult.success) {
          cacheData = repairResult.data
        } else {
          return repairResult
        }
      }

      // 异步更新访问时间，避免循环保存
      this.updateAccessTimeAsync(wxid, cacheData)

      log.info('账号数据加载成功', {
        wxid,
        version: cacheData.version,
        sessionsCount: cacheData.sessions.length,
        messagesCount: cacheData.metadata.totalMessages,
        migrated: validationResult.migrated
      }, 'ImprovedCacheManager')

      return {
        success: true,
        data: cacheData,
        migrated: validationResult.migrated
      }

    } catch (error) {
      log.error('加载账号数据失败', { wxid, error }, 'ImprovedCacheManager')
      return { success: false, error: String(error) }
    } finally {
      log.endTimer(`loadAccountData_${wxid}`)
    }
  }

  /**
   * 验证账号数据完整性
   */
  private validateAccountData(sessions: ChatSession[], messages: Record<string, ChatMessage[]>): CacheOperationResult {
    const errors: string[] = []

    // 验证会话数据
    if (!Array.isArray(sessions)) {
      errors.push('Sessions must be an array')
    } else {
      sessions.forEach((session, index) => {
        if (!session || !session.id || !session.name) {
          errors.push(`Invalid session at index ${index}`)
        }
      })
    }

    // 验证消息数据
    if (!messages || typeof messages !== 'object') {
      errors.push('Messages must be an object')
    } else {
      Object.entries(messages).forEach(([sessionId, msgs]) => {
        if (!Array.isArray(msgs)) {
          errors.push(`Messages for session ${sessionId} must be an array`)
        } else {
          msgs.forEach((msg, index) => {
            if (!msg || !msg.id) {
              errors.push(`Invalid message at session ${sessionId}, index ${index}`)
            }
          })
        }
      })
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined
    }
  }

  /**
   * 清理和验证会话数据
   */
  private sanitizeSessions(sessions: ChatSession[]): ChatSession[] {
    return sessions.filter(session =>
      session &&
      typeof session === 'object' &&
      session.id &&
      session.name
    ).map(session => ({
      ...session,
      lastMessageTime: session.lastMessageTime instanceof Date
        ? session.lastMessageTime
        : new Date(session.lastMessageTime || Date.now())
    }))
  }

  /**
   * 清理和验证消息数据
   */
  private sanitizeMessages(messages: Record<string, ChatMessage[]>): Record<string, ChatMessage[]> {
    const sanitized: Record<string, ChatMessage[]> = {}

    Object.entries(messages).forEach(([sessionId, msgs]) => {
      if (Array.isArray(msgs)) {
        sanitized[sessionId] = msgs.filter(msg =>
          msg &&
          typeof msg === 'object' &&
          msg.id
        ).map(msg => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date
            ? msg.timestamp
            : new Date(msg.timestamp || Date.now())
        }))
      }
    })

    return sanitized
  }

  /**
   * 验证缓存数据
   */
  private validateCacheData(cacheData: AccountCacheData): CacheOperationResult {
    const errors: string[] = []

    if (!cacheData) {
      errors.push('Cache data is null or undefined')
    } else {
      if (!cacheData.wxid) {
        errors.push('Missing wxid')
      }
      if (!cacheData.version) {
        errors.push('Missing version')
      } else if (!CacheKeyManager.isVersionCompatible(cacheData.version)) {
        errors.push(`Incompatible version: ${cacheData.version}`)
      }
      if (!Array.isArray(cacheData.sessions)) {
        errors.push('Sessions must be an array')
      }
      if (!cacheData.messages || typeof cacheData.messages !== 'object') {
        errors.push('Messages must be an object')
      }
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined
    }
  }

  /**
   * 处理保存失败的降级方案
   */
  private async handleSaveFailure(wxid: string, cacheData: AccountCacheData): Promise<CacheOperationResult> {
    try {
      log.warn('分页存储失败，尝试传统存储', { wxid }, 'ImprovedCacheManager')

      // 尝试使用传统localStorage
      const fallbackKey = `fallback_${CacheKeyManager.getAccountDataKey(wxid)}`
      localStorage.setItem(fallbackKey, JSON.stringify(cacheData))

      log.info('降级存储成功', { wxid }, 'ImprovedCacheManager')
      return { success: true, data: cacheData }

    } catch (error) {
      log.error('降级存储也失败', { wxid, error }, 'ImprovedCacheManager')
      return { success: false, error: `Both chunked and fallback storage failed: ${error}` }
    }
  }

  /**
   * 迁移旧格式数据
   */
  private async migrateOldFormatData(wxid: string): Promise<CacheOperationResult> {
    if (this.migrationInProgress.has(wxid)) {
      return { success: false, error: 'Migration already in progress' }
    }

    this.migrationInProgress.add(wxid)

    try {
      log.info('开始迁移旧格式数据', { wxid }, 'ImprovedCacheManager')

      // 尝试加载旧格式的缓存键
      const oldKeys = [
        `account_data_${wxid}`,
        `wechat_account_${wxid}`,
        `wechat_account_${wxid}_v2.0`,
        `wechat_account_${wxid}_v2.1`,
        `wechat_account_${wxid}_v2.2`
      ]

      for (const oldKey of oldKeys) {
        try {
          // 尝试分页加载
          let oldData = ChunkedStorage.loadChunked(oldKey)

          // 如果分页加载失败，尝试传统加载
          if (!oldData) {
            const rawData = localStorage.getItem(oldKey)
            if (rawData) {
              oldData = JSON.parse(rawData)
            }
          }

          if (oldData) {
            log.info('找到旧格式数据，开始转换', { wxid, oldKey }, 'ImprovedCacheManager')

            // 转换为新格式
            const migratedData = this.convertToNewFormat(wxid, oldData)

            // 保存新格式数据
            const saveResult = await this.saveAccountData(
              wxid,
              migratedData.sessions,
              migratedData.messages,
              migratedData.currentSession
            )

            if (saveResult.success) {
              // 清理旧数据
              ChunkedStorage.removeChunked(oldKey)
              localStorage.removeItem(oldKey)

              log.info('数据迁移成功', { wxid, oldKey }, 'ImprovedCacheManager')
              return { success: true, data: migratedData, migrated: true }
            }
          }
        } catch (error) {
          log.warn('迁移旧格式数据失败', { wxid, oldKey, error }, 'ImprovedCacheManager')
          continue
        }
      }

      log.info('没有找到可迁移的旧数据', { wxid }, 'ImprovedCacheManager')
      return { success: false, error: 'No migratable old data found' }

    } catch (error) {
      log.error('数据迁移异常', { wxid, error }, 'ImprovedCacheManager')
      return { success: false, error: String(error) }
    } finally {
      this.migrationInProgress.delete(wxid)
    }
  }

  /**
   * 转换为新格式
   */
  private convertToNewFormat(wxid: string, oldData: any): AccountCacheData {
    const now = Date.now()

    // 处理不同的旧格式
    let sessions: ChatSession[] = []
    let messages: Record<string, ChatMessage[]> = {}
    let currentSession: ChatSession | null = null

    if (oldData.sessions) {
      sessions = Array.isArray(oldData.sessions) ? oldData.sessions : []
    }

    if (oldData.messages) {
      messages = typeof oldData.messages === 'object' ? oldData.messages : {}
    }

    if (oldData.currentSession) {
      currentSession = oldData.currentSession
    }

    // 清理和验证数据
    sessions = this.sanitizeSessions(sessions)
    messages = this.sanitizeMessages(messages)

    return {
      wxid,
      sessions,
      messages,
      currentSession,
      lastUpdateTime: oldData.lastUpdateTime || now,
      version: CACHE_VERSION,
      metadata: {
        totalMessages: Object.values(messages).reduce((sum, msgs) => sum + msgs.length, 0),
        totalSessions: sessions.length,
        lastAccess: now
      }
    }
  }

  /**
   * 修复缓存数据
   */
  private async repairCacheData(wxid: string, cacheData: AccountCacheData): Promise<CacheOperationResult> {
    try {
      log.info('开始修复缓存数据', { wxid }, 'ImprovedCacheManager')

      // 修复基本字段
      if (!cacheData.wxid) cacheData.wxid = wxid
      if (!cacheData.version) cacheData.version = CACHE_VERSION
      if (!cacheData.lastUpdateTime) cacheData.lastUpdateTime = Date.now()

      // 修复会话数据
      if (!Array.isArray(cacheData.sessions)) {
        cacheData.sessions = []
      } else {
        cacheData.sessions = this.sanitizeSessions(cacheData.sessions)
      }

      // 修复消息数据
      if (!cacheData.messages || typeof cacheData.messages !== 'object') {
        cacheData.messages = {}
      } else {
        cacheData.messages = this.sanitizeMessages(cacheData.messages)
      }

      // 修复元数据
      if (!cacheData.metadata) {
        cacheData.metadata = {
          totalMessages: 0,
          totalSessions: 0,
          lastAccess: Date.now()
        }
      }

      cacheData.metadata.totalMessages = Object.values(cacheData.messages).reduce((sum, msgs) => sum + msgs.length, 0)
      cacheData.metadata.totalSessions = cacheData.sessions.length
      cacheData.metadata.lastAccess = Date.now()

      // 保存修复后的数据
      const saveResult = await this.saveAccountData(
        wxid,
        cacheData.sessions,
        cacheData.messages,
        cacheData.currentSession
      )

      if (saveResult.success) {
        log.info('缓存数据修复成功', { wxid }, 'ImprovedCacheManager')
        return { success: true, data: cacheData }
      } else {
        return saveResult
      }

    } catch (error) {
      log.error('修复缓存数据失败', { wxid, error }, 'ImprovedCacheManager')
      return { success: false, error: String(error) }
    }
  }

  /**
   * 异步更新访问时间，避免循环保存
   */
  private updateAccessTimeAsync(wxid: string, cacheData: AccountCacheData): void {
    // 使用setTimeout异步更新，避免阻塞当前操作
    setTimeout(async () => {
      try {
        // 只更新访问时间，不触发完整的保存操作
        cacheData.metadata.lastAccess = Date.now()

        // 使用轻量级的访问时间更新
        const cacheKey = CacheKeyManager.getAccountDataKey(wxid)
        const existingData = ChunkedStorage.loadChunked(cacheKey) as AccountCacheData

        if (existingData && existingData.metadata) {
          existingData.metadata.lastAccess = Date.now()

          // 只保存元数据更新，不触发完整的数据验证和保存流程
          ChunkedStorage.saveChunked(cacheKey, existingData)

          log.debug('访问时间更新完成', { wxid }, 'ImprovedCacheManager')
        }
      } catch (error) {
        log.warn('更新访问时间失败', { wxid, error }, 'ImprovedCacheManager')
        // 访问时间更新失败不应该影响主要功能
      }
    }, 100) // 100ms延迟，确保主要操作完成
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache(): void {
    try {
      const now = Date.now()
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30天

      // 遍历所有localStorage键
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('wechat_app_')) {
          try {
            const data = localStorage.getItem(key)
            if (data) {
              const parsed = JSON.parse(data)
              if (parsed.metadata && parsed.metadata.lastAccess) {
                if (now - parsed.metadata.lastAccess > maxAge) {
                  localStorage.removeItem(key)
                  log.debug('清理过期缓存', { key }, 'ImprovedCacheManager')
                }
              }
            }
          } catch (error) {
            // 忽略解析错误，继续处理下一个
          }
        }
      }

      log.info('过期缓存清理完成', undefined, 'ImprovedCacheManager')
    } catch (error) {
      log.error('清理过期缓存失败', { error }, 'ImprovedCacheManager')
    }
  }
}

// 创建全局实例
export const improvedCacheManager = new ImprovedCacheManager()