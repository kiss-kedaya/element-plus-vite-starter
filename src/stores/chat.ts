import type { ChatMessage, ChatSession } from '@/types/chat'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { chatApi } from '@/api/chat'
import { friendApi } from '@/api/friend'
import { uploadFile } from '@/api'
// 使用动态导入避免与其他地方的动态导入冲突
import { useAuthStore } from '@/stores/auth'
import { useContactStore } from '@/stores/contact'
import { accountDataManager } from './accountDataManager'
import { fileCacheManager } from '@/utils/fileCache'
import { ElMessage } from 'element-plus'

export const useChatStore = defineStore('chat', () => {
  // 状态 - 现在通过accountDataManager管理
  const isLoading = ref(false)
  const isSending = ref(false)

  // 强制刷新触发器
  const refreshTrigger = ref(0)

  // 缓存保存防抖
  const saveTimeouts = new Map<string, NodeJS.Timeout>()

  // 获取当前账号的会话列表
  const sessions = computed(() => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount?.wxid) return []

    const accountData = accountDataManager.getAccountData(authStore.currentAccount.wxid)
    return accountData.sessions
  })

  // 获取当前账号的当前会话
  const currentSession = computed(() => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount?.wxid) return null

    const accountData = accountDataManager.getAccountData(authStore.currentAccount.wxid)

    // 添加调试日志
    console.log(`🔍 计算currentSession:`, {
      wxid: authStore.currentAccount.wxid,
      currentSession: accountData.currentSession?.name,
      refreshTrigger: refreshTrigger.value
    })

    return accountData.currentSession
  })

  // 获取当前账号的所有消息
  const messages = computed(() => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount?.wxid) return {}

    const accountData = accountDataManager.getAccountData(authStore.currentAccount.wxid)
    return accountData.messages
  })

  // 计算属性
  const currentMessages = computed(() => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount?.wxid || !currentSession.value) return []

    return accountDataManager.getSessionMessages(authStore.currentAccount.wxid, currentSession.value.id)
  })

  const unreadCount = computed(() => {
    return sessions.value.reduce((total, session) => total + (session.unreadCount || 0), 0)
  })

  // 联系人store
  const contactStore = useContactStore()

  // 缓存键名
  const CACHE_KEYS = {
    SESSIONS: 'wechat_chat_sessions',
    MESSAGES: 'wechat_chat_messages',
    CURRENT_SESSION: 'wechat_current_session',
  }

  // 缓存工具函数
  const saveToCache = (key: string, data: any, wxid?: string) => {
    try {
      const cacheKey = wxid ? `${key}_${wxid}` : key
      const serializedData = JSON.stringify(data, (key, value) => {
        // 处理Date对象的序列化
        if (value instanceof Date) {
          return { __type: 'Date', value: value.toISOString() }
        }
        return value
      })
      localStorage.setItem(cacheKey, serializedData)
      console.log(`💾 保存缓存: ${cacheKey}, 大小: ${serializedData.length} 字符`, {
        originalKey: key,
        wxid: wxid,
        finalCacheKey: cacheKey
      })
    }
    catch (error: unknown) {
      console.error('保存缓存失败:', error)
    }
  }

  const loadFromCache = (key: string, wxid?: string) => {
    try {
      const cacheKey = wxid ? `${key}_${wxid}` : key
      console.log(`🔍 尝试加载缓存: ${cacheKey}`)
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        console.log(`✅ 找到缓存数据: ${cacheKey}, 大小: ${cached.length} 字符`, {
          originalKey: key,
          wxid: wxid,
          finalCacheKey: cacheKey
        })
        return JSON.parse(cached, (key, value) => {
          // 处理Date对象的反序列化
          if (value && typeof value === 'object' && value.__type === 'Date') {
            const date = new Date(value.value)
            // 确保日期有效，如果无效则使用当前时间
            return isNaN(date.getTime()) ? new Date() : date
          }
          // 处理可能的时间戳字段
          if ((key === 'timestamp' || key === 'lastMessageTime') && value) {
            const date = new Date(value)
            return Number.isNaN(date.getTime()) ? new Date() : date
          }
          return value
        })
      }
    }
    catch (error: unknown) {
      console.error('加载缓存失败:', error)
    }
    return null
  }

  const clearCache = (wxid?: string) => {
    try {
      if (wxid) {
        // 清除特定账号的缓存
        const keys = [
          `${CACHE_KEYS.SESSIONS}_${wxid}`,
          `${CACHE_KEYS.MESSAGES}_${wxid}`,
          `${CACHE_KEYS.CURRENT_SESSION}_${wxid}`
        ]
        keys.forEach(key => {
          localStorage.removeItem(key)
          console.log(`🗑️ 删除缓存键: ${key}`)
        })
        console.log(`已清除账号 ${wxid} 的所有缓存`)
      }
      else {
        // 清除所有聊天缓存
        const allKeys = Object.keys(localStorage)
        const chatKeys = allKeys.filter(key => key.startsWith('wechat_chat_'))
        chatKeys.forEach(key => {
          localStorage.removeItem(key)
          console.log(`🗑️ 删除缓存键: ${key}`)
        })
        console.log(`已清除所有聊天缓存，共删除 ${chatKeys.length} 个键`)
      }
    }
    catch (error: unknown) {
      console.error('清除缓存失败:', error)
    }
  }



  // 排序会话列表（按最后消息时间降序）
  const sortSessions = () => {
    sessions.value.sort((a, b) => {
      const timeA = a.lastMessageTime instanceof Date ? a.lastMessageTime.getTime() : new Date(a.lastMessageTime).getTime()
      const timeB = b.lastMessageTime instanceof Date ? b.lastMessageTime.getTime() : new Date(b.lastMessageTime).getTime()
      return timeB - timeA // 降序排列，最新的在前面
    })
  }

  // 调试：列出所有相关的缓存键
  const debugCacheKeys = (wxid: string) => {
    const allKeys = Object.keys(localStorage)
    const relevantKeys = allKeys.filter(key =>
      key.includes('wechat_chat') || key.includes(wxid)
    )
    console.log(`🔍 当前localStorage中的相关缓存键:`, relevantKeys)

    // 显示每个键的数据大小和内容摘要
    relevantKeys.forEach(key => {
      const data = localStorage.getItem(key)
      if (data) {
        try {
          const parsed = JSON.parse(data)
          let summary = ''
          if (Array.isArray(parsed)) {
            summary = `数组，${parsed.length} 项`
          } else if (typeof parsed === 'object') {
            summary = `对象，${Object.keys(parsed).length} 个键`
          } else {
            summary = `${typeof parsed}`
          }
          console.log(`  - ${key}: ${data.length} 字符 (${summary})`)
        } catch {
          console.log(`  - ${key}: ${data.length} 字符 (无法解析)`)
        }
      } else {
        console.log(`  - ${key}: 0 字符`)
      }
    })
  }

  // 迁移旧缓存数据到新的 accountDataManager
  const migrateOldCacheData = async (wxid: string): Promise<boolean> => {
    console.log(`� 开始迁移账号 ${wxid} 的旧缓存数据`)

    // 调试：显示所有相关缓存键
    debugCacheKeys(wxid)

    try {
      // 首先尝试加载新格式数据
      accountDataManager.loadAccountFromCache(wxid)
      const accountData = accountDataManager.getAccountData(wxid)

      // 检查是否已有有效的新格式数据
      if (accountData.sessions.length > 0 || Object.keys(accountData.messages).length > 0) {
        console.log(`账号 ${wxid} 已有新格式数据，迁移完成`, {
          sessions: accountData.sessions.length,
          messageSessions: Object.keys(accountData.messages).length
        })
        return true
      }

      console.log(`开始迁移旧格式缓存数据`)
      let migrationSuccess = false

      // 加载旧格式的会话列表
      const cachedSessions = loadFromCache(CACHE_KEYS.SESSIONS, wxid)
      if (cachedSessions && Array.isArray(cachedSessions)) {
        console.log(`找到旧格式会话数据: ${cachedSessions.length} 个会话`)
        accountDataManager.updateSessions(wxid, cachedSessions)
        migrationSuccess = true
      }

      // 加载旧格式的消息记录
      const cachedMessages = loadFromCache(CACHE_KEYS.MESSAGES, wxid)
      if (cachedMessages && typeof cachedMessages === 'object') {
        const messageCount = Object.values(cachedMessages).reduce((total: number, msgs) => total + (Array.isArray(msgs) ? msgs.length : 0), 0)
        console.log(`找到旧格式消息数据: ${messageCount} 条消息`)

        // 将消息逐个添加到 accountDataManager
        Object.entries(cachedMessages).forEach(([sessionId, msgs]) => {
          if (Array.isArray(msgs)) {
            msgs.forEach(msg => {
              accountDataManager.addMessage(wxid, sessionId, msg)
            })
          }
        })
        migrationSuccess = true
      }

      // 加载旧格式的当前会话
      const cachedCurrentSession = loadFromCache(CACHE_KEYS.CURRENT_SESSION, wxid)
      if (cachedCurrentSession) {
        console.log(`找到旧格式当前会话: ${cachedCurrentSession.name}`)
        accountDataManager.updateCurrentSession(wxid, cachedCurrentSession)
        migrationSuccess = true
      }

      if (migrationSuccess) {
        console.log(`账号 ${wxid} 的旧缓存数据迁移完成`)
        // 迁移完成后，清理旧格式缓存以释放空间
        clearCache(wxid)
      } else {
        console.log(`账号 ${wxid} 没有找到可迁移的旧缓存数据`)
      }

      return migrationSuccess

    } catch (error) {
      console.error(`账号 ${wxid} 缓存迁移失败:`, error)
      return false
    }
  }

  // 保存数据到缓存（带防抖）
  const saveCachedData = (wxid: string, immediate = false) => {
    if (!wxid)
      return

    // 如果需要立即保存，清除现有的定时器
    if (immediate) {
      const existingTimeout = saveTimeouts.get(wxid)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        saveTimeouts.delete(wxid)
      }
      performSave(wxid)
      return
    }

    // 清除现有的定时器
    const existingTimeout = saveTimeouts.get(wxid)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // 设置新的定时器，500ms后保存
    const timeout = setTimeout(() => {
      performSave(wxid)
      saveTimeouts.delete(wxid)
    }, 500)

    saveTimeouts.set(wxid, timeout)
  }

  // 实际执行保存的函数
  const performSave = (wxid: string) => {
    try {
      // 保存会话列表
      saveToCache(CACHE_KEYS.SESSIONS, sessions.value, wxid)

      // 保存消息记录
      saveToCache(CACHE_KEYS.MESSAGES, messages.value, wxid)

      // 保存当前会话
      if (currentSession.value) {
        saveToCache(CACHE_KEYS.CURRENT_SESSION, currentSession.value, wxid)
      }

      console.log(`账号 ${wxid} 的数据已保存到缓存`)
    }
    catch (error: unknown) {
      console.error('保存缓存数据失败:', error)
    }
  }

  // 方法 - 重构为使用accountDataManager
  const setSessions = (newSessions: ChatSession[], wxid?: string) => {
    const authStore = useAuthStore()
    const targetWxid = wxid || authStore.currentAccount?.wxid

    if (!targetWxid) {
      console.warn('setSessions: 无法确定目标账号')
      return
    }

    // 排序会话
    const sortedSessions = [...newSessions].sort((a, b) => {
      const timeA = a.lastMessageTime?.getTime() || 0
      const timeB = b.lastMessageTime?.getTime() || 0
      return timeB - timeA // 降序排列，最新的在前面
    })

    // 使用accountDataManager更新会话
    accountDataManager.updateSessions(targetWxid, sortedSessions)

    console.log(`✅ 更新账号 ${targetWxid} 的会话列表: ${sortedSessions.length} 个会话`)
  }

  const setCurrentSession = (sessionId: string, wxid?: string) => {
    const authStore = useAuthStore()
    const targetWxid = wxid || authStore.currentAccount?.wxid

    if (!targetWxid) {
      console.warn('setCurrentSession: 无法确定目标账号')
      return
    }

    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      // 标记为已读
      session.unreadCount = 0

      // 使用accountDataManager更新当前会话
      accountDataManager.updateCurrentSession(targetWxid, session)

      // 懒加载：只加载当前会话的最近消息（限制数量）
      loadSessionMessagesLazy(sessionId)

      // 当用户查看会话时，清除该账号的未读计数
      authStore.clearAccountUnreadCount(targetWxid)

      console.log(`✅ 设置账号 ${targetWxid} 的当前会话: ${session.name}`)
    }
  }

  // 懒加载会话消息（限制数量，避免卡顿）
  const loadSessionMessagesLazy = (sessionId: string) => {
    const authStore = useAuthStore()
    if (!authStore.currentAccount?.wxid) return

    const cachedMessages = loadFromCache(CACHE_KEYS.MESSAGES, authStore.currentAccount.wxid)
    if (cachedMessages && cachedMessages[sessionId]) {
      const allMessages = cachedMessages[sessionId] || []
      // 只加载最近的50条消息，避免页面卡顿
      const recentMessages = allMessages.slice(-50)



      // 只设置当前会话的消息
      if (!messages.value[sessionId]) {
        messages.value[sessionId] = []
      }
      messages.value[sessionId] = recentMessages
    } else {
      // 如果没有缓存消息，初始化为空数组
      if (!messages.value[sessionId]) {
        messages.value[sessionId] = []
      }
    }
  }

  const addMessage = (sessionId: string, message: ChatMessage, wxid?: string) => {
    const authStore = useAuthStore()
    const targetWxid = wxid || authStore.currentAccount?.wxid

    if (!targetWxid) {
      console.warn('addMessage: 无法确定目标账号')
      return
    }

    console.log('📝 添加消息到账号会话:', {
      wxid: targetWxid,
      sessionId,
      messageId: message.id,
      content: message.content?.substring(0, 30) + '...',
      fromMe: message.fromMe,
      type: message.type
    })

    // 使用accountDataManager添加消息
    accountDataManager.addMessage(targetWxid, sessionId, message)

    // 更新会话的最后消息和未读计数
    const accountData = accountDataManager.getAccountData(targetWxid)
    const sessionIndex = accountData.sessions.findIndex(s => s.id === sessionId)

    if (sessionIndex !== -1) {
      const session = accountData.sessions[sessionIndex]

      // 更新会话信息
      session.lastMessage = message.content
      session.lastMessageTime = message.timestamp

      // 只有在以下情况下才增加未读计数：
      // 1. 消息不是自己发送的
      // 2. 用户当前没有在查看这个会话
      if (message.fromMe === false && currentSession.value?.id !== sessionId) {
        session.unreadCount = (session.unreadCount || 0) + 1
      }

      // 将有新消息的会话移到列表顶部
      const updatedSession = { ...session }
      accountData.sessions.splice(sessionIndex, 1) // 从原位置移除
      accountData.sessions.splice(0, 0, updatedSession) // 插入到顶部

      // 更新accountDataManager中的会话列表
      accountDataManager.updateSessions(targetWxid, accountData.sessions)

      console.log(`✅ 会话 ${sessionId} 已移动到账号 ${targetWxid} 列表顶部`)

      // 强制刷新UI
      forceRefreshUI()
    }

    console.log(`✅ 消息已添加到账号 ${targetWxid} 的会话 ${sessionId}`)
  }

  const loadMessages = async (sessionId: string) => {
    if (messages.value[sessionId])
      return // 已加载过

    isLoading.value = true
    try {
      // 这里调用获取消息历史的API
      // const result = await chatApi.getMessages(sessionId)
      // messages.value[sessionId] = result.data || []
      messages.value[sessionId] = []
    }
    catch (error) {
      console.error('加载消息失败:', error)
      messages.value[sessionId] = []
    }
    finally {
      isLoading.value = false
    }
  }

  const sendTextMessage = async (wxid: string, toUserName: string, content: string) => {
    isSending.value = true

    // 立即显示消息，状态为发送中
    const messageId = Date.now().toString()
    const currentTime = Date.now()
    const message: ChatMessage = {
      id: messageId,
      content,
      timestamp: new Date(),
      fromMe: true,
      type: 'text',
      status: 'sending',
      originalContent: content,
      canRetry: false,
      canRecall: false,
      retryCount: 0,
      sessionId: toUserName,
      isGroupMessage: toUserName.includes('@chatroom'),
      actualSender: wxid,
      clientMsgId: parseInt(messageId),
      createTime: Math.floor(currentTime / 1000),
      newMsgId: parseInt(messageId),
    }
    addMessage(toUserName, message)

    try {
      console.log('开始发送消息:', { wxid, toUserName, content, messageId })
      const result = await chatApi.sendTextMessage({
        Wxid: wxid,
        ToWxid: toUserName,
        Content: content,
        Type: 1,
      })

      console.log('发送消息API返回:', result)

      if (result.Success) {
        console.log('消息发送成功，准备更新状态')
        // 更新消息状态为已发送，并传递真实的消息数据
        updateMessageStatus(toUserName, messageId, 'sent', false, result)
      }
      else {
        console.log('消息发送失败，准备更新状态为失败')
        // 更新消息状态为失败
        updateMessageStatus(toUserName, messageId, 'failed', true)
      }

      return result
    }
    catch (error) {
      console.error('发送消息失败:', error)
      // 更新消息状态为失败，允许重试
      updateMessageStatus(toUserName, messageId, 'failed', true)
      throw error
    }
    finally {
      isSending.value = false
    }
  }

  const sendImageMessage = async (wxid: string, toUserName: string, imageData: string) => {
    isSending.value = true

    // 立即显示消息，状态为发送中
    const messageId = Date.now().toString()
    const currentTime = Date.now()
    const message: ChatMessage = {
      id: messageId,
      content: '[图片]',
      timestamp: new Date(),
      fromMe: true,
      type: 'image',
      imageData,
      status: 'sending',
      sessionId: toUserName,
      isGroupMessage: toUserName.includes('@chatroom'),
      actualSender: wxid,
      canRecall: false, // 发送中时不能撤回
      clientMsgId: parseInt(messageId),
      createTime: Math.floor(currentTime / 1000),
      newMsgId: parseInt(messageId),
    }
    addMessage(toUserName, message)

    try {
      const result = await chatApi.sendImageMessage({
        Wxid: wxid,
        ToWxid: toUserName,
        Base64: imageData,
      })

      if (result.Success) {
        // 更新消息状态为已发送，并传递真实的消息数据
        updateMessageStatus(toUserName, messageId, 'sent', false, result)
      }
      else {
        // 更新消息状态为失败
        updateMessageStatus(toUserName, messageId, 'failed', true)
      }

      return result
    }
    catch (error) {
      console.error('发送图片失败:', error)
      // 更新消息状态为失败，允许重试
      updateMessageStatus(toUserName, messageId, 'failed', true)
      throw error
    }
    finally {
      isSending.value = false
    }
  }

  const sendFileMessage = async (wxid: string, toUserName: string, file: File) => {
    isSending.value = true

    try {
      // 首先检查文件缓存
      console.log('检查文件缓存:', { fileName: file.name, fileSize: file.size })
      const cachedFile = await fileCacheManager.findCachedFile(file)

      if (cachedFile) {
        console.log('找到缓存文件，使用转发方式发送:', cachedFile)
        ElMessage.success('检测到相同文件，使用快速发送模式')

        // 使用缓存的文件信息进行发送
        return await sendCachedFileMessage(wxid, toUserName, cachedFile.originalContent)
      }

      // 检查文件类型
      if (file.type.startsWith('image/')) {
        // 如果是图片文件，转换为base64并使用图片发送接口
        try {
          const reader = new FileReader()
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
          })
          reader.readAsDataURL(file)

          const base64 = await base64Promise
          return await sendImageMessage(wxid, toUserName, base64)
        } catch (error) {
          console.error('图片文件处理失败:', error)
          throw new Error('图片文件处理失败')
        }
      }

    // 立即显示消息，状态为发送中
    const messageId = Date.now().toString()
    const currentTime = Date.now()
    const message: ChatMessage = {
      id: messageId,
      content: `[文件] ${file.name}`,
      timestamp: new Date(),
      fromMe: true,
      type: 'file',
      fileData: {
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file)
      },
      status: 'sending',
      sessionId: toUserName,
      isGroupMessage: toUserName.includes('@chatroom'),
      actualSender: wxid,
      canRecall: false,
      clientMsgId: parseInt(messageId),
      createTime: Math.floor(currentTime / 1000),
      newMsgId: parseInt(messageId),
    }
    addMessage(toUserName, message)

      try {
        // 对于非图片文件，如果没有缓存，则无法发送
        updateMessageStatus(toUserName, messageId, 'failed', false)

        // 提供更详细的错误信息
        const errorMessage = `无法发送文件 "${file.name}"。\n\n` +
          '原因：\n' +
          '1. 该文件不是图片格式\n' +
          '2. 未找到该文件的缓存信息\n\n' +
          '解决方案：\n' +
          '• 如果要发送图片，请使用 JPG、PNG 等图片格式\n' +
          '• 如果要发送其他文件，请先在微信中接收过相同的文件，然后再尝试发送'

        throw new Error(errorMessage)
      }
      catch (error) {
        console.error('发送文件失败:', error)
        updateMessageStatus(toUserName, messageId, 'failed', true)
        throw error
      }
    } catch (error) {
      console.error('发送文件失败:', error)
      throw error
    } finally {
      isSending.value = false
    }
  }

  // 发送缓存文件消息
  const sendCachedFileMessage = async (wxid: string, toUserName: string, originalContent: string) => {
    isSending.value = true

    // 立即显示消息，状态为发送中
    const messageId = Date.now().toString()
    const currentTime = Date.now()

    // 从XML中解析文件信息
    let fileName = '未知文件'
    let fileSize = 0
    let attachId = ''
    let cdnUrl = ''
    let aesKey = ''

    try {
      // 解析文件名
      const titleMatch = originalContent.match(/<title>(.*?)<\/title>/)
      if (titleMatch) {
        fileName = titleMatch[1]
      }

      // 解析文件大小
      const totallenMatch = originalContent.match(/<totallen>(\d+)<\/totallen>/)
      if (totallenMatch) {
        fileSize = parseInt(totallenMatch[1])
      }

      // 解析attachId
      const attachidMatch = originalContent.match(/<attachid>(.*?)<\/attachid>/)
      if (attachidMatch) {
        attachId = attachidMatch[1]
      }

      // 解析CDN URL和AES Key
      const cdnurlMatch = originalContent.match(/<cdnurl>(.*?)<\/cdnurl>/)
      if (cdnurlMatch) {
        cdnUrl = cdnurlMatch[1]
      }

      const aeskeyMatch = originalContent.match(/<aeskey>(.*?)<\/aeskey>/)
      if (aeskeyMatch) {
        aesKey = aeskeyMatch[1]
      }

      console.log('解析的文件信息:', { fileName, fileSize, attachId, cdnUrl: cdnUrl.substring(0, 50) + '...' })
    } catch (error) {
      console.warn('解析文件信息失败:', error)
    }

    const message: ChatMessage = {
      id: messageId,
      content: `[文件] ${fileName}`,
      timestamp: new Date(),
      fromMe: true,
      type: 'file',
      status: 'sending',
      sessionId: toUserName,
      isGroupMessage: toUserName.includes('@chatroom'),
      actualSender: wxid,
      canRecall: false,
      clientMsgId: parseInt(messageId),
      createTime: Math.floor(currentTime / 1000),
      newMsgId: parseInt(messageId),
      fileData: {
        name: fileName,
        size: fileSize,
        originalContent: originalContent,
        attachId: attachId,
        cdnUrl: cdnUrl,
        aesKey: aesKey
      }
    }
    addMessage(toUserName, message)

    try {
      const result = await chatApi.forwardFileMessage({
        Wxid: wxid,
        ToWxid: toUserName,
        Content: originalContent
      })

      if (result.Success) {
        updateMessageStatus(toUserName, messageId, 'sent', false, result)
      } else {
        updateMessageStatus(toUserName, messageId, 'failed', true)
      }

      return result
    } catch (error) {
      console.error('转发文件失败:', error)
      updateMessageStatus(toUserName, messageId, 'failed', true)
      throw error
    } finally {
      isSending.value = false
    }
  }

  const clearMessages = (sessionId: string) => {
    console.log(`开始清空会话 ${sessionId} 的消息`)

    // 清空内存中的消息
    delete messages.value[sessionId]
    console.log(`已清空内存中会话 ${sessionId} 的消息`)

    // 同时清空缓存中的消息
    const authStore = useAuthStore()
    if (authStore.currentAccount?.wxid) {
      const wxid = authStore.currentAccount.wxid
      const cacheKey = `${CACHE_KEYS.MESSAGES}_${wxid}`

      // 加载当前缓存的所有消息
      const cachedMessages = loadFromCache(CACHE_KEYS.MESSAGES, wxid) || {}
      console.log(`加载缓存消息，会话 ${sessionId} 原有消息数量:`, cachedMessages[sessionId]?.length || 0)

      // 删除指定会话的消息
      delete cachedMessages[sessionId]

      // 保存更新后的缓存
      saveToCache(CACHE_KEYS.MESSAGES, cachedMessages, wxid)
      console.log(`已清空缓存中会话 ${sessionId} 的消息`)

      // 验证缓存是否真的被清空
      const verifyCache = loadFromCache(CACHE_KEYS.MESSAGES, wxid) || {}
      console.log(`验证缓存清空结果，会话 ${sessionId} 消息数量:`, verifyCache[sessionId]?.length || 0)
    } else {
      console.warn('无法清空缓存：当前账号信息不存在')
    }

    console.log(`会话 ${sessionId} 消息清空完成`)
  }

  const updateMessageStatus = (sessionId: string, messageId: string, status: ChatMessage['status'], canRetry: boolean = false, realMessageData?: any) => {
    const sessionMessages = messages.value[sessionId]
    if (sessionMessages) {
      const message = sessionMessages.find(m => m.id === messageId)
      if (message) {
        message.status = status
        message.canRetry = canRetry && status === 'failed'
        message.canRecall = status === 'sent' && message.fromMe

        console.log('更新消息状态:', {
          messageId,
          status,
          fromMe: message.fromMe,
          canRecall: message.canRecall,
          canRetry: message.canRetry
        })

        // 如果有真实的消息数据，更新消息的真实ID
        if (realMessageData && realMessageData.Data && realMessageData.Data.List && realMessageData.Data.List.length > 0) {
          const msgData = realMessageData.Data.List[0]
          message.clientMsgId = msgData.ClientMsgid
          message.createTime = msgData.Createtime
          message.newMsgId = msgData.NewMsgId
          console.log('更新消息真实ID:', {
            clientMsgId: message.clientMsgId,
            createTime: message.createTime,
            newMsgId: message.newMsgId
          })
        }
      }
    }
  }

  // 重试发送消息
  const retryMessage = async (wxid: string, sessionId: string, messageId: string) => {
    const sessionMessages = messages.value[sessionId]
    if (!sessionMessages)
      return

    const message = sessionMessages.find(m => m.id === messageId)
    if (!message || !message.canRetry || !message.originalContent)
      return

    // 删除原消息
    const messageIndex = sessionMessages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      sessionMessages.splice(messageIndex, 1)
    }

    // 重新发送消息（会显示在最下方）
    try {
      await sendTextMessage(wxid, sessionId, message.originalContent)
    }
    catch (error) {
      console.error('重试发送消息失败:', error)
    }
  }

  // 撤回消息
  const recallMessage = async (wxid: string, sessionId: string, messageId: string) => {
    const sessionMessages = messages.value[sessionId]
    if (!sessionMessages)
      return

    const message = sessionMessages.find(m => m.id === messageId)
    if (!message || !message.fromMe)
      return

    try {
      // 调用撤回消息的API
      const result = await chatApi.revokeMessage({
        Wxid: wxid,
        ToUserName: sessionId,
        ClientMsgId: message.clientMsgId || parseInt(message.id) || Date.now(),
        CreateTime: message.createTime || Math.floor(message.timestamp.getTime() / 1000),
        NewMsgId: message.newMsgId || parseInt(message.id) || Date.now(),
      })

      if (result.Success) {
        // API调用成功，从本地删除消息
        const messageIndex = sessionMessages.findIndex(m => m.id === messageId)
        if (messageIndex !== -1) {
          sessionMessages.splice(messageIndex, 1)
        }

        console.log('消息撤回成功')
      } else {
        console.error('撤回消息失败:', result.Message)
        throw new Error(result.Message || '撤回消息失败')
      }
    }
    catch (error) {
      console.error('撤回消息失败:', error)
      throw error
    }
  }

  const clearAllData = () => {
    // 现在数据通过 accountDataManager 管理，这个方法主要用于清理状态
    console.log('🧹 清空所有数据（通过accountDataManager管理）')
    // accountDataManager 会在账号切换时自动处理数据清理
  }

  // 同步跨账号消息到当前聊天界面
  const syncCrossAccountMessages = async (wxid: string) => {
    try {
      // 动态导入跨账号消息store以避免循环依赖
      const { useCrossAccountMessageStore } = await import('./crossAccountMessage')
      const crossAccountStore = useCrossAccountMessageStore()

      // 获取该账号的跨账号消息
      const crossMessages = crossAccountStore.getAccountMessages(wxid)

      if (crossMessages.length === 0) {
        console.log(`账号 ${wxid} 没有跨账号消息需要同步`)
        return
      }

      console.log(`开始同步账号 ${wxid} 的 ${crossMessages.length} 条跨账号消息`)

      // 按会话分组消息
      const messagesBySession: Record<string, any[]> = {}

      crossMessages.forEach(crossMsg => {
        const sessionId = crossMsg.sessionId
        if (!messagesBySession[sessionId]) {
          messagesBySession[sessionId] = []
        }

        // 转换跨账号消息格式为聊天消息格式
        const chatMessage = {
          id: crossMsg.id,
          content: crossMsg.content,
          timestamp: crossMsg.timestamp,
          fromMe: crossMsg.fromMe,
          type: crossMsg.type,
          status: 'received',
          senderName: crossMsg.senderName,
          isGroupMessage: crossMsg.isGroupMessage,
          // 标记为跨账号同步的消息
          isCrossAccountSync: true
        }

        messagesBySession[sessionId].push(chatMessage)
      })

      // 将消息添加到对应的会话中
      Object.entries(messagesBySession).forEach(([sessionId, msgs]) => {
        // 使用accountDataManager添加消息（内置防重复机制）
        msgs.forEach(msg => {
          accountDataManager.addMessage(wxid, sessionId, msg)
        })

        console.log(`会话 ${sessionId} 同步了 ${msgs.length} 条跨账号消息`)

        // 获取当前账号数据
        const accountData = accountDataManager.getAccountData(wxid)
        let session = accountData.sessions.find(s => s.id === sessionId)

        if (!session) {
          // 如果会话不存在，创建一个基本的会话
          const firstMessage = msgs[0]
          session = {
            id: sessionId,
            name: firstMessage.senderName || sessionId,
            avatar: '',
            type: firstMessage.isGroupMessage ? 'group' : 'friend',
            lastMessage: '',
            lastMessageTime: new Date(),
            unreadCount: 0,
            isOnline: false,
          }

          // 添加新会话到账号数据
          const updatedSessions = [session, ...accountData.sessions]
          accountDataManager.updateSessions(wxid, updatedSessions)
          console.log(`为跨账号消息创建新会话: ${sessionId}`)
        }

        // 更新会话的最后消息信息
        const lastMessage = msgs[msgs.length - 1]
        if (session) {
          session.lastMessage = lastMessage.content
          session.lastMessageTime = lastMessage.timestamp

          // 如果消息不是自己发送的，增加未读计数
          if (!lastMessage.fromMe) {
            session.unreadCount = (session.unreadCount || 0) + msgs.filter(m => !m.fromMe).length
          }

          // 更新会话信息
          accountDataManager.updateSessions(wxid, accountData.sessions)
        }
      })

      // 强制刷新UI
      forceRefreshUI()

      // 清除已同步的跨账号消息，避免重复同步
      crossAccountStore.clearAccountMessages(wxid)

      console.log(`账号 ${wxid} 的跨账号消息同步完成`)

    } catch (error) {
      console.error('同步跨账号消息失败:', error)
    }
  }

  // 检测和修复缓存问题
  const detectAndRepairCache = (wxid: string) => {
    console.log(`🔍 检测账号 ${wxid} 的缓存状态`)

    try {
      // 检查缓存是否可以正常加载
      const accountData = accountDataManager.getAccountData(wxid)

      // 验证数据完整性
      let hasIssues = false

      if (!Array.isArray(accountData.sessions)) {
        console.warn(`会话数据格式异常`)
        hasIssues = true
      }

      if (!accountData.messages || typeof accountData.messages !== 'object') {
        console.warn(`消息数据格式异常`)
        hasIssues = true
      }

      // 检查会话数据的完整性
      accountData.sessions.forEach((session, index) => {
        if (!session || !session.id || !session.name) {
          console.warn(`会话 ${index} 数据不完整:`, session)
          hasIssues = true
        }
      })

      // 检查消息数据的完整性
      Object.entries(accountData.messages).forEach(([sessionId, messages]) => {
        if (!Array.isArray(messages)) {
          console.warn(`会话 ${sessionId} 的消息数据不是数组`)
          hasIssues = true
        } else {
          messages.forEach((msg, index) => {
            if (!msg || !msg.id) {
              console.warn(`会话 ${sessionId} 消息 ${index} 数据不完整:`, msg)
              hasIssues = true
            }
          })
        }
      })

      if (hasIssues) {
        console.log(`🔧 检测到缓存问题，开始修复`)
        accountDataManager.repairCorruptedCache(wxid)
        return true
      } else {
        console.log(`✅ 缓存数据完整，无需修复`)
        return false
      }
    } catch (error) {
      console.error(`检测缓存时出错:`, error)
      console.log(`🔧 强制修复缓存`)
      accountDataManager.repairCorruptedCache(wxid)
      return true
    }
  }

  // 切换账号时的数据管理
  const switchAccount = (newWxid: string, oldWxid?: string) => {
    console.log(`🔄 开始账号切换: ${oldWxid} -> ${newWxid}`)

    // 检测和修复缓存问题
    const wasRepaired = detectAndRepairCache(newWxid)
    if (wasRepaired) {
      console.log(`账号 ${newWxid} 的缓存已修复`)
    }

    // 先迁移旧缓存数据（如果存在且未修复）
    if (!wasRepaired) {
      migrateOldCacheData(newWxid)
    }

    // 使用accountDataManager进行账号切换
    const newAccountData = accountDataManager.switchToAccount(newWxid)

    // 加载联系人缓存
    contactStore.loadContactCache(newWxid)

    console.log(`✅ 已切换到账号 ${newWxid}`, {
      sessionsCount: newAccountData.sessions.length,
      currentSession: newAccountData.currentSession?.name,
      messagesCount: Object.keys(newAccountData.messages).length
    })

    // 同步跨账号消息到聊天界面
    syncCrossAccountMessages(newWxid)

    // 清除新账号的未读计数（因为用户已经切换到这个账号）
    const authStore = useAuthStore()
    authStore.clearAccountUnreadCount(newWxid)

    // 强制刷新UI以确保显示新账号的数据
    forceRefreshUI()
  }

  // WebSocket连接管理
  const connectWebSocket = async (wxid: string): Promise<boolean> => {
    try {
      console.log(`🔌 ChatStore尝试连接WebSocket: ${wxid}`)
      const { webSocketService } = await import('@/services/websocket')

      // 无论是否已连接，都重新设置事件监听器以确保正确绑定
      console.log(`🔧 重新设置WebSocket事件监听器`)
      webSocketService.off('chat_message', handleChatMessage) // 先移除旧的监听器
      webSocketService.off('system_message', handleSystemMessage)
      webSocketService.on('chat_message', handleChatMessage) // 重新添加监听器
      webSocketService.on('system_message', handleSystemMessage)

      // 检查是否已经连接到该账号
      if (webSocketService.isAccountConnected(wxid)) {
        console.log(`✅ 账号 ${wxid} 已有WebSocket连接，切换到该账号`)
        webSocketService.switchCurrentAccount(wxid)

        // 强制触发一次消息同步，确保能看到最新消息
        console.log(`🔄 强制同步最新消息`)
        // 这里可以添加消息同步逻辑

        return true
      }

      console.log(`🔗 账号 ${wxid} 尚未连接，开始建立新连接`)

      // 建立新的连接，使用setAsCurrent=true确保设置为当前账号
      const connected = await webSocketService.connect(wxid, true)
      if (connected) {
        console.log(`✅ 成功建立账号 ${wxid} 的WebSocket连接`)
      } else {
        console.warn(`❌ 建立账号 ${wxid} 的WebSocket连接失败`)
      }
      return connected
    }
    catch (error) {
      console.error(`❌ WebSocket连接失败 (${wxid}):`, error)
      return false
    }
  }

  // 获取联系人详情
  const getContactDetail = async (currentWxid: string, targetWxid: string) => {
    try {
      console.log(`获取联系人详情: ${targetWxid}`)

      // 判断是否为群聊
      const isGroup = targetWxid.includes('@chatroom')

      const result = await friendApi.getFriendDetail({
        Wxid: currentWxid,
        Towxids: targetWxid,
        ChatRoom: isGroup ? targetWxid : '',
        force_refresh: false,
      })

      console.log('API返回的完整结果:', result)

      // 处理不同的数据格式
      let contactData = null
      if (result.Success && result.Data) {
        // 检查数据类型
        if (Array.isArray(result.Data) && result.Data.length > 0) {
          // 数组格式（从缓存返回）
          contactData = result.Data[0]
          console.log('从数组格式获取联系人详情:', contactData)
        } else if (result.Data.ContactList && Array.isArray(result.Data.ContactList) && result.Data.ContactList.length > 0) {
          // GetContactResponse格式（从API返回）
          contactData = result.Data.ContactList[0]
          console.log('从ContactList获取联系人详情:', contactData)
        } else {
          console.warn('未知的数据格式:', result.Data)
          return null
        }
      }

      if (contactData) {
        console.log('处理联系人数据:', contactData)

        // 提取联系人信息的通用函数
        const extractContactInfo = (contact: any) => {
          // 处理不同的字段格式
          const getNickName = () => {
            if (contact.NickName) {
              if (typeof contact.NickName === 'string') return contact.NickName
              if (contact.NickName.string) return contact.NickName.string
              if (contact.NickName.String_) return contact.NickName.String_
            }
            return ''
          }

          const getRemark = () => {
            if (contact.Remark) {
              if (typeof contact.Remark === 'string') return contact.Remark
              if (contact.Remark.string) return contact.Remark.string
              if (contact.Remark.String_) return contact.Remark.String_
            }
            return ''
          }

          const getAlias = () => {
            if (contact.Alias) {
              if (typeof contact.Alias === 'string') return contact.Alias
              if (contact.Alias.string) return contact.Alias.string
              if (contact.Alias.String_) return contact.Alias.String_
            }
            return ''
          }

          const getAvatar = () => {
            return contact.SmallHeadImgUrl || contact.BigHeadImgUrl ||
                   contact.smallHeadImgUrl || contact.bigHeadImgUrl || ''
          }

          return {
            nickname: getNickName(),
            remark: getRemark(),
            alias: getAlias(),
            avatar: getAvatar()
          }
        }

        const contactInfo = extractContactInfo(contactData)
        console.log('提取的联系人信息:', contactInfo)

        // 处理群聊信息
        if (isGroup) {
          // 对于群聊，优先使用昵称
          const groupName = contactInfo.nickname || contactInfo.remark || targetWxid

          return {
            wxid: targetWxid,
            nickname: groupName,
            alias: contactInfo.alias,
            avatar: contactInfo.avatar,
            remark: contactInfo.remark,
            isGroup,
          }
        }
        else {
          // 个人联系人，优先显示备注，然后是昵称
          const displayName = contactInfo.remark || contactInfo.nickname || contactInfo.alias || targetWxid

          return {
            wxid: targetWxid,
            nickname: displayName,
            alias: contactInfo.alias,
            avatar: contactInfo.avatar,
            remark: contactInfo.remark,
            isGroup,
          }
        }
      }
    }
    catch (error) {
      console.error('获取联系人详情失败:', error)
    }

    return null
  }

  // 处理聊天消息
  const handleChatMessage = async (data: any, messageWxid?: string) => {
    console.log('📥 Chat Store 收到聊天消息:', {
      sessionId: data.sessionId,
      content: data.content?.substring(0, 30) + '...',
      fromMe: data.fromMe,
      type: data.type,
      messageWxid,
      timestamp: data.timestamp
    })

    // 检查消息是否属于当前账号
    const authStore = useAuthStore()
    const currentAccountWxid = authStore.currentAccount?.wxid

    // 如果提供了messageWxid，检查是否匹配当前账号
    if (messageWxid && currentAccountWxid && messageWxid !== currentAccountWxid) {
      console.log(`📨 消息属于账号 ${messageWxid}，但当前账号是 ${currentAccountWxid}`)

      // 跨账号消息已经由 crossAccountMessage.ts 处理了，这里不需要重复处理
      console.log(`⏭️ 跳过当前账号的消息处理，跨账号消息由专门的存储处理`)
      return
    }

    const sessionId = data.sessionId || (data.fromMe ? data.toUser : data.fromUser)

    console.log('🎯 确定会话ID:', {
      originalSessionId: data.sessionId,
      calculatedSessionId: sessionId,
      fromMe: data.fromMe,
      toUser: data.toUser,
      fromUser: data.fromUser
    })

    const chatMessage: ChatMessage = {
      id: data.id || Date.now().toString(),
      content: data.content || '',
      timestamp: data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp || Date.now()),
      fromMe: data.fromMe || false,
      type: data.type || 'text',
      status: 'received',
      sessionId: sessionId,
      isGroupMessage: sessionId?.includes('@chatroom') || false,
      actualSender: data.actualSender || data.fromUser,
      actualSenderName: data.actualSenderName || data.senderName,
      // 表情相关字段
      emojiUrl: data.emojiUrl,
      emojiThumbUrl: data.emojiThumbUrl,
      emojiExternUrl: data.emojiExternUrl,
      emojiWidth: data.emojiWidth,
      emojiHeight: data.emojiHeight,
      emojiData: data.emojiData,
      emojiAesKey: data.emojiAesKey,
      emojiMd5: data.emojiMd5,
      // 图片相关字段
      imageData: data.imageData,
      imagePath: data.imagePath,
      imageAesKey: data.imageAesKey,
      imageMd5: data.imageMd5,
      imageDataLen: data.imageDataLen,
      imageCompressType: data.imageCompressType,
      // CDN下载参数
      imageCdnFileAesKey: data.imageCdnFileAesKey,
      imageCdnFileNo: data.imageCdnFileNo,
      // 其他CDN信息
      imageCdnThumbUrl: data.imageCdnThumbUrl,
      imageCdnMidUrl: data.imageCdnMidUrl,
      // 视频相关字段
      videoAesKey: data.videoAesKey,
      videoMd5: data.videoMd5,
      // videoNewMd5: data.videoNewMd5, // 移除不存在的字段
      videoDataLen: data.videoDataLen,
      videoCompressType: data.videoCompressType,
      videoPlayLength: data.videoPlayLength,
      videoCdnUrl: data.videoCdnUrl,
      videoThumbUrl: data.videoThumbUrl,
      videoThumbAesKey: data.videoThumbAesKey,
      // videoThumbLength: data.videoThumbLength, // 移除不存在的字段
      videoThumbWidth: data.videoThumbWidth,
      videoThumbHeight: data.videoThumbHeight,
      videoFromUserName: data.videoFromUserName,
      // 文件相关字段
      fileData: data.fileData,
      // 其他字段
      extraData: data.extraData,
    }
    console.log('消息会话ID:', sessionId, '消息内容:', chatMessage.content)



    if (sessionId) {
      // 确保会话存在
      let session = sessions.value.find(s => s.id === sessionId)
      if (!session) {
        // 如果会话不存在，创建一个新会话
        session = {
          id: sessionId,
          name: sessionId, // 临时使用sessionId作为名称
          avatar: '',
          type: 'friend',
          lastMessage: '',
          lastMessageTime: new Date(),
          unreadCount: 0,
          isOnline: false,
        }
        sessions.value.unshift(session)
        console.log('创建新会话:', sessionId)

        // 异步获取联系人详情并更新会话信息
        const authStore = useAuthStore()
        if (authStore.currentAccount?.wxid) {
          updateSessionContactInfo(authStore.currentAccount.wxid, sessionId, true) // 强制刷新新会话
        }
      } else {
        // 即使会话已存在，如果是收到的消息，也尝试更新联系人信息（添加防重复更新机制）
        if (!chatMessage.fromMe) {
          const authStore = useAuthStore()
          if (authStore.currentAccount?.wxid) {
            // 检查是否需要更新联系人信息（防止重复更新）
            const cacheKey = `contact_update_${authStore.currentAccount.wxid}_${sessionId}`
            const lastUpdate = sessionStorage.getItem(cacheKey)
            const now = Date.now()
            const CONTACT_UPDATE_COOLDOWN = 30000 // 30秒冷却时间

            if (!lastUpdate || (now - parseInt(lastUpdate)) > CONTACT_UPDATE_COOLDOWN) {
              console.log('🔄 收到新消息，尝试更新现有会话的联系人信息:', sessionId)
              sessionStorage.setItem(cacheKey, now.toString())
              updateSessionContactInfo(authStore.currentAccount.wxid, sessionId, false) // 不强制刷新，避免频繁更新
            } else {
              console.log(`⏰ 跳过联系人信息更新 (冷却中): ${sessionId}, 距离上次更新 ${Math.round((now - parseInt(lastUpdate)) / 1000)}秒`)
            }
          }
        }
      }

      // 确定消息应该保存到哪个账号的缓存中
      const authStore = useAuthStore()
      const targetWxid = messageWxid || authStore.currentAccount?.wxid

      addMessage(sessionId, chatMessage, targetWxid)

      // 如果当前没有选中会话，自动选中这个会话
      if (!currentSession.value) {
        setCurrentSession(sessionId, targetWxid)
        console.log('自动选中会话:', sessionId)
      }
    }
    else {
      console.warn('无法确定消息的会话ID:', data)
    }
  }

  // 处理系统消息
  const handleSystemMessage = (data: any, messageWxid?: string) => {
    // 检查消息是否属于当前账号
    const authStore = useAuthStore()
    const currentAccountWxid = authStore.currentAccount?.wxid

    // 如果提供了messageWxid，检查是否匹配当前账号
    if (messageWxid && currentAccountWxid && messageWxid !== currentAccountWxid) {
      console.log(`系统消息属于账号 ${messageWxid}，但当前账号是 ${currentAccountWxid}，跳过处理`)
      return
    }

    if (data.message) {
      console.log('系统消息:', data.message)
    }
  }

  const disconnectWebSocket = async () => {
    try {
      const { webSocketService } = await import('@/services/websocket')
      webSocketService.disconnect()
    } catch (error) {
      console.error('断开WebSocket连接失败:', error)
    }
  }

  // 创建或获取聊天会话
  const createOrGetSession = (friend: any): ChatSession => {
    // 检查是否已存在会话
    let session = sessions.value.find(s => s.id === friend.wxid)

    if (!session) {
      // 创建新会话
      session = {
        id: friend.wxid,
        name: friend.remark || friend.nickname || friend.alias || '未知好友',
        avatar: friend.avatar || '',
        type: 'friend',
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0,
        isOnline: friend.isOnline || false,
      }

      // 添加到会话列表
      sessions.value.unshift(session)
    }

    return session
  }

  // 同步消息历史
  const syncMessages = async (wxid: string) => {
    try {
      await chatApi.syncAndPushMessages(wxid)
    }
    catch (error) {
      console.error('同步消息失败:', error)
    }
  }

  // 测试WebSocket消息处理
  const testWebSocketMessage = () => {
    const testMessage = {
      id: `test_${Date.now()}`,
      content: '这是一条测试消息',
      timestamp: new Date(),
      fromMe: false,
      type: 'text',
      sessionId: 'test_session',
    }

    handleChatMessage(testMessage)
  }

  // 更新会话联系人信息
  const updateSessionContactInfo = async (accountWxid: string, sessionId: string, forceRefresh = false) => {
    try {
      // 使用联系人store获取最新信息
      const contactInfo = await contactStore.updateContactInfo(accountWxid, sessionId, forceRefresh)

      if (contactInfo) {
        // 找到会话在数组中的索引
        const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
        if (sessionIndex !== -1) {
          // 确定显示名称的优先级，确保结果始终是字符串
          let displayName = sessionId
          if (contactInfo.isGroup) {
            // 群聊：优先显示群名称，其次昵称
            displayName = String(contactInfo.groupName || contactInfo.nickname || sessionId)
          } else {
            // 个人：优先显示备注，其次昵称，再次别名
            displayName = String(contactInfo.remark || contactInfo.nickname || contactInfo.alias || sessionId)
          }

          // 确保displayName是有效的字符串
          if (!displayName || displayName === 'undefined' || displayName === 'null') {
            displayName = sessionId
          }

          console.log(`📝 更新会话显示名称: ${sessionId} -> ${displayName}`, {
            isGroup: contactInfo.isGroup,
            groupName: contactInfo.groupName,
            nickname: contactInfo.nickname,
            remark: contactInfo.remark,
            alias: contactInfo.alias,
            finalName: displayName
          })

          // 创建新的会话对象来触发响应式更新
          const updatedSession = {
            ...sessions.value[sessionIndex],
            name: displayName,
            type: (contactInfo.isGroup ? 'group' : 'friend') as 'friend' | 'group',
            avatar: contactInfo.avatar || ''
          }

          // 使用splice来替换数组中的会话对象，确保Vue检测到变化
          sessions.value.splice(sessionIndex, 1, updatedSession)

          // currentSession 是计算属性，会自动响应 accountDataManager 中的变化

          console.log('会话联系人信息已更新:', updatedSession.name, updatedSession.avatar, '类型:', updatedSession.type)

          // 强制刷新UI
          forceRefreshUI()

          // 保存到缓存
          saveCachedData(accountWxid)

          return updatedSession
        }
      }
    } catch (error) {
      console.error('更新会话联系人信息失败:', error)
    }

    return null
  }

  // 更新会话信息
  const updateSessionInfo = (sessionId: string, updates: Partial<ChatSession>) => {
    const authStore = useAuthStore()
    const targetWxid = authStore.currentAccount?.wxid

    if (!targetWxid) {
      console.warn('updateSessionInfo: 无法确定目标账号')
      return null
    }

    const accountData = accountDataManager.getAccountData(targetWxid)
    const sessionIndex = accountData.sessions.findIndex(s => s.id === sessionId)

    if (sessionIndex !== -1) {
      // 创建新的会话对象
      const updatedSession = {
        ...accountData.sessions[sessionIndex],
        ...updates
      }

      // 更新会话列表
      const updatedSessions = [...accountData.sessions]
      updatedSessions[sessionIndex] = updatedSession

      // 使用accountDataManager更新会话列表
      accountDataManager.updateSessions(targetWxid, updatedSessions)

      // 如果这是当前选中的会话，也要更新currentSession
      if (currentSession.value?.id === sessionId) {
        accountDataManager.updateCurrentSession(targetWxid, updatedSession)
        console.log(`🔄 当前会话已更新: ${updatedSession.name}`)
      }

      // 强制刷新UI以确保界面更新
      forceRefreshUI()

      console.log(`✅ 更新账号 ${targetWxid} 的会话信息: ${sessionId}`)
      return updatedSession
    }
    return null
  }

  // 删除会话
  const removeSession = (sessionId: string) => {
    const authStore = useAuthStore()
    const targetWxid = authStore.currentAccount?.wxid

    if (!targetWxid) {
      console.warn('removeSession: 无法确定目标账号')
      return
    }

    const accountData = accountDataManager.getAccountData(targetWxid)
    const sessionIndex = accountData.sessions.findIndex(s => s.id === sessionId)

    if (sessionIndex !== -1) {
      // 删除会话
      const updatedSessions = accountData.sessions.filter(s => s.id !== sessionId)
      accountDataManager.updateSessions(targetWxid, updatedSessions)

      // 删除相关消息
      accountDataManager.removeSessionMessages(targetWxid, sessionId)

      // 如果删除的是当前会话，清空当前会话
      if (currentSession.value?.id === sessionId) {
        accountDataManager.updateCurrentSession(targetWxid, null)
      }

      console.log(`✅ 删除账号 ${targetWxid} 的会话: ${sessionId}`)
    }
  }

  // 更新会话名称
  const updateSessionName = (sessionId: string, newName: string) => {
    updateSessionInfo(sessionId, { name: newName })
  }

  // 强制刷新UI
  const forceRefreshUI = () => {
    refreshTrigger.value++
    console.log('🔄 强制刷新UI触发器:', refreshTrigger.value)
  }

  return {
    // 状态
    sessions,
    currentSession,
    messages,
    isLoading,
    isSending,
    refreshTrigger,

    // 计算属性
    currentMessages,
    unreadCount,

    // 方法
    setSessions,
    setCurrentSession,
    addMessage,
    loadMessages,
    sendTextMessage,
    sendImageMessage,
    sendFileMessage,
    sendCachedFileMessage,
    clearMessages,
    updateMessageStatus,
    retryMessage,
    recallMessage,
    clearAllData,
    connectWebSocket,
    disconnectWebSocket,
    createOrGetSession,
    syncMessages,
    testWebSocketMessage,
    updateSessionInfo,
    updateSessionContactInfo,
    removeSession,
    updateSessionName,
    sortSessions,
    forceRefreshUI,

    // 缓存相关方法
    migrateOldCacheData,
    saveCachedData,
    switchAccount,
    syncCrossAccountMessages,
    clearCache,
    debugCacheKeys,
    detectAndRepairCache,
  }
})
