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
      } as unknown as WebSocket
    } else {
      throw new Error('WebSocket连接失败')
    }
  } catch (error: unknown) {
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

  data.messages.forEach((msg: any) => {
    // 转换为聊天消息格式
    const chatMessage: ChatMessage = {
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      content: msg.content || '',
      timestamp: new Date(msg.timestamp * 1000),
      fromMe: msg.isSelf || false,
      type: getMsgType(msg.msgType),
      status: 'received'
    }

    // 处理表情消息
    if (msg.msgType === 47 && msg.originalContent) {
      chatMessage.emojiData = msg.originalContent

      // 尝试从originalContent中提取CDN URL（主要表情图片）
      const cdnUrlMatch = msg.originalContent.match(/cdnurl\s*=\s*"([^"]+)"/)
      if (cdnUrlMatch) {
        // 解码HTML实体
        const cdnUrl = cdnUrlMatch[1].replace(/&amp;/g, '&')
        chatMessage.emojiUrl = cdnUrl
      }

      // 尝试提取缩略图URL（用于快速预览）
      const thumbUrlMatch = msg.originalContent.match(/thumburl\s*=\s*"([^"]*)"/)
      if (thumbUrlMatch && thumbUrlMatch[1] && thumbUrlMatch[1].trim()) {
        const thumbUrl = thumbUrlMatch[1].replace(/&amp;/g, '&')
        chatMessage.emojiThumbUrl = thumbUrl
      }

      // 尝试提取加密URL（备用）
      const encryptUrlMatch = msg.originalContent.match(/encrypturl\s*=\s*"([^"]+)"/)
      if (encryptUrlMatch && encryptUrlMatch[1]) {
        const encryptUrl = encryptUrlMatch[1].replace(/&amp;/g, '&')
        // 如果没有缩略图URL，使用加密URL作为备用
        if (!chatMessage.emojiThumbUrl) {
          chatMessage.emojiThumbUrl = encryptUrl
        }
      }

      // 尝试提取外部URL（可能更容易访问）
      const externUrlMatch = msg.originalContent.match(/externurl\s*=\s*"([^"]+)"/)
      if (externUrlMatch && externUrlMatch[1]) {
        const externUrl = externUrlMatch[1].replace(/&amp;/g, '&')
        // 如果仍然没有缩略图URL，使用外部URL
        if (!chatMessage.emojiThumbUrl) {
          chatMessage.emojiThumbUrl = externUrl
        }
        // 将外部URL存储为额外字段
        chatMessage.emojiExternUrl = externUrl
      }

      // 提取表情尺寸信息
      const widthMatch = msg.originalContent.match(/width\s*=\s*"([^"]+)"/)
      const heightMatch = msg.originalContent.match(/height\s*=\s*"([^"]+)"/)
      if (widthMatch && heightMatch) {
        chatMessage.emojiWidth = parseInt(widthMatch[1])
        chatMessage.emojiHeight = parseInt(heightMatch[1])
      }

      // 提取AES密钥和MD5（用于CDN下载API）
      const aesKeyMatch = msg.originalContent.match(/aeskey\s*=\s*"([^"]+)"/)
      const md5Match = msg.originalContent.match(/md5\s*=\s*"([^"]+)"/)
      if (aesKeyMatch && md5Match) {
        chatMessage.emojiAesKey = aesKeyMatch[1]
        chatMessage.emojiMd5 = md5Match[1]
      }

      console.log('WebSocket解析表情消息:', {
        cdnUrl: chatMessage.emojiUrl,
        thumbUrl: chatMessage.emojiThumbUrl,
        width: chatMessage.emojiWidth,
        height: chatMessage.emojiHeight,
        aesKey: chatMessage.emojiAesKey,
        md5: chatMessage.emojiMd5,
        originalContent: msg.originalContent.substring(0, 200) + '...' // 显示部分原始内容用于调试
      })
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
  } catch (error: unknown) {
    ElMessage.error('WebSocket重连失败')
    throw error
  }
}
