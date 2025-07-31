export interface ChatSession {
  id: string
  name: string
  avatar: string
  type: 'friend' | 'group'
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  isOnline?: boolean
}

export interface ChatMessage {
  id: string
  content: string
  timestamp: Date
  fromMe: boolean
  type: 'text' | 'image' | 'file' | 'system' | 'emoji'
  status?: 'sending' | 'sent' | 'failed'
  imageData?: string
  fileData?: {
    name: string
    size: number
    url: string
  }
  // 群聊相关字段
  isGroupMessage?: boolean    // 是否为群聊消息
  actualSender?: string       // 实际发送者ID（群聊中的发送者wxid）
  actualSenderName?: string   // 实际发送者名称（群聊中的发送者昵称）
  sessionId?: string          // 会话ID
  // 表情相关字段
  emojiUrl?: string          // 表情图片URL
  emojiThumbUrl?: string     // 表情缩略图URL
  // 新增字段用于重试和撤回功能
  originalContent?: string  // 原始内容，用于重试
  canRetry?: boolean       // 是否可以重试
  canRecall?: boolean      // 是否可以撤回
  retryCount?: number      // 重试次数
  // 系统消息相关字段
  extraData?: any          // 系统消息的额外数据
  // 撤回消息所需字段
  clientMsgId?: number     // 客户端消息ID
  createTime?: number      // 创建时间戳
  newMsgId?: number        // 新消息ID
}

export interface SendTextMessageRequest {
  Wxid: string
  ToWxid: string
  Content: string
  Type: number
  At?: string
}

export interface SendImageMessageRequest {
  Wxid: string
  ToWxid: string
  Base64: string
}

export interface SendFileMessageRequest {
  Wxid: string
  ToWxid: string
  FilePath: string
  FileName?: string
}

export interface MessageResponse {
  Code: number
  Success: boolean
  Message: string
  Data?: any
}
