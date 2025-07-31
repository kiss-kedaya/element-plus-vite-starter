import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage } from '@/types/chat'

// WebSocket 连接状态
export const wsConnections = reactive<Record<string, WebSocket>>({})
export const wsStatus = reactive<Record<string, 'connecting' | 'connected' | 'disconnected'>>({})

// WebSocket 消息类型定义
interface WeChatMessage {
  type: 'wechat_message'
  wxid: string
  timestamp: number
  count: number
  messages: Array<{
    id: string
    fromUser: string
    toUser: string
    content: string
    msgType: number
    timestamp: number
    isSelf: boolean
  }>
}

// 创建 WebSocket 连接
export const createWebSocketConnection = (wxid: string): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    if (wsConnections[wxid] && wsConnections[wxid].readyState === WebSocket.OPEN) {
      resolve(wsConnections[wxid])
      return
    }

    const wsUrl = `ws://localhost:8059/ws?wxid=${wxid}`
    const ws = new WebSocket(wsUrl)
    
    wsStatus[wxid] = 'connecting'

    ws.onopen = () => {
      console.log(`WebSocket连接已建立 (wxid: ${wxid})`)
      wsStatus[wxid] = 'connected'
      wsConnections[wxid] = ws
      resolve(ws)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(wxid, data)
      } catch (error) {
        console.error('解析WebSocket消息失败:', error)
      }
    }

    ws.onclose = () => {
      console.log(`WebSocket连接已关闭 (wxid: ${wxid})`)
      wsStatus[wxid] = 'disconnected'
      delete wsConnections[wxid]
    }

    ws.onerror = (error) => {
      console.error(`WebSocket连接错误 (wxid: ${wxid}):`, error)
      wsStatus[wxid] = 'disconnected'
      reject(error)
    }

    // 设置连接超时
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close()
        reject(new Error('WebSocket连接超时'))
      }
    }, 10000)
  })
}

// 处理 WebSocket 消息
const handleWebSocketMessage = (wxid: string, data: any) => {
  console.log('收到WebSocket消息:', data)

  if (data.type === 'wechat_message') {
    handleWeChatMessage(wxid, data as WeChatMessage)
  } else {
    console.log('收到未知类型的消息:', data)
  }
}

// 处理微信消息
const handleWeChatMessage = (wxid: string, data: WeChatMessage) => {
  const chatStore = useChatStore()
  
  if (!data.messages || data.messages.length === 0) {
    return
  }

  console.log(`收到 ${data.count} 条微信消息`)

  data.messages.forEach(msg => {
    // 转换为聊天消息格式
    const chatMessage: ChatMessage = {
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      content: msg.content || '',
      timestamp: new Date(msg.timestamp * 1000),
      fromMe: msg.isSelf || false,
      type: getMsgType(msg.msgType),
      status: 'received'
    }

    // 确定会话ID（发送者或接收者）
    const sessionId = msg.isSelf ? msg.toUser : msg.fromUser
    
    // 添加消息到聊天存储
    chatStore.addMessage(sessionId, chatMessage)
  })
}

// 根据消息类型转换
const getMsgType = (msgType: number): ChatMessage['type'] => {
  switch (msgType) {
    case 1: // 文本消息
      return 'text'
    case 3: // 图片消息
      return 'image'
    case 6: // 文件消息
      return 'file'
    default:
      return 'text'
  }
}

// 关闭 WebSocket 连接
export const closeWebSocketConnection = (wxid: string) => {
  if (wsConnections[wxid]) {
    wsConnections[wxid].close()
    delete wsConnections[wxid]
    wsStatus[wxid] = 'disconnected'
  }
}

// 获取连接状态
export const getWebSocketStatus = (wxid: string) => {
  return wsStatus[wxid] || 'disconnected'
}

// 发送 WebSocket 消息
export const sendWebSocketMessage = (wxid: string, message: any) => {
  const ws = wsConnections[wxid]
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
    return true
  }
  return false
}

// 重连 WebSocket
export const reconnectWebSocket = async (wxid: string) => {
  closeWebSocketConnection(wxid)
  try {
    await createWebSocketConnection(wxid)
    ElMessage.success('WebSocket重连成功')
  } catch (error) {
    ElMessage.error('WebSocket重连失败')
    throw error
  }
}
