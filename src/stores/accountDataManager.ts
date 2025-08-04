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
      if (!accountData) return

      const cacheData = {
        sessions: accountData.sessions,
        messages: accountData.messages,
        currentSession: accountData.currentSession,
        lastUpdateTime: accountData.lastUpdateTime
      }

      const cacheKey = `account_data_${wxid}`
      const serializedData = JSON.stringify(cacheData, (key, value) => {
        if (value instanceof Date) {
          return { __type: 'Date', value: value.toISOString() }
        }
        return value
      })

      localStorage.setItem(cacheKey, serializedData)
      console.log(`💾 保存账号 ${wxid} 数据到缓存: ${serializedData.length} 字符`)
    } catch (error) {
      console.error(`保存账号 ${wxid} 数据失败:`, error)
    }
  }

  /**
   * 从localStorage加载账号数据
   */
  private loadAccountFromCache(wxid: string) {
    try {
      const cacheKey = `account_data_${wxid}`
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) {
        console.log(`📂 账号 ${wxid} 没有缓存数据`)
        return
      }

      const cacheData = JSON.parse(cached, (key, value) => {
        if (value && typeof value === 'object' && value.__type === 'Date') {
          return new Date(value.value)
        }
        if ((key === 'timestamp' || key === 'lastMessageTime') && value) {
          const date = new Date(value)
          return Number.isNaN(date.getTime()) ? new Date() : date
        }
        return value
      })

      const accountData = this.initAccount(wxid)
      accountData.sessions = cacheData.sessions || []
      accountData.messages = cacheData.messages || {}
      accountData.currentSession = cacheData.currentSession || null
      accountData.lastUpdateTime = cacheData.lastUpdateTime || Date.now()

      console.log(`📂 加载账号 ${wxid} 缓存数据:`, {
        sessions: accountData.sessions.length,
        messages: Object.keys(accountData.messages).length,
        currentSession: accountData.currentSession?.name
      })
    } catch (error) {
      console.error(`加载账号 ${wxid} 数据失败:`, error)
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
}

// 创建全局单例
export const accountDataManager = new AccountDataManager()

// 导出类型
export type { AccountData }
