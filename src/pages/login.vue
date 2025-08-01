<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
// import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, User, Setting, Monitor, Refresh } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import type { ProxyConfig, LoginAccount } from '@/types/auth'
import { proxyApi, type ProxyInfo, getProxyDisplayName } from '@/api/proxy'
import ProxyManagement from '@/components/business/ProxyManagement.vue'

const router = useRouter()
// const authStore = useAuthStore()

const activeTab = ref('qrcode')
const isLoading = ref(false)
const qrCodeUrl = ref('')
const qrCodeData = ref('')

// 二维码登录表单
const qrForm = reactive({
  deviceType: 'iPad',
  deviceId: '',
  deviceName: '微信机器人',
  proxy: {
    ProxyIp: '',
    ProxyUser: '',
    ProxyPassword: '',
    Host: '',
    Port: 0,
    Type: 'socks5'
  } as ProxyConfig
})

// 密码登录表单
const passwordForm = reactive({
  username: '',
  password: '',
  data62: '',
  deviceName: '微信机器人',
  proxy: {
    ProxyIp: '',
    ProxyUser: '',
    ProxyPassword: '',
    Host: '',
    Port: 0,
    Type: 'socks5'
  } as ProxyConfig
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

const generateDeviceId = () => {
  return 'WX' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

const generateQRCode = async () => {
  if (!qrForm.deviceId || !qrForm.deviceName) {
    ElMessage.error('请填写设备ID和设备名称')
    return
  }

  isLoading.value = true
  try {
    // 模拟二维码生成
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 生成一个示例二维码
    const sampleData = 'https://login.weixin.qq.com/l/sample-qr-code'
    qrCodeData.value = sampleData
    qrCodeUrl.value = await QRCode.toDataURL(sampleData)

    ElMessage.success('二维码生成成功，请使用微信扫码登录（演示模式）')

    // 开始轮询检查登录状态
    startLoginStatusCheck()
  } catch (error) {
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
    // 模拟登录过程
    await new Promise(resolve => setTimeout(resolve, 2000))

    ElMessage.success('登录成功（演示模式）')
    router.push('/dashboard')
  } catch (error) {
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

  // 模拟登录状态检查
  statusCheckTimer = setInterval(() => {
    // 演示模式：10秒后自动"登录成功"
    setTimeout(() => {
      if (statusCheckTimer) {
        clearInterval(statusCheckTimer)
        ElMessage.success('扫码登录成功（演示模式）')
        router.push('/dashboard')
      }
    }, 10000)
  }, 1000)
}

const resetQRCode = () => {
  qrCodeUrl.value = ''
  qrCodeData.value = ''
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
  } catch (error) {
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
    ProxyUser: proxy.username,
    ProxyPassword: proxy.password,
    Host: proxy.ip,
    Port: proxy.port,
    Type: 'socks5'
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

// 处理二维码登录代理模式变化
const handleQrProxyModeChange = () => {
  if (qrProxyMode.value === 'none') {
    // 清空代理配置
    Object.assign(qrForm.proxy, {
      ProxyIp: '',
      ProxyUser: '',
      ProxyPassword: '',
      Host: '',
      Port: 0,
      Type: 'socks5'
    })
  }
  selectedProxyId.value = null
  selectedProxy.value = null
}

// 处理密码登录代理模式变化
const handlePasswordProxyModeChange = () => {
  if (passwordProxyMode.value === 'none') {
    // 清空代理配置
    Object.assign(passwordForm.proxy, {
      ProxyIp: '',
      ProxyUser: '',
      ProxyPassword: '',
      Host: '',
      Port: 0,
      Type: 'socks5'
    })
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
                      <el-input-number v-model="qrForm.proxy.Port" placeholder="代理端口" />
                    </el-form-item>
                    <el-form-item label="用户名">
                      <el-input v-model="qrForm.proxy.ProxyUser" placeholder="代理用户名（可选）" />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input v-model="qrForm.proxy.ProxyPassword" type="password" placeholder="代理密码（可选）" />
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
                <img :src="qrCodeUrl" alt="登录二维码" />
                <p>请使用微信扫描二维码登录</p>
                <el-button @click="resetQRCode" link>重新生成</el-button>
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
                      <el-input-number v-model="passwordForm.proxy.Port" placeholder="代理端口" />
                    </el-form-item>
                    <el-form-item label="用户名">
                      <el-input v-model="passwordForm.proxy.ProxyUser" placeholder="代理用户名（可选）" />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input v-model="passwordForm.proxy.ProxyPassword" type="password" placeholder="代理密码（可选）" />
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

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.login-card {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 600px;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.login-header p {
  color: #666;
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

.qrcode-display img {
  max-width: 200px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.qrcode-display p {
  margin: 1rem 0;
  color: #666;
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
