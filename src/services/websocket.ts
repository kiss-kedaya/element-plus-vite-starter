import { ElMessage } from 'element-plus'
import type { ChatMessage } from '@/types/chat'

// 事件类型定义
export interface WebSocketEvents {
  'chat_message': (data: any) => void
  'system_message': (data: any) => void
  'connection_status': (connected: boolean) => void
}

export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 3000
  private heartbeatInterval: number | null = null
  private isConnecting = false
  private eventListeners: Map<string, Function[]> = new Map()
  private currentWxid: string | undefined = undefined

  constructor() {
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
        reject(new Error('WebSocket正在连接中'))
        return
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve(true)
        return
      }

      this.isConnecting = true
      this.currentWxid = wxid

      try {
        // WebSocket服务器地址，包含wxid参数
        const wsUrl = wxid
          ? `ws://127.0.0.1:8088/ws?wxid=${wxid}`
          : 'ws://127.0.0.1:8088/ws'
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log(`WebSocket连接已建立 (wxid: ${wxid || '未指定'})`)
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startHeartbeat()

          // 触发连接状态事件
          this.emit('connection_status', true)
          ElMessage.success('WebSocket连接成功')
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
          console.error('WebSocket连接错误:', error)
          this.isConnecting = false
          ElMessage.error('WebSocket连接失败')
          reject(error)
        }

      } catch (error) {
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
        case 'system_message':
          this.emit('system_message', message.data)
          break
        case 'heartbeat_response':
          // 心跳响应，不需要特殊处理
          break
        default:
          console.log('收到未知类型的消息:', message)
      }
    } catch (error) {
      console.error('解析WebSocket消息失败:', error)
    }
  }



  // 开始心跳
  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          type: 'heartbeat',
          timestamp: Date.now()
        }
        this.ws.send(JSON.stringify(heartbeat))
      }
    }, 30000) // 每30秒发送一次心跳
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
    console.log(`准备第${this.reconnectAttempts}次重连... (wxid: ${this.currentWxid || '未指定'})`)

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

// 创建全局WebSocket实例
export const webSocketService = new WebSocketService()
