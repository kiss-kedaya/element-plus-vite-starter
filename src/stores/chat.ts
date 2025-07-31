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
    try {
      const result = await chatApi.sendTextMessage({
        Wxid: wxid,
        ToWxid: toUserName,
        Content: content,
        Type: 1
      })
      
      if (result.Success) {
        // 添加到本地消息列表
        const message: ChatMessage = {
          id: Date.now().toString(),
          content,
          timestamp: new Date(),
          fromMe: true,
          type: 'text',
          status: 'sent'
        }
        addMessage(toUserName, message)
      }
      
      return result
    } catch (error) {
      console.error('发送消息失败:', error)
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

  const updateMessageStatus = (sessionId: string, messageId: string, status: ChatMessage['status']) => {
    const sessionMessages = messages.value[sessionId]
    if (sessionMessages) {
      const message = sessionMessages.find(m => m.id === messageId)
      if (message) {
        message.status = status
      }
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
    const chatMessage: ChatMessage = {
      id: data.id || Date.now().toString(),
      content: data.content || '',
      timestamp: data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp || Date.now()),
      fromMe: data.fromMe || false,
      type: data.type || 'text',
      status: 'received'
    }

    const sessionId = data.sessionId || (data.fromMe ? data.toUser : data.fromUser)
    if (sessionId) {
      addMessage(sessionId, chatMessage)

      // 如果当前没有选中会话，自动选中这个会话
      if (!currentSession.value) {
        const session = sessions.value.find(s => s.id === sessionId)
        if (session) {
          setCurrentSession(sessionId)
        }
      }
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
    clearAllData,
    connectWebSocket,
    disconnectWebSocket,
    createOrGetSession,
    syncMessages
  }
})
