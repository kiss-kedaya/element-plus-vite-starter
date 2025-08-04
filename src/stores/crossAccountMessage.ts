import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
// 使用动态导入避免与其他地方的动态导入冲突
import { ElNotification } from 'element-plus'

// 跨账号消息类型定义
interface CrossAccountMessage {
  id: string
  wxid: string // 消息所属的账号
  sessionId: string
  content: string
  timestamp: Date
  fromMe: boolean
  type: string
  senderName?: string
  isGroupMessage?: boolean
}

// 账号消息统计
interface AccountMessageStats {
  wxid: string
  unreadCount: number
  lastMessage?: CrossAccountMessage
  lastMessageTime?: Date
}

export const useCrossAccountMessageStore = defineStore('crossAccountMessage', () => {
  // 状态
  const accountMessages = ref<Record<string, CrossAccountMessage[]>>({})
  const accountStats = ref<Record<string, AccountMessageStats>>({})
  const isInitialized = ref(false)

  // 计算属性
  const totalUnreadCount = computed(() => {
    return Object.values(accountStats.value).reduce((total, stats) => total + stats.unreadCount, 0)
  })

  const getAccountUnreadCount = (wxid: string): number => {
    return accountStats.value[wxid]?.unreadCount || 0
  }

  const getAccountLastMessage = (wxid: string): CrossAccountMessage | undefined => {
    return accountStats.value[wxid]?.lastMessage
  }

  // 初始化跨账号消息监听
  const initializeCrossAccountMessaging = async () => {
    if (isInitialized.value) return

    console.log('初始化跨账号消息监听')

    try {
      const { webSocketService } = await import('@/services/websocket')

      // 监听所有账号的消息
      webSocketService.on('chat_message', handleCrossAccountMessage)
      webSocketService.on('friend_request', handleCrossAccountFriendRequest)

      // 监听连接状态变化
      webSocketService.on('connection_status', (connected: boolean, wxid: string) => {
        console.log(`账号 ${wxid} 连接状态变化: ${connected ? '已连接' : '已断开'}`)
        if (connected) {
          console.log(`✅ 账号 ${wxid} WebSocket连接已建立，开始监听消息`)
        } else {
          console.log(`❌ 账号 ${wxid} WebSocket连接已断开`)
        }
      })

      isInitialized.value = true
    } catch (error) {
      console.error('初始化跨账号消息监听失败:', error)
    }
  }

  // 处理跨账号聊天消息
  const handleCrossAccountMessage = (messageData: any, messageWxid: string) => {
    console.log('🔄 处理跨账号消息:', {
      messageWxid,
      currentAccount: useAuthStore().currentAccount?.wxid,
      sessionId: messageData.sessionId,
      fromUser: messageData.fromUser,
      toUser: messageData.toUser,
      fromMe: messageData.fromMe,
      content: messageData.content?.substring(0, 30) + '...'
    })

    if (!messageWxid) {
      console.warn('⚠️ messageWxid为空，跳过处理')
      return
    }

    const authStore = useAuthStore()
    const currentAccountWxid = authStore.currentAccount?.wxid

    // 创建跨账号消息对象
    const crossMessage: CrossAccountMessage = {
      id: messageData.id || `msg_${Date.now()}_${Math.random()}`,
      wxid: messageWxid,
      sessionId: messageData.sessionId || (messageData.fromMe ? messageData.toUser : messageData.fromUser),
      content: messageData.content || '',
      timestamp: messageData.timestamp || new Date(),
      fromMe: messageData.fromMe || false,
      type: messageData.type || 'text',
      senderName: messageData.actualSenderName || messageData.senderName,
      isGroupMessage: messageData.isGroupMessage || false
    }

    console.log('💾 存储跨账号消息:', {
      messageWxid,
      sessionId: crossMessage.sessionId,
      messageId: crossMessage.id,
      content: crossMessage.content?.substring(0, 30) + '...'
    })

    // 存储消息
    if (!accountMessages.value[messageWxid]) {
      accountMessages.value[messageWxid] = []
    }
    accountMessages.value[messageWxid].push(crossMessage)

    console.log(`✅ 跨账号消息已存储，账号 ${messageWxid} 现有 ${accountMessages.value[messageWxid].length} 条消息`)

    // 更新账号统计
    updateAccountStats(messageWxid, crossMessage)

    // 如果消息不属于当前账号，显示通知
    if (messageWxid !== currentAccountWxid && !crossMessage.fromMe) {
      // 更新auth store中的未读计数
      authStore.incrementAccountUnreadCount(messageWxid, 1)
    }
  }

  // 处理跨账号好友请求
  const handleCrossAccountFriendRequest = (requestData: any, messageWxid: string) => {
    if (!messageWxid) return

    const authStore = useAuthStore()
    const currentAccountWxid = authStore.currentAccount?.wxid

    // 如果好友请求不属于当前账号，显示通知
    if (messageWxid !== currentAccountWxid) {
      const account = authStore.accounts.find(acc => acc.wxid === messageWxid)
      const accountName = account?.nickname || messageWxid

      ElNotification.info({
        title: '好友请求',
        message: `账号 ${accountName} 收到新的好友请求`,
        duration: 5000,
        onClick: async () => {
          // 可以在这里添加切换到对应账号的逻辑
          await authStore.setCurrentAccount(messageWxid)
        }
      })
    }
  }

  // 更新账号统计信息
  const updateAccountStats = (wxid: string, message: CrossAccountMessage) => {
    if (!accountStats.value[wxid]) {
      accountStats.value[wxid] = {
        wxid,
        unreadCount: 0
      }
    }

    const stats = accountStats.value[wxid]

    // 更新最后消息
    stats.lastMessage = message
    stats.lastMessageTime = message.timestamp

    // 如果不是自己发送的消息，增加未读计数
    if (!message.fromMe) {
      stats.unreadCount++
    }
  }

  // 清除账号的未读计数
  const clearAccountUnreadCount = (wxid: string) => {
    if (accountStats.value[wxid]) {
      accountStats.value[wxid].unreadCount = 0
    }

    // 同时清除auth store中的计数
    const authStore = useAuthStore()
    authStore.clearAccountUnreadCount(wxid)
  }

  // 清除账号的跨账号消息（在消息同步到聊天界面后调用）
  const clearAccountMessages = (wxid: string) => {
    if (accountMessages.value[wxid]) {
      console.log(`清除账号 ${wxid} 的 ${accountMessages.value[wxid].length} 条跨账号消息`)
      accountMessages.value[wxid] = []
    }

    // 重置统计信息
    if (accountStats.value[wxid]) {
      accountStats.value[wxid].unreadCount = 0
      accountStats.value[wxid].lastMessage = undefined
      accountStats.value[wxid].lastMessageTime = undefined
    }
  }

  // 获取账号的消息列表
  const getAccountMessages = (wxid: string): CrossAccountMessage[] => {
    return accountMessages.value[wxid] || []
  }

  // 清除所有数据
  const clearAllData = () => {
    accountMessages.value = {}
    accountStats.value = {}
  }

  // 销毁监听器
  const destroy = async () => {
    if (isInitialized.value) {
      try {
        const { webSocketService } = await import('@/services/websocket')
        webSocketService.off('chat_message', handleCrossAccountMessage)
        webSocketService.off('friend_request', handleCrossAccountFriendRequest)
        isInitialized.value = false
      } catch (error) {
        console.error('销毁跨账号消息监听失败:', error)
      }
    }
  }

  return {
    // 状态
    accountMessages,
    accountStats,
    isInitialized,

    // 计算属性
    totalUnreadCount,

    // 方法
    initializeCrossAccountMessaging,
    handleCrossAccountMessage,
    getAccountUnreadCount,
    getAccountLastMessage,
    clearAccountUnreadCount,
    clearAccountMessages,
    getAccountMessages,
    clearAllData,
    destroy
  }
})
