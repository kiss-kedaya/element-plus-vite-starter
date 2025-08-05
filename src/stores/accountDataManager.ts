/**
 * 账号数据管理器 - 完全隔离的账号数据存储系统
 * 每个账号的数据完全独立，避免任何形式的数据污染
 */

import { ref, reactive } from 'vue'
import type { ChatSession, ChatMessage } from '@/types/chat'

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
  // 所有账号的数据存储
  private accountsData = reactive<Record<string, AccountData>>({})
  
  // 当前活跃的账号ID
  private currentWxid = ref<string | null>(null)

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
    console.log(`🔄 切换账号数据管理器到: ${wxid}`)
    
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
   * 添加消息到指定账号的指定会话
   */
  addMessage(wxid: string, sessionId: string, message: ChatMessage) {
    const accountData = this.initAccount(wxid)
    
    if (!accountData.messages[sessionId]) {
      accountData.messages[sessionId] = []
    }
    
    // 检查消息是否已存在（避免重复）
    const existingMessage = accountData.messages[sessionId].find(m => m.id === message.id)
    if (existingMessage) {
      console.log(`⚠️ 消息已存在，跳过添加: ${message.id}`, {
        wxid,
        sessionId,
        messageId: message.id,
        content: message.content?.substring(0, 30) + '...'
      })
      return
    }

    accountData.messages[sessionId].push(message)
    accountData.lastUpdateTime = Date.now()

    console.log(`📨 添加消息到账号 ${wxid} 会话 ${sessionId}: ${message.content?.substring(0, 30)}...`, {
      messageId: message.id,
      fromMe: message.fromMe,
      timestamp: message.timestamp,
      totalMessages: accountData.messages[sessionId].length
    })
    
    // 立即保存到缓存
    this.saveAccountToCache(wxid)
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
   * 保存账号数据到localStorage
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

      const cacheData = {
        sessions: validSessions,
        messages: validMessages,
        currentSession: accountData.currentSession,
        lastUpdateTime: accountData.lastUpdateTime,
        version: '1.0' // 添加版本号用于未来的兼容性
      }

      const cacheKey = `account_data_${wxid}`

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

      // 检查序列化后的数据大小
      if (serializedData.length > 5 * 1024 * 1024) { // 5MB限制
        console.warn(`账号 ${wxid} 缓存数据过大 (${Math.round(serializedData.length / 1024 / 1024)}MB)，可能影响性能`)
      }

      try {
        localStorage.setItem(cacheKey, serializedData)
        console.log(`💾 保存账号 ${wxid} 数据到缓存: ${Math.round(serializedData.length / 1024)}KB`, {
          sessions: validSessions.length,
          messagesSessions: Object.keys(validMessages).length,
          totalMessages: Object.values(validMessages).reduce((sum, msgs) => sum + msgs.length, 0)
        })
      } catch (storageError) {
        console.error(`存储账号 ${wxid} 数据失败:`, storageError)

        // 如果是存储空间不足，尝试清理旧数据
        if (storageError.name === 'QuotaExceededError') {
          console.log(`存储空间不足，尝试清理旧缓存数据`)
          this.cleanupOldCache()

          // 重试保存
          try {
            localStorage.setItem(cacheKey, serializedData)
            console.log(`💾 清理后重新保存成功: ${wxid}`)
          } catch (retryError) {
            console.error(`清理后重新保存仍然失败:`, retryError)
          }
        }
      }
    } catch (error) {
      console.error(`保存账号 ${wxid} 数据失败:`, error)
    }
  }

  /**
   * 从localStorage加载账号数据
   */
  loadAccountFromCache(wxid: string) {
    try {
      const cacheKey = `account_data_${wxid}`
      console.log(`🔍 尝试加载账号 ${wxid} 的缓存数据，键名: ${cacheKey}`)

      const cached = localStorage.getItem(cacheKey)

      if (!cached) {
        console.log(`📂 账号 ${wxid} 没有缓存数据`)
        return
      }

      console.log(`📂 找到缓存数据，大小: ${cached.length} 字符`)

      // 安全的JSON解析，带有详细的错误处理
      let cacheData: any
      try {
        cacheData = JSON.parse(cached, (key, value) => {
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
      } catch (parseError) {
        console.error(`JSON解析失败:`, parseError)
        console.error(`缓存数据内容（前100字符）:`, cached.substring(0, 100))

        // 尝试清除损坏的缓存
        localStorage.removeItem(cacheKey)
        console.log(`🗑️ 已清除损坏的缓存数据: ${cacheKey}`)
        return
      }

      // 验证缓存数据结构
      if (!cacheData || typeof cacheData !== 'object') {
        console.error(`缓存数据格式无效:`, cacheData)
        localStorage.removeItem(cacheKey)
        return
      }

      const accountData = this.initAccount(wxid)

      // 安全地设置会话数据
      if (Array.isArray(cacheData.sessions)) {
        accountData.sessions = cacheData.sessions.filter(session => {
          // 验证会话对象的基本结构
          return session && typeof session === 'object' && session.id && session.name
        })
        console.log(`✅ 加载了 ${accountData.sessions.length} 个有效会话`)
      } else {
        console.warn(`会话数据格式无效，使用空数组`)
        accountData.sessions = []
      }

      // 安全地设置消息数据
      if (cacheData.messages && typeof cacheData.messages === 'object') {
        accountData.messages = {}
        Object.entries(cacheData.messages).forEach(([sessionId, messages]) => {
          if (Array.isArray(messages)) {
            accountData.messages[sessionId] = messages.filter(msg => {
              // 验证消息对象的基本结构
              return msg && typeof msg === 'object' && msg.id
            })
            console.log(`✅ 会话 ${sessionId} 加载了 ${accountData.messages[sessionId].length} 条有效消息`)
          }
        })
      } else {
        console.warn(`消息数据格式无效，使用空对象`)
        accountData.messages = {}
      }

      // 安全地设置当前会话
      if (cacheData.currentSession && typeof cacheData.currentSession === 'object' && cacheData.currentSession.id) {
        accountData.currentSession = cacheData.currentSession
        console.log(`✅ 加载当前会话: ${accountData.currentSession.name}`)
      } else {
        accountData.currentSession = null
        console.log(`当前会话数据无效或为空`)
      }

      // 设置最后更新时间
      accountData.lastUpdateTime = cacheData.lastUpdateTime || Date.now()

      console.log(`📂 成功加载账号 ${wxid} 缓存数据:`, {
        sessions: accountData.sessions.length,
        messagesSessions: Object.keys(accountData.messages).length,
        totalMessages: Object.values(accountData.messages).reduce((sum, msgs) => sum + msgs.length, 0),
        currentSession: accountData.currentSession?.name || 'null',
        lastUpdate: new Date(accountData.lastUpdateTime).toLocaleString()
      })
    } catch (error) {
      console.error(`加载账号 ${wxid} 数据失败:`, error)

      // 发生错误时，确保账号数据至少是初始化状态
      const accountData = this.initAccount(wxid)
      accountData.sessions = []
      accountData.messages = {}
      accountData.currentSession = null
      accountData.lastUpdateTime = Date.now()

      console.log(`🔄 已重置账号 ${wxid} 为初始状态`)
    }
  }

  /**
   * 清除指定账号的所有数据
   */
  clearAccountData(wxid: string) {
    delete this.accountsData[wxid]
    localStorage.removeItem(`account_data_${wxid}`)
    console.log(`🗑️ 清除账号 ${wxid} 的所有数据`)
  }

  /**
   * 清除所有账号数据
   */
  clearAllData() {
    Object.keys(this.accountsData).forEach(wxid => {
      localStorage.removeItem(`account_data_${wxid}`)
    })
    Object.keys(this.accountsData).forEach(wxid => {
      delete this.accountsData[wxid]
    })
    this.currentWxid.value = null
    console.log(`🗑️ 清除所有账号数据`)
  }

  /**
   * 清理旧的缓存数据
   */
  private cleanupOldCache() {
    try {
      console.log(`🧹 开始清理旧缓存数据`)

      const keysToRemove: string[] = []
      const currentTime = Date.now()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7天

      // 检查所有localStorage键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // 清理旧格式的缓存键
        if (key.startsWith('wechat_chat_') || key.startsWith('account_data_')) {
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

      // 删除标记的键
      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        console.log(`🗑️ 删除旧缓存键: ${key}`)
      })

      console.log(`🧹 清理完成，删除了 ${keysToRemove.length} 个旧缓存项`)
    } catch (error) {
      console.error(`清理旧缓存失败:`, error)
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
