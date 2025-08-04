import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LoginAccount, ProxyConfig } from '@/types/auth'
import { fileCacheManager } from '@/utils/fileCache'
import { loginApi } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const accounts = ref<LoginAccount[]>([])
  const currentAccount = ref<LoginAccount | null>(null)
  const isLoading = ref(false)
  // 每个账号的未读消息计数
  const accountUnreadCounts = ref<Record<string, number>>({})

  // 计算属性
  const isLoggedIn = computed(() => accounts.value.length > 0)
  const onlineAccounts = computed(() =>
    accounts.value.filter(account => account.status === 'online')
  )

  // 获取账号的未读消息总数
  const getTotalUnreadCount = computed(() => {
    return Object.values(accountUnreadCounts.value).reduce((total, count) => total + count, 0)
  })

  // 方法
  const addAccount = async (account: LoginAccount) => {
    const existingIndex = accounts.value.findIndex(a => a.wxid === account.wxid)
    if (existingIndex >= 0) {
      accounts.value[existingIndex] = account
    } else {
      accounts.value.push(account)
    }

    if (!currentAccount.value) {
      currentAccount.value = account
    }

    // 如果新账号是在线状态，自动连接WebSocket
    if (account.status === 'online' && account.wxid) {
      try {
        const { webSocketService } = await import('@/services/websocket')
        webSocketService.addAutoConnectAccount(account.wxid)
        console.log(`新账号 ${account.wxid} 已添加到自动连接列表`)
      } catch (error) {
        console.warn(`为新账号 ${account.wxid} 连接WebSocket失败:`, error)
      }
    }
  }

  const removeAccount = async (wxid: string) => {
    const index = accounts.value.findIndex(a => a.wxid === wxid)
    if (index >= 0) {
      accounts.value.splice(index, 1)
      if (currentAccount.value?.wxid === wxid) {
        currentAccount.value = accounts.value[0] || null
      }

      // 断开该账号的WebSocket连接
      try {
        const { webSocketService } = await import('@/services/websocket')
        webSocketService.removeAutoConnectAccount(wxid)
        console.log(`账号 ${wxid} 已从自动连接列表移除并断开连接`)
      } catch (error) {
        console.warn(`断开账号 ${wxid} 的WebSocket连接失败:`, error)
      }
    }
  }

  const updateAccountStatus = (wxid: string, status: LoginAccount['status']) => {
    const account = accounts.value.find(a => a.wxid === wxid)
    if (account) {
      account.status = status
    }
  }

  const setCurrentAccount = (wxid: string) => {
    const account = accounts.value.find(a => a.wxid === wxid)
    if (account) {
      const previousAccount = currentAccount.value
      currentAccount.value = account

      // 设置文件缓存管理器的当前微信账号
      fileCacheManager.setCurrentWxid(wxid)

      // 如果是真正的账号切换（不是初始化），触发数据清空和切换
      if (previousAccount && previousAccount.wxid !== wxid) {
        console.log(`账号切换：${previousAccount.wxid} -> ${wxid}`)

        // 触发聊天数据的账号切换
        try {
          // 动态导入避免循环依赖
          import('@/stores/chat').then(({ useChatStore }) => {
            const chatStore = useChatStore()
            chatStore.switchAccount(wxid, previousAccount.wxid)
          })
        } catch (error) {
          console.error('切换聊天账号数据失败:', error)
        }
      }
    }
  }

  // 消息计数管理方法
  const getAccountUnreadCount = (wxid: string): number => {
    return accountUnreadCounts.value[wxid] || 0
  }

  const setAccountUnreadCount = (wxid: string, count: number) => {
    accountUnreadCounts.value[wxid] = Math.max(0, count)
  }

  const incrementAccountUnreadCount = (wxid: string, increment: number = 1) => {
    const currentCount = accountUnreadCounts.value[wxid] || 0
    accountUnreadCounts.value[wxid] = currentCount + increment
  }

  const clearAccountUnreadCount = (wxid: string) => {
    accountUnreadCounts.value[wxid] = 0
  }

  const clearAllUnreadCounts = () => {
    accountUnreadCounts.value = {}
  }

  // 登录相关方法
  const loginWithQRCode = async (deviceType: string, deviceId: string, deviceName: string, proxy?: ProxyConfig) => {
    isLoading.value = true
    try {
      const result = await loginApi.getQRCode(deviceType, {
        DeviceID: deviceId,
        DeviceName: deviceName,
        Proxy: proxy || {}
      })
      return result
    } finally {
      isLoading.value = false
    }
  }

  const loginWithPassword = async (username: string, password: string, data62: string, deviceName: string, proxy?: ProxyConfig) => {
    isLoading.value = true
    try {
      const result = await loginApi.loginWithData62({
        UserName: username,
        Password: password,
        Data62: data62,
        DeviceName: deviceName,
        Proxy: proxy || {}
      })
      return result
    } finally {
      isLoading.value = false
    }
  }

  const checkLoginStatus = async (wxid: string) => {
    try {
      // 这里可以调用检查登录状态的API
      // const result = await loginApi.checkStatus(wxid)
      // return result
      return true
    } catch (error: unknown) {
      console.error('检查登录状态失败:', error)
      return false
    }
  }

  // 获取已登录账号列表
  const fetchLoggedAccounts = async () => {
    isLoading.value = true
    try {
      const response = await loginApi.getLoggedAccounts()
      // 成功获取账号数据

      // 处理响应数据 - 由于axios拦截器已经提取了response.data，所以response就是实际的数据
      let accountsData = []

      // 检查响应结构 - response已经是后端返回的JSON数据
      if (response && Array.isArray(response.Data)) {
        accountsData = response.Data
        // 使用 response.Data 数据
      } else if (response && Array.isArray(response.Data)) {
        accountsData = response.Data
        // 使用 response.data 数据
      } else if (Array.isArray(response)) {
        accountsData = response
        // 使用 response 数据
      } else {
        console.error('未识别的响应格式，response:', response)
        // 如果没有数据，设置为空数组
        accountsData = []
      }

      // 转换为前端需要的格式
      accounts.value = accountsData.map((account: any) => {
        const processedAccount = {
          wxid: account.wxid || '',
          nickname: account.nickname || '',
          avatar: account.headUrl || account.avatar || '',
          headUrl: account.headUrl || account.avatar || '',
          status: (account.status === 'online' ? 'online' : 'offline') as 'online' | 'offline' | 'connecting',
          deviceType: account.deviceType || 'Unknown',
          deviceId: account.deviceId || account.imei || '',
          deviceName: account.deviceName || '',
          loginTime: account.loginTime,
          refreshTokenDate: account.refreshTokenDate,
          uin: account.uin || 0,
          alias: account.alias || '',
          email: account.email || '',
          mobile: account.mobile || '',
          imei: account.imei || '',
          loginMode: account.loginMode || '',
          osVersion: account.osVersion || '',
          romModel: account.romModel || '',
          softType: account.softType || ''
        }
        return processedAccount
      })

      // 自动连接所有在线账号的WebSocket
      if (accounts.value.length > 0) {
        try {
          const { webSocketService } = await import('@/services/websocket')
          const onlineWxids = accounts.value
            .filter(account => account.status === 'online')
            .map(account => account.wxid)

          if (onlineWxids.length > 0) {
            console.log('开始自动连接所有在线账号的WebSocket:', onlineWxids)
            await webSocketService.connectAllAccounts(onlineWxids)
          }
        } catch (error) {
          console.warn('自动连接WebSocket失败:', error)
        }
      }

      // 设置当前账号为第一个在线账号（在WebSocket连接之后）
      if (accounts.value.length > 0 && !currentAccount.value) {
        const onlineAccount = accounts.value.find(acc => acc.status === 'online')
        const selectedAccount = onlineAccount || accounts.value[0]
        currentAccount.value = selectedAccount

        // 明确设置该账号为当前WebSocket连接的账号
        if (selectedAccount.wxid) {
          console.log('初始化时设置当前账号:', selectedAccount.wxid)
          try {
            const { webSocketService } = await import('@/services/websocket')
            // 使用setAsCurrent=true参数确保设置为当前账号
            await webSocketService.connect(selectedAccount.wxid, true)
          } catch (error) {
            console.warn('设置当前账号WebSocket连接失败:', error)
            // 如果WebSocket连接失败，至少设置文件缓存管理器
            fileCacheManager.setCurrentWxid(selectedAccount.wxid)
          }
        }
      }

      return accounts.value
    } catch (error: unknown) {
      console.error('获取已登录账号失败:', error)
      return []
    } finally {
      isLoading.value = false
    }
  }

  return {
    // 状态
    accounts,
    currentAccount,
    isLoading,
    accountUnreadCounts,

    // 计算属性
    isLoggedIn,
    onlineAccounts,
    getTotalUnreadCount,

    // 方法
    addAccount,
    removeAccount,
    updateAccountStatus,
    setCurrentAccount,
    loginWithQRCode,
    loginWithPassword,
    checkLoginStatus,
    fetchLoggedAccounts,

    // 消息计数方法
    getAccountUnreadCount,
    setAccountUnreadCount,
    incrementAccountUnreadCount,
    clearAccountUnreadCount,
    clearAllUnreadCounts,
  }
})
