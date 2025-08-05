/**
 * 账号数据管理器 - 完全隔离的账号数据存储系统
 * 每个账号的数据完全独立，避免任何形式的数据污染
 */

import { ref, reactive, shallowReactive } from 'vue'
import type { ChatSession, ChatMessage } from '@/types/chat'
import { ChunkedStorage } from '@/utils/storageCompression'
import { memoryManager, MemoryManager } from '@/utils/memoryManager'
import { messageProcessor } from '@/utils/messageProcessor'
import { log } from '@/utils/logger'
import { improvedMessageDeduplicator } from '@/utils/improvedMessageDeduplicator'

// 单个账号的完整数据结构
interface AccountData {
  wxid: string
  sessions: ChatSession[]
  messages: Record<string, ChatMessage[]>
  currentSession: ChatSession | null
  lastUpdateTime: number
}

// 账号数据管理器
class AccountDataManager {
  // 所有账号的数据存储 - 使用shallowReactive提高性能
  private accountsData = shallowReactive<Record<string, AccountData>>({})

  // 当前活跃的账号ID
  private currentWxid = ref<string | null>(null)

  // 内存管理配置
  private memoryConfig = {
    maxAccountsInMemory: 3,
    maxMessagesPerSession: 500,
    maxSessionsPerAccount: 50,
    lastAccessTime: new Map<string, number>(),
    cleanupInterval: null as NodeJS.Timeout | null
  }

  // 清理定时器
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor() {
    // 注册内存清理回调
    memoryManager.registerCleanupCallback('accountDataManager', () => {
      this.performMemoryCleanup()
    })

    // 启动定期清理
    this.startPeriodicCleanup()

    // 监听页面卸载，清理资源
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup()
      })
    }
  }

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    // 每5分钟执行一次内存清理
    this.cleanupTimer = setInterval(() => {
      this.performMemoryCleanup()
      this.cleanupAccessTimeMap()
    }, 5 * 60 * 1000)
  }

  /**
   * 清理访问时间映射，防止Map无限增长
   */
  private cleanupAccessTimeMap(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24小时

    for (const [wxid, lastAccess] of this.memoryConfig.lastAccessTime.entries()) {
      if (now - lastAccess > maxAge) {
        this.memoryConfig.lastAccessTime.delete(wxid)
        log.debug('清理过期的访问时间记录', { wxid, lastAccess }, 'AccountDataManager')
      }
    }
  }

  /**
   * 执行内存清理
   */
  private performMemoryCleanup() {
    log.info('开始执行账号数据内存清理', undefined, 'AccountDataManager')

    const accountIds = Object.keys(this.accountsData)

    // 如果账号数量超过限制，清理最久未使用的账号
    if (accountIds.length > this.memoryConfig.maxAccountsInMemory) {
      const accountsWithAccess = accountIds.map(wxid => ({
        wxid,
        lastAccess: this.memoryConfig.lastAccessTime.get(wxid) || 0
      })).sort((a, b) => b.lastAccess - a.lastAccess)

      // 保留最近使用的账号，清理其他
      const accountsToRemove = accountsWithAccess.slice(this.memoryConfig.maxAccountsInMemory)

      accountsToRemove.forEach(({ wxid }) => {
        if (wxid !== this.currentWxid.value) {
          log.debug('清理内存中的账号数据', { wxid }, 'AccountDataManager')
          // 保存到缓存后从内存中删除
          this.saveAccountToCache(wxid)
          delete this.accountsData[wxid]
          this.memoryConfig.lastAccessTime.delete(wxid)
        }
      })
    }

    // 清理每个账号中过多的消息数据
    accountIds.forEach(wxid => {
      if (this.accountsData[wxid]) {
        this.cleanupAccountMessages(wxid)
        this.cleanupAccountSessions(wxid)
      }
    })

    log.info('内存清理完成', {
      accountCount: Object.keys(this.accountsData).length,
      memoryMapSize: this.memoryConfig.lastAccessTime.size
    }, 'AccountDataManager')
  }

  /**
   * 清理账号中的消息数据
   */
  private cleanupAccountMessages(wxid: string) {
    const accountData = this.accountsData[wxid]
    if (!accountData) return

    let totalCleaned = 0

    Object.keys(accountData.messages).forEach(sessionId => {
      const messages = accountData.messages[sessionId]
      if (messages && messages.length > this.memoryConfig.maxMessagesPerSession) {
        // 保留最新的消息
        const sortedMessages = messages.sort((a, b) =>
          (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
        )
        const keptMessages = sortedMessages.slice(0, this.memoryConfig.maxMessagesPerSession)
        const cleanedCount = messages.length - keptMessages.length

        accountData.messages[sessionId] = keptMessages
        totalCleaned += cleanedCount
      }
    })

    if (totalCleaned > 0) {
      log.debug('清理账号旧消息', { wxid, totalCleaned }, 'AccountDataManager')
    }
  }

  /**
   * 清理账号中的会话数据
   */
  private cleanupAccountSessions(wxid: string) {
    const accountData = this.accountsData[wxid]
    if (!accountData) return

    if (accountData.sessions.length > this.memoryConfig.maxSessionsPerAccount) {
      // 按最后消息时间排序，保留最新的会话
      const sortedSessions = accountData.sessions.sort((a, b) =>
        (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0)
      )

      const keptSessions = sortedSessions.slice(0, this.memoryConfig.maxSessionsPerAccount)
      const removedSessions = sortedSessions.slice(this.memoryConfig.maxSessionsPerAccount)

      // 删除对应的消息数据
      removedSessions.forEach(session => {
        delete accountData.messages[session.id]
      })

      accountData.sessions = keptSessions
      log.debug('清理账号旧会话', { wxid, removedCount: removedSessions.length }, 'AccountDataManager')
    }
  }

  /**
   * 更新账号访问时间
   */
  private updateAccountAccess(wxid: string) {
    this.memoryConfig.lastAccessTime.set(wxid, Date.now())
  }

  /**
   * 清理所有资源
   */
  private cleanup() {
    log.info('清理账号数据管理器资源', undefined, 'AccountDataManager')

    // 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 保存所有账号数据
    Object.keys(this.accountsData).forEach(wxid => {
      this.saveAccountToCache(wxid)
    })

    // 注销内存清理回调
    memoryManager.unregisterCleanupCallback('accountDataManager')

    // 清理内存数据
    Object.keys(this.accountsData).forEach(wxid => {
      delete this.accountsData[wxid]
    })

    this.memoryConfig.lastAccessTime.clear()
  }

  /**
   * 初始化账号数据
   */
  initAccount(wxid: string): AccountData {
    if (!this.accountsData[wxid]) {
      this.accountsData[wxid] = reactive({
        wxid,
        sessions: [],
        messages: {},
        currentSession: null,
        lastUpdateTime: Date.now()
      })
      console.log(`🆕 初始化账号数据: ${wxid}`)
    }
    return this.accountsData[wxid]
  }

  /**
   * 切换到指定账号
   */
  switchToAccount(wxid: string): AccountData {
    console.log(`切换账号数据管理器到: ${wxid}`)

    // 保存当前账号数据到缓存
    if (this.currentWxid.value) {
      this.saveAccountToCache(this.currentWxid.value)
    }

    // 切换到新账号
    this.currentWxid.value = wxid

    // 确保新账号数据存在
    this.initAccount(wxid)

    // 从缓存加载新账号数据
    this.loadAccountFromCache(wxid)

    // 更新访问时间
    this.updateAccountAccess(wxid)

    return this.accountsData[wxid]
  }

  /**
   * 获取当前账号数据
   */
  getCurrentAccountData(): AccountData | null {
    if (!this.currentWxid.value) return null
    return this.accountsData[this.currentWxid.value] || null
  }

  /**
   * 获取指定账号数据
   */
  getAccountData(wxid: string): AccountData {
    // 更新访问时间
    this.updateAccountAccess(wxid)
    return this.initAccount(wxid)
  }

  /**
   * 更新账号的会话列表
   */
  updateSessions(wxid: string, sessions: ChatSession[]) {
    const accountData = this.initAccount(wxid)
    accountData.sessions = [...sessions]
    accountData.lastUpdateTime = Date.now()
    console.log(`📝 更新账号 ${wxid} 的会话列表: ${sessions.length} 个会话`)
    
    // 立即保存到缓存
    this.saveAccountToCache(wxid)
  }

  /**
   * 更新账号的当前会话
   */
  updateCurrentSession(wxid: string, session: ChatSession | null) {
    const accountData = this.initAccount(wxid)

    // 创建新的会话对象以触发响应式更新
    if (session) {
      accountData.currentSession = { ...session }
    } else {
      accountData.currentSession = null
    }

    accountData.lastUpdateTime = Date.now()
    console.log(`📝 更新账号 ${wxid} 的当前会话: ${session?.name || 'null'}`, {
      oldSession: accountData.currentSession?.name,
      newSession: session?.name
    })

    // 立即保存到缓存
    this.saveAccountToCache(wxid)
  }

  /**
   * 添加消息到指定账号的指定会话（改进的去重逻辑）
   */
  addMessage(wxid: string, sessionId: string, message: ChatMessage): boolean {
    try {
      // 验证消息数据完整性
      const validation = messageProcessor.validateMessage(message)
      if (!validation.valid) {
        console.error(`消息数据无效: ${message.id}`, validation.errors)
        return false
      }

      // 生成消息唯一标识符
      const messageId = messageProcessor.generateMessageIdentifier(message)

      // 检查消息是否已经处理过
      if (messageProcessor.isMessageProcessed(messageId, wxid)) {
        console.log(`消息已处理过，跳过: ${message.id}`)
        return false
      }

      // 标记消息开始处理
      if (!messageProcessor.markMessageProcessing(messageId, wxid, sessionId)) {
        console.log(`消息正在处理中，跳过: ${message.id}`)
        return false
      }

      const accountData = this.initAccount(wxid)

      if (!accountData.messages[sessionId]) {
        accountData.messages[sessionId] = []
      }

      // 使用改进的消息去重器
      const existingMessages = accountData.messages[sessionId] || []
      const deduplicationResult = improvedMessageDeduplicator.isDuplicate(message, sessionId, existingMessages)

      if (deduplicationResult.isDuplicate) {
        log.debug('消息重复检测', {
          messageId: message.id,
          reason: deduplicationResult.reason,
          confidence: deduplicationResult.confidence,
          existingMessageId: deduplicationResult.existingMessageId
        }, 'AccountDataManager')

        messageProcessor.markMessageCompleted(messageId, wxid)
        return false
      }

      // 添加消息
      accountData.messages[sessionId].push(message)
      accountData.lastUpdateTime = Date.now()

      console.log(`添加消息到账号 ${wxid} 会话 ${sessionId}: ${message.content?.substring(0, 30)}...`, {
        messageId: message.id,
        messageHash: messageId.hash,
        fromMe: message.fromMe,
        timestamp: message.timestamp,
        totalMessages: accountData.messages[sessionId].length
      })

      // 检查是否需要清理旧消息
      if (accountData.messages[sessionId].length > this.memoryConfig.maxMessagesPerSession) {
        const sortedMessages = accountData.messages[sessionId].sort((a, b) =>
          (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
        )
        accountData.messages[sessionId] = sortedMessages.slice(0, this.memoryConfig.maxMessagesPerSession)
        console.log(`会话 ${sessionId} 消息数量超限，已清理到 ${this.memoryConfig.maxMessagesPerSession} 条`)
      }

      // 更新访问时间
      this.updateAccountAccess(wxid)

      // 标记消息处理完成
      messageProcessor.markMessageCompleted(messageId, wxid)

      // 立即保存到缓存
      this.saveAccountToCache(wxid)

      return true

    } catch (error) {
      console.error(`添加消息失败: ${message.id}`, error)

      // 标记消息处理失败
      const messageId = messageProcessor.generateMessageIdentifier(message)
      messageProcessor.markMessageFailed(messageId, wxid, error as Error)

      return false
    }
  }

  /**
   * 获取账号的所有消息
   */
  getMessages(wxid: string): Record<string, ChatMessage[]> {
    const accountData = this.getAccountData(wxid)
    return accountData.messages
  }

  /**
   * 获取账号指定会话的消息
   */
  getSessionMessages(wxid: string, sessionId: string): ChatMessage[] {
    const accountData = this.getAccountData(wxid)
    return accountData.messages[sessionId] || []
  }

  /**
   * 删除账号指定会话的所有消息
   */
  removeSessionMessages(wxid: string, sessionId: string) {
    const accountData = this.initAccount(wxid)
    delete accountData.messages[sessionId]
    accountData.lastUpdateTime = Date.now()

    console.log(`🗑️ 删除账号 ${wxid} 会话 ${sessionId} 的所有消息`)

    // 立即保存到缓存
    this.saveAccountToCache(wxid)
  }

  /**
   * 保存账号数据到localStorage（使用分页存储）
   */
  private saveAccountToCache(wxid: string) {
    try {
      const accountData = this.accountsData[wxid]
      if (!accountData) {
        console.warn(`尝试保存不存在的账号数据: ${wxid}`)
        return
      }

      // 验证数据完整性
      const validSessions = accountData.sessions.filter(session =>
        session && typeof session === 'object' && session.id && session.name
      )

      const validMessages: Record<string, ChatMessage[]> = {}
      Object.entries(accountData.messages).forEach(([sessionId, messages]) => {
        if (Array.isArray(messages)) {
          validMessages[sessionId] = messages.filter(msg =>
            msg && typeof msg === 'object' && msg.id
          )
        }
      })

      // 准备缓存数据
      const cacheData = {
        sessions: validSessions,
        messages: validMessages,
        currentSession: accountData.currentSession,
        lastUpdateTime: accountData.lastUpdateTime,
        version: '2.0' // 升级版本号，支持分页存储
      }

      const cacheKey = `account_data_${wxid}`

      // 序列化数据，包含错误处理
      let serializedData: string
      try {
        serializedData = JSON.stringify(cacheData, (key, value) => {
          try {
            if (value instanceof Date) {
              return { __type: 'Date', value: value.toISOString() }
            }
            return value
          } catch (serializeError) {
            console.warn(`序列化字段 ${key} 时出错:`, serializeError, '值:', value)
            return null // 跳过有问题的值
          }
        })
      } catch (serializeError) {
        console.error(`序列化账号 ${wxid} 数据失败:`, serializeError)
        return
      }

      const originalSize = serializedData.length
      console.log(`准备保存账号 ${wxid} 数据: ${Math.round(originalSize / 1024)}KB`, {
        sessions: validSessions.length,
        messagesSessions: Object.keys(validMessages).length,
        totalMessages: Object.values(validMessages).reduce((sum, msgs) => sum + msgs.length, 0)
      })

      // 尝试使用分页存储
      const success = ChunkedStorage.saveChunked(cacheKey, cacheData)

      if (success) {
        console.log(`分页存储成功: ${wxid}`)
      } else {
        console.warn(`分页存储失败，尝试降级处理: ${wxid}`)
        this.handleStorageFailure(wxid, cacheData, originalSize)
      }

    } catch (error) {
      console.error(`保存账号 ${wxid} 数据失败:`, error)
    }
  }

  /**
   * 处理存储失败的降级策略
   */
  private handleStorageFailure(wxid: string, cacheData: any, originalSize: number) {
    try {
      console.log(`开始降级处理，原始大小: ${Math.round(originalSize / 1024)}KB`)

      // 策略1: 只保存最近的消息
      const reducedData = this.reduceDataSize(cacheData)
      const reducedSuccess = ChunkedStorage.saveChunked(`account_data_${wxid}`, reducedData)

      if (reducedSuccess) {
        console.log(`降级存储成功: ${wxid} (仅保存最近数据)`)
        return
      }

      // 策略2: 只保存会话列表，不保存消息
      const sessionsOnlyData = {
        sessions: cacheData.sessions,
        messages: {}, // 清空消息
        currentSession: cacheData.currentSession,
        lastUpdateTime: cacheData.lastUpdateTime,
        version: cacheData.version
      }

      const sessionsSuccess = ChunkedStorage.saveChunked(`account_data_${wxid}`, sessionsOnlyData)

      if (sessionsSuccess) {
        console.log(`最小化存储成功: ${wxid} (仅保存会话列表)`)
        return
      }

      // 策略3: 清理旧数据后重试
      console.log(`尝试清理旧数据后重试`)
      this.cleanupOldCache()

      const retrySuccess = ChunkedStorage.saveChunked(`account_data_${wxid}`, reducedData)
      if (retrySuccess) {
        console.log(`清理后重试成功: ${wxid}`)
        return
      }

      console.error(`所有存储策略都失败了: ${wxid}`)

    } catch (error) {
      console.error(`降级处理失败:`, error)
    }
  }

  /**
   * 减少数据大小，只保留最近的消息
   */
  private reduceDataSize(cacheData: any): any {
    const maxMessagesPerSession = 100 // 每个会话最多保留100条消息
    const maxSessions = 20 // 最多保留20个会话

    const reducedMessages: Record<string, ChatMessage[]> = {}

    // 只保留最近的会话
    const recentSessions = cacheData.sessions
      .sort((a: any, b: any) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
      .slice(0, maxSessions)

    // 为每个会话只保留最近的消息
    Object.entries(cacheData.messages).forEach(([sessionId, messages]: [string, any]) => {
      if (Array.isArray(messages) && recentSessions.some((s: any) => s.id === sessionId)) {
        // 按时间戳排序，保留最新的消息
        const sortedMessages = messages
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, maxMessagesPerSession)

        if (sortedMessages.length > 0) {
          reducedMessages[sessionId] = sortedMessages
        }
      }
    })

    return {
      sessions: recentSessions,
      messages: reducedMessages,
      currentSession: cacheData.currentSession,
      lastUpdateTime: cacheData.lastUpdateTime,
      version: cacheData.version
    }
  }

  /**
   * 从localStorage加载账号数据（支持分页存储）
   */
  loadAccountFromCache(wxid: string) {
    try {
      const cacheKey = `account_data_${wxid}`
      console.log(`尝试加载账号 ${wxid} 的缓存数据`)

      // 首先尝试加载分页数据
      let cacheData = ChunkedStorage.loadChunked(cacheKey)

      // 如果分页加载失败，尝试加载传统格式
      if (!cacheData) {
        console.log(`分页数据不存在，尝试加载传统格式缓存`)
        cacheData = this.loadLegacyCache(cacheKey)
      }

      if (!cacheData) {
        console.log(`账号 ${wxid} 没有缓存数据`)
        return
      }

      // 验证缓存数据结构
      if (!cacheData || typeof cacheData !== 'object') {
        console.error(`缓存数据格式无效:`, cacheData)
        ChunkedStorage.removeChunked(cacheKey)
        return
      }

      console.log(`成功加载缓存数据，版本: ${cacheData.version || '1.0'}`)
      const accountData = this.initAccount(wxid)

      // 处理缓存数据
      this.processCacheData(accountData, cacheData, wxid)

    } catch (error) {
      console.error(`加载账号 ${wxid} 缓存数据失败:`, error)
    }
  }

  /**
   * 加载传统格式的缓存数据
   */
  private loadLegacyCache(cacheKey: string): any | null {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (!cached) {
        return null
      }

      console.log(`找到传统格式缓存数据，大小: ${Math.round(cached.length / 1024)}KB`)

      // 安全的JSON解析
      const cacheData = JSON.parse(cached, (key, value) => {
        try {
          // 处理Date对象的反序列化
          if (value && typeof value === 'object' && value.__type === 'Date') {
            const date = new Date(value.value)
            if (isNaN(date.getTime())) {
              console.warn(`无效的Date对象: ${value.value}，使用当前时间`)
              return new Date()
            }
            return date
          }

          // 处理时间戳字段
          if ((key === 'timestamp' || key === 'lastMessageTime') && value) {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
              console.warn(`无效的时间戳: ${value}，使用当前时间`)
              return new Date()
            }
            return date
          }

          return value
        } catch (parseError) {
          console.warn(`解析字段 ${key} 时出错:`, parseError, '值:', value)
          return value
        }
      })

      // 迁移到新格式
      if (cacheData) {
        console.log(`开始迁移传统格式到分页存储`)
        const success = ChunkedStorage.saveChunked(cacheKey, cacheData)
        if (success) {
          // 删除旧格式数据
          localStorage.removeItem(cacheKey)
          console.log(`传统格式迁移完成`)
        }
      }

      return cacheData

    } catch (parseError) {
      console.error(`传统格式解析失败:`, parseError)
      // 清除损坏的缓存
      localStorage.removeItem(cacheKey)
      return null
    }
  }

  /**
   * 处理缓存数据并设置到账号数据中
   */
  private processCacheData(accountData: AccountData, cacheData: any, wxid: string) {
    // 安全地设置会话数据
    if (Array.isArray(cacheData.sessions)) {
      accountData.sessions = cacheData.sessions.filter((session: any) => {
        // 验证会话对象的基本结构
        return session && typeof session === 'object' && session.id && session.name
      })
      console.log(`加载了 ${accountData.sessions.length} 个有效会话`)
    } else {
      console.warn(`会话数据格式无效，使用空数组`)
      accountData.sessions = []
    }

    // 安全地设置消息数据
    if (cacheData.messages && typeof cacheData.messages === 'object') {
      accountData.messages = {}
      Object.entries(cacheData.messages).forEach(([sessionId, messages]) => {
        if (Array.isArray(messages)) {
          accountData.messages[sessionId] = messages.filter((msg: any) => {
            // 验证消息对象的基本结构
            return msg && typeof msg === 'object' && msg.id
          })
          console.log(`会话 ${sessionId} 加载了 ${accountData.messages[sessionId].length} 条有效消息`)
        }
      })
    } else {
      console.warn(`消息数据格式无效，使用空对象`)
      accountData.messages = {}
    }

    // 设置当前会话
    if (cacheData.currentSession) {
      accountData.currentSession = cacheData.currentSession
      console.log(`设置当前会话: ${cacheData.currentSession.name}`)
    }

    // 设置最后更新时间
    accountData.lastUpdateTime = cacheData.lastUpdateTime || Date.now()

    const totalMessages = Object.values(accountData.messages).reduce((sum, msgs) => sum + msgs.length, 0)
    console.log(`账号 ${wxid} 缓存加载完成: ${accountData.sessions.length} 个会话, ${totalMessages} 条消息`)
  }

  /**
   * 清除指定账号的所有数据（支持分页存储）
   */
  clearAccountData(wxid: string) {
    delete this.accountsData[wxid]

    // 清除分页存储数据
    ChunkedStorage.removeChunked(`account_data_${wxid}`)

    // 清除传统格式数据（兼容性）
    localStorage.removeItem(`account_data_${wxid}`)

    console.log(`清除账号 ${wxid} 的所有数据`)
  }

  /**
   * 清除所有账号数据（支持分页存储）
   */
  clearAllData() {
    Object.keys(this.accountsData).forEach(wxid => {
      // 清除分页存储数据
      ChunkedStorage.removeChunked(`account_data_${wxid}`)
      // 清除传统格式数据
      localStorage.removeItem(`account_data_${wxid}`)
      // 清除内存数据
      delete this.accountsData[wxid]
    })

    this.currentWxid.value = null
    console.log(`清除所有账号数据`)
  }

  /**
   * 清理旧的缓存数据（支持分页存储）
   */
  private cleanupOldCache() {
    try {
      console.log(`开始清理旧缓存数据`)

      const keysToRemove: string[] = []
      const chunkedKeysToRemove: string[] = []
      const currentTime = Date.now()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7天

      // 检查所有localStorage键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // 处理分页存储的元数据
        if (key.endsWith('_meta') && key.startsWith('account_data_')) {
          try {
            const metaData = localStorage.getItem(key)
            if (metaData) {
              const parsed = JSON.parse(metaData)
              const lastUpdate = parsed.timestamp || 0

              // 如果数据超过7天未更新，标记整个分页数据为删除
              if (currentTime - lastUpdate > maxAge) {
                const baseKey = key.replace('_meta', '')
                chunkedKeysToRemove.push(baseKey)
              }
            }
          } catch (error) {
            // 元数据损坏，删除相关的分页数据
            const baseKey = key.replace('_meta', '')
            chunkedKeysToRemove.push(baseKey)
          }
        }

        // 清理旧格式的缓存键
        if (key.startsWith('wechat_chat_') ||
           (key.startsWith('account_data_') && !key.includes('_meta') && !key.includes('_chunk_'))) {
          try {
            const data = localStorage.getItem(key)
            if (data) {
              const parsed = JSON.parse(data)
              const lastUpdate = parsed.lastUpdateTime || parsed.lastUpdate || 0

              // 如果数据超过7天未更新，标记为删除
              if (currentTime - lastUpdate > maxAge) {
                keysToRemove.push(key)
              }
            }
          } catch (error) {
            // 如果解析失败，也标记为删除
            keysToRemove.push(key)
          }
        }
      }

      // 删除分页存储数据
      chunkedKeysToRemove.forEach(baseKey => {
        ChunkedStorage.removeChunked(baseKey)
        console.log(`删除旧分页缓存: ${baseKey}`)
      })

      // 删除传统格式数据
      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        console.log(`删除旧缓存键: ${key}`)
      })

      const totalRemoved = chunkedKeysToRemove.length + keysToRemove.length
      console.log(`清理完成，删除了 ${totalRemoved} 个旧缓存项`)

      // 显示存储使用情况
      const stats = ChunkedStorage.getStorageStats()
      console.log(`存储使用情况: ${Math.round(stats.used / 1024)}KB / ${Math.round(stats.total / 1024)}KB`)

    } catch (error) {
      console.error(`清理缓存时出错:`, error)
    }
  }

  /**
   * 获取所有账号的数据统计
   */
  getDataStats() {
    const stats: Record<string, any> = {}
    Object.keys(this.accountsData).forEach(wxid => {
      const data = this.accountsData[wxid]
      stats[wxid] = {
        sessions: data.sessions.length,
        messages: Object.keys(data.messages).length,
        totalMessages: Object.values(data.messages).reduce((sum, msgs) => sum + msgs.length, 0),
        currentSession: data.currentSession?.name,
        lastUpdate: new Date(data.lastUpdateTime).toLocaleString()
      }
    })
    return stats
  }

  /**
   * 修复损坏的缓存数据
   */
  repairCorruptedCache(wxid: string) {
    console.log(`🔧 开始修复账号 ${wxid} 的缓存数据`)

    try {
      const cacheKey = `account_data_${wxid}`
      const cached = localStorage.getItem(cacheKey)

      if (!cached) {
        console.log(`没有找到缓存数据，无需修复`)
        return
      }

      // 尝试解析并修复数据
      const accountData = this.initAccount(wxid)
      accountData.sessions = []
      accountData.messages = {}
      accountData.currentSession = null
      accountData.lastUpdateTime = Date.now()

      // 保存修复后的数据
      this.saveAccountToCache(wxid)

      console.log(`✅ 账号 ${wxid} 的缓存数据已修复`)
    } catch (error) {
      console.error(`修复账号 ${wxid} 缓存数据失败:`, error)
    }
  }
}

// 创建全局单例
export const accountDataManager = new AccountDataManager()

// 导出类型
export type { AccountData }
