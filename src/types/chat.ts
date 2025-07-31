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
  type: 'text' | 'image' | 'file' | 'system'
  status?: 'sending' | 'sent' | 'failed'
  imageData?: string
  fileData?: {
    name: string
    size: number
    url: string
  }
  // 新增字段用于重试和撤回功能
  originalContent?: string  // 原始内容，用于重试
  canRetry?: boolean       // 是否可以重试
  canRecall?: boolean      // 是否可以撤回
  retryCount?: number      // 重试次数
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
