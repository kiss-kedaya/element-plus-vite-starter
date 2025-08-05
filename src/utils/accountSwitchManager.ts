/**
 * 统一的账号切换管理器
 * 解决多重触发点和竞态条件问题
 */

import { log } from './logger'
import { resourceManager } from './memoryLeakFixer'

// 账号切换状态
enum SwitchState {
  IDLE = 'idle',
  SWITCHING = 'switching',
  CONNECTING = 'connecting',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 切换操作记录
interface SwitchOperation {
  id: string
  fromWxid: string | null
  toWxid: string
  state: SwitchState
  startTime: number
  endTime?: number
  error?: string
  steps: string[]
}

// 切换结果
interface SwitchResult {
  success: boolean
  operation: SwitchOperation
  error?: string
}

/**
 * 账号切换管理器
 * 确保账号切换操作的原子性和一致性
 */
export class AccountSwitchManager {
  private static instance: AccountSwitchManager
  private currentOperation: SwitchOperation | null = null
  private operationHistory: SwitchOperation[] = []
  private readonly MAX_HISTORY = 10
  private switchLock = false
  private pendingOperations: Array<() => void> = []

  static getInstance(): AccountSwitchManager {
    if (!AccountSwitchManager.instance) {
      AccountSwitchManager.instance = new AccountSwitchManager()
    }
    return AccountSwitchManager.instance
  }

  private constructor() {
    this.setupGlobalListeners()
  }

  /**
   * 设置全局监听器，监听账号切换事件
   */
  private setupGlobalListeners(): void {
    if (typeof window !== 'undefined') {
      // 使用事件监听器而不是重写dispatchEvent，避免影响其他组件
      window.addEventListener('account-switch', (event: Event) => {
        if (event instanceof CustomEvent) {
          const { newWxid, previousWxid } = event.detail
          // 异步处理，避免阻塞原事件
          setTimeout(() => {
            this.switchAccount(newWxid, previousWxid)
          }, 0)
        }
      })

      log.debug('账号切换事件监听器已设置', undefined, 'AccountSwitchManager')
    }
  }

  /**
   * 统一的账号切换入口
   */
  async switchAccount(toWxid: string, fromWxid?: string | null): Promise<SwitchResult> {
    // 防重复切换检查
    if (this.switchLock) {
      log.warn('账号切换正在进行中，忽略重复请求', {
        toWxid,
        fromWxid,
        currentOperation: this.currentOperation?.id
      }, 'AccountSwitchManager')

      return {
        success: false,
        operation: this.currentOperation!,
        error: 'Switch operation already in progress'
      }
    }

    // 相同账号检查
    if (fromWxid === toWxid) {
      log.debug('切换到相同账号，跳过操作', { wxid: toWxid }, 'AccountSwitchManager')
      return {
        success: true,
        operation: this.createOperation(fromWxid, toWxid, SwitchState.COMPLETED),
        error: undefined
      }
    }

    // 开始切换操作
    this.switchLock = true
    const operation = this.createOperation(fromWxid, toWxid, SwitchState.SWITCHING)
    this.currentOperation = operation

    try {
      log.info('开始账号切换', {
        operationId: operation.id,
        fromWxid,
        toWxid
      }, 'AccountSwitchManager')

      // 执行切换步骤
      await this.executeSwitch(operation)

      // 切换成功
      operation.state = SwitchState.COMPLETED
      operation.endTime = Date.now()

      log.info('账号切换完成', {
        operationId: operation.id,
        duration: operation.endTime - operation.startTime,
        steps: operation.steps
      }, 'AccountSwitchManager')

      return {
        success: true,
        operation,
        error: undefined
      }

    } catch (error) {
      // 切换失败
      operation.state = SwitchState.FAILED
      operation.endTime = Date.now()
      operation.error = String(error)

      log.error('账号切换失败', {
        operationId: operation.id,
        error,
        duration: operation.endTime - operation.startTime
      }, 'AccountSwitchManager')

      return {
        success: false,
        operation,
        error: String(error)
      }

    } finally {
      // 清理状态
      this.currentOperation = null
      this.switchLock = false

      // 保存操作历史
      this.operationHistory.push(operation)
      if (this.operationHistory.length > this.MAX_HISTORY) {
        this.operationHistory = this.operationHistory.slice(-this.MAX_HISTORY)
      }

      // 处理待处理的操作
      this.processPendingOperations()
    }
  }

  /**
   * 执行切换步骤
   */
  private async executeSwitch(operation: SwitchOperation): Promise<void> {
    const { fromWxid, toWxid } = operation

    // 步骤1: 保存当前账号数据
    if (fromWxid) {
      operation.steps.push('saving_current_account')
      await this.saveCurrentAccountData(fromWxid)
    }

    // 步骤2: 断开当前WebSocket连接
    if (fromWxid) {
      operation.steps.push('disconnecting_websocket')
      await this.disconnectWebSocket(fromWxid)
    }

    // 步骤3: 切换账号数据
    operation.steps.push('switching_account_data')
    await this.switchAccountData(toWxid, fromWxid)

    // 步骤4: 建立新的WebSocket连接
    operation.steps.push('connecting_websocket')
    operation.state = SwitchState.CONNECTING
    await this.connectWebSocket(toWxid)

    // 步骤5: 更新UI状态
    operation.steps.push('updating_ui')
    await this.updateUIState(toWxid)

    operation.steps.push('completed')
  }

  /**
   * 保存当前账号数据
   */
  private async saveCurrentAccountData(wxid: string): Promise<void> {
    try {
      // 使用改进的缓存管理器保存数据
      const { improvedCacheManager } = await import('@/utils/improvedCacheManager')
      const { accountDataManager } = await import('@/stores/accountDataManager')

      // 获取当前账号数据
      const accountData = accountDataManager.getAccountData(wxid)
      if (accountData) {
        await improvedCacheManager.saveAccountData(
          wxid,
          accountData.sessions,
          accountData.messages,
          accountData.currentSession
        )
      }

      log.debug('当前账号数据保存完成', { wxid }, 'AccountSwitchManager')
    } catch (error) {
      log.warn('保存当前账号数据失败', { wxid, error }, 'AccountSwitchManager')
      // 不抛出错误，允许继续切换
    }
  }

  /**
   * 断开WebSocket连接
   */
  private async disconnectWebSocket(wxid: string): Promise<void> {
    try {
      const { webSocketService } = await import('@/services/websocket')
      await webSocketService.disconnect(wxid)
      log.debug('WebSocket连接断开完成', { wxid }, 'AccountSwitchManager')
    } catch (error) {
      log.warn('断开WebSocket连接失败', { wxid, error }, 'AccountSwitchManager')
      // 不抛出错误，允许继续切换
    }
  }

  /**
   * 切换账号数据
   */
  private async switchAccountData(toWxid: string, fromWxid?: string | null): Promise<void> {
    try {
      // 使用改进的账号数据管理器
      const { improvedAccountDataManager } = await import('@/stores/improvedAccountDataManager')
      await improvedAccountDataManager.switchToAccount(toWxid)

      // 同时更新认证状态
      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()

      // 直接更新当前账号，避免触发额外的切换事件
      const account = authStore.accounts.find(a => a.wxid === toWxid)
      if (account) {
        authStore.currentAccount = account
      }

      log.debug('账号数据切换完成', { toWxid, fromWxid }, 'AccountSwitchManager')
    } catch (error) {
      log.error('切换账号数据失败', { toWxid, fromWxid, error }, 'AccountSwitchManager')
      throw error
    }
  }

  /**
   * 建立WebSocket连接
   */
  private async connectWebSocket(wxid: string): Promise<void> {
    try {
      const { webSocketService } = await import('@/services/websocket')
      const connected = await webSocketService.connect(wxid)

      if (!connected) {
        log.warn('WebSocket连接失败，但不影响账号切换', { wxid }, 'AccountSwitchManager')
        // 在开发环境中WebSocket可能无法连接，这是正常的
      } else {
        log.debug('WebSocket连接建立完成', { wxid }, 'AccountSwitchManager')
      }
    } catch (error) {
      log.warn('建立WebSocket连接失败', { wxid, error }, 'AccountSwitchManager')
      // 不抛出错误，WebSocket连接失败不应该阻止账号切换
    }
  }

  /**
   * 更新UI状态
   */
  private async updateUIState(wxid: string): Promise<void> {
    try {
      // 清除未读计数
      const { useAuthStore } = await import('@/stores/auth')
      const { useCrossAccountMessageStore } = await import('@/stores/crossAccountMessage')

      const authStore = useAuthStore()
      const crossAccountStore = useCrossAccountMessageStore()

      authStore.clearAccountUnreadCount(wxid)
      crossAccountStore.clearAccountUnreadCount(wxid)

      // 触发UI刷新事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('account-switched', {
          detail: { wxid }
        }))
      }

      log.debug('UI状态更新完成', { wxid }, 'AccountSwitchManager')
    } catch (error) {
      log.warn('更新UI状态失败', { wxid, error }, 'AccountSwitchManager')
      // 不抛出错误，UI更新失败不应该阻止账号切换
    }
  }

  /**
   * 创建切换操作记录
   */
  private createOperation(fromWxid: string | null, toWxid: string, state: SwitchState): SwitchOperation {
    return {
      id: `switch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromWxid,
      toWxid,
      state,
      startTime: Date.now(),
      steps: []
    }
  }

  /**
   * 处理待处理的操作
   */
  private processPendingOperations(): void {
    if (this.pendingOperations.length > 0) {
      const operations = this.pendingOperations.splice(0)
      operations.forEach(operation => {
        try {
          operation()
        } catch (error) {
          log.error('处理待处理操作失败', { error }, 'AccountSwitchManager')
        }
      })
    }
  }

  /**
   * 获取当前切换状态
   */
  getCurrentOperation(): SwitchOperation | null {
    return this.currentOperation
  }

  /**
   * 获取操作历史
   */
  getOperationHistory(): SwitchOperation[] {
    return [...this.operationHistory]
  }

  /**
   * 检查是否正在切换
   */
  isSwitching(): boolean {
    return this.switchLock
  }

  /**
   * 强制重置切换状态（仅用于错误恢复）
   */
  forceReset(): void {
    log.warn('强制重置账号切换状态', {
      currentOperation: this.currentOperation?.id
    }, 'AccountSwitchManager')

    this.switchLock = false
    this.currentOperation = null
    this.pendingOperations = []
  }
}

// 创建全局实例
export const accountSwitchManager = AccountSwitchManager.getInstance()