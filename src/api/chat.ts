import { api } from './index'
import type { 
  SendTextMessageRequest,
  SendImageMessageRequest,
  SendFileMessageRequest,
  MessageResponse
} from '@/types/chat'

export const chatApi = {
  // 发送文本消息
  sendTextMessage: (params: SendTextMessageRequest): Promise<MessageResponse> => {
    return api.post('/Msg/SendTxt', params)
  },

  // 发送图片消息
  sendImageMessage: (params: SendImageMessageRequest): Promise<MessageResponse> => {
    return api.post('/Msg/UploadImg', params)
  },

  // 发送文件消息
  sendFileMessage: (params: SendFileMessageRequest): Promise<MessageResponse> => {
    return api.post('/Msg/SendFile', params)
  },

  // 发送视频消息
  sendVideoMessage: (params: { Wxid: string, ToWxid: string, VideoPath: string }): Promise<MessageResponse> => {
    return api.post('/Msg/SendVideo', params)
  },

  // 发送表情消息
  sendEmojiMessage: (params: { Wxid: string, ToWxid: string, EmojiMd5: string }): Promise<MessageResponse> => {
    return api.post('/Msg/SendEmoji', params)
  },

  // 发送CDN图片（转发图片）
  sendCDNImage: (params: { Wxid: string, ToWxid: string, Content: string }): Promise<MessageResponse> => {
    return api.post('/Msg/SendCDNImg', params)
  },

  // 发送CDN文件（转发文件）
  sendCDNFile: (params: { Wxid: string, ToWxid: string, Content: string }): Promise<MessageResponse> => {
    return api.post('/Msg/SendCDNFile', params)
  },

  // 发送名片
  sendBusinessCard: (params: { Wxid: string, ToWxid: string, CardWxid: string }): Promise<MessageResponse> => {
    return api.post('/Msg/SendBusinessCard', params)
  },

  // 手动同步微信消息并推送到WebSocket
  syncAndPushMessages: (wxid: string): Promise<MessageResponse> => {
    return api.get(`/Msg/SyncAndPush?wxid=${wxid}`)
  },

  // 获取WebSocket连接状态
  getWebSocketStatus: (): Promise<{ connected: boolean }> => {
    return api.get('/Msg/WebSocketStatus')
  },

  // 测试消息监听器
  testMessageListener: (wxid: string): Promise<MessageResponse> => {
    return api.get(`/Msg/TestMsgListener?wxid=${wxid}`)
  },

  // 测试WebSocket消息推送
  testWebSocket: (wxid: string): Promise<MessageResponse> => {
    return api.get(`/Msg/TestWebSocket?wxid=${wxid}`)
  }
}
