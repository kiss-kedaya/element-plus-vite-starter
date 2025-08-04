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

  // 发送CDN文件（转发已存在的文件）
  sendCDNFile: (params: { Wxid: string; ToWxid: string; Content: string }): Promise<MessageResponse> => {
    return api.post('/Msg/SendCDNFile', params)
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
  },

  // 撤回消息
  revokeMessage: (params: {
    Wxid: string;
    ToUserName: string;
    ClientMsgId: number;
    CreateTime: number;
    NewMsgId: number;
  }): Promise<MessageResponse> => {
    return api.post('/Msg/Revoke', params)
  },

  // CDN下载图片
  downloadCdnImage: (params: {
    Wxid: string;
    FileAesKey: string;
    FileNo: string;
  }): Promise<any> => {
    return api.post('/Tools/CdnDownloadImage', params)
  },

  // 转发文件消息
  forwardFileMessage: (params: {
    Wxid: string;
    ToWxid: string;
    Content: string; // 原始消息的XML内容
  }): Promise<MessageResponse> => {
    console.log('发送文件转发请求:', {
      url: '/Msg/SendCDNFile',
      params: {
        ...params,
        Content: params.Content.substring(0, 100) + '...' // 只显示前100个字符
      }
    })
    return api.post('/Msg/SendCDNFile', params)
  },

  // 转发图片消息
  forwardImageMessage: (params: {
    Wxid: string;
    ToWxid: string;
    Content: string; // 原始消息的XML内容
  }): Promise<MessageResponse> => {
    console.log('发送图片转发请求:', {
      url: '/Msg/SendCDNImg',
      params: {
        ...params,
        Content: params.Content.substring(0, 100) + '...'
      }
    })
    return api.post('/Msg/SendCDNImg', params)
  },

  // 转发视频消息
  forwardVideoMessage: (params: {
    Wxid: string;
    ToWxid: string;
    Content: string; // 原始消息的XML内容
  }): Promise<MessageResponse> => {
    console.log('发送视频转发请求:', {
      url: '/Msg/SendCDNVideo',
      params: {
        ...params,
        Content: params.Content.substring(0, 100) + '...'
      }
    })
    return api.post('/Msg/SendCDNVideo', params)
  }
}

// 单独导出CDN下载函数
export const downloadCdnImage = (params: {
  Wxid: string;
  FileAesKey: string;
  FileNo: string;
}): Promise<any> => {
  return api.post('/Tools/CdnDownloadImage', params)
}

// 下载普通图片
export const downloadImage = (params: {
  Wxid: string;
  ToWxid: string;
  MsgId: number;
  DataLen: number;
  CompressType?: number;
  Section: {
    StartPos: number;
    DataLen: number;
  };
}): Promise<any> => {
  console.log('发送图片下载请求:', {
    url: '/Tools/DownloadImg',
    params
  })
  return api.post('/Tools/DownloadImg', params)
}

// 下载视频
export const downloadVideo = (params: {
  Wxid: string;
  ToWxid: string;
  MsgId: number;
  DataLen: number;
  CompressType?: number;
  Section: {
    StartPos: number;
    DataLen: number;
  };
}): Promise<any> => {
  console.log('发送视频下载请求:', {
    url: '/Tools/DownloadVideo',
    params
  })
  return api.post('/Tools/DownloadVideo', params)
}
