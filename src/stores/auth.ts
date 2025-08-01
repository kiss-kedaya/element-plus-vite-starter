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

  // 计算属性
  const isLoggedIn = computed(() => accounts.value.length > 0)
  const onlineAccounts = computed(() => 
    accounts.value.filter(account => account.status === 'online')
  )

  // 方法
  const addAccount = (account: LoginAccount) => {
    const existingIndex = accounts.value.findIndex(a => a.wxid === account.wxid)
    if (existingIndex >= 0) {
      accounts.value[existingIndex] = account
    } else {
      accounts.value.push(account)
    }
    
    if (!currentAccount.value) {
      currentAccount.value = account
    }
  }

  const removeAccount = (wxid: string) => {
    const index = accounts.value.findIndex(a => a.wxid === wxid)
    if (index >= 0) {
      accounts.value.splice(index, 1)
      if (currentAccount.value?.wxid === wxid) {
        currentAccount.value = accounts.value[0] || null
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

      // 如果是真正的账号切换（不是初始化），触发数据清空事件
      if (previousAccount && previousAccount.wxid !== wxid) {
        console.log(`账号切换：${previousAccount.wxid} -> ${wxid}`)
        // 这里可以触发全局的数据清空事件
        // 各个组件可以监听这个事件来清空自己的数据
      }
    }
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
    } catch (error) {
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
      } else if (response && Array.isArray(response.data)) {
        accountsData = response.data
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
          status: account.status === 'online' ? 'online' : 'offline',
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

      // 设置当前账号为第一个在线账号
      if (accounts.value.length > 0 && !currentAccount.value) {
        const onlineAccount = accounts.value.find(acc => acc.status === 'online')
        currentAccount.value = onlineAccount || accounts.value[0]
      }
      return accounts.value
    } catch (error) {
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
    
    // 计算属性
    isLoggedIn,
    onlineAccounts,
    
    // 方法
    addAccount,
    removeAccount,
    updateAccountStatus,
    setCurrentAccount,
    loginWithQRCode,
    loginWithPassword,
    checkLoginStatus,
    fetchLoggedAccounts
  }
})
