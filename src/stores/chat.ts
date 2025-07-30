import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatSession, ChatMessage } from '@/types/chat'
import { chatApi } from '@/api/chat'

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
    messages.value[sessionId].push(message)
    
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
        ToUserName: toUserName,
        Content: content
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
        ToUserName: toUserName,
        ImageData: imageData
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
    updateMessageStatus
  }
})
