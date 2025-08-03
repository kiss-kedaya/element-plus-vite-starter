// WebSocket 配置
export const WEBSOCKET_CONFIG = {
  // WebSocket 服务器地址
  HOST: '127.0.0.1',
  PORT: 8088,
  
  // 连接超时时间（毫秒）
  CONNECT_TIMEOUT: 10000,
  
  // 重连配置
  RECONNECT: {
    MAX_ATTEMPTS: Infinity, // 无限重连
    INTERVAL: 3000, // 基础重连间隔3秒
    MAX_INTERVAL: 30000, // 最大重连间隔30秒
  },
  
  // 心跳配置
  HEARTBEAT: {
    INTERVAL: 30000, // 30秒
  },
  
  // 获取WebSocket URL
  getUrl: (wxid?: string): string => {
    const baseUrl = `ws://${WEBSOCKET_CONFIG.HOST}:${WEBSOCKET_CONFIG.PORT}/ws`
    return wxid ? `${baseUrl}?wxid=${wxid}` : baseUrl
  }
}
