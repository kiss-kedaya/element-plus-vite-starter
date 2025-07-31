import type { ChatMessage } from '@/types/chat'
import { ElMessage } from 'element-plus'
import { WEBSOCKET_CONFIG } from '@/config/websocket'

// 事件类型定义
export interface WebSocketEvents {
  chat_message: (data: any) => void
  system_message: (data: any) => void
  connection_status: (connected: boolean) => void
}

export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = WEBSOCKET_CONFIG.RECONNECT.MAX_ATTEMPTS
  private reconnectInterval = WEBSOCKET_CONFIG.RECONNECT.INTERVAL
  private heartbeatInterval: number | null = null
  private isConnecting = false
  private eventListeners: Map<string, Function[]> = new Map()
  private currentWxid: string | undefined = undefined
  private static instance: WebSocketService | null = null

  // 单例模式
  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }

  private constructor() {
    // 初始化事件监听器映射
  }

  // 事件监听器管理
  on<K extends keyof WebSocketEvents>(event: K, listener: WebSocketEvents[K]) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  off<K extends keyof WebSocketEvents>(event: K, listener: WebSocketEvents[K]) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit<K extends keyof WebSocketEvents>(event: K, ...args: Parameters<WebSocketEvents[K]>) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(...args))
    }
  }

  // 连接WebSocket
  connect(wxid?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        console.log('WebSocket正在连接中，等待完成...')
        reject(new Error('WebSocket正在连接中'))
        return
      }

      // 如果已经连接到相同的wxid，直接返回成功
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentWxid === wxid) {
        console.log(`WebSocket已连接到 ${wxid}，复用现有连接`)
        resolve(true)
        return
      }

      // 如果连接到不同的wxid，先断开当前连接
      if (this.ws && this.currentWxid !== wxid) {
        console.log(`切换WebSocket连接从 ${this.currentWxid} 到 ${wxid}`)
        this.disconnect()
      }

      this.isConnecting = true
      this.currentWxid = wxid

      try {
        // WebSocket服务器地址，包含wxid参数
        const wsUrl = WEBSOCKET_CONFIG.getUrl(wxid)
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log(`WebSocket连接已建立 (wxid: ${wxid || '未指定'})`)
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startHeartbeat()

          // 触发连接状态事件
          this.emit('connection_status', true)
          resolve(true)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket连接已关闭', event.code, event.reason)
          this.isConnecting = false
          this.stopHeartbeat()

          // 触发连接状态事件
          this.emit('connection_status', false)

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.warn('WebSocket连接失败，将在模拟模式下运行')
          this.isConnecting = false
          reject(error)
        }
      }
      catch (error) {
        this.isConnecting = false
        console.error('创建WebSocket连接失败:', error)
        reject(error)
      }
    })
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, '主动断开连接')
      this.ws = null
    }
    this.reconnectAttempts = 0
    this.currentWxid = undefined
  }

  // 处理接收到的消息
  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data)

      switch (message.type) {
        case 'chat_message':
          this.emit('chat_message', message.data)
          break
        case 'wechat_message':
          // 处理微信消息格式
          this.handleWeChatMessage(message)
          break
        case 'system_message':
          this.emit('system_message', message.data)
          break
        case 'heartbeat_response':
          // 心跳响应，不需要特殊处理
          break
        default:
          console.log('收到未知类型的消息:', message)
      }
    }
    catch (error) {
      console.error('解析WebSocket消息失败:', error)
    }
  }

  // 处理微信消息
  private handleWeChatMessage(data: any) {
    if (!data.messages || data.messages.length === 0) {
      console.log('收到空的微信消息数据:', data)
      return
    }

    console.log(`收到 ${data.count || data.messages.length} 条微信消息`, data)

    data.messages.forEach((msg: any) => {
      // 转换为标准聊天消息格式
      const chatMessage = {
        id: msg.id || `msg_${Date.now()}_${Math.random()}`,
        content: msg.content || '',
        timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
        fromMe: msg.isSelf || false,
        type: this.getMsgType(msg.msgType),
        status: 'received',
        sessionId: msg.isSelf ? msg.toUser : msg.fromUser,
      }

      console.log('准备发送聊天消息事件:', chatMessage)
      // 发送聊天消息事件
      this.emit('chat_message', chatMessage)
      console.log('聊天消息事件已发送')
    })
  }

  // 根据消息类型转换
  private getMsgType(msgType: number): string {
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

  // 开始心跳
  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          type: 'heartbeat',
          timestamp: Date.now(),
        }
        this.ws.send(JSON.stringify(heartbeat))
      }
    }, WEBSOCKET_CONFIG.HEARTBEAT.INTERVAL)
  }

  // 停止心跳
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // 安排重连
  private scheduleReconnect() {
    this.reconnectAttempts++

    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect(this.currentWxid)
      }
    }, this.reconnectInterval * this.reconnectAttempts)
  }

  // 获取连接状态
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  // 发送消息到WebSocket
  send(message: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
      return true
    }
    return false
  }
}

// 导出WebSocket服务单例
export const webSocketService = WebSocketService.getInstance()
