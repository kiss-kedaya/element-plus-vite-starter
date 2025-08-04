import type { ChatMessage } from '@/types/chat'
import { ElMessage } from 'element-plus'
import { WEBSOCKET_CONFIG } from '@/config/websocket'
import { parseImageMessage, parseVideoMessage } from '@/utils/imageMessageParser'
import { fileCacheManager } from '@/utils/fileCache'

// 事件类型定义
export interface WebSocketEvents {
  chat_message: (data: any, wxid: string) => void
  system_message: (data: any, wxid: string) => void
  connection_status: (connected: boolean, wxid: string) => void
  friend_request: (data: any, wxid: string) => void
}

// 单个账号的WebSocket连接信息
interface AccountConnection {
  ws: WebSocket
  reconnectAttempts: number
  heartbeatInterval: number | null
  isConnecting: boolean
}

export class WebSocketService {
  private connections: Map<string, AccountConnection> = new Map()
  private maxReconnectAttempts = Infinity // 无限重连
  private reconnectInterval = WEBSOCKET_CONFIG.RECONNECT.INTERVAL
  private eventListeners: Map<string, Function[]> = new Map()
  private currentWxid: string | undefined = undefined
  private static instance: WebSocketService | null = null
  private autoConnectAccounts: Set<string> = new Set() // 需要自动连接的账号列表

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

  // 连接所有已登录的账号
  async connectAllAccounts(accounts: string[]): Promise<void> {
    console.log('🚀 开始批量连接所有账号的WebSocket:', accounts)

    // 过滤掉已经连接的账号
    const accountsToConnect = accounts.filter(wxid => {
      const isConnected = this.isAccountConnected(wxid)
      if (isConnected) {
        console.log(`⏭️ 账号 ${wxid} 已连接，跳过`)
      }
      return !isConnected
    })

    if (accountsToConnect.length === 0) {
      console.log('✅ 所有账号都已连接，无需重复连接')
      return
    }

    console.log('📋 需要连接的账号:', accountsToConnect)

    // 更新自动连接账号列表
    this.autoConnectAccounts.clear()
    accounts.forEach(wxid => this.autoConnectAccounts.add(wxid))

    // 并发连接所有账号
    const connectionPromises = accountsToConnect.map(async (wxid) => {
      try {
        await this.connect(wxid)
        console.log(`✅ 账号 ${wxid} WebSocket连接成功`)
      } catch (error) {
        console.warn(`❌ 账号 ${wxid} WebSocket连接失败:`, error)
        // 失败的连接会自动重连，不需要额外处理
      }
    })

    await Promise.allSettled(connectionPromises)
    console.log('🎉 所有账号WebSocket连接尝试完成')
  }

  // 添加账号到自动连接列表
  addAutoConnectAccount(wxid: string): void {
    this.autoConnectAccounts.add(wxid)
    // 立即尝试连接
    this.connect(wxid).catch(error => {
      console.warn(`添加账号 ${wxid} 到自动连接列表后连接失败:`, error)
    })
  }

  // 从自动连接列表移除账号
  removeAutoConnectAccount(wxid: string): void {
    this.autoConnectAccounts.delete(wxid)
    this.disconnect(wxid)
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
  connect(wxid?: string, setAsCurrent: boolean = false): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!wxid) {
        reject(new Error('wxid不能为空'))
        return
      }

      console.log(`🔄 尝试连接WebSocket: ${wxid}`)

      // 检查是否已经有该账号的连接
      const existingConnection = this.connections.get(wxid)
      if (existingConnection && existingConnection.ws.readyState === WebSocket.OPEN) {
        console.log(`✅ WebSocket已连接到 ${wxid}，复用现有连接`)
        // 只在明确指定时才设置为当前账号
        if (setAsCurrent) {
          this.currentWxid = wxid
          fileCacheManager.setCurrentWxid(wxid)
          console.log(`🎯 设置当前账号: ${wxid}`)
        }
        resolve(true)
        return
      }

      // 如果连接存在但已断开，清理旧连接
      if (existingConnection && existingConnection.ws.readyState !== WebSocket.OPEN) {
        console.log(`🧹 清理账号 ${wxid} 的旧连接，状态: ${existingConnection.ws.readyState}`)
        this.connections.delete(wxid)
      }

      // 检查是否正在连接中
      if (existingConnection && existingConnection.isConnecting) {
        console.log(`⏳ WebSocket正在连接中: ${wxid}，拒绝重复连接`)
        reject(new Error('WebSocket正在连接中'))
        return
      }

      // 只在明确指定或者没有当前账号时才设置当前账号
      if (setAsCurrent || !this.currentWxid) {
        this.currentWxid = wxid
        fileCacheManager.setCurrentWxid(wxid)
        console.log(`🎯 设置当前账号: ${wxid}`)
      }

      // 创建新的连接信息
      const connectionInfo: AccountConnection = {
        ws: null as any, // 稍后设置
        reconnectAttempts: 0,
        heartbeatInterval: null,
        isConnecting: true
      }

      try {
        // WebSocket服务器地址，包含wxid参数
        const wsUrl = WEBSOCKET_CONFIG.getUrl(wxid)
        console.log(`正在连接WebSocket: ${wsUrl}`)
        const ws = new WebSocket(wsUrl)
        connectionInfo.ws = ws

        ws.onopen = () => {
          console.log(`✅ WebSocket连接已建立 (wxid: ${wxid})`)
          console.log(`当前所有连接:`, Array.from(this.connections.keys()))
          connectionInfo.isConnecting = false
          connectionInfo.reconnectAttempts = 0
          this.currentWxid = wxid
          fileCacheManager.setCurrentWxid(wxid)
          this.startHeartbeat(wxid)

          // 触发连接状态事件
          this.emit('connection_status', true, wxid)
          resolve(true)
        }

        ws.onmessage = (event) => {
          this.handleMessage(event.data, wxid)
        }

        ws.onclose = (event) => {
          console.log(`WebSocket连接已关闭 (wxid: ${wxid})`, event.code, event.reason)
          connectionInfo.isConnecting = false
          this.stopHeartbeat(wxid)

          // 触发连接状态事件
          this.emit('connection_status', false, wxid)

          // 如果是自动连接的账号或者非正常关闭，则自动重连
          if (!event.wasClean || this.autoConnectAccounts.has(wxid)) {
            this.scheduleReconnect(wxid)
          }
        }

        ws.onerror = (error) => {
          console.warn(`❌ WebSocket连接失败 (wxid: ${wxid})，URL: ${wsUrl}`)
          console.warn('连接错误详情:', error)
          connectionInfo.isConnecting = false
          // 清理失败的连接
          this.connections.delete(wxid)
          reject(error)
        }

        // 保存连接信息
        this.connections.set(wxid, connectionInfo)
      }
      catch (error) {
        console.error('创建WebSocket连接失败:', error)
        reject(error)
      }
    })
  }

  // 断开连接（可以指定wxid，如果不指定则断开当前账号）
  disconnect(wxid?: string) {
    const targetWxid = wxid || this.currentWxid
    if (!targetWxid) {
      console.log('没有指定要断开的账号')
      return
    }

    // 从自动连接列表中移除，防止重连
    this.autoConnectAccounts.delete(targetWxid)

    const connection = this.connections.get(targetWxid)
    if (connection) {
      this.stopHeartbeat(targetWxid)
      if (connection.ws) {
        connection.ws.close(1000, '主动断开连接')
      }
      this.connections.delete(targetWxid)
      console.log(`已断开账号 ${targetWxid} 的WebSocket连接`)
    }

    // 如果断开的是当前账号，清除当前账号
    if (targetWxid === this.currentWxid) {
      this.currentWxid = undefined
    }
  }

  // 断开所有连接
  disconnectAll() {
    console.log('断开所有WebSocket连接')

    // 清空自动连接列表，防止重连
    this.autoConnectAccounts.clear()

    for (const [wxid, connection] of this.connections) {
      this.stopHeartbeat(wxid)
      if (connection.ws) {
        connection.ws.close(1000, '主动断开所有连接')
      }
    }
    this.connections.clear()
    this.currentWxid = undefined
  }

  // 切换当前账号（不断开连接）
  switchCurrentAccount(wxid: string) {
    if (this.connections.has(wxid)) {
      console.log(`切换当前账号到: ${wxid}`)
      this.currentWxid = wxid
      fileCacheManager.setCurrentWxid(wxid)
      return true
    } else {
      console.warn(`账号 ${wxid} 没有WebSocket连接`)
      return false
    }
  }

  // 获取所有已连接的账号
  getConnectedAccounts(): string[] {
    return Array.from(this.connections.keys()).filter(wxid =>
      this.isAccountConnected(wxid)
    )
  }

  // 检查是否已设置事件监听器
  hasEventListeners(): boolean {
    return this.eventListeners.size > 0
  }

  // 处理接收到的消息
  private handleMessage(data: string, wxid: string) {
    try {
      const message = JSON.parse(data)

      switch (message.type) {
        case 'chat_message':
          this.emit('chat_message', message.data, wxid)
          break
        case 'wechat_message':
          // 处理微信消息格式
          this.handleWeChatMessage(message)
          break
        case 'system_message':
          this.emit('system_message', message.data, wxid)
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
    console.log('🔄 处理微信消息:', {
      wxid: data.wxid,
      messageCount: data.messages?.length || 0,
      timestamp: data.timestamp
    })

    if (!data.messages || data.messages.length === 0) {
      console.log('收到空的微信消息数据:', data)
      return
    }

    data.messages.forEach((msg: any, index: number) => {
      console.log(`📨 处理消息 ${index + 1}/${data.messages.length}:`, {
        msgId: msg.msgId,
        msgType: msg.msgType,
        contentType: msg.contentType,
        fromUser: msg.fromUser,
        toUser: msg.toUser,
        content: msg.content?.substring(0, 50) + '...'
      })

      // 过滤掉不需要显示的消息类型
      if (this.shouldFilterMessage(msg)) {
        console.log(`⏭️ 消息被过滤: msgType=${msg.msgType}, contentType=${msg.contentType}`)
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
        // 个人消息：只比较fromUser和当前wxid
        // data.wxid是当前账号，如果fromUser等于当前账号，说明是自己发送的
        fromMe = msg.fromUser === data.wxid
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

      // 修复sessionId为空的问题
      if (!sessionId) {
        console.warn('⚠️ sessionId为空，尝试从其他字段获取:', {
          fromUser: msg.fromUser,
          toUser: msg.toUser,
          fromUserName: msg.fromUserName,
          toUserName: msg.toUserName,
          actualSender: msg.actualSender
        })

        // 尝试从其他字段获取sessionId
        if (fromMe) {
          sessionId = msg.toUser || msg.toUserName
        } else {
          sessionId = msg.fromUser || msg.fromUserName || msg.actualSender
        }
      }

      console.log(`🎯 消息会话信息:`, {
        isGroupMessage,
        fromMe,
        sessionId,
        fromUser: msg.fromUser,
        toUser: msg.toUser,
        actualSender: msg.actualSender
      })

      // 如果sessionId仍然为空，跳过这条消息
      if (!sessionId) {
        console.error('❌ 无法确定sessionId，跳过消息:', msg)
        return
      }

      // 特殊处理：系统消息的会话ID
      if (msg.msgType === 10000) {
        // 对于好友申请通过的系统消息，会话ID应该是对方的wxid
        // 判断消息方向：如果fromUser是当前用户，则会话ID是toUser；反之亦然
        if (msg.fromUser === data.wxid) {
          // 当前用户发出的系统消息，会话ID是接收方
          sessionId = msg.toUser
        } else {
          // 对方发来的系统消息，会话ID是发送方
          sessionId = msg.fromUser
        }
      }

      // 转换为标准聊天消息格式
      const chatMessage: any = {
        id: msg.msgId?.toString() || `msg_${Date.now()}_${Math.random()}`,
        content: msg.content || '',
        timestamp: msg.createTime ? new Date(msg.createTime * 1000) : new Date(),
        fromMe,
        type: this.getMsgType(msg.msgType, msg.contentType, msg.extraData),
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
        this.emit('chat_message', chatMessage, data.wxid)
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

      // 处理链接/小程序/文件消息 (msgType: 49)
      if (msg.msgType === 49) {
        console.log('处理msgType 49消息:', {
          contentType: msg.contentType,
          extraData: msg.extraData,
          content: msg.content,
          msgTypeDesc: msg.msgTypeDesc
        })

        // 检查是否是文件消息
        if (msg.contentType === 'file' || (msg.extraData && msg.extraData.type === 'file')) {
          console.log('识别为文件消息，开始解析文件信息')
          // 解析文件信息
          const fileName = msg.extraData?.title || '未知文件'
          const fileExt = msg.extraData?.fileExt || ''

          // 解析XML获取更多文件信息
          let fileSize = 0
          let cdnUrl = ''
          let aesKey = ''
          let attachId = ''

          if (msg.originalContent) {
            try {
              // 解析文件大小
              const totalLenMatch = msg.originalContent.match(/<totallen>(\d+)<\/totallen>/)
              if (totalLenMatch) {
                fileSize = parseInt(totalLenMatch[1])
              }

              // 解析CDN URL
              const cdnUrlMatch = msg.originalContent.match(/<cdnattachurl>(.*?)<\/cdnattachurl>/)
              if (cdnUrlMatch) {
                cdnUrl = cdnUrlMatch[1]
              }

              // 解析AES密钥
              const aesKeyMatch = msg.originalContent.match(/<aeskey>(.*?)<\/aeskey>/)
              if (aesKeyMatch) {
                aesKey = aesKeyMatch[1]
              }

              // 解析附件ID
              const attachIdMatch = msg.originalContent.match(/<attachid>(.*?)<\/attachid>/)
              if (attachIdMatch) {
                attachId = attachIdMatch[1]
              }
            } catch (error) {
              console.warn('解析文件消息XML失败:', error)
            }
          }

          chatMessage.fileData = {
            name: fileName,
            size: fileSize,
            ext: fileExt,
            cdnUrl: cdnUrl,
            aesKey: aesKey,
            attachId: attachId,
            originalContent: msg.originalContent
          }
          chatMessage.content = `[文件: ${fileName}]`

          console.log('文件消息解析完成:', {
            fileName,
            fileSize,
            fileExt,
            attachId: attachId.substring(0, 50) + '...',
            cdnUrl: cdnUrl.substring(0, 50) + '...',
            messageType: chatMessage.type,
            messageContent: chatMessage.content
          })

          console.log('文件消息解析完成:', {
            fileName,
            fileSize,
            fileExt,
            attachId: attachId.substring(0, 50) + '...',
            cdnUrl: cdnUrl.substring(0, 50) + '...',
            messageType: chatMessage.type,
            messageContent: chatMessage.content
          })

          // 将文件信息添加到缓存
          if (fileName && fileSize > 0 && attachId && msg.originalContent) {
            try {
              // 解析AppID
              const appIdMatch = msg.originalContent.match(/<appmsg appid="([^"]*)"/)
              const appId = appIdMatch ? appIdMatch[1] : ''

              fileCacheManager.addFileToCache({
                fileName: fileName,
                fileSize: fileSize,
                originalContent: msg.originalContent,
                attachId: attachId,
                cdnUrl: cdnUrl,
                aesKey: aesKey,
                appId: appId
              })
              console.log('文件已缓存:', { fileName, fileSize, attachId })
            } catch (error) {
              console.warn('缓存文件信息失败:', error)
            }
          }
        } else if (msg.contentType === 'link' || (msg.extraData && msg.extraData.type === 'link')) {
          // 链接消息处理
          const linkTitle = msg.extraData?.title || msg.content || '链接'
          const linkUrl = msg.extraData?.url || ''
          const thumbUrl = msg.extraData?.thumbUrl || ''

          chatMessage.linkData = {
            title: linkTitle,
            url: linkUrl,
            thumbUrl: thumbUrl,
            originalContent: msg.originalContent
          }
          chatMessage.content = linkTitle
        } else {
          // 其他类型的49消息（小程序等）
          chatMessage.content = msg.content || '[小程序/其他]'
        }
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
        chatMessage.type = 'emoji' // 设置消息类型为表情
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



      // 处理好友请求消息
      if (msg.msgType === 37) {
        console.log('收到好友请求消息:', msg)

        // 解析XML内容获取好友请求信息
        if (msg.originalContent) {
          try {
            const parser = new DOMParser()
            const xmlDoc = parser.parseFromString(msg.originalContent, 'text/xml')
            const msgElement = xmlDoc.querySelector('msg')

            if (msgElement) {
              const friendRequestData = {
                fromUserName: msgElement.getAttribute('fromusername') || '',
                fromNickName: msgElement.getAttribute('fromnickname') || '',
                content: msgElement.getAttribute('content') || '',
                alias: msgElement.getAttribute('alias') || '',
                bigHeadImgUrl: msgElement.getAttribute('bigheadimgurl') || '',
                smallHeadImgUrl: msgElement.getAttribute('smallheadimgurl') || '',
                ticket: msgElement.getAttribute('ticket') || '',
                sex: msgElement.getAttribute('sex') || '0',
                province: msgElement.getAttribute('province') || '',
                city: msgElement.getAttribute('city') || '',
                country: msgElement.getAttribute('country') || ''
              }

              console.log('解析的好友请求数据:', friendRequestData)

              // 发送好友请求事件，传递wxid参数
              this.emit('friend_request', {
                type: 'friend_request',
                data: friendRequestData,
                timestamp: new Date(),
                wxid: data.wxid
              }, data.wxid)
            }
          } catch (error) {
            console.error('解析好友请求XML失败:', error)
          }
        }

        // 不继续处理为普通聊天消息
        return
      }

      // 处理系统消息（撤回消息已在前面处理）
      if (msg.msgType === 10000) {
        // 使用originalContent作为系统消息内容，如果没有则使用content
        let systemContent = msg.originalContent || msg.content || '[系统消息]'

        // 优化好友申请通过消息的显示
        if (systemContent.includes('你已添加了') || systemContent.includes('通过了你的朋友验证请求')) {
          // 提取用户名
          if (systemContent.includes('你已添加了')) {
            const nameMatch = systemContent.match(/你已添加了(.+?)，/)
            if (nameMatch && nameMatch[1]) {
              systemContent = `你已添加了 ${nameMatch[1]} 为好友`
            }
          } else if (systemContent.includes('通过了你的朋友验证请求')) {
            const nameMatch = systemContent.match(/(.+?)通过了你的朋友验证请求/)
            if (nameMatch && nameMatch[1]) {
              systemContent = `${nameMatch[1]} 通过了你的好友申请`
            }
          }
        }

        chatMessage.content = systemContent

        // 系统消息不属于任何人发送
        chatMessage.fromMe = false

        // 保存额外数据
        if (msg.extraData) {
          chatMessage.extraData = msg.extraData
        }
      }

      // 发送聊天消息事件，传递wxid参数用于正确路由
      console.log(`🚀 发送聊天消息事件:`, {
        sessionId: chatMessage.sessionId,
        content: chatMessage.content?.substring(0, 30) + '...',
        fromMe: chatMessage.fromMe,
        type: chatMessage.type,
        wxid: data.wxid
      })
      this.emit('chat_message', chatMessage, data.wxid)
    })
  }

  // 判断是否应该过滤消息
  private shouldFilterMessage(msg: any): boolean {
    // 过滤状态通知消息
    if (msg.msgType === 51 || msg.contentType === 'status') {
      return true
    }

    // 好友请求消息需要特殊处理，不过滤
    if (msg.msgType === 37) {
      return false
    }

    // 过滤其他不需要显示的消息类型
    const filteredMsgTypes = [
      51,   // 状态通知
      // 可以在这里添加其他需要过滤的消息类型
    ]

    return filteredMsgTypes.includes(msg.msgType)
  }

  // 根据消息类型转换
  private getMsgType(msgType: number, contentType?: string, extraData?: any): string {
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
      case 49: // 链接/小程序/文件消息
        // 根据 contentType 和 extraData 进一步判断
        if (contentType === 'file' || (extraData && extraData.type === 'file')) {
          return 'file'
        } else if (contentType === 'link' || (extraData && extraData.type === 'link')) {
          return 'link'
        } else {
          // 默认为链接类型
          return 'link'
        }
      case 10000: // 系统消息
        return 'system'
      case 10002: // 撤回消息
        return 'system'
      default:
        return 'text'
    }
  }

  // 开始心跳
  private startHeartbeat(wxid: string) {
    const connection = this.connections.get(wxid)
    if (!connection) return

    connection.heartbeatInterval = window.setInterval(() => {
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          type: 'heartbeat',
          timestamp: Date.now(),
          wxid: wxid
        }
        connection.ws.send(JSON.stringify(heartbeat))
      }
    }, WEBSOCKET_CONFIG.HEARTBEAT.INTERVAL)
  }

  // 停止心跳
  private stopHeartbeat(wxid: string) {
    const connection = this.connections.get(wxid)
    if (connection && connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval)
      connection.heartbeatInterval = null
    }
  }

  // 安排重连
  private scheduleReconnect(wxid: string) {
    const connection = this.connections.get(wxid)
    if (!connection) return

    connection.reconnectAttempts++

    // 计算重连延迟，使用指数退避算法，最大不超过配置的最大间隔
    const delay = Math.min(
      this.reconnectInterval * Math.min(connection.reconnectAttempts, 10),
      WEBSOCKET_CONFIG.RECONNECT.MAX_INTERVAL
    )

    console.log(`账号 ${wxid} 将在 ${delay}ms 后进行第 ${connection.reconnectAttempts} 次重连`)

    setTimeout(() => {
      // 检查账号是否仍在自动连接列表中，或者是否有其他原因需要重连
      if (this.autoConnectAccounts.has(wxid) || connection.reconnectAttempts <= 3) {
        console.log(`开始重连账号 ${wxid} (第 ${connection.reconnectAttempts} 次尝试)`)
        this.connect(wxid).catch(error => {
          console.warn(`账号 ${wxid} 重连失败:`, error)
        })
      } else {
        console.log(`账号 ${wxid} 不在自动连接列表中，停止重连`)
      }
    }, delay)
  }

  // 获取连接状态（当前账号）
  get isConnected(): boolean {
    if (!this.currentWxid) return false
    const connection = this.connections.get(this.currentWxid)
    return connection !== undefined && connection.ws.readyState === WebSocket.OPEN
  }

  // 获取指定账号的连接状态
  isAccountConnected(wxid: string): boolean {
    const connection = this.connections.get(wxid)
    return connection !== undefined && connection.ws.readyState === WebSocket.OPEN
  }

  // 发送消息到WebSocket（当前账号）
  send(message: any): boolean {
    if (!this.currentWxid) return false
    return this.sendToAccount(this.currentWxid, message)
  }

  // 发送消息到指定账号的WebSocket
  sendToAccount(wxid: string, message: any): boolean {
    const connection = this.connections.get(wxid)
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message))
      return true
    }
    return false
  }
}

// 导出WebSocket服务单例
export const webSocketService = WebSocketService.getInstance()
