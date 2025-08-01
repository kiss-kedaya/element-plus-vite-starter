import type { ChatMessage } from '@/types/chat'
import { ElMessage } from 'element-plus'
import { WEBSOCKET_CONFIG } from '@/config/websocket'
import { parseImageMessage, parseVideoMessage } from '@/utils/imageMessageParser'

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

    data.messages.forEach((msg: any) => {
      // 过滤掉不需要显示的消息类型
      if (this.shouldFilterMessage(msg)) {
        console.log('过滤消息:', msg.msgType, msg.msgTypeDesc, msg.contentType)
        return
      }

      // 判断是否为群聊消息
      const isGroupMessage = msg.isGroupMessage || msg.fromUser?.includes('@chatroom') || msg.toUser?.includes('@chatroom')

      // 判断是否为自己发送的消息
      let fromMe = false
      if (isGroupMessage) {
        // 群聊消息：比较actualSender和当前wxid
        fromMe = msg.actualSender === data.wxid
      }
      else {
        // 个人消息：比较fromUser和当前wxid，或者使用actualSender
        fromMe = msg.fromUser === data.wxid || msg.actualSender === data.wxid
      }

      // 确定会话ID
      let sessionId
      if (isGroupMessage) {
        // 群聊消息：会话ID是群聊ID（可能在fromUser或toUser中）
        sessionId = msg.fromUser?.includes('@chatroom') ? msg.fromUser : msg.toUser
      }
      else {
        // 个人消息：会话ID是对方的wxid
        sessionId = fromMe ? msg.toUser : msg.fromUser
      }

      // 转换为标准聊天消息格式
      const chatMessage: any = {
        id: msg.msgId?.toString() || `msg_${Date.now()}_${Math.random()}`,
        content: msg.content || '',
        timestamp: msg.createTime ? new Date(msg.createTime * 1000) : new Date(),
        fromMe,
        type: this.getMsgType(msg.msgType),
        status: 'received',
        sessionId,
        isGroupMessage,
      }

      // 特殊处理：撤回消息需要提前处理，避免重复
      if (msg.msgType === 10002) {
        // 解析撤回消息的XML内容，提取replacemsg
        let recallContent = '[系统消息]'

        if (msg.originalContent) {
          try {
            // 提取replacemsg中的内容
            const replaceMsgMatch = msg.originalContent.match(/<replacemsg><!\[CDATA\[(.*?)\]\]><\/replacemsg>/)
            if (replaceMsgMatch && replaceMsgMatch[1]) {
              recallContent = replaceMsgMatch[1]
            } else {
              // 备用方案：直接查找CDATA内容
              const cdataMatch = msg.originalContent.match(/\[CDATA\[(.*?)\]\]/)
              if (cdataMatch && cdataMatch[1]) {
                recallContent = cdataMatch[1]
              }
            }
          } catch (error) {
            console.warn('解析撤回消息内容失败:', error)
          }
        }

        chatMessage.content = recallContent
        chatMessage.type = 'system'
        chatMessage.fromMe = false

        // 保存额外数据
        if (msg.extraData) {
          chatMessage.extraData = msg.extraData
        }

        // 直接发送消息，跳过后续处理
        this.emit('chat_message', chatMessage)
        return
      }

      // 设置发送者信息（群聊和个人聊天都需要）
      if (isGroupMessage) {
        chatMessage.actualSender = msg.actualSender // 实际发送者wxid
        chatMessage.actualSenderName = msg.actualSenderName // 实际发送者名称
        chatMessage.groupId = msg.toUser // 群聊ID
      } else {
        // 个人聊天消息也设置发送者信息
        chatMessage.actualSender = fromMe ? data.wxid : msg.fromUser
        chatMessage.actualSenderName = fromMe ? msg.toUserName : msg.fromUserName
      }

      // 处理图片消息
      if (msg.msgType === 3) {
        chatMessage.content = '[图片]'

        console.log('处理图片消息，原始数据:', {
          msgId: msg.msgId,
          originalContent: msg.originalContent,
          content: msg.content
        })

        // 解析XML数据获取图片信息
        if (msg.originalContent) {
          // 使用新的图片消息解析工具
          const imageParams = parseImageMessage(msg.originalContent)

          // 设置解析出的图片参数
          chatMessage.imageAesKey = imageParams.aesKey
          chatMessage.imageMd5 = imageParams.md5
          chatMessage.imageDataLen = imageParams.dataLen
          chatMessage.imageCompressType = imageParams.compressType

          // CDN下载参数（优先使用）
          chatMessage.imageCdnFileAesKey = imageParams.cdnFileAesKey
          chatMessage.imageCdnFileNo = imageParams.cdnFileNo

          // 额外的CDN信息（用于备用下载方式）
          chatMessage.imageCdnThumbUrl = imageParams.cdnThumbUrl
          chatMessage.imageCdnMidUrl = imageParams.cdnMidUrl

          console.log('图片信息解析结果:', {
            imageAesKey: chatMessage.imageAesKey,
            imageMd5: chatMessage.imageMd5,
            imageDataLen: chatMessage.imageDataLen,
            imageCompressType: chatMessage.imageCompressType,
            cdnFileAesKey: chatMessage.imageCdnFileAesKey,
            cdnFileNo: chatMessage.imageCdnFileNo,
            cdnThumbUrl: chatMessage.imageCdnThumbUrl,
            cdnMidUrl: chatMessage.imageCdnMidUrl
          })
        }

        // 检查是否有直接的图片数据
        if (msg.content) {
          // 如果content是文件路径，需要转换为可访问的URL
          if (msg.content.startsWith('/') || msg.content.includes('\\')) {
            // 这是一个文件路径，需要通过API获取图片
            chatMessage.imageData = null // 暂时设为null，后续可以通过API获取
            chatMessage.imagePath = msg.content
          }
          else if (msg.content.startsWith('data:image/') || msg.content.startsWith('http')) {
            // 这是base64数据或HTTP URL，可以直接使用
            chatMessage.imageData = msg.content
          }
          else {
            // 其他情况，尝试作为图片数据使用
            chatMessage.imageData = msg.content
          }
        }

        // 检查其他可能的图片字段
        if (msg.imageUrl) {
          chatMessage.imageData = msg.imageUrl
        }
        if (msg.imageBase64) {
          chatMessage.imageData = msg.imageBase64
        }
      }

      // 处理文件消息
      if (msg.msgType === 6 && msg.content) {
        chatMessage.fileData = {
          name: msg.fileName || '未知文件',
          size: msg.fileSize || 0,
          path: msg.content,
        }
        chatMessage.content = '[文件]'
      }

      // 处理视频消息
      if (msg.msgType === 43) {
        chatMessage.content = '[视频]'

        // 解析XML数据获取视频信息
        if (msg.originalContent) {
          const videoParams = parseVideoMessage(msg.originalContent)

          // 设置解析出的视频参数
          chatMessage.videoAesKey = videoParams.aesKey
          chatMessage.videoMd5 = videoParams.md5
          chatMessage.videoNewMd5 = videoParams.newMd5
          chatMessage.videoDataLen = videoParams.dataLen
          chatMessage.videoCompressType = videoParams.compressType || 0
          chatMessage.videoPlayLength = videoParams.playLength
          chatMessage.videoCdnUrl = videoParams.cdnVideoUrl
          chatMessage.videoThumbUrl = videoParams.cdnThumbUrl
          chatMessage.videoThumbAesKey = videoParams.cdnThumbAesKey
          chatMessage.videoThumbLength = videoParams.cdnThumbLength
          chatMessage.videoThumbWidth = videoParams.cdnThumbWidth
          chatMessage.videoThumbHeight = videoParams.cdnThumbHeight
          chatMessage.videoFromUserName = videoParams.fromUserName

          console.log('视频信息解析结果:', {
            videoAesKey: chatMessage.videoAesKey,
            videoMd5: chatMessage.videoMd5,
            videoNewMd5: chatMessage.videoNewMd5,
            videoDataLen: chatMessage.videoDataLen,
            videoPlayLength: chatMessage.videoPlayLength,
            videoCdnUrl: chatMessage.videoCdnUrl,
            videoThumbUrl: chatMessage.videoThumbUrl,
            videoThumbAesKey: chatMessage.videoThumbAesKey
          })
        }
      }

      // 处理表情消息
      if (msg.msgType === 47) {
        chatMessage.content = '[表情]'
        // 解析表情信息
        if (msg.originalContent) {
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

          console.log('WebSocket服务解析表情消息:', {
            cdnUrl: chatMessage.emojiUrl,
            thumbUrl: chatMessage.emojiThumbUrl,
            width: chatMessage.emojiWidth,
            height: chatMessage.emojiHeight,
            aesKey: chatMessage.emojiAesKey,
            md5: chatMessage.emojiMd5,
            originalContent: msg.originalContent.substring(0, 200) + '...' // 显示部分原始内容用于调试
          })
        }
      }



      // 处理系统消息（撤回消息已在前面处理）
      if (msg.msgType === 10000) {
        // 使用originalContent作为系统消息内容，如果没有则使用content
        chatMessage.content = msg.originalContent || msg.content || '[系统消息]'

        // 系统消息不属于任何人发送
        chatMessage.fromMe = false

        // 保存额外数据
        if (msg.extraData) {
          chatMessage.extraData = msg.extraData
        }
      }

      // 发送聊天消息事件
      this.emit('chat_message', chatMessage)
    })
  }

  // 判断是否应该过滤消息
  private shouldFilterMessage(msg: any): boolean {
    // 过滤状态通知消息
    if (msg.msgType === 51 || msg.contentType === 'status') {
      return true
    }

    // 过滤其他不需要显示的消息类型
    const filteredMsgTypes = [
      51,   // 状态通知
      // 可以在这里添加其他需要过滤的消息类型
    ]

    return filteredMsgTypes.includes(msg.msgType)
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
      case 43: // 视频消息
        return 'video'
      case 47: // 表情消息
        return 'emoji'
      case 10000: // 系统消息
        return 'system'
      case 10002: // 撤回消息
        return 'system'
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
