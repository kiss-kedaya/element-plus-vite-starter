/**
 * 改进的账号数据管理器
 * 解决缓存失效、内存泄漏和性能问题
 */

import { ref, shallowReactive, computed, watch } from 'vue'
import type { ChatSession, ChatMessage } from '@/types/chat'
import { ImprovedCacheManager } from '@/utils/improvedCacheManager'
import { resourceManager } from '@/utils/memoryLeakFixer'
import { log } from '@/utils/logger'
import { messageProcessor } from '@/utils/messageProcessor'

// 账号数据接口
interface AccountData {
  wxid: string
  sessions: ChatSession[]
  messages: Record<string, ChatMessage[]>
  currentSession: ChatSession | null
  lastUpdateTime: number
  isLoaded: boolean
  isLoading: boolean
}

// 数据管理器状态
interface ManagerState {
  currentWxid: string | null
  accounts: Record<string, AccountData>
  isInitialized: boolean
  lastCleanupTime: number
}

/**
 * 改进的账号数据管理器
 */
export class ImprovedAccountDataManager {
  private static instance: ImprovedAccountDataManager
  private cacheManager = ImprovedCacheManager.getInstance()

  // 使用shallowReactive提高性能
  private state = shallowReactive<ManagerState>({
    currentWxid: null,
    accounts: {},
    isInitialized: false,
    lastCleanupTime: 0
  })

  // 内存管理配置
  private readonly config = {
    maxAccountsInMemory: 3,
    maxMessagesPerSession: 500,
    maxSessionsPerAccount: 50,
    cleanupInterval: 5 * 60 * 1000, // 5分钟
    autoSaveInterval: 30 * 1000, // 30秒
  }

  // 资源ID跟踪
  private resourceIds: string[] = []

  static getInstance(): ImprovedAccountDataManager {
    if (!ImprovedAccountDataManager.instance) {
      ImprovedAccountDataManager.instance = new ImprovedAccountDataManager()
    }
    return ImprovedAccountDataManager.instance
  }

  private constructor() {
    this.initializeManager()
  }

  /**
   * 初始化管理器
   */
  private initializeManager(): void {
    log.info('初始化改进的账号数据管理器', undefined, 'ImprovedAccountDataManager')

    // 设置定期清理
    const cleanupTimerId = resourceManager.addTimer(
      () => this.performCleanup(),
      this.config.cleanupInterval,
      'interval',
      'ImprovedAccountDataManager'
    )
    this.resourceIds.push(cleanupTimerId)

    // 设置自动保存
    const autoSaveTimerId = resourceManager.addTimer(
      () => this.autoSave(),
      this.config.autoSaveInterval,
      'interval',
      'ImprovedAccountDataManager'
    )
    this.resourceIds.push(autoSaveTimerId)

    // 监听页面可见性变化
    const visibilityListenerId = resourceManager.addEventListener(
      document,
      'visibilitychange',
      () => {
        if (document.hidden) {
          this.saveAllAccounts()
        }
      },
      false,
      'ImprovedAccountDataManager'
    )
    this.resourceIds.push(visibilityListenerId)

    this.state.isInitialized = true
    log.info('账号数据管理器初始化完成', undefined, 'ImprovedAccountDataManager')
  }

  /**
   * 切换到指定账号
   */
  async switchToAccount(wxid: string): Promise<AccountData> {
    log.startTimer(`switchToAccount_${wxid}`)

    try {
      // 保存当前账号数据
      if (this.state.currentWxid && this.state.currentWxid !== wxid) {
        await this.saveAccount(this.state.currentWxid)
      }

      // 设置新的当前账号
      this.state.currentWxid = wxid

      // 确保账号数据存在
      if (!this.state.accounts[wxid]) {
        this.state.accounts[wxid] = this.createEmptyAccountData(wxid)
      }

      const accountData = this.state.accounts[wxid]

      // 如果数据未加载，从缓存加载
      if (!accountData.isLoaded && !accountData.isLoading) {
        await this.loadAccount(wxid)
      }

      // 清理内存中的其他账号（如果超过限制）
      this.cleanupExcessAccounts()

      log.info('账号切换完成', {
        wxid,
        sessionsCount: accountData.sessions.length,
        isLoaded: accountData.isLoaded
      }, 'ImprovedAccountDataManager')

      return accountData

    } catch (error) {
      log.error('账号切换失败', { wxid, error }, 'ImprovedAccountDataManager')
      throw error
    } finally {
      log.endTimer(`switchToAccount_${wxid}`)
    }
  }

  /**
   * 加载账号数据
   */
  private async loadAccount(wxid: string): Promise<void> {
    const accountData = this.state.accounts[wxid]
    if (!accountData || accountData.isLoading) return

    accountData.isLoading = true

    try {
      log.info('开始加载账号数据', { wxid }, 'ImprovedAccountDataManager')

      const result = await this.cacheManager.loadAccountData(wxid)

      if (result.success && result.data) {
        // 更新账号数据
        accountData.sessions = result.data.sessions || []
        accountData.messages = result.data.messages || {}
        accountData.currentSession = result.data.currentSession
        accountData.lastUpdateTime = result.data.lastUpdateTime || Date.now()
        accountData.isLoaded = true

        log.info('账号数据加载成功', {
          wxid,
          sessionsCount: accountData.sessions.length,
          messagesCount: Object.keys(accountData.messages).length,
          migrated: result.migrated
        }, 'ImprovedAccountDataManager')

      } else {
        log.warn('账号数据加载失败，使用空数据', { wxid, error: result.error }, 'ImprovedAccountDataManager')
        accountData.isLoaded = true // 标记为已加载，避免重复尝试
      }

    } catch (error) {
      log.error('加载账号数据异常', { wxid, error }, 'ImprovedAccountDataManager')
      accountData.isLoaded = true // 即使失败也标记为已加载
    } finally {
      accountData.isLoading = false
    }
  }

  /**
   * 保存账号数据
   */
  private async saveAccount(wxid: string): Promise<void> {
    const accountData = this.state.accounts[wxid]
    if (!accountData || !accountData.isLoaded) return

    try {
      log.debug('保存账号数据', { wxid }, 'ImprovedAccountDataManager')

      const result = await this.cacheManager.saveAccountData(
        wxid,
        accountData.sessions,
        accountData.messages,
        accountData.currentSession
      )

      if (result.success) {
        accountData.lastUpdateTime = Date.now()
        log.debug('账号数据保存成功', { wxid }, 'ImprovedAccountDataManager')
      } else {
        log.warn('账号数据保存失败', { wxid, error: result.error }, 'ImprovedAccountDataManager')
      }

    } catch (error) {
      log.error('保存账号数据异常', { wxid, error }, 'ImprovedAccountDataManager')
    }
  }

  /**
   * 创建空的账号数据
   */
  private createEmptyAccountData(wxid: string): AccountData {
    return {
      wxid,
      sessions: [],
      messages: {},
      currentSession: null,
      lastUpdateTime: Date.now(),
      isLoaded: false,
      isLoading: false
    }
  }

  /**
   * 清理超出限制的账号
   */
  private cleanupExcessAccounts(): void {
    const accountIds = Object.keys(this.state.accounts)

    if (accountIds.length <= this.config.maxAccountsInMemory) return

    // 按最后更新时间排序，保留最新的账号
    const sortedAccounts = accountIds
      .map(wxid => ({
        wxid,
        lastUpdateTime: this.state.accounts[wxid].lastUpdateTime,
        isCurrent: wxid === this.state.currentWxid
      }))
      .sort((a, b) => b.lastUpdateTime - a.lastUpdateTime)

    // 保留当前账号和最近使用的账号
    const accountsToKeep = sortedAccounts.slice(0, this.config.maxAccountsInMemory)
    const accountsToRemove = sortedAccounts.slice(this.config.maxAccountsInMemory)

    // 移除多余的账号（但不移除当前账号）
    accountsToRemove.forEach(({ wxid, isCurrent }) => {
      if (!isCurrent) {
        log.debug('清理内存中的账号数据', { wxid }, 'ImprovedAccountDataManager')
        this.saveAccount(wxid) // 保存后删除
        delete this.state.accounts[wxid]
      }
    })
  }

  /**
   * 添加消息到指定会话
   */
  async addMessage(wxid: string, sessionId: string, message: ChatMessage): Promise<boolean> {
    try {
      // 确保账号数据存在
      if (!this.state.accounts[wxid]) {
        await this.switchToAccount(wxid)
      }

      const accountData = this.state.accounts[wxid]

      // 确保会话存在
      if (!accountData.messages[sessionId]) {
        accountData.messages[sessionId] = []
      }

      // 检查消息是否已存在（去重）
      const existingMessage = accountData.messages[sessionId].find(m => m.id === message.id)
      if (existingMessage) {
        log.debug('消息已存在，跳过添加', { wxid, sessionId, messageId: message.id }, 'ImprovedAccountDataManager')
        return false
      }

      // 添加消息
      accountData.messages[sessionId].push(message)

      // 限制消息数量
      if (accountData.messages[sessionId].length > this.config.maxMessagesPerSession) {
        accountData.messages[sessionId] = accountData.messages[sessionId]
          .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
          .slice(0, this.config.maxMessagesPerSession)
      }

      // 更新会话信息
      this.updateSessionInfo(accountData, sessionId, message)

      accountData.lastUpdateTime = Date.now()

      log.debug('消息添加成功', {
        wxid,
        sessionId,
        messageId: message.id,
        totalMessages: accountData.messages[sessionId].length
      }, 'ImprovedAccountDataManager')

      return true

    } catch (error) {
      log.error('添加消息失败', { wxid, sessionId, messageId: message.id, error }, 'ImprovedAccountDataManager')
      return false
    }
  }

  /**
   * 更新会话信息
   */
  private updateSessionInfo(accountData: AccountData, sessionId: string, message: ChatMessage): void {
    let session = accountData.sessions.find(s => s.id === sessionId)

    if (!session) {
      // 创建新会话
      session = {
        id: sessionId,
        name: (message as any).senderName || sessionId,
        avatar: '',
        lastMessage: message.content || '',
        lastMessageTime: message.timestamp || new Date(),
        unreadCount: 0,
        type: 'friend' // 默认类型
      }
      accountData.sessions.push(session)
    } else {
      // 更新现有会话
      session.lastMessage = message.content || ''
      session.lastMessageTime = message.timestamp || new Date()
    }

    // 限制会话数量
    if (accountData.sessions.length > this.config.maxSessionsPerAccount) {
      accountData.sessions = accountData.sessions
        .sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0))
        .slice(0, this.config.maxSessionsPerAccount)
    }
  }

  /**
   * 获取账号数据（响应式）
   */
  getAccountData(wxid: string) {
    return computed(() => this.state.accounts[wxid] || this.createEmptyAccountData(wxid))
  }

  /**
   * 获取当前账号ID（响应式）
   */
  getCurrentWxid() {
    return computed(() => this.state.currentWxid)
  }

  /**
   * 获取当前账号数据（响应式）
   */
  getCurrentAccountData() {
    return computed(() => {
      const wxid = this.state.currentWxid
      return wxid ? this.state.accounts[wxid] : null
    })
  }

  /**
   * 执行清理
   */
  private performCleanup(): void {
    const now = Date.now()

    // 避免频繁清理
    if (now - this.state.lastCleanupTime < this.config.cleanupInterval) return

    log.debug('开始执行定期清理', undefined, 'ImprovedAccountDataManager')

    // 清理超出限制的账号
    this.cleanupExcessAccounts()

    // 清理每个账号的消息和会话
    Object.keys(this.state.accounts).forEach(wxid => {
      this.cleanupAccountData(wxid)
    })

    this.state.lastCleanupTime = now
    log.debug('定期清理完成', undefined, 'ImprovedAccountDataManager')
  }

  /**
   * 清理账号数据
   */
  private cleanupAccountData(wxid: string): void {
    const accountData = this.state.accounts[wxid]
    if (!accountData) return

    let totalCleaned = 0

    // 清理消息
    Object.keys(accountData.messages).forEach(sessionId => {
      const messages = accountData.messages[sessionId]
      if (messages.length > this.config.maxMessagesPerSession) {
        const originalLength = messages.length
        accountData.messages[sessionId] = messages
          .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
          .slice(0, this.config.maxMessagesPerSession)
        totalCleaned += originalLength - accountData.messages[sessionId].length
      }
    })

    // 清理会话
    if (accountData.sessions.length > this.config.maxSessionsPerAccount) {
      const originalLength = accountData.sessions.length
      accountData.sessions = accountData.sessions
        .sort((a, b) => (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0))
        .slice(0, this.config.maxSessionsPerAccount)

      // 删除对应的消息数据
      const keptSessionIds = new Set(accountData.sessions.map(s => s.id))
      Object.keys(accountData.messages).forEach(sessionId => {
        if (!keptSessionIds.has(sessionId)) {
          delete accountData.messages[sessionId]
        }
      })
    }

    if (totalCleaned > 0) {
      log.debug('清理账号数据完成', { wxid, totalCleaned }, 'ImprovedAccountDataManager')
    }
  }

  /**
   * 自动保存
   */
  private async autoSave(): Promise<void> {
    if (!this.state.currentWxid) return

    try {
      await this.saveAccount(this.state.currentWxid)
    } catch (error) {
      log.warn('自动保存失败', { error }, 'ImprovedAccountDataManager')
    }
  }

  /**
   * 保存所有账号数据
   */
  private async saveAllAccounts(): Promise<void> {
    const savePromises = Object.keys(this.state.accounts).map(wxid =>
      this.saveAccount(wxid)
    )

    try {
      await Promise.all(savePromises)
      log.info('所有账号数据保存完成', undefined, 'ImprovedAccountDataManager')
    } catch (error) {
      log.error('保存所有账号数据失败', { error }, 'ImprovedAccountDataManager')
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    log.info('销毁账号数据管理器', undefined, 'ImprovedAccountDataManager')

    // 保存所有数据
    this.saveAllAccounts()

    // 清理资源
    this.resourceIds.forEach(id => {
      resourceManager.cleanup(id)
    })
    this.resourceIds = []

    // 清理状态
    this.state.accounts = {}
    this.state.currentWxid = null
    this.state.isInitialized = false
  }
}

// 创建全局实例
export const improvedAccountDataManager = ImprovedAccountDataManager.getInstance()