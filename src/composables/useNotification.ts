import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import type { MessageOptions, NotificationOptions, MessageBoxOptions } from 'element-plus'

export type NotificationType = 'success' | 'warning' | 'info' | 'error'

export interface UseNotificationOptions {
  defaultDuration?: number
  showClose?: boolean
  center?: boolean
}

export function useNotification(options: UseNotificationOptions = {}) {
  const defaultOptions = {
    duration: options.defaultDuration || 3000,
    showClose: options.showClose ?? true,
    center: options.center ?? false
  }

  // 消息提示
  const message = {
    success: (content: string, opts?: Partial<MessageOptions>) => {
      return ElMessage.success({
        message: content,
        ...defaultOptions,
        ...opts
      })
    },
    
    warning: (content: string, opts?: Partial<MessageOptions>) => {
      return ElMessage.warning({
        message: content,
        ...defaultOptions,
        ...opts
      })
    },
    
    info: (content: string, opts?: Partial<MessageOptions>) => {
      return ElMessage.info({
        message: content,
        ...defaultOptions,
        ...opts
      })
    },
    
    error: (content: string, opts?: Partial<MessageOptions>) => {
      return ElMessage.error({
        message: content,
        duration: 5000, // 错误消息显示更久
        ...opts
      })
    }
  }

  // 通知
  const notification = {
    success: (title: string, message?: string, opts?: Partial<NotificationOptions>) => {
      return ElNotification.success({
        title,
        message,
        duration: defaultOptions.duration,
        ...opts
      })
    },
    
    warning: (title: string, message?: string, opts?: Partial<NotificationOptions>) => {
      return ElNotification.warning({
        title,
        message,
        duration: defaultOptions.duration,
        ...opts
      })
    },
    
    info: (title: string, message?: string, opts?: Partial<NotificationOptions>) => {
      return ElNotification.info({
        title,
        message,
        duration: defaultOptions.duration,
        ...opts
      })
    },
    
    error: (title: string, message?: string, opts?: Partial<NotificationOptions>) => {
      return ElNotification.error({
        title,
        message,
        duration: 0, // 错误通知不自动关闭
        ...opts
      })
    }
  }

  // 确认对话框
  const confirm = async (
    content: string,
    title: string = '确认',
    opts?: Partial<MessageBoxOptions>
  ) => {
    try {
      await ElMessageBox.confirm(content, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        ...opts
      })
      return true
    } catch {
      return false
    }
  }

  // 输入对话框
  const prompt = async (
    content: string,
    title: string = '输入',
    opts?: Partial<MessageBoxOptions>
  ) => {
    try {
      const { value } = await ElMessageBox.prompt(content, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        ...opts
      })
      return value
    } catch {
      return null
    }
  }

  // 警告对话框
  const alert = async (
    content: string,
    title: string = '提示',
    opts?: Partial<MessageBoxOptions>
  ) => {
    try {
      await ElMessageBox.alert(content, title, {
        confirmButtonText: '确定',
        ...opts
      })
      return true
    } catch {
      return false
    }
  }

  // 快捷方法
  const showSuccess = (content: string) => message.success(content)
  const showWarning = (content: string) => message.warning(content)
  const showInfo = (content: string) => message.info(content)
  const showError = (content: string) => message.error(content)

  const notifySuccess = (title: string, content?: string) => notification.success(title, content)
  const notifyWarning = (title: string, content?: string) => notification.warning(title, content)
  const notifyInfo = (title: string, content?: string) => notification.info(title, content)
  const notifyError = (title: string, content?: string) => notification.error(title, content)

  // 业务场景快捷方法
  const showApiError = (error: any) => {
    const errorMessage = error?.response?.data?.message || error?.message || '操作失败'
    message.error(errorMessage)
  }

  const showNetworkError = () => {
    message.error('网络连接异常，请检查网络设置')
  }

  const showOperationSuccess = (operation: string = '操作') => {
    message.success(`${operation}成功`)
  }

  const confirmDelete = (itemName: string = '此项') => {
    return confirm(
      `确定要删除${itemName}吗？此操作不可撤销。`,
      '删除确认',
      { type: 'error' }
    )
  }

  const confirmLogout = () => {
    return confirm(
      '确定要退出登录吗？',
      '退出确认',
      { type: 'warning' }
    )
  }

  return {
    // 基础方法
    message,
    notification,
    confirm,
    prompt,
    alert,
    
    // 快捷方法
    showSuccess,
    showWarning,
    showInfo,
    showError,
    notifySuccess,
    notifyWarning,
    notifyInfo,
    notifyError,
    
    // 业务方法
    showApiError,
    showNetworkError,
    showOperationSuccess,
    confirmDelete,
    confirmLogout
  }
}

export default useNotification
