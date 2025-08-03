import type { ChatMessage, ChatSession } from '@/types/chat'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { chatApi } from '@/api/chat'
import { friendApi } from '@/api/friend'
import { uploadFile } from '@/api'
import { webSocketService } from '@/services/websocket'
import { useAuthStore } from '@/stores/auth'
import { fileCacheManager } from '@/utils/fileCache'
import { ElMessage } from 'element-plus'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const sessions = ref<ChatSession[]>([])
  const currentSession = ref<ChatSession | null>(null)
  const messages = ref<Record<string, ChatMessage[]>>({})
  const isLoading = ref(false)
  const isSending = ref(false)

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
    }
    catch (error) {
      console.error('保存缓存失败:', error)
    }
  }

  const loadFromCache = (key: string, wxid?: string) => {
    try {
      const cacheKey = wxid ? `${key}_${wxid}` : key
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
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
    catch (error) {
      console.error('加载缓存失败:', error)
    }
    return null
  }

  const clearCache = (wxid?: string) => {
    try {
      if (wxid) {
        // 清除特定账号的缓存
        localStorage.removeItem(`${CACHE_KEYS.SESSIONS}_${wxid}`)
        localStorage.removeItem(`${CACHE_KEYS.MESSAGES}_${wxid}`)
        localStorage.removeItem(`${CACHE_KEYS.CURRENT_SESSION}_${wxid}`)
      }
      else {
        // 清除所有聊天缓存
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('wechat_chat_')) {
            localStorage.removeItem(key)
          }
        })
      }
    }
    catch (error) {
      console.error('清除缓存失败:', error)
    }
  }

  // 计算属性
  const currentMessages = computed(() => {
    if (!currentSession.value)
      return []
    return messages.value[currentSession.value.id] || []
  })

  const unreadCount = computed(() => {
    return sessions.value.reduce((total, session) => total + session.unreadCount, 0)
  })

  // 加载缓存数据
  const loadCachedData = (wxid: string) => {
    console.log(`加载账号 ${wxid} 的缓存数据`)

    // 加载会话列表
    const cachedSessions = loadFromCache(CACHE_KEYS.SESSIONS, wxid)
    if (cachedSessions && Array.isArray(cachedSessions)) {
      sessions.value = cachedSessions
      console.log(`加载了 ${cachedSessions.length} 个缓存会话`)
    }

    // 加载消息记录
    const cachedMessages = loadFromCache(CACHE_KEYS.MESSAGES, wxid)
    if (cachedMessages && typeof cachedMessages === 'object') {
      messages.value = cachedMessages
      const messageCount = Object.values(cachedMessages).reduce((total, msgs) => total + (msgs as any[]).length, 0)
      console.log(`加载了 ${messageCount} 条缓存消息`)
    }

    // 不自动恢复当前会话，等待用户点击选择
    // const cachedCurrentSession = loadFromCache(CACHE_KEYS.CURRENT_SESSION, wxid)
    // if (cachedCurrentSession && sessions.value.find(s => s.id === cachedCurrentSession.id)) {
    //   currentSession.value = cachedCurrentSession
    //   console.log(`恢复当前会话: ${cachedCurrentSession.name}`)
    // }
  }

  // 保存数据到缓存
  const saveCachedData = (wxid: string) => {
    if (!wxid)
      return

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
    catch (error) {
      console.error('保存缓存数据失败:', error)
    }
  }

  // 方法
  const setSessions = (newSessions: ChatSession[]) => {
    sessions.value = newSessions
    // 自动保存到缓存
    const authStore = useAuthStore()
    if (authStore.currentAccount?.wxid) {
      saveCachedData(authStore.currentAccount.wxid)
    }
  }

  const setCurrentSession = (sessionId: string) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      currentSession.value = session
      // 标记为已读
      session.unreadCount = 0

      // 懒加载：只加载当前会话的最近消息（限制数量）
      loadSessionMessagesLazy(sessionId)

      // 自动保存到缓存
      const authStore = useAuthStore()
      if (authStore.currentAccount?.wxid) {
        saveCachedData(authStore.currentAccount.wxid)
      }
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

  const addMessage = (sessionId: string, message: ChatMessage) => {
    if (!messages.value[sessionId]) {
      messages.value[sessionId] = []
    }

    // 检查消息是否已存在（避免重复）
    const existingMessage = messages.value[sessionId].find(m => m.id === message.id)
    if (existingMessage) {
      return
    }

    messages.value[sessionId].push(message)

    // 按时间戳排序消息
    messages.value[sessionId].sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
      return timeA - timeB
    })

    // 更新会话的最后消息
    const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
    if (sessionIndex !== -1) {
      const session = sessions.value[sessionIndex]
      session.lastMessage = message.content
      session.lastMessageTime = message.timestamp

      // 只有在以下情况下才增加未读计数：
      // 1. 消息不是自己发送的
      // 2. 用户当前没有在查看这个会话
      if (message.fromMe === false && currentSession.value?.id !== sessionId) {
        session.unreadCount++
      }

      // 将有新消息的会话移到列表顶部
      if (sessionIndex > 0) {
        sessions.value.splice(sessionIndex, 1) // 从原位置移除
        sessions.value.unshift(session) // 添加到顶部
      }
    }

    // 自动保存到缓存
    const authStore = useAuthStore()
    if (authStore.currentAccount?.wxid) {
      saveCachedData(authStore.currentAccount.wxid)
    }
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
    sessions.value = []
    currentSession.value = null
    messages.value = {}
  }

  // 切换账号时的数据管理
  const switchAccount = (newWxid: string, oldWxid?: string) => {
    // 保存当前账号的数据到缓存
    if (oldWxid) {
      saveCachedData(oldWxid)
      console.log(`账号 ${oldWxid} 的数据已保存`)
    }

    // 清空当前数据
    clearAllData()

    // 加载新账号的缓存数据
    if (newWxid) {
      loadCachedData(newWxid)
      console.log(`已切换到账号 ${newWxid}`)
    }
  }

  // WebSocket连接管理
  const connectWebSocket = async (wxid: string): Promise<boolean> => {
    try {
      // 检查是否已经连接到该账号
      if (webSocketService.isAccountConnected(wxid)) {
        console.log(`账号 ${wxid} 已有WebSocket连接，切换到该账号`)
        webSocketService.switchCurrentAccount(wxid)
        return true
      }

      // 设置事件监听器（只需要设置一次）
      if (!webSocketService.hasEventListeners()) {
        webSocketService.on('chat_message', handleChatMessage)
        webSocketService.on('system_message', handleSystemMessage)
      }

      // 建立新的连接
      const connected = await webSocketService.connect(wxid)
      if (connected) {
        console.log(`成功建立账号 ${wxid} 的WebSocket连接`)
      }
      return connected
    }
    catch (error) {
      console.error('WebSocket连接失败:', error)
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

      if (result.Success && result.Data && result.Data.length > 0) {
        const contactData = result.Data[0]
        console.log('联系人详情:', contactData)

        // 处理群聊信息
        if (isGroup) {
          // 对于群聊，优先从ContactList中获取群名称
          let groupName = targetWxid
          if (result.Data[0].ContactList && result.Data[0].ContactList.length > 0) {
            groupName = result.Data[0].ContactList[0].NickName?.string || targetWxid
          }
          else {
            groupName = contactData.NickName?.string || contactData.Remark?.string || targetWxid
          }

          return {
            wxid: targetWxid,
            nickname: groupName,
            alias: contactData.Alias || '',
            avatar: contactData.SmallHeadImgUrl || contactData.BigHeadImgUrl || '',
            remark: contactData.Remark?.string || '',
            isGroup,
          }
        }
        else {
          // 个人联系人
          return {
            wxid: targetWxid,
            nickname: contactData.NickName?.string || contactData.Remark?.string || targetWxid,
            alias: contactData.Alias || '',
            avatar: contactData.SmallHeadImgUrl || contactData.BigHeadImgUrl || '',
            remark: contactData.Remark?.string || '',
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
  const handleChatMessage = async (data: any) => {
    console.log('处理聊天消息:', data)

    const sessionId = data.sessionId || (data.fromMe ? data.toUser : data.fromUser)
    
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
      videoNewMd5: data.videoNewMd5,
      videoDataLen: data.videoDataLen,
      videoCompressType: data.videoCompressType,
      videoPlayLength: data.videoPlayLength,
      videoCdnUrl: data.videoCdnUrl,
      videoThumbUrl: data.videoThumbUrl,
      videoThumbAesKey: data.videoThumbAesKey,
      videoThumbLength: data.videoThumbLength,
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
          getContactDetail(authStore.currentAccount.wxid, sessionId).then((contactInfo) => {
            if (contactInfo) {
              // 找到会话在数组中的索引
              const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
              if (sessionIndex !== -1) {
                // 创建新的会话对象来触发响应式更新
                const updatedSession = {
                  ...sessions.value[sessionIndex],
                  name: contactInfo.isGroup 
                    ? (contactInfo.nickname || sessionId)
                    : (contactInfo.remark || contactInfo.nickname || contactInfo.alias || sessionId),
                  type: contactInfo.isGroup ? 'group' : 'friend',
                  avatar: contactInfo.avatar || ''
                }
                
                // 替换数组中的会话对象
                sessions.value[sessionIndex] = updatedSession
                
                // 如果这是当前选中的会话，也要更新currentSession
                if (currentSession.value?.id === sessionId) {
                  currentSession.value = updatedSession
                }
                
                console.log('会话信息已更新:', updatedSession.name, updatedSession.avatar, '类型:', updatedSession.type)
                
                // 保存到缓存
                saveCachedData(authStore.currentAccount.wxid)
              }
            }
          })
        }
      }

      addMessage(sessionId, chatMessage)
      console.log('消息已添加到会话:', sessionId, '当前消息数量:', messages.value[sessionId]?.length || 0)

      // 如果当前没有选中会话，自动选中这个会话
      if (!currentSession.value) {
        setCurrentSession(sessionId)
        console.log('自动选中会话:', sessionId)
      }
    }
    else {
      console.warn('无法确定消息的会话ID:', data)
    }
  }

  // 处理系统消息
  const handleSystemMessage = (data: any) => {
    if (data.message) {
      console.log('系统消息:', data.message)
    }
  }

  const disconnectWebSocket = () => {
    webSocketService.disconnect()
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

  // 更新会话信息
  const updateSessionInfo = (sessionId: string, updates: Partial<ChatSession>) => {
    const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
    if (sessionIndex !== -1) {
      // 创建新的会话对象来触发响应式更新
      const updatedSession = {
        ...sessions.value[sessionIndex],
        ...updates
      }

      // 替换数组中的会话对象
      sessions.value[sessionIndex] = updatedSession

      // 如果这是当前选中的会话，也要更新currentSession
      if (currentSession.value?.id === sessionId) {
        currentSession.value = updatedSession
      }

      // 自动保存到缓存
      const authStore = useAuthStore()
      if (authStore.currentAccount?.wxid) {
        saveCachedData(authStore.currentAccount.wxid)
      }

      return updatedSession
    }
    return null
  }

  // 删除会话
  const removeSession = (sessionId: string) => {
    const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
    if (sessionIndex !== -1) {
      // 删除会话
      sessions.value.splice(sessionIndex, 1)

      // 删除相关消息
      delete messages.value[sessionId]

      // 如果删除的是当前会话，清空当前会话
      if (currentSession.value?.id === sessionId) {
        currentSession.value = null
      }

      // 保存到缓存
      const authStore = useAuthStore()
      if (authStore.currentAccount?.wxid) {
        saveCachedData(authStore.currentAccount.wxid)
      }
    }
  }

  // 更新会话名称
  const updateSessionName = (sessionId: string, newName: string) => {
    updateSessionInfo(sessionId, { name: newName })
  }

  return {
    // 状态
    sessions,
    currentSession,
    messages,
    isLoading,
    isSending,

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
    removeSession,
    updateSessionName,

    // 缓存相关方法
    loadCachedData,
    saveCachedData,
    switchAccount,
    clearCache,
  }
})
