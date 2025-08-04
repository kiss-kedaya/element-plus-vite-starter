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
    if (!messageWxid) return

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

    // 存储消息
    if (!accountMessages.value[messageWxid]) {
      accountMessages.value[messageWxid] = []
    }
    accountMessages.value[messageWxid].push(crossMessage)

    // 更新账号统计
    updateAccountStats(messageWxid, crossMessage)

    // 如果消息不属于当前账号，显示通知
    if (messageWxid !== currentAccountWxid && !crossMessage.fromMe) {
      showCrossAccountNotification(crossMessage)
      
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
        onClick: () => {
          // 可以在这里添加切换到对应账号的逻辑
          authStore.setCurrentAccount(messageWxid)
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

  // 显示跨账号消息通知
  const showCrossAccountNotification = (message: CrossAccountMessage) => {
    const authStore = useAuthStore()
    const account = authStore.accounts.find(acc => acc.wxid === message.wxid)
    const accountName = account?.nickname || message.wxid

    let title = `${accountName} 收到新消息`
    let content = message.content

    // 处理不同类型的消息
    if (message.type === 'image') {
      content = '[图片]'
    } else if (message.type === 'file') {
      content = '[文件]'
    } else if (message.type === 'voice') {
      content = '[语音]'
    } else if (message.type === 'video') {
      content = '[视频]'
    }

    // 群聊消息显示发送者
    if (message.isGroupMessage && message.senderName) {
      content = `${message.senderName}: ${content}`
    }

    ElNotification.info({
      title,
      message: content,
      duration: 5000,
      onClick: () => {
        // 点击通知切换到对应账号
        authStore.setCurrentAccount(message.wxid)
      }
    })
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
    getAccountUnreadCount,
    getAccountLastMessage,
    clearAccountUnreadCount,
    getAccountMessages,
    clearAllData,
    destroy
  }
})
