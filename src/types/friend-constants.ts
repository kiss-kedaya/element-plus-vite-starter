// 好友添加相关常量定义

// Opcode 操作码
export const FRIEND_OPCODE = {
  NO_VERIFY: 1,      // 免验证发送请求
  SEND_REQUEST: 2,   // 发送验证申请
  ACCEPT_REQUEST: 3  // 通过好友验证
} as const

// Scene 场景值 - 好友来源
export const FRIEND_SCENE = {
  QQ: 1,              // QQ来源
  EMAIL: 2,           // 邮箱来源
  WECHAT_ID: 3,       // 微信号来源
  ADDRESS_BOOK: 13,   // 通讯录来源
  CHAT_ROOM: 14,      // 群聊来源
  PHONE: 15,          // 手机号来源
  NEARBY: 18,         // 附近的人
  BOTTLE: 25,         // 漂流瓶
  SHAKE: 29,          // 摇一摇
  QRCODE: 30          // 二维码
} as const

// 场景值描述映射
export const SCENE_DESCRIPTIONS = {
  [FRIEND_SCENE.QQ]: '通过QQ添加',
  [FRIEND_SCENE.EMAIL]: '通过邮箱添加',
  [FRIEND_SCENE.WECHAT_ID]: '通过微信号搜索',
  [FRIEND_SCENE.ADDRESS_BOOK]: '通过通讯录添加',
  [FRIEND_SCENE.CHAT_ROOM]: '通过群聊添加',
  [FRIEND_SCENE.PHONE]: '通过手机号添加',
  [FRIEND_SCENE.NEARBY]: '通过附近的人',
  [FRIEND_SCENE.BOTTLE]: '通过漂流瓶',
  [FRIEND_SCENE.SHAKE]: '通过摇一摇',
  [FRIEND_SCENE.QRCODE]: '通过二维码添加'
} as const

// 操作码描述映射
export const OPCODE_DESCRIPTIONS = {
  [FRIEND_OPCODE.NO_VERIFY]: '免验证发送请求',
  [FRIEND_OPCODE.SEND_REQUEST]: '发送验证申请',
  [FRIEND_OPCODE.ACCEPT_REQUEST]: '通过好友验证'
} as const

// 常用场景值选项（用于下拉框）
export const SCENE_OPTIONS = [
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.WECHAT_ID], value: FRIEND_SCENE.WECHAT_ID },
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.QQ], value: FRIEND_SCENE.QQ },
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.EMAIL], value: FRIEND_SCENE.EMAIL },
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.ADDRESS_BOOK], value: FRIEND_SCENE.ADDRESS_BOOK },
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.CHAT_ROOM], value: FRIEND_SCENE.CHAT_ROOM },
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.PHONE], value: FRIEND_SCENE.PHONE },
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.NEARBY], value: FRIEND_SCENE.NEARBY },
  { label: SCENE_DESCRIPTIONS[FRIEND_SCENE.QRCODE], value: FRIEND_SCENE.QRCODE }
] as const

// 类型定义
export type FriendOpcode = typeof FRIEND_OPCODE[keyof typeof FRIEND_OPCODE]
export type FriendScene = typeof FRIEND_SCENE[keyof typeof FRIEND_SCENE]
