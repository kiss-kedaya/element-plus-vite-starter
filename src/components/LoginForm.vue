<template>
  <div class="login-form">
    <el-tabs v-model="activeTab" class="login-tabs">
      <!-- 二维码登录 -->
      <el-tab-pane label="二维码登录" name="qrcode">
        <el-form :model="qrForm" label-width="100px" class="qr-form">
          <el-form-item label="设备类型">
            <el-select v-model="qrForm.deviceType" placeholder="选择设备类型">
              <el-option label="车载微信" value="Car" />
            </el-select>
          </el-form-item>

          <el-form-item label="设备ID">
            <el-input v-model="qrForm.deviceId" placeholder="自动生成随机设备ID">
              <template #append>
                <el-button @click="updateRandomDeviceInfo">随机生成</el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="设备名称">
            <el-input v-model="qrForm.deviceName" placeholder="自动生成随机设备名称" />
          </el-form-item>


          <!-- 代理设置 -->
          <el-card class="proxy-card" shadow="never">
            <template #header>
              <div class="card-header">
                <div class="header-left">
                  <span>代理设置</span>
                  <el-tag v-if="proxyEnabled && proxyStatus" :type="getProxyStatusType(proxyStatus)" size="small"
                    class="status-tag">
                    {{ getProxyStatusLabel(proxyStatus) }}
                  </el-tag>
                </div>
                <div class="header-right">
                  <el-button v-if="proxyEnabled" @click="testProxyConnection" :loading="proxyTesting" size="small"
                    type="primary" plain>
                    <el-icon>
                      <Connection />
                    </el-icon>
                    测试连接
                  </el-button>
                  <el-switch v-model="proxyEnabled" @change="handleProxyToggle" :loading="proxyLoading" />
                </div>
              </div>
            </template>

            <div v-if="proxyEnabled" class="proxy-form">
              <!-- 代理配置方式选择 -->
              <div class="proxy-mode-selection">
                <div class="mode-label">代理配置方式</div>
                <el-radio-group v-model="proxyMode" @change="handleProxyModeChange" class="mode-radios">
                  <el-radio value="preset">选择已有代理</el-radio>
                  <el-radio value="manual">手动配置</el-radio>
                </el-radio-group>
              </div>

              <!-- 选择已有代理 -->
              <template v-if="proxyMode === 'preset'">
                <div class="proxy-preset-section">
                  <el-form-item label="地区筛选">
                    <el-select v-model="selectedCountry" placeholder="选择地区" clearable @change="filterProxiesByCountry"
                      size="large" :popper-options="{ strategy: 'fixed' }">
                      <el-option label="全部地区" value="" />
                      <el-option v-for="country in availableCountries" :key="country" :label="country"
                        :value="country" />
                    </el-select>
                  </el-form-item>

                  <el-form-item label="选择代理">
                    <el-select v-model="selectedProxyId" placeholder="选择一个可用的代理" filterable @change="handleProxySelect"
                      size="large" style="width: 100%" :popper-options="{ strategy: 'fixed' }">
                      <el-option v-for="proxy in filteredProxies" :key="proxy.id" :label="getProxyDisplayName(proxy)"
                        :value="proxy.id" :disabled="proxy.status !== 'active'" />
                    </el-select>
                  </el-form-item>

                  <el-form-item v-if="selectedProxy">
                    <el-alert
                      :title="`已选择代理: ${selectedProxy.ip}:${selectedProxy.port} [${selectedProxy.country || '未知地区'}]`"
                      type="success" :closable="false" show-icon />
                  </el-form-item>

                  <div class="proxy-preset-actions">
                    <el-button size="small" @click="refreshProxyList">
                      <el-icon>
                        <Refresh />
                      </el-icon>
                      刷新列表
                    </el-button>
                    <el-button size="small" type="primary" @click="showProxyManagement = true">
                      <el-icon>
                        <Setting />
                      </el-icon>
                      管理代理
                    </el-button>
                  </div>
                </div>
              </template>

              <!-- 手动配置代理 -->
              <template v-if="proxyMode === 'manual'">
                <!-- 快速预设 -->
                <div class="proxy-presets">
                  <div class="preset-label">快速设置</div>
                  <div class="preset-buttons">
                    <el-button v-for="preset in proxyPresets" :key="preset.name" size="small"
                      @click="applyPreset(preset)" plain>
                      {{ preset.name }}
                    </el-button>
                  </div>
                </div>

                <!-- 代理配置 -->
                <div class="proxy-input-group">
                  <div class="proxy-type">
                    <el-select v-model="proxyForm.Type" placeholder="代理类型" size="large">
                      <el-option label="SOCKS5" value="SOCKS5" />
                      <el-option label="HTTP" value="HTTP" />
                      <el-option label="HTTPS" value="HTTPS" />
                    </el-select>
                  </div>

                  <div class="proxy-address">
                    <el-input v-model="proxyForm.Host" placeholder="如: 127.0.0.1" size="large" />
                  </div>

                  <div class="proxy-port">
                    <el-input-number v-model="proxyForm.Port" :min="1" :max="65535" placeholder="端口" size="large"
                      controls-position="right" />
                  </div>
                </div>

                <!-- 认证信息 -->
                <div class="proxy-auth">
                  <el-input v-model="proxyForm.ProxyUser" placeholder="用户名 (可选)" size="large" />
                  <el-input v-model="proxyForm.ProxyPassword" type="password" placeholder="密码 (可选)" size="large"
                    show-password />
                </div>
              </template>

              <!-- 操作按钮 -->
              <div class="proxy-actions">
                <el-button type="primary" @click="saveProxy" :loading="proxyLoading">
                  保存代理设置
                </el-button>
                <el-button @click="clearProxy" :loading="proxyLoading" plain>
                  清除代理
                </el-button>
              </div>
            </div>

            <div v-else class="proxy-disabled">
              <div class="disabled-text">代理功能已关闭</div>
            </div>
          </el-card>


          <div class="qr-section">
            <div v-if="!qrCodeUrl" class="qr-placeholder">
              <el-button type="primary" :loading="isLoading" @click="generateQRCode">
                生成二维码
              </el-button>
            </div>

            <div v-else class="qr-display">
              <div class="qr-code">
                <img :src="qrCodeUrl" alt="登录二维码" />
              </div>
              <div class="qr-tips">
                <p>请使用微信扫描二维码登录</p>
                <p class="countdown" v-if="countdown > 0">{{ countdown }}秒后过期，请及时扫码</p>
                <el-button size="small" @click="resetQRCode">重新生成</el-button>
              </div>
            </div>
          </div>
        </el-form>
      </el-tab-pane>

      <!-- 密码登录 -->
      <el-tab-pane label="密码登录" name="password">
        <el-form :model="passwordForm" label-width="100px" class="password-form">
          <el-form-item label="微信号">
            <el-input v-model="passwordForm.username" placeholder="输入微信号" />
          </el-form-item>

          <el-form-item label="密码">
            <el-input v-model="passwordForm.password" type="password" placeholder="输入密码" />
          </el-form-item>

          <el-form-item label="Data62">
            <el-input v-model="passwordForm.data62" type="textarea" :rows="3" placeholder="输入Data62数据" />
          </el-form-item>

          <el-form-item label="设备名称">
            <el-input v-model="passwordForm.deviceName" placeholder="输入设备名称" />
          </el-form-item>


          <!-- 代理设置 -->
          <el-card class="proxy-card" shadow="never">
            <template #header>
              <div class="card-header">
                <div class="header-left">
                  <span>代理设置</span>
                  <el-tag v-if="proxyEnabled && proxyStatus" :type="getProxyStatusType(proxyStatus)" size="small"
                    class="status-tag">
                    {{ getProxyStatusLabel(proxyStatus) }}
                  </el-tag>
                </div>
                <div class="header-right">
                  <el-button v-if="proxyEnabled" @click="testProxyConnection" :loading="proxyTesting" size="small"
                    type="primary" plain>
                    <el-icon>
                      <Connection />
                    </el-icon>
                    测试连接
                  </el-button>
                  <el-switch v-model="proxyEnabled" @change="handleProxyToggle" :loading="proxyLoading" />
                </div>
              </div>
            </template>

            <div v-if="proxyEnabled" class="proxy-form">
              <!-- 代理配置方式选择 -->
              <div class="proxy-mode-selection">
                <div class="mode-label">代理配置方式</div>
                <el-radio-group v-model="proxyMode" @change="handleProxyModeChange" class="mode-radios">
                  <el-radio value="preset">选择已有代理</el-radio>
                  <el-radio value="manual">手动配置</el-radio>
                </el-radio-group>
              </div>

              <!-- 选择已有代理 -->
              <template v-if="proxyMode === 'preset'">
                <div class="proxy-preset-section">
                  <el-form-item label="地区筛选">
                    <el-select v-model="selectedCountry" placeholder="选择地区" clearable @change="filterProxiesByCountry"
                      size="large" :popper-options="{ strategy: 'fixed' }">
                      <el-option label="全部地区" value="" />
                      <el-option v-for="country in availableCountries" :key="country" :label="country"
                        :value="country" />
                    </el-select>
                  </el-form-item>

                  <el-form-item label="选择代理">
                    <el-select v-model="selectedProxyId" placeholder="选择一个可用的代理" filterable @change="handleProxySelect"
                      size="large" style="width: 100%" :popper-options="{ strategy: 'fixed' }">
                      <el-option v-for="proxy in filteredProxies" :key="proxy.id" :label="getProxyDisplayName(proxy)"
                        :value="proxy.id" :disabled="proxy.status !== 'active'" />
                    </el-select>
                  </el-form-item>

                  <el-form-item v-if="selectedProxy">
                    <el-alert
                      :title="`已选择代理: ${selectedProxy.ip}:${selectedProxy.port} [${selectedProxy.country || '未知地区'}]`"
                      type="success" :closable="false" show-icon />
                  </el-form-item>

                  <div class="proxy-preset-actions">
                    <el-button size="small" @click="refreshProxyList">
                      <el-icon>
                        <Refresh />
                      </el-icon>
                      刷新列表
                    </el-button>
                    <el-button size="small" type="primary" @click="showProxyManagement = true">
                      <el-icon>
                        <Setting />
                      </el-icon>
                      管理代理
                    </el-button>
                  </div>
                </div>
              </template>

              <!-- 手动配置代理 -->
              <template v-if="proxyMode === 'manual'">
                <!-- 快速预设 -->
                <div class="proxy-presets">
                  <div class="preset-label">快速设置</div>
                  <div class="preset-buttons">
                    <el-button v-for="preset in proxyPresets" :key="preset.name" size="small"
                      @click="applyPreset(preset)" plain>
                      {{ preset.name }}
                    </el-button>
                  </div>
                </div>

                <!-- 代理配置 -->
                <div class="proxy-input-group">
                  <div class="proxy-type">
                    <el-select v-model="proxyForm.Type" placeholder="代理类型" size="large">
                      <el-option label="SOCKS5" value="SOCKS5" />
                      <el-option label="HTTP" value="HTTP" />
                      <el-option label="HTTPS" value="HTTPS" />
                    </el-select>
                  </div>

                  <div class="proxy-address">
                    <el-input v-model="proxyForm.Host" placeholder="如: 127.0.0.1" size="large" />
                  </div>

                  <div class="proxy-port">
                    <el-input-number v-model="proxyForm.Port" :min="1" :max="65535" placeholder="端口" size="large"
                      controls-position="right" />
                  </div>
                </div>

                <!-- 认证信息 -->
                <div class="proxy-auth">
                  <el-input v-model="proxyForm.ProxyUser" placeholder="用户名 (可选)" size="large" />
                  <el-input v-model="proxyForm.ProxyPassword" type="password" placeholder="密码 (可选)" size="large"
                    show-password />
                </div>
              </template>

              <!-- 操作按钮 -->
              <div class="proxy-actions">
                <el-button type="primary" @click="saveProxy" :loading="proxyLoading">
                  保存代理设置
                </el-button>
                <el-button @click="clearProxy" :loading="proxyLoading" plain>
                  清除代理
                </el-button>
              </div>
            </div>

            <div v-else class="proxy-disabled">
              <div class="disabled-text">代理功能已关闭</div>
            </div>
          </el-card>


          <div class="login-actions">
            <el-button type="primary" :loading="isLoading" @click="loginWithPassword">
              登录
            </el-button>
          </div>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <!-- 代理管理弹窗 -->
    <el-dialog
      v-model="showProxyManagement"
      title="代理管理"
      width="95%"
      top="2vh"
      :append-to-body="true"
      :modal="true"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :before-close="() => showProxyManagement = false"
      class="proxy-management-dialog"
      destroy-on-close
    >
      <ProxyManagement :show-title="false" @proxy-updated="loadProxyList" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, Refresh, Setting } from '@element-plus/icons-vue'
import { loginApi } from '@/api/auth'
import type { QRCodeLoginRequest, Data62LoginRequest } from '@/types/auth'
import {
  generateRandomDeviceInfo,
  generateDeviceId,
  createDefaultProxyConfig,
  buildProxyParams,
  buildSetProxyParams,
  type ProxyConfig
} from '@/utils/deviceUtils'
import { proxyApi, type ProxyInfo, getProxyDisplayName } from '@/api/proxy'
import ProxyManagement from '@/components/business/ProxyManagement.vue'

// 定义事件
const emit = defineEmits(['login-success', 'close'])

// 响应式数据
const activeTab = ref('qrcode')
const isLoading = ref(false)
const qrCodeUrl = ref('')
const countdown = ref(0)


// 表单数据
const qrForm = ref({
  deviceType: 'Car',
  deviceId: '',
  deviceName: '',
  proxy: createDefaultProxyConfig()
})

const passwordForm = ref({
  username: '',
  password: '',
  data62: '',
  deviceName: '',
  proxy: createDefaultProxyConfig()
})

let countdownTimer: NodeJS.Timeout | null = null

// 代理相关状态
const proxyEnabled = ref(false)
const proxyMode = ref('preset') // 'preset' | 'manual'
const proxyLoading = ref(false)
const proxyTesting = ref(false)
const proxyStatus = ref('')
const showProxyManagement = ref(false)

// 代理列表相关
const proxyList = ref<ProxyInfo[]>([])
const filteredProxies = ref<ProxyInfo[]>([])
const selectedProxyId = ref('')
const selectedCountry = ref('')

// 手动代理配置
const proxyForm = ref({
  Type: 'SOCKS5',
  Host: '',
  Port: 1080,
  ProxyUser: '',
  ProxyPassword: ''
})

// 代理预设
const proxyPresets = [
  { name: '本地代理', Type: 'SOCKS5', Host: '127.0.0.1', Port: 1080 },
  { name: 'HTTP代理', Type: 'HTTP', Host: '127.0.0.1', Port: 8080 },
  { name: 'HTTPS代理', Type: 'HTTPS', Host: '127.0.0.1', Port: 8443 }
]

// 计算属性
const availableCountries = computed(() => {
  const countries = new Set(proxyList.value.map(p => p.country).filter(Boolean))
  return Array.from(countries).sort()
})

const selectedProxy = computed(() => {
  return proxyList.value.find(p => p.id === Number(selectedProxyId.value))
})

// 组件挂载时自动生成随机设备信息
onMounted(() => {
  updateRandomDeviceInfo()
  loadProxyList()
})

// 更新随机设备信息
const updateRandomDeviceInfo = () => {
  const deviceInfo = generateRandomDeviceInfo()
  qrForm.value.deviceId = deviceInfo.deviceId
  qrForm.value.deviceName = deviceInfo.deviceName
}

// 生成二维码
const generateQRCode = async () => {
  // 如果没有设备信息，自动生成随机信息
  if (!qrForm.value.deviceId || !qrForm.value.deviceName) {
    generateRandomDeviceInfo()
  }

  isLoading.value = true
  try {
    const params: QRCodeLoginRequest = {
      DeviceID: qrForm.value.deviceId,
      DeviceName: qrForm.value.deviceName,
      Proxy: buildProxyParams(qrForm.value.proxy)
    }

    // 使用车载版二维码接口
    const response = await loginApi.getQRCodeForDeviceReuse(params)

    // 检查响应格式：Code: 1 表示成功，或者 Success: true
    if ((response.Code === 1 || response.Success === true) && response.Data) {
      // 直接使用返回的QrBase64，不要使用QrUrl
      if (response.Data.QrBase64) {
        qrCodeUrl.value = response.Data.QrBase64
        ElMessage.success('车载版二维码生成成功，请使用微信扫码登录')

        // 开始检查登录状态，使用Uuid
        startLoginCheck(response.Data.Uuid)
      } else {
        throw new Error('响应中没有找到QrBase64数据')
      }
    } else {
      throw new Error(response.Message || '生成车载版二维码失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '生成二维码失败')
    console.error('生成二维码失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 开始登录检查
const startLoginCheck = (deviceId: string) => {
  // 先清理之前的定时器
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }

  countdown.value = 120 // 2分钟超时
  countdownTimer = setInterval(async () => {
    countdown.value--

    try {
      const response = await loginApi.checkQRCodeStatus({
        Uuid: deviceId
      })

      if (response.Success && response.Message === "登录成功") {
        clearInterval(countdownTimer!)

        ElMessage.success('扫码登录成功！正在初始化...')

        // 执行二次登录（自动心跳）
        if (response.Data && response.Data.wxid) {
          try {
            await loginApi.performSecondAuth(response.Data.wxid)
            ElMessage.success('账号初始化成功！')
          } catch (error) {
            console.error('二次认证失败:', error)
            ElMessage.warning('账号初始化失败，请手动重连')
          }

          // 如果使用了代理，登录成功后自动设置代理
          if (qrForm.value.proxy.ProxyIp) {
            try {
              console.log('登录成功，正在设置代理...', qrForm.value.proxy)
              const proxyParams = buildSetProxyParams(response.Data.wxid, qrForm.value.proxy)
              const proxyResponse = await loginApi.setProxy(proxyParams)

              if (proxyResponse.Success) {
                console.log('代理设置成功:', proxyResponse)
                ElMessage.success('代理已自动配置')
              } else {
                console.warn('代理设置失败:', proxyResponse.Message)
                ElMessage.warning(`代理设置失败: ${proxyResponse.Message}`)
              }
            } catch (error) {
              console.error('设置代理时发生错误:', error)
              ElMessage.warning('代理设置失败')
            }
          }

          const accountData = {
            wxid: response.Data.wxid,
            nickname: response.Data.nickname || qrForm.value.deviceName,
            avatar: response.Data.avatar || '',
            status: 'online' as const,
            deviceType: 'Car', // 车载版设备类型
            deviceId: qrForm.value.deviceId,
            deviceName: qrForm.value.deviceName,
            loginTime: new Date(),
            proxy: qrForm.value.proxy.ProxyIp ? qrForm.value.proxy : undefined
          }
          emit('login-success', accountData)
        }
        return
      } else if (response.Success && response.Data) {
        const data = response.Data

        if (data.expiredTime <= 0) {
          // 二维码已过期
          clearInterval(countdownTimer!)
          ElMessage.error('二维码已过期，请重新生成')
          resetQRCode()

        } else if (data.status === 0) {
          // 等待扫码
          console.log(`等待扫码... (${data.expiredTime}秒后过期)`)

        } else if (data.status === 1) {
          // 已扫码，等待确认
          const userName = data.nickName || '用户'
          ElMessage.info(`${userName}已扫码，请在手机上确认登录`)

        } else if (data.status === 4) {
          // 用户取消登录
          clearInterval(countdownTimer!)
          ElMessage.warning('用户取消登录')
          resetQRCode()

        } else {
          // 其他状态
          console.log(`状态: ${data.status} (${data.expiredTime}秒后过期)`)
        }
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }

    if (countdown.value <= 0) {
      clearInterval(countdownTimer!)
      ElMessage.error('二维码已过期，请重新生成')
      resetQRCode()
    }
  }, 1000)
}

// 清理定时器
const clearTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 重置二维码
const resetQRCode = () => {
  qrCodeUrl.value = ''
  countdown.value = 0
  clearTimer()
}

// 密码登录
const loginWithPassword = async () => {
  if (!passwordForm.value.username || !passwordForm.value.password) {
    ElMessage.error('请填写微信号和密码')
    return
  }

  isLoading.value = true
  try {
    const params: Data62LoginRequest = {
      UserName: passwordForm.value.username,
      Password: passwordForm.value.password,
      Data62: passwordForm.value.data62,
      DeviceName: passwordForm.value.deviceName || '微信机器人',
      Proxy: buildProxyParams(passwordForm.value.proxy)
    }

    const response = await loginApi.loginWithData62(params)

    if (response.Success && response.Data?.wxid) {
      const accountData = {
        wxid: response.Data.wxid,
        nickname: response.Data.nickname || passwordForm.value.username,
        avatar: response.Data.avatar || '',
        status: 'online' as const,
        deviceType: 'Data62',
        deviceId: generateDeviceId(),
        deviceName: passwordForm.value.deviceName || '微信机器人',
        loginTime: new Date(),
        proxy: passwordForm.value.proxy.ProxyIp ? passwordForm.value.proxy : undefined
      }

      emit('login-success', accountData)
    } else {
      throw new Error(response.Message || '登录失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '登录失败')
    console.error('登录失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 代理相关函数
const loadProxyList = async () => {
  try {
    const response = await proxyApi.getProxyList()
    if (response.code === 0 && response.data?.list) {
      proxyList.value = response.data.list
      filteredProxies.value = response.data.list
    }
  } catch (error) {
    console.error('加载代理列表失败:', error)
  }
}

const filterProxiesByCountry = () => {
  if (!selectedCountry.value) {
    filteredProxies.value = proxyList.value
  } else {
    filteredProxies.value = proxyList.value.filter(p => p.country === selectedCountry.value)
  }
  selectedProxyId.value = ''
}

const handleProxySelect = () => {
  if (selectedProxy.value) {
    // 将选中的代理信息同步到表单
    qrForm.value.proxy.ProxyIp = selectedProxy.value.ip
    qrForm.value.proxy.ProxyPort = selectedProxy.value.port
    qrForm.value.proxy.ProxyUser = selectedProxy.value.username || ''
    qrForm.value.proxy.ProxyPass = selectedProxy.value.password || ''

    passwordForm.value.proxy.ProxyIp = selectedProxy.value.ip
    passwordForm.value.proxy.ProxyPort = selectedProxy.value.port
    passwordForm.value.proxy.ProxyUser = selectedProxy.value.username || ''
    passwordForm.value.proxy.ProxyPass = selectedProxy.value.password || ''
  }
}

const refreshProxyList = () => {
  loadProxyList()
}

const handleProxyToggle = (enabled: boolean) => {
  if (!enabled) {
    // 清空代理配置
    qrForm.value.proxy = createDefaultProxyConfig()
    passwordForm.value.proxy = createDefaultProxyConfig()
    selectedProxyId.value = ''
  }
}

const handleProxyModeChange = () => {
  // 切换模式时清空配置
  qrForm.value.proxy = createDefaultProxyConfig()
  passwordForm.value.proxy = createDefaultProxyConfig()
  selectedProxyId.value = ''
}

const applyPreset = (preset: any) => {
  proxyForm.value = { ...preset }
  // 同步到表单
  qrForm.value.proxy.ProxyIp = preset.Host
  qrForm.value.proxy.ProxyPort = preset.Port
  passwordForm.value.proxy.ProxyIp = preset.Host
  passwordForm.value.proxy.ProxyPort = preset.Port
}

const saveProxy = () => {
  if (proxyMode.value === 'manual') {
    qrForm.value.proxy.ProxyIp = proxyForm.value.Host
    qrForm.value.proxy.ProxyPort = proxyForm.value.Port
    qrForm.value.proxy.ProxyUser = proxyForm.value.ProxyUser
    qrForm.value.proxy.ProxyPass = proxyForm.value.ProxyPassword

    passwordForm.value.proxy.ProxyIp = proxyForm.value.Host
    passwordForm.value.proxy.ProxyPort = proxyForm.value.Port
    passwordForm.value.proxy.ProxyUser = proxyForm.value.ProxyUser
    passwordForm.value.proxy.ProxyPass = proxyForm.value.ProxyPassword
  }
  ElMessage.success('代理设置已保存')
}

const clearProxy = () => {
  qrForm.value.proxy = createDefaultProxyConfig()
  passwordForm.value.proxy = createDefaultProxyConfig()
  proxyForm.value = {
    Type: 'SOCKS5',
    Host: '',
    Port: 1080,
    ProxyUser: '',
    ProxyPassword: ''
  }
  selectedProxyId.value = ''
  ElMessage.success('代理设置已清除')
}

const testProxyConnection = async () => {
  if (!qrForm.value.proxy.ProxyIp || !qrForm.value.proxy.ProxyPort) {
    ElMessage.error('请先配置代理信息')
    return
  }

  proxyTesting.value = true
  try {
    const response = await loginApi.testProxy({
      Type: 'SOCKS5',
      Host: qrForm.value.proxy.ProxyIp,
      Port: qrForm.value.proxy.ProxyPort,
      ProxyUser: qrForm.value.proxy.ProxyUser,
      ProxyPassword: qrForm.value.proxy.ProxyPass
    })

    if (response.Success) {
      proxyStatus.value = 'connected'
      ElMessage.success('代理连接测试成功')
    } else {
      proxyStatus.value = 'failed'
      ElMessage.error(`代理连接测试失败: ${response.Message}`)
    }
  } catch (error: any) {
    proxyStatus.value = 'failed'
    ElMessage.error(`代理连接测试失败: ${error.message}`)
  } finally {
    proxyTesting.value = false
  }
}

const getProxyStatusType = (status: string) => {
  switch (status) {
    case 'connected': return 'success'
    case 'failed': return 'danger'
    case 'testing': return 'warning'
    default: return 'info'
  }
}

const getProxyStatusLabel = (status: string) => {
  switch (status) {
    case 'connected': return '已连接'
    case 'failed': return '连接失败'
    case 'testing': return '测试中'
    default: return '未知'
  }
}

// 清理定时器
onUnmounted(() => {
  clearTimer()
})

// 暴露清理方法给父组件
defineExpose({
  clearTimer,
  resetQRCode,
})
</script>

<style scoped lang="scss">
.login-form {
  .login-tabs {
    :deep(.el-tabs__content) {
      padding-top: 20px;
    }
  }
}

.qr-section {
  text-align: center;
  margin-top: 20px;
}

.qr-placeholder {
  padding: 40px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
}

.qr-display {
  .qr-code {
    margin-bottom: 16px;

    img {
      width: 200px;
      height: 200px;
      border: 1px solid #dcdfe6;
      border-radius: 8px;
    }
  }

  .qr-tips {
    p {
      margin: 8px 0;
      color: #666;
    }

    .countdown {
      color: #409eff;
      font-weight: 500;
    }
  }
}

.login-actions {
  text-align: center;
  margin-top: 20px;
}

.el-collapse {
  margin: 16px 0;
}

// 代理相关样式
.proxy-card {
  margin: 16px 0;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;

      .status-tag {
        margin-left: 8px;
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}

.proxy-form {
  .proxy-mode-selection {
    margin-bottom: 16px;

    .mode-label {
      margin-bottom: 8px;
      font-weight: 500;
      color: #606266;
    }

    .mode-radios {
      display: flex;
      gap: 16px;
    }
  }

  .proxy-preset-section {
    .proxy-preset-actions {
      margin-top: 12px;
      display: flex;
      gap: 8px;
    }
  }

  .proxy-presets {
    margin-bottom: 16px;

    .preset-label {
      margin-bottom: 8px;
      font-weight: 500;
      color: #606266;
    }

    .preset-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  }

  .proxy-input-group {
    display: grid;
    grid-template-columns: 120px 1fr 120px;
    gap: 12px;
    margin-bottom: 16px;
  }

  .proxy-auth {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  .proxy-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
}

.proxy-disabled {
  text-align: center;
  padding: 20px;
  color: #909399;

  .disabled-text {
    font-size: 14px;
  }
}

// 代理管理弹窗样式
.proxy-management-dialog {
  :deep(.el-dialog) {
    margin: 0 !important;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-dialog__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #ebeef5;
    flex-shrink: 0;
  }

  :deep(.el-dialog__body) {
    padding: 10px;
    flex: 1;
    overflow-y: auto;
    max-height: calc(95vh - 120px);
  }

  :deep(.el-dialog__footer) {
    padding: 16px 20px;
    border-top: 1px solid #ebeef5;
    flex-shrink: 0;
  }
}
</style>
