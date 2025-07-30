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
