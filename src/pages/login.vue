<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, User, Setting, Monitor, Refresh, Iphone, CircleClose } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import type { ProxyConfig, LoginAccount } from '@/types/auth'
import { proxyApi, type ProxyInfo, getProxyDisplayName } from '@/api/proxy'
import { loginApi } from '@/api/auth'
import ProxyManagement from '@/components/business/ProxyManagement.vue'
import {
  generateDeviceId,
  createDefaultProxyConfig,
  type ProxyConfig as DeviceProxyConfig
} from '@/utils/deviceUtils'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref('qrcode')
const isLoading = ref(false)
const qrCodeUrl = ref('')
const qrCodeData = ref('')
const currentUuid = ref('')

// 二维码登录表单
const qrForm = reactive({
  deviceType: 'iPad',
  deviceId: '',
  deviceName: '微信机器人',
  proxy: createDefaultProxyConfig()
})

// 密码登录表单
const passwordForm = reactive({
  username: '',
  password: '',
  data62: '',
  deviceName: '微信机器人',
  proxy: createDefaultProxyConfig()
})

const deviceTypes = [
  { label: 'iPad', value: 'iPad' },
  { label: 'iPad X', value: 'iPadX' },
  { label: 'Windows', value: 'Windows' },
  { label: 'Windows UWP', value: 'WindowsUwp' },
  { label: 'Windows Unified', value: 'WindowsUnified' },
  { label: 'Car', value: 'Car' },
  { label: 'Android Pad', value: 'AndroidPad' }
]

onMounted(() => {
  // 生成随机设备ID
  qrForm.deviceId = generateDeviceId()
})

const generateQRCode = async () => {
  if (!qrForm.deviceId || !qrForm.deviceName) {
    ElMessage.error('请填写设备ID和设备名称')
    return
  }

  isLoading.value = true
  try {
    // 调用真实的API生成二维码
    const response = await loginApi.getQRCode('Car', {
      DeviceID: qrForm.deviceId,
      DeviceName: qrForm.deviceName
    })

    if (response.Success && response.Data) {
      qrCodeData.value = response.Data.QRCodeData || response.Data.QrBase64
      qrCodeUrl.value = await QRCode.toDataURL(qrCodeData.value)
      currentUuid.value = response.Data.Uuid || ''

      ElMessage.success('二维码生成成功，请使用微信扫码登录')

      // 开始轮询检查登录状态
      startLoginStatusCheck()
    } else {
      throw new Error(response.Message || '生成二维码失败')
    }
  } catch (error: unknown) {
    console.error('生成二维码失败:', error)
    ElMessage.error('生成二维码失败，请检查网络连接')
  } finally {
    isLoading.value = false
  }
}

const loginWithPassword = async () => {
  if (!passwordForm.username || !passwordForm.password || !passwordForm.data62) {
    ElMessage.error('请填写完整的登录信息')
    return
  }

  isLoading.value = true
  try {
    // 调用真实的62数据登录API
    const response = await loginApi.loginWithData62({
      UserName: passwordForm.username,
      Password: passwordForm.password,
      Data62: passwordForm.data62,
      DeviceName: qrForm.deviceName || 'Device_Login',
      Proxy: passwordForm.proxy
    })

    if (response.Success && response.Data?.wxid) {
      // 保存登录账号信息到store
      const accountData = {
        wxid: response.Data.wxid,
        nickname: response.Data.nickname || passwordForm.username,
        avatar: response.Data.avatar || '',
        status: 'online' as const,
        deviceType: 'Data62',
        deviceId: generateDeviceId(),
        deviceName: qrForm.deviceName || 'Device_Login',
        loginTime: new Date(),
        proxy: passwordForm.proxy.ProxyIp ? passwordForm.proxy : undefined
      }
      authStore.addAccount(accountData)

      ElMessage.success('登录成功')
      router.push('/dashboard')
    } else {
      throw new Error(response.Message || '登录失败')
    }
  } catch (error: unknown) {
    console.error('登录失败:', error)
    ElMessage.error('登录失败，请检查账号密码')
  } finally {
    isLoading.value = false
  }
}

let statusCheckTimer: NodeJS.Timeout | null = null

const startLoginStatusCheck = () => {
  if (statusCheckTimer) {
    clearInterval(statusCheckTimer)
  }

  if (!currentUuid.value) {
    ElMessage.error('二维码UUID无效')
    return
  }

  // 真实的登录状态检查
  statusCheckTimer = setInterval(async () => {
    try {
      const response = await loginApi.checkQRCodeStatus({ Uuid: currentUuid.value })

      if (response.Success && response.Message === "登录成功") {
        // 登录成功
        clearInterval(statusCheckTimer!)
        statusCheckTimer = null

        ElMessage.success('扫码登录成功！正在初始化...')

        // 执行二次登录（自动心跳）
        if (response.Data && response.Data.wxid) {
          await performSecondAuth(response.Data.wxid)

          // 保存登录账号信息到store
          const accountData = {
            wxid: response.Data.wxid,
            nickname: response.Data.nickname || qrForm.deviceName,
            avatar: response.Data.avatar || '',
            status: 'online' as const,
            deviceType: 'Car', // 车载版设备类型
            deviceId: qrForm.deviceId,
            deviceName: qrForm.deviceName,
            loginTime: new Date(),
            proxy: passwordForm.proxy.ProxyIp ? passwordForm.proxy : undefined
          }
          authStore.addAccount(accountData)
        }

        // 延迟跳转，给用户看到成功提示
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)

      } else if (response.Success && response.Data) {
        const data = response.Data

        if (data.expiredTime <= 0) {
          // 二维码已过期
          clearInterval(statusCheckTimer!)
          statusCheckTimer = null
          ElMessage.error('二维码已过期，请重新生成')
          resetQRCode()

        } else if (data.status === 0) {
          // 等待扫码
          console.log(`等待扫码... (${data.expiredTime}秒后过期)`)

        } else if (data.status === 1) {
          // 已扫码，显示用户信息覆盖层
          showUserScannedInfo(data)

        } else if (data.status === 4) {
          // 用户取消登录
          clearInterval(statusCheckTimer!)
          statusCheckTimer = null
          showQRCodeCancelled(data)

        } else {
          // 其他状态
          console.log(`状态: ${data.status} (${data.expiredTime}秒后过期)`)
        }
      }
    } catch (error: unknown) {
      console.error('检查登录状态失败:', error)
    }
  }, 2000) // 每2秒检查一次
}

// 显示用户扫码信息覆盖层
const showUserScannedInfo = (data: any) => {
  const qrcodeDisplay = document.querySelector('.qrcode-display')
  if (!qrcodeDisplay) return

  // 移除之前的覆盖层
  const existingOverlay = qrcodeDisplay.querySelector('.user-scanned-overlay')
  if (existingOverlay) {
    existingOverlay.remove()
  }

  // 创建用户信息覆盖层
  const userOverlay = document.createElement('div')
  userOverlay.className = 'user-scanned-overlay'
  userOverlay.innerHTML = `
    <div class="user-info">
      <img src="${data.headImgUrl}"
           alt="用户头像"
           class="user-avatar"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
      <div class="avatar-fallback" style="display: none; width: 80px; height: 80px; border-radius: 50%; background: var(--el-color-primary); color: white; align-items: center; justify-content: center; font-size: 24px; font-weight: 600;">
        ${data.nickName ? data.nickName.charAt(0).toUpperCase() : '?'}
      </div>
      <div class="user-details">
        <div class="user-nickname">${data.nickName}</div>
        <div class="scan-status">已扫码，请确认登录</div>
      </div>
    </div>
    <div class="confirm-hint">
      <el-icon><Iphone /></el-icon>
      请在手机上确认登录
    </div>
  `

  qrcodeDisplay.appendChild(userOverlay)
}

// 显示取消登录覆盖层
const showQRCodeCancelled = (data: any) => {
  const qrcodeDisplay = document.querySelector('.qrcode-display')
  if (!qrcodeDisplay) return

  // 移除之前的覆盖层
  const existingOverlay = qrcodeDisplay.querySelector('.user-scanned-overlay')
  if (existingOverlay) {
    existingOverlay.remove()
  }

  // 创建取消登录覆盖层
  const cancelOverlay = document.createElement('div')
  cancelOverlay.className = 'qrcode-cancelled-overlay'
  cancelOverlay.innerHTML = `
    <div class="cancel-info">
      <el-icon><CircleClose /></el-icon>
      <div class="cancel-message">用户取消登录</div>
      ${data.nickName ? `<div class="cancel-user">${data.nickName} 取消了登录</div>` : ''}
    </div>
    <button class="el-button el-button--primary" onclick="location.reload()">
      <el-icon><Refresh /></el-icon>
      重新获取二维码
    </button>
  `

  qrcodeDisplay.appendChild(cancelOverlay)
}

// 执行二次登录（自动心跳）
const performSecondAuth = async (wxid: string) => {
  try {
    const response = await loginApi.performSecondAuth(wxid)

    if (response.Success) {
      ElMessage.success('账号初始化成功！')
    } else {
      ElMessage.warning(`账号初始化失败: ${response.Message}`)
    }
  } catch (error: unknown) {
    console.error('二次认证失败:', error)
    ElMessage.warning('账号初始化失败，请手动重连')
  }
}

// 测试方法
const testScanned = () => {
  const testData = {
    headImgUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKVUskibDnhMt5MCIJ8227HHkibIhkKRkjZuEQoVy9KKIZqmMUz8gWxj2LjQQp8QJiciaKnFSJwQzTtJg/132',
    nickName: '可达鸭',
    status: 1,
    expiredTime: 227
  }
  showUserScannedInfo(testData)
}

const testCancelled = () => {
  const testData = {
    nickName: '可达鸭',
    status: 4
  }
  showQRCodeCancelled(testData)
}

// 重置二维码
const resetQRCode = () => {
  qrCodeUrl.value = ''
  qrCodeData.value = ''
  currentUuid.value = ''
  if (statusCheckTimer) {
    clearInterval(statusCheckTimer)
    statusCheckTimer = null
  }
}



const goBack = () => {
  router.push('/')
}

// 代理相关数据
const availableProxies = ref<ProxyInfo[]>([])
const filteredProxies = ref<ProxyInfo[]>([])
const availableCountries = ref<string[]>([])
const selectedCountry = ref('')
const selectedProxyId = ref<number | null>(null)
const selectedProxy = ref<ProxyInfo | null>(null)
const showProxyManagement = ref(false)
const qrProxyMode = ref('none') // 二维码登录代理模式
const passwordProxyMode = ref('none') // 密码登录代理模式

// 获取可用代理列表
const loadAvailableProxies = async () => {
  try {
    const response = await proxyApi.getAvailableProxies()
    if (response.code === 0) {
      availableProxies.value = response.data.list
      filteredProxies.value = response.data.list

      // 提取地区列表
      const countries = new Set<string>()
      response.data.list.forEach(proxy => {
        if (proxy.country) {
          countries.add(proxy.country)
        }
      })
      availableCountries.value = Array.from(countries).sort()
    }
  } catch (error: unknown) {
    console.error('获取代理列表失败:', error)
  }
}

// 根据地区筛选代理
const filterProxiesByCountry = () => {
  if (selectedCountry.value) {
    filteredProxies.value = availableProxies.value.filter(proxy =>
      proxy.country === selectedCountry.value
    )
  } else {
    filteredProxies.value = availableProxies.value
  }
  selectedProxyId.value = null
  selectedProxy.value = null
}

// 选择代理
const handleProxySelect = () => {
  if (selectedProxyId.value) {
    selectedProxy.value = availableProxies.value.find(proxy =>
      proxy.id === selectedProxyId.value
    ) || null

    if (selectedProxy.value) {
      // 更新表单数据
      updateFormProxy(selectedProxy.value)
    }
  }
}

// 更新表单代理配置
const updateFormProxy = (proxy: ProxyInfo) => {
  const proxyConfig = {
    ProxyIp: proxy.ip,
    ProxyPort: proxy.port,
    ProxyUser: proxy.username,
    ProxyPass: proxy.password
  }

  // 更新当前活动标签页的表单
  if (activeTab.value === 'qrcode') {
    Object.assign(qrForm.proxy, proxyConfig)
  } else if (activeTab.value === 'password') {
    Object.assign(passwordForm.proxy, proxyConfig)
  }
}

// 刷新代理列表
const refreshProxyList = () => {
  loadAvailableProxies()
}

// 清空代理配置的通用函数
const clearProxyConfig = (proxyConfig: any) => {
  Object.assign(proxyConfig, createDefaultProxyConfig())
}

// 处理二维码登录代理模式变化
const handleQrProxyModeChange = () => {
  if (qrProxyMode.value === 'none') {
    clearProxyConfig(qrForm.proxy)
  }
  selectedProxyId.value = null
  selectedProxy.value = null
}

// 处理密码登录代理模式变化
const handlePasswordProxyModeChange = () => {
  if (passwordProxyMode.value === 'none') {
    clearProxyConfig(passwordForm.proxy)
  }
  selectedProxyId.value = null
  selectedProxy.value = null
}

// 组件挂载时加载代理列表
onMounted(() => {
  loadAvailableProxies()
})
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h2>微信机器人登录</h2>
        <p>选择登录方式开始使用</p>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="二维码登录" name="qrcode">
          <div class="qrcode-login">
            <el-form :model="qrForm" label-width="100px">
              <el-form-item label="设备类型">
                <el-select v-model="qrForm.deviceType" placeholder="选择设备类型">
                  <el-option
                    v-for="device in deviceTypes"
                    :key="device.value"
                    :label="device.label"
                    :value="device.value"
                  />
                </el-select>
              </el-form-item>
              
              <el-form-item label="设备ID">
                <el-input v-model="qrForm.deviceId" placeholder="自动生成" readonly>
                  <template #append>
                    <el-button @click="qrForm.deviceId = generateDeviceId()">
                      重新生成
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
              
              <el-form-item label="设备名称">
                <el-input v-model="qrForm.deviceName" placeholder="输入设备名称" />
              </el-form-item>
              
              <el-collapse>
                <el-collapse-item title="代理设置（可选）" name="proxy">
                  <!-- 代理选择方式 -->
                  <el-form-item label="代理配置">
                    <el-radio-group v-model="qrProxyMode" @change="handleQrProxyModeChange">
                      <el-radio value="none">不使用代理</el-radio>
                      <el-radio value="preset">选择已有代理</el-radio>
                      <el-radio value="manual">手动配置</el-radio>
                    </el-radio-group>
                  </el-form-item>

                  <!-- 选择已有代理 -->
                  <template v-if="qrProxyMode === 'preset'">
                    <el-form-item label="地区筛选">
                      <el-select v-model="selectedCountry" placeholder="选择地区" clearable @change="filterProxiesByCountry">
                        <el-option label="全部地区" value="" />
                        <el-option v-for="country in availableCountries" :key="country" :label="country" :value="country" />
                      </el-select>
                    </el-form-item>

                    <el-form-item label="选择代理">
                      <el-select
                        v-model="selectedProxyId"
                        placeholder="选择一个可用的代理"
                        filterable
                        @change="handleProxySelect"
                        style="width: 100%"
                      >
                        <el-option
                          v-for="proxy in filteredProxies"
                          :key="proxy.id"
                          :label="getProxyDisplayName(proxy)"
                          :value="proxy.id"
                          :disabled="proxy.status !== 'active'"
                        />
                      </el-select>
                    </el-form-item>

                    <el-form-item v-if="selectedProxy">
                      <el-alert
                        :title="`已选择代理: ${selectedProxy.ip}:${selectedProxy.port} [${selectedProxy.country || '未知地区'}]`"
                        type="success"
                        :closable="false"
                        show-icon
                      />
                    </el-form-item>

                    <div class="proxy-actions">
                      <el-button size="small" @click="refreshProxyList">
                        <el-icon><Refresh /></el-icon>
                        刷新列表
                      </el-button>
                      <el-button size="small" type="primary" @click="showProxyManagement = true">
                        <el-icon><Setting /></el-icon>
                        管理代理
                      </el-button>
                    </div>
                  </template>

                  <!-- 手动配置代理 -->
                  <template v-if="qrProxyMode === 'manual'">
                    <el-form-item label="代理IP">
                      <el-input v-model="qrForm.proxy.ProxyIp" placeholder="代理服务器IP" />
                    </el-form-item>
                    <el-form-item label="代理端口">
                      <el-input-number v-model="qrForm.proxy.ProxyPort" placeholder="代理端口" />
                    </el-form-item>
                    <el-form-item label="用户名">
                      <el-input v-model="qrForm.proxy.ProxyUser" placeholder="代理用户名（可选）" />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input v-model="qrForm.proxy.ProxyPass" type="password" placeholder="代理密码（可选）" />
                    </el-form-item>
                  </template>
                </el-collapse-item>
              </el-collapse>
            </el-form>
            
            <div class="qrcode-section">
              <div v-if="!qrCodeUrl" class="qrcode-placeholder">
                <el-icon size="64" color="#ccc">
                  <Picture />
                </el-icon>
                <p>点击生成二维码</p>
              </div>
              
              <div v-else class="qrcode-display">
                <div class="qrcode-content">
                  <img :src="qrCodeUrl" alt="登录二维码" />
                  <p>请使用微信扫描二维码登录</p>
                  <el-button @click="resetQRCode" link>重新生成</el-button>
                </div>
              </div>
            </div>
            
            <el-button 
              type="primary" 
              size="large" 
              @click="generateQRCode"
              :loading="isLoading"
              class="login-button"
            >
              生成二维码
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="账号密码登录" name="password">
          <div class="password-login">
            <el-form :model="passwordForm" label-width="100px">
              <el-form-item label="用户名">
                <el-input v-model="passwordForm.username" placeholder="输入微信号或手机号" />
              </el-form-item>
              
              <el-form-item label="密码">
                <el-input v-model="passwordForm.password" type="password" placeholder="输入密码" />
              </el-form-item>
              
              <el-form-item label="Data62">
                <el-input 
                  v-model="passwordForm.data62" 
                  type="textarea" 
                  :rows="3"
                  placeholder="输入Data62数据"
                />
              </el-form-item>
              
              <el-form-item label="设备名称">
                <el-input v-model="passwordForm.deviceName" placeholder="输入设备名称" />
              </el-form-item>
              
              <el-collapse>
                <el-collapse-item title="代理设置（可选）" name="proxy">
                  <!-- 代理选择方式 -->
                  <el-form-item label="代理配置">
                    <el-radio-group v-model="passwordProxyMode" @change="handlePasswordProxyModeChange">
                      <el-radio value="none">不使用代理</el-radio>
                      <el-radio value="preset">选择已有代理</el-radio>
                      <el-radio value="manual">手动配置</el-radio>
                    </el-radio-group>
                  </el-form-item>

                  <!-- 选择已有代理 -->
                  <template v-if="passwordProxyMode === 'preset'">
                    <el-form-item label="地区筛选">
                      <el-select v-model="selectedCountry" placeholder="选择地区" clearable @change="filterProxiesByCountry">
                        <el-option label="全部地区" value="" />
                        <el-option v-for="country in availableCountries" :key="country" :label="country" :value="country" />
                      </el-select>
                    </el-form-item>

                    <el-form-item label="选择代理">
                      <el-select
                        v-model="selectedProxyId"
                        placeholder="选择一个可用的代理"
                        filterable
                        @change="handleProxySelect"
                        style="width: 100%"
                      >
                        <el-option
                          v-for="proxy in filteredProxies"
                          :key="proxy.id"
                          :label="getProxyDisplayName(proxy)"
                          :value="proxy.id"
                          :disabled="proxy.status !== 'active'"
                        />
                      </el-select>
                    </el-form-item>

                    <el-form-item v-if="selectedProxy">
                      <el-alert
                        :title="`已选择代理: ${selectedProxy.ip}:${selectedProxy.port} [${selectedProxy.country || '未知地区'}]`"
                        type="success"
                        :closable="false"
                        show-icon
                      />
                    </el-form-item>

                    <div class="proxy-actions">
                      <el-button size="small" @click="refreshProxyList">
                        <el-icon><Refresh /></el-icon>
                        刷新列表
                      </el-button>
                      <el-button size="small" type="primary" @click="showProxyManagement = true">
                        <el-icon><Setting /></el-icon>
                        管理代理
                      </el-button>
                    </div>
                  </template>

                  <!-- 手动配置代理 -->
                  <template v-if="passwordProxyMode === 'manual'">
                    <el-form-item label="代理IP">
                      <el-input v-model="passwordForm.proxy.ProxyIp" placeholder="代理服务器IP" />
                    </el-form-item>
                    <el-form-item label="代理端口">
                      <el-input-number v-model="passwordForm.proxy.ProxyPort" placeholder="代理端口" />
                    </el-form-item>
                    <el-form-item label="用户名">
                      <el-input v-model="passwordForm.proxy.ProxyUser" placeholder="代理用户名（可选）" />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input v-model="passwordForm.proxy.ProxyPass" type="password" placeholder="代理密码（可选）" />
                    </el-form-item>
                  </template>
                </el-collapse-item>
              </el-collapse>
            </el-form>
            
            <el-button 
              type="primary" 
              size="large" 
              @click="loginWithPassword"
              :loading="isLoading"
              class="login-button"
            >
              登录
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <div class="login-footer">
        <el-button @click="goBack">返回首页</el-button>
      </div>
    </div>

    <!-- 代理管理对话框 -->
    <el-dialog v-model="showProxyManagement" title="代理管理" width="80%" top="5vh">
      <ProxyManagement @proxy-updated="refreshProxyList" />
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 24px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.15) 0%, transparent 50%);
    pointer-events: none;
  }
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  padding: 48px;
  width: 100%;
  max-width: 700px;
  position: relative;
  z-index: 1;
  box-shadow:
    0 16px 64px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 50%,
      rgba(255, 255, 255, 0.1) 100%
    );
    border-radius: inherit;
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 20px 80px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 48px;
  position: relative;
  z-index: 2;
}

.login-header h2 {
  color: #1a1a1a;
  margin-bottom: 8px;
  font-size: 2rem;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-header p {
  color: #4a4a4a;
  font-size: 1rem;
  margin: 0;
}

.login-tabs {
  margin-bottom: 2rem;
}

.qrcode-section {
  text-align: center;
  margin: 2rem 0;
}

.qrcode-placeholder {
  padding: 2rem;
  border: 2px dashed #ddd;
  border-radius: 10px;
  color: #999;
}

.qrcode-display {
  width: 280px;
  height: 280px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
  margin: 0 auto;
  position: relative; /* 确保覆盖层能正确定位 */
}

.qrcode-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.qrcode-content img {
  max-width: 200px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.qrcode-content p {
  margin: 1rem 0;
  color: #666;
}

/* 用户扫码后的覆盖层样式 */
.user-scanned-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
  animation: fadeInScale 0.3s ease-out;
}

.user-scanned-overlay .user-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.user-scanned-overlay .user-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  aspect-ratio: 1;
  border: 3px solid var(--el-color-primary);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
}

.user-scanned-overlay .avatar-fallback {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  border: 3px solid var(--el-color-primary);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
}

.user-scanned-overlay .user-details {
  text-align: center;
}

.user-scanned-overlay .user-nickname {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.user-scanned-overlay .scan-status {
  font-size: 14px;
  color: var(--el-color-success);
  font-weight: 500;
}

.user-scanned-overlay .confirm-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 14px;
  text-align: center;
}

.user-scanned-overlay .confirm-hint i {
  font-size: 24px;
  color: var(--el-color-primary);
}

/* 取消登录覆盖层样式 */
.qrcode-cancelled-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 20px;
  border-radius: 8px;
  animation: fadeInScale 0.3s ease-out;
}

.qrcode-cancelled-overlay .cancel-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.qrcode-cancelled-overlay .cancel-info i {
  font-size: 48px;
  color: var(--el-color-danger);
  margin-bottom: 8px;
}

.qrcode-cancelled-overlay .cancel-message {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-danger);
  margin-bottom: 4px;
}

.qrcode-cancelled-overlay .cancel-user {
  font-size: 14px;
  color: #666;
}

.qrcode-cancelled-overlay .el-button {
  margin-top: 8px;
  padding: 10px 20px;
  font-size: 14px;
}

/* 动画效果 */
@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.login-button {
  width: 100%;
  margin-top: 1rem;
}

.login-footer {
  text-align: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #eee;
}

.el-collapse {
  margin: 1rem 0;
}

.proxy-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.proxy-actions .el-button {
  flex: 1;
}

:deep(.el-collapse-item__header) {
  font-weight: 500;
}

:deep(.el-radio-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.el-radio) {
  margin-right: 0;
  margin-bottom: 8px;
}

:deep(.el-alert) {
  margin-top: 8px;
}

@media (max-width: 768px) {
  .login-container {
    padding: 1rem;
  }

  .login-card {
    padding: 1.5rem;
  }
}
</style>
