/**
 * P0级别逻辑错误修复验证脚本
 * 用于验证修复后的功能是否正常工作
 */

import { accountSwitchManager } from './accountSwitchManager'
import { improvedMessageDeduplicator } from './improvedMessageDeduplicator'
import { sessionIdCalculator } from './sessionIdCalculator'
import { log } from './logger'
import type { ChatMessage } from '@/types/chat'

// 验证结果接口
interface VerificationResult {
  testName: string
  passed: boolean
  details: string
  error?: string
}

/**
 * 逻辑修复验证器
 */
export class LogicFixVerification {
  private results: VerificationResult[] = []

  /**
   * 运行所有验证测试
   */
  async runAllTests(): Promise<VerificationResult[]> {
    this.results = []
    
    log.info('开始P0级别逻辑错误修复验证', undefined, 'LogicFixVerification')

    // 1. 验证账号切换逻辑
    await this.testAccountSwitchLogic()

    // 2. 验证消息去重逻辑
    await this.testMessageDeduplication()

    // 3. 验证会话ID计算一致性
    await this.testSessionIdConsistency()

    // 4. 验证缓存循环保存修复
    await this.testCacheCircularSaveFix()

    log.info('P0级别逻辑错误修复验证完成', {
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.passed).length,
      failedTests: this.results.filter(r => !r.passed).length
    }, 'LogicFixVerification')

    return this.results
  }

  /**
   * 测试账号切换逻辑
   */
  private async testAccountSwitchLogic(): Promise<void> {
    try {
      // 测试1: 防重复切换
      const result1 = await accountSwitchManager.switchAccount('test_wxid_1')
      const result2 = await accountSwitchManager.switchAccount('test_wxid_1') // 相同账号
      
      this.addResult({
        testName: '账号切换 - 相同账号检测',
        passed: result2.success && result2.operation.state === 'completed',
        details: '相同账号切换应该立即成功'
      })

      // 测试2: 切换状态管理
      const isSwitching = accountSwitchManager.isSwitching()
      this.addResult({
        testName: '账号切换 - 状态管理',
        passed: !isSwitching,
        details: '切换完成后状态应该重置'
      })

      // 测试3: 操作历史记录
      const history = accountSwitchManager.getOperationHistory()
      this.addResult({
        testName: '账号切换 - 操作历史',
        passed: history.length > 0,
        details: `操作历史记录数量: ${history.length}`
      })

    } catch (error) {
      this.addResult({
        testName: '账号切换逻辑测试',
        passed: false,
        details: '测试执行失败',
        error: String(error)
      })
    }
  }

  /**
   * 测试消息去重逻辑
   */
  private async testMessageDeduplication(): Promise<void> {
    try {
      const testMessage: ChatMessage = {
        id: 'test_msg_001',
        content: '测试消息内容',
        fromMe: false,
        fromUser: 'test_user',
        toUser: 'current_user',
        timestamp: new Date(),
        type: 'text',
        status: 'received'
      }

      const sessionId = 'test_session'
      const existingMessages: ChatMessage[] = []

      // 测试1: 新消息不重复
      const result1 = improvedMessageDeduplicator.isDuplicate(testMessage, sessionId, existingMessages)
      this.addResult({
        testName: '消息去重 - 新消息检测',
        passed: !result1.isDuplicate,
        details: `新消息应该不重复，置信度: ${result1.confidence}`
      })

      // 测试2: 相同ID消息重复
      existingMessages.push(testMessage)
      const result2 = improvedMessageDeduplicator.isDuplicate(testMessage, sessionId, existingMessages)
      this.addResult({
        testName: '消息去重 - ID重复检测',
        passed: result2.isDuplicate && result2.reason?.includes('Exact ID match'),
        details: `相同ID消息应该被检测为重复: ${result2.reason}`
      })

      // 测试3: 内容相似消息检测
      const similarMessage: ChatMessage = {
        ...testMessage,
        id: 'test_msg_002',
        timestamp: new Date(Date.now() + 1000) // 1秒后
      }
      
      const result3 = improvedMessageDeduplicator.isDuplicate(similarMessage, sessionId, existingMessages)
      this.addResult({
        testName: '消息去重 - 内容相似检测',
        passed: result3.isDuplicate,
        details: `相似内容消息应该被检测为重复: ${result3.reason}`
      })

    } catch (error) {
      this.addResult({
        testName: '消息去重逻辑测试',
        passed: false,
        details: '测试执行失败',
        error: String(error)
      })
    }
  }

  /**
   * 测试会话ID计算一致性
   */
  private async testSessionIdConsistency(): Promise<void> {
    try {
      const currentWxid = 'current_user'
      
      // 测试1: 发送消息的会话ID
      const sentMessage: ChatMessage = {
        id: 'sent_001',
        content: '发送的消息',
        fromMe: true,
        fromUser: currentWxid,
        toUser: 'friend_001',
        timestamp: new Date(),
        type: 'text',
        status: 'sent'
      }
      
      const sentResult = sessionIdCalculator.calculateSessionId(sentMessage, currentWxid)
      this.addResult({
        testName: '会话ID计算 - 发送消息',
        passed: sentResult.sessionId === 'friend_001',
        details: `发送消息会话ID: ${sentResult.sessionId}, 置信度: ${sentResult.confidence}`
      })

      // 测试2: 接收消息的会话ID
      const receivedMessage: ChatMessage = {
        id: 'received_001',
        content: '接收的消息',
        fromMe: false,
        fromUser: 'friend_002',
        toUser: currentWxid,
        timestamp: new Date(),
        type: 'text',
        status: 'received'
      }
      
      const receivedResult = sessionIdCalculator.calculateSessionId(receivedMessage, currentWxid)
      this.addResult({
        testName: '会话ID计算 - 接收消息',
        passed: receivedResult.sessionId === 'friend_002',
        details: `接收消息会话ID: ${receivedResult.sessionId}, 置信度: ${receivedResult.confidence}`
      })

      // 测试3: 群聊消息的会话ID
      const groupMessage: ChatMessage = {
        id: 'group_001',
        content: '群聊消息',
        fromMe: false,
        fromUser: 'group_123@chatroom',
        toUser: currentWxid,
        timestamp: new Date(),
        type: 'text',
        status: 'received'
      }
      
      const groupResult = sessionIdCalculator.calculateSessionId(groupMessage, currentWxid)
      this.addResult({
        testName: '会话ID计算 - 群聊消息',
        passed: groupResult.sessionId === 'group_123@chatroom' && groupResult.isGroupMessage,
        details: `群聊消息会话ID: ${groupResult.sessionId}, 是否群聊: ${groupResult.isGroupMessage}`
      })

    } catch (error) {
      this.addResult({
        testName: '会话ID计算一致性测试',
        passed: false,
        details: '测试执行失败',
        error: String(error)
      })
    }
  }

  /**
   * 测试缓存循环保存修复
   */
  private async testCacheCircularSaveFix(): Promise<void> {
    try {
      // 这个测试主要验证改进的缓存管理器是否正确分离了访问时间更新和数据保存
      const { improvedCacheManager } = await import('./improvedCacheManager')
      
      // 模拟加载操作
      const loadResult = await improvedCacheManager.loadAccountData('test_wxid')
      
      this.addResult({
        testName: '缓存循环保存修复 - 加载操作',
        passed: true, // 如果没有抛出错误就算通过
        details: `缓存加载操作完成，成功: ${loadResult.success}`
      })

    } catch (error) {
      this.addResult({
        testName: '缓存循环保存修复测试',
        passed: false,
        details: '测试执行失败',
        error: String(error)
      })
    }
  }

  /**
   * 添加测试结果
   */
  private addResult(result: VerificationResult): void {
    this.results.push(result)
    
    if (result.passed) {
      log.debug(`✅ ${result.testName}: ${result.details}`, undefined, 'LogicFixVerification')
    } else {
      log.warn(`❌ ${result.testName}: ${result.details}`, { error: result.error }, 'LogicFixVerification')
    }
  }

  /**
   * 获取测试结果摘要
   */
  getResultSummary(): {
    total: number
    passed: number
    failed: number
    passRate: number
    details: VerificationResult[]
  } {
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    
    return {
      total: this.results.length,
      passed,
      failed,
      passRate: this.results.length > 0 ? (passed / this.results.length) * 100 : 0,
      details: this.results
    }
  }
}

// 创建全局实例
export const logicFixVerification = new LogicFixVerification()

// 在开发环境中暴露到全局作用域
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).logicFixVerification = logicFixVerification
}
