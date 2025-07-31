import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage } from '@/types/chat'
import { WEBSOCKET_CONFIG } from '@/config/websocket'

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

// 创建 WebSocket 连接（使用统一的WebSocket服务）
export const createWebSocketConnection = async (wxid: string): Promise<WebSocket> => {
  const { webSocketService } = await import('@/services/websocket')

  try {
    const connected = await webSocketService.connect(wxid)
    if (connected) {
      // 创建一个虚拟的WebSocket对象来保持兼容性
      return {
        readyState: WebSocket.OPEN,
        close: () => webSocketService.disconnect(),
        send: (data: string) => webSocketService.send(JSON.parse(data))
      } as WebSocket
    } else {
      throw new Error('WebSocket连接失败')
    }
  } catch (error) {
    throw error
  }
}

// 旧的WebSocket连接逻辑已被统一的WebSocket服务替代

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

// 关闭 WebSocket 连接（使用统一的WebSocket服务）
export const closeWebSocketConnection = async (wxid: string) => {
  const { webSocketService } = await import('@/services/websocket')
  webSocketService.disconnect()
  wsStatus[wxid] = 'disconnected'
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
