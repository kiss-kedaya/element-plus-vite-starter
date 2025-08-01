// 好友相关辅助函数

import { FRIEND_OPCODE, FRIEND_SCENE, SCENE_DESCRIPTIONS, OPCODE_DESCRIPTIONS } from '@/types/friend-constants'
import type { SendFriendRequestRequest } from '@/types/friend'

/**
 * 验证好友请求参数
 * @param params 好友请求参数
 * @returns 验证结果
 */
export function validateFriendRequestParams(params: SendFriendRequestRequest): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 验证必填字段
  if (!params.Wxid?.trim()) {
    errors.push('发送方微信ID不能为空')
  }

  if (!params.V1?.trim()) {
    errors.push('V1参数不能为空')
  }

  if (!params.V2?.trim()) {
    errors.push('V2参数不能为空')
  }

  if (!params.VerifyContent?.trim()) {
    errors.push('验证消息不能为空')
  }

  // 验证V1格式（应该以v3_开头）
  if (params.V1 && !params.V1.startsWith('v3_')) {
    errors.push('V1参数格式不正确，应该以v3_开头')
  }

  // 验证V2格式（应该以v4_开头）
  if (params.V2 && !params.V2.startsWith('v4_')) {
    errors.push('V2参数格式不正确，应该以v4_开头')
  }

  // 验证Opcode
  const validOpcodes = Object.values(FRIEND_OPCODE)
  if (!validOpcodes.includes(params.Opcode as any)) {
    errors.push(`Opcode参数无效，有效值：${validOpcodes.join(', ')}`)
  }

  // 验证Scene
  const validScenes = Object.values(FRIEND_SCENE)
  if (!validScenes.includes(params.Scene as any)) {
    errors.push(`Scene参数无效，有效值：${validScenes.join(', ')}`)
  }

  // 验证消息长度
  if (params.VerifyContent && params.VerifyContent.length > 200) {
    errors.push('验证消息长度不能超过200字符')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 获取场景描述
 * @param scene 场景值
 * @returns 场景描述
 */
export function getSceneDescription(scene: number): string {
  return SCENE_DESCRIPTIONS[scene as keyof typeof SCENE_DESCRIPTIONS] || `未知场景(${scene})`
}

/**
 * 获取操作码描述
 * @param opcode 操作码
 * @returns 操作码描述
 */
export function getOpcodeDescription(opcode: number): string {
  return OPCODE_DESCRIPTIONS[opcode as keyof typeof OPCODE_DESCRIPTIONS] || `未知操作(${opcode})`
}

/**
 * 创建标准的好友请求参数
 * @param wxid 发送方微信ID
 * @param v1 目标用户V1参数
 * @param v2 目标用户V2参数
 * @param verifyContent 验证消息
 * @param scene 场景值，默认为微信号搜索
 * @param opcode 操作码，默认为发送验证申请
 * @returns 好友请求参数
 */
export function createFriendRequestParams(
  wxid: string,
  v1: string,
  v2: string,
  verifyContent: string,
  scene: number = FRIEND_SCENE.WECHAT_ID,
  opcode: number = FRIEND_OPCODE.SEND_REQUEST
): SendFriendRequestRequest {
  return {
    Wxid: wxid.trim(),
    V1: v1.trim(),
    V2: v2.trim(),
    Opcode: opcode,
    Scene: scene,
    VerifyContent: verifyContent.trim()
  }
}

/**
 * 格式化好友请求参数用于日志输出
 * @param params 好友请求参数
 * @returns 格式化后的字符串
 */
export function formatFriendRequestParams(params: SendFriendRequestRequest): string {
  return `
好友请求参数:
- 发送方: ${params.Wxid}
- V1: ${params.V1}
- V2: ${params.V2}
- 操作码: ${params.Opcode} (${getOpcodeDescription(params.Opcode)})
- 场景值: ${params.Scene} (${getSceneDescription(params.Scene)})
- 验证消息: ${params.VerifyContent}
  `.trim()
}
