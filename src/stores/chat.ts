import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatSession, ChatMessage } from '@/types/chat'
import { chatApi } from '@/api/chat'
import { webSocketService } from '@/services/websocket'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const sessions = ref<ChatSession[]>([])
  const currentSession = ref<ChatSession | null>(null)
  const messages = ref<Record<string, ChatMessage[]>>({})
  const isLoading = ref(false)
  const isSending = ref(false)

  // 计算属性
  const currentMessages = computed(() => {
    if (!currentSession.value) return []
    return messages.value[currentSession.value.id] || []
  })

  const unreadCount = computed(() => {
    return sessions.value.reduce((total, session) => total + session.unreadCount, 0)
  })

  // 方法
  const setSessions = (newSessions: ChatSession[]) => {
    sessions.value = newSessions
  }

  const setCurrentSession = (sessionId: string) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      currentSession.value = session
      // 标记为已读
      session.unreadCount = 0
      // 加载消息历史
      loadMessages(sessionId)
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
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      session.lastMessage = message.content
      session.lastMessageTime = message.timestamp
      if (message.fromMe === false) {
        session.unreadCount++
      }
    }
  }

  const loadMessages = async (sessionId: string) => {
    if (messages.value[sessionId]) return // 已加载过
    
    isLoading.value = true
    try {
      // 这里调用获取消息历史的API
      // const result = await chatApi.getMessages(sessionId)
      // messages.value[sessionId] = result.data || []
      messages.value[sessionId] = []
    } catch (error) {
      console.error('加载消息失败:', error)
      messages.value[sessionId] = []
    } finally {
      isLoading.value = false
    }
  }

  const sendTextMessage = async (wxid: string, toUserName: string, content: string) => {
    isSending.value = true

    // 立即显示消息，状态为发送中
    const messageId = Date.now().toString()
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
      retryCount: 0
    }
    addMessage(toUserName, message)

    try {
      const result = await chatApi.sendTextMessage({
        Wxid: wxid,
        ToWxid: toUserName,
        Content: content,
        Type: 1
      })

      if (result.Success) {
        // 更新消息状态为已发送
        updateMessageStatus(toUserName, messageId, 'sent', true)
      } else {
        // 更新消息状态为失败
        updateMessageStatus(toUserName, messageId, 'failed', true)
      }

      return result
    } catch (error) {
      console.error('发送消息失败:', error)
      // 更新消息状态为失败，允许重试
      updateMessageStatus(toUserName, messageId, 'failed', true)
      throw error
    } finally {
      isSending.value = false
    }
  }

  const sendImageMessage = async (wxid: string, toUserName: string, imageData: string) => {
    isSending.value = true
    try {
      const result = await chatApi.sendImageMessage({
        Wxid: wxid,
        ToWxid: toUserName,
        Base64: imageData
      })
      
      if (result.Success) {
        const message: ChatMessage = {
          id: Date.now().toString(),
          content: '[图片]',
          timestamp: new Date(),
          fromMe: true,
          type: 'image',
          imageData,
          status: 'sent'
        }
        addMessage(toUserName, message)
      }
      
      return result
    } catch (error) {
      console.error('发送图片失败:', error)
      throw error
    } finally {
      isSending.value = false
    }
  }

  const clearMessages = (sessionId: string) => {
    delete messages.value[sessionId]
  }

  const updateMessageStatus = (sessionId: string, messageId: string, status: ChatMessage['status'], canRetry: boolean = false) => {
    const sessionMessages = messages.value[sessionId]
    if (sessionMessages) {
      const message = sessionMessages.find(m => m.id === messageId)
      if (message) {
        message.status = status
        message.canRetry = canRetry && status === 'failed'
        message.canRecall = status === 'sent' && message.fromMe
      }
    }
  }

  // 重试发送消息
  const retryMessage = async (wxid: string, sessionId: string, messageId: string) => {
    const sessionMessages = messages.value[sessionId]
    if (!sessionMessages) return

    const message = sessionMessages.find(m => m.id === messageId)
    if (!message || !message.canRetry || !message.originalContent) return

    // 删除原消息
    const messageIndex = sessionMessages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      sessionMessages.splice(messageIndex, 1)
    }

    // 重新发送消息（会显示在最下方）
    try {
      await sendTextMessage(wxid, sessionId, message.originalContent)
    } catch (error) {
      console.error('重试发送消息失败:', error)
    }
  }

  // 撤回消息
  const recallMessage = async (wxid: string, sessionId: string, messageId: string) => {
    const sessionMessages = messages.value[sessionId]
    if (!sessionMessages) return

    const message = sessionMessages.find(m => m.id === messageId)
    if (!message || !message.canRecall) return

    try {
      // 这里需要调用撤回消息的API
      // const result = await chatApi.recallMessage({ Wxid: wxid, MessageId: messageId })

      // 暂时直接从本地删除消息
      const messageIndex = sessionMessages.findIndex(m => m.id === messageId)
      if (messageIndex !== -1) {
        sessionMessages.splice(messageIndex, 1)
      }

      // 添加系统消息提示撤回
      const recallNotice: ChatMessage = {
        id: Date.now().toString(),
        content: '你撤回了一条消息',
        timestamp: new Date(),
        fromMe: false,
        type: 'system',
        status: 'sent'
      }
      sessionMessages.push(recallNotice)

    } catch (error) {
      console.error('撤回消息失败:', error)
      throw error
    }
  }

  const clearAllData = () => {
    sessions.value = []
    currentSession.value = null
    messages.value = {}
  }

  // WebSocket连接管理
  const connectWebSocket = async (wxid: string): Promise<boolean> => {
    try {
      // 清除之前的事件监听器
      webSocketService.off('chat_message', handleChatMessage)
      webSocketService.off('system_message', handleSystemMessage)

      // 设置事件监听器
      webSocketService.on('chat_message', handleChatMessage)
      webSocketService.on('system_message', handleSystemMessage)

      return await webSocketService.connect(wxid)
    } catch (error) {
      console.error('WebSocket连接失败:', error)
      return false
    }
  }

  // 处理聊天消息
  const handleChatMessage = (data: any) => {
    console.log('处理聊天消息:', data)
    
    const chatMessage: ChatMessage = {
      id: data.id || Date.now().toString(),
      content: data.content || '',
      timestamp: data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp || Date.now()),
      fromMe: data.fromMe || false,
      type: data.type || 'text',
      status: 'received'
    }

    const sessionId = data.sessionId || (data.fromMe ? data.toUser : data.fromUser)
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
          isOnline: false
        }
        sessions.value.unshift(session)
        console.log('创建新会话:', sessionId)
      }
      
      addMessage(sessionId, chatMessage)
      console.log('消息已添加到会话:', sessionId, '当前消息数量:', messages.value[sessionId]?.length || 0)

      // 如果当前没有选中会话，自动选中这个会话
      if (!currentSession.value) {
        setCurrentSession(sessionId)
        console.log('自动选中会话:', sessionId)
      }
    } else {
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
        isOnline: friend.isOnline || false
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
    } catch (error) {
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
      sessionId: 'test_session'
    }
    
    console.log('发送测试WebSocket消息:', testMessage)
    handleChatMessage(testMessage)
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
    clearMessages,
    updateMessageStatus,
    retryMessage,
    recallMessage,
    clearAllData,
    connectWebSocket,
    disconnectWebSocket,
    createOrGetSession,
    syncMessages,
    testWebSocketMessage
  }
})
