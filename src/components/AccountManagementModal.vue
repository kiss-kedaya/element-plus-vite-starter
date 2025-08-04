<template>
  <BaseModal v-model="visible" :title="`管理账号 - ${account?.nickname || ''}`" width="90%" top="5vh"
    custom-class="account-management-modal responsive-modal" @close="handleClose">
    <div v-if="account" class="account-management">
      <!-- 账号基本信息 -->
      <el-card class="account-info-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span>账号信息</span>
            <el-tag :type="account.status === 'online' ? 'primary' : 'danger'" effect="light">
              {{ account.status === 'online' ? '在线' : '离线' }}
            </el-tag>
          </div>
        </template>

        <div class="account-details">
          <div class="avatar-section">
            <el-avatar :src="account.headUrl || account.avatar" :size="80">
              {{ account.nickname.charAt(0) }}
            </el-avatar>
          </div>

          <div class="info-section">
            <div class="info-grid">
              <div class="info-item">
                <label>昵称：</label>
                <span>{{ account.nickname }}</span>
              </div>
              <div class="info-item">
                <label>微信号：</label>
                <span>{{ account.wxid }}</span>
              </div>
              <div class="info-item">
                <label>别名：</label>
                <span>{{ account.alias || '无' }}</span>
              </div>
              <div class="info-item">
                <label>UIN：</label>
                <span>{{ account.uin || '无' }}</span>
              </div>
              <div class="info-item">
                <label>邮箱：</label>
                <span>{{ account.email || '无' }}</span>
              </div>
              <div class="info-item">
                <label>手机：</label>
                <span>{{ account.mobile || '无' }}</span>
              </div>
              <div class="info-item">
                <label>设备类型：</label>
                <span>{{ account.deviceType }}</span>
              </div>
              <div class="info-item">
                <label>设备名称：</label>
                <span>{{ account.deviceName }}</span>
              </div>
              <div class="info-item">
                <label>设备ID：</label>
                <span>{{ account.deviceId || account.imei || '无' }}</span>
              </div>
              <div class="info-item">
                <label>登录时间：</label>
                <span>{{ formatTime(account.loginTime) }}</span>
              </div>
              <div class="info-item">
                <label>Token刷新：</label>
                <span>{{ formatTime(account.refreshTokenDate) }}</span>
              </div>
              <div class="info-item">
                <label>系统版本：</label>
                <span>{{ account.osVersion || '无' }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-card>

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
                  <el-option v-for="country in availableCountries" :key="country" :label="country" :value="country" />
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
                <el-button v-for="preset in proxyPresets" :key="preset.name" size="small" @click="applyPreset(preset)"
                  plain>
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

      <!-- 账号操作 -->
      <el-card class="actions-card" shadow="never">
        <template #header>
          <span>账号操作</span>
        </template>

        <!-- 自动同意好友设置 -->
        <div class="auto-accept-section">
          <div class="setting-item">
            <div class="setting-label">
              <span>自动同意好友请求</span>
              <el-tooltip content="开启后将自动同意所有好友请求" placement="top">
                <el-icon class="info-icon">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </div>
            <el-switch v-model="autoAcceptFriend" :loading="autoAcceptLoading" @change="handleAutoAcceptChange"
              active-text="开启" inactive-text="关闭" />
          </div>
        </div>

        <div class="action-buttons">
          <el-button v-if="account.status === 'offline'" type="primary" @click="showReloginDialog = true"
            :loading="reloginLoading">
            <el-icon>
              <Refresh />
            </el-icon>
            设备复用重新登录
          </el-button>

          <el-button v-else type="default" @click="disconnectAccount" :loading="disconnectLoading"
            class="warning-button">
            <el-icon>
              <SwitchButton />
            </el-icon>
            断开连接
          </el-button>

          <el-button v-if="account.status !== 'online'" type="warning" @click="enableHeartbeat"
            :loading="heartbeatLoading" plain>
            <el-icon>
              <Timer />
            </el-icon>
            开启心跳
          </el-button>

          <el-button type="default" @click="removeAccount" :loading="removeLoading" class="danger-button">
            <el-icon>
              <Delete />
            </el-icon>
            删除账号
          </el-button>
        </div>
      </el-card>
    </div>
  </BaseModal>

  <!-- 重新登录对话框 - 移到外层避免嵌套 -->
  <BaseModal v-model="showReloginDialog" title="设备复用重新登录" width="400px" append-to-body custom-class="relogin-modal">
    <div v-if="qrCodeUrl" class="qr-login">
      <div class="qr-container">
        <img :src="qrCodeUrl" alt="登录二维码" class="qr-image" />
      </div>
      <div class="qr-status">
        <p :class="['qr-status-text', getStatusClass()]">{{ qrStatus }}</p>
      </div>
      <el-button @click="refreshQRCode" :loading="qrLoading">
        刷新二维码
      </el-button>
    </div>

    <div v-else class="qr-loading">
      <el-skeleton :rows="3" animated />
      <p>{{ qrStatus }}</p>
    </div>

    <template #footer>
      <el-button @click="showReloginDialog = false">取消</el-button>
    </template>
  </BaseModal>

  <!-- 代理管理对话框 -->
  <el-dialog v-model="showProxyManagement" title="代理管理" width="85%" top="5vh" append-to-body
    custom-class="proxy-management-dialog" center>
    <ProxyManagement @proxy-updated="refreshProxyList" />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseModal from '@/components/common/BaseModal.vue'
import { Refresh, SwitchButton, Delete, Timer, QuestionFilled, Connection, Setting } from '@element-plus/icons-vue'
import type { LoginAccount, ProxyConfig } from '@/types/auth'
import { loginApi } from '@/api/auth'
import { friendApi } from '@/api/friend'
import { proxyApi, type ProxyInfo, getProxyDisplayName } from '@/api/proxy'
import { useAuthStore } from '@/stores/auth'
import { useTimerManager } from '@/utils/timerManager'
import { useQRCodeManager } from '@/utils/qrCodeManager'
import ProxyManagement from '@/components/business/ProxyManagement.vue'

// Props
const props = defineProps<{
  modelValue: boolean
  account: LoginAccount | null
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'account-updated': [account: LoginAccount]
  'account-deleted': [wxid: string]
  'refresh': []
}>()

// Store
const authStore = useAuthStore()
const { createTimer, clearTimer, clearAllTimers } = useTimerManager()
const { startCheck, stopCheck, stopAllChecks } = useQRCodeManager()

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const proxyEnabled = ref(false)
const proxyLoading = ref(false)
const reloginLoading = ref(false)
const disconnectLoading = ref(false)
const removeLoading = ref(false)
const heartbeatLoading = ref(false)
const showReloginDialog = ref(false)
const qrCodeUrl = ref('')
const qrLoading = ref(false)
const qrStatus = ref('等待获取二维码')
const qrCheckTimer = ref<NodeJS.Timeout | null>(null)
const qrTimeoutTimer = ref<NodeJS.Timeout | null>(null)
const currentUuid = ref('')

// 自动同意好友相关状态
const autoAcceptFriend = ref(false)
const autoAcceptLoading = ref(false)

// 代理连接状态
const proxyStatus = ref<string>('')
const proxyTesting = ref(false)

// 代理配置模式
const proxyMode = ref('manual') // 'preset' | 'manual'

// 代理管理相关
const availableProxies = ref<ProxyInfo[]>([])
const filteredProxies = ref<ProxyInfo[]>([])
const availableCountries = ref<string[]>([])
const selectedCountry = ref('')
const selectedProxyId = ref<number | null>(null)
const selectedProxy = ref<ProxyInfo | null>(null)
const showProxyManagement = ref(false)

// 代理预设配置
const proxyPresets = [
  { name: 'V2Ray', Type: 'SOCKS5', Host: '127.0.0.1', Port: 1080 },
  { name: 'Clash', Type: 'SOCKS5', Host: '127.0.0.1', Port: 7890 },
  { name: 'SSR', Type: 'SOCKS5', Host: '127.0.0.1', Port: 1086 },
  { name: 'HTTP代理', Type: 'HTTP', Host: '127.0.0.1', Port: 8080 }
]

// 应用预设配置
const applyPreset = (preset) => {
  proxyForm.value.Type = preset.Type
  proxyForm.value.Host = preset.Host
  proxyForm.value.Port = preset.Port
  // 清空认证信息
  proxyForm.value.ProxyUser = ''
  proxyForm.value.ProxyPassword = ''
}

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
  proxyForm.value = {
    Type: 'SOCKS5',
    Host: proxy.ip,
    Port: proxy.port,
    ProxyIp: proxy.ip,
    ProxyUser: proxy.username,
    ProxyPassword: proxy.password
  }
}

// 刷新代理列表
const refreshProxyList = () => {
  loadAvailableProxies()
}

// 处理代理模式变化
const handleProxyModeChange = () => {
  if (proxyMode.value === 'manual') {
    // 清空选择的代理
    selectedProxyId.value = null
    selectedProxy.value = null
  } else if (proxyMode.value === 'preset') {
    // 清空手动配置
    proxyForm.value = {
      Type: 'SOCKS5',
      Host: '',
      Port: 1080,
      ProxyIp: '',
      ProxyUser: '',
      ProxyPassword: ''
    }
  }
}

const proxyForm = ref<ProxyConfig>({
  Type: 'SOCKS5',
  Host: '',
  Port: 1080,
  ProxyIp: '',
  ProxyUser: '',
  ProxyPassword: ''
})

// 监听账号变化，初始化代理设置
watch(() => props.account, async (newAccount) => {
  if (newAccount) {
    // 先尝试从服务器获取已设置的代理
    await loadAccountProxy(newAccount.wxid)
  }
}, { immediate: true })

// 加载账号的代理设置
const loadAccountProxy = async (wxid: string) => {
  try {
    const response = await loginApi.getProxy({ Wxid: wxid })
    if (response.Success && response.Data) {
      // 服务器有代理配置
      proxyEnabled.value = true
      proxyForm.value = { ...response.Data }
      proxyStatus.value = 'inactive' // 重置为未测试状态

      // 判断是否是预设代理（通过ProxyIp字段判断）
      if (response.Data.ProxyIp && response.Data.ProxyIp !== response.Data.Host) {
        proxyMode.value = 'preset'
        // 尝试找到对应的预设代理
        const matchedProxy = availableProxies.value.find(proxy =>
          proxy.ip === response.Data.ProxyIp
        )
        if (matchedProxy) {
          selectedProxy.value = matchedProxy
          selectedProxyId.value = matchedProxy.id
        }
      } else {
        proxyMode.value = 'manual'
      }
    } else {
      // 服务器没有代理配置，检查本地存储
      if (props.account?.proxy) {
        proxyEnabled.value = true
        proxyForm.value = { ...props.account.proxy }
        proxyStatus.value = 'inactive'
        proxyMode.value = 'manual'
      } else {
        // 完全没有代理配置
        proxyEnabled.value = false
        proxyStatus.value = ''
        proxyMode.value = 'manual'
        proxyForm.value = {
          Type: 'SOCKS5',
          Host: '',
          Port: 1080,
          ProxyIp: '',
          ProxyUser: '',
          ProxyPassword: ''
        }
      }
    }
  } catch (error: any) {
    console.error('获取代理设置失败:', error)
    // 如果是404错误，说明后端接口还没有实现，暂时跳过
    if (error.message?.includes('404') || error.message?.includes('不存在')) {
      console.log('代理查询接口暂未实现，使用本地存储的代理配置')
    }

    // 降级到本地存储
    if (props.account?.proxy) {
      proxyEnabled.value = true
      proxyForm.value = { ...props.account.proxy }
      proxyStatus.value = 'inactive'
      proxyMode.value = 'manual'
    } else {
      proxyEnabled.value = false
      proxyStatus.value = ''
      proxyMode.value = 'manual'
      proxyForm.value = {
        Type: 'SOCKS5',
        Host: '',
        Port: 1080,
        ProxyIp: '',
        ProxyUser: '',
        ProxyPassword: ''
      }
    }
  }
}

// 监听代理表单变化，重置状态
watch(() => [proxyForm.value.Host, proxyForm.value.Port, proxyForm.value.Type], () => {
  if (proxyEnabled.value && proxyStatus.value !== 'testing') {
    proxyStatus.value = 'inactive'
  }
})

// 方法
const formatTime = (time: string | Date | undefined) => {
  if (!time) return '无'
  const date = typeof time === 'string' ? new Date(time) : time
  return date.toLocaleString('zh-CN')
}

const handleClose = () => {
  console.log('模态框关闭，清理定时器')
  clearQRTimer()
  showReloginDialog.value = false
  visible.value = false
}

const handleProxyToggle = (enabled: boolean) => {
  if (!enabled) {
    clearProxy()
  }
}

const saveProxy = async () => {
  if (!props.account) return

  proxyLoading.value = true
  try {
    const response = await loginApi.setProxy({
      Wxid: props.account.wxid,
      Proxy: proxyForm.value
    })

    if (response.Success) {
      ElMessage.success('代理设置保存成功')
      // 更新本地账号数据
      if (props.account) {
        props.account.proxy = { ...proxyForm.value }
        emit('account-updated', props.account)
      }
    } else {
      throw new Error(response.Message || '保存代理设置失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '保存代理设置失败')
    console.error('保存代理设置失败:', error)
  } finally {
    proxyLoading.value = false
  }
}

const clearProxy = async () => {
  if (!props.account) return

  proxyLoading.value = true
  try {
    const response = await loginApi.setProxy({
      Wxid: props.account.wxid,
      Proxy: {}
    })

    if (response.Success) {
      ElMessage.success('代理设置已清除')
      proxyEnabled.value = false
      proxyStatus.value = ''
      proxyForm.value = {
        Type: 'SOCKS5',
        Host: '',
        Port: 1080,
        ProxyIp: '',
        ProxyUser: '',
        ProxyPassword: ''
      }
      // 更新本地账号数据
      if (props.account) {
        props.account.proxy = undefined
        emit('account-updated', props.account)
      }
    } else {
      throw new Error(response.Message || '清除代理设置失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '清除代理设置失败')
    console.error('清除代理设置失败:', error)
  } finally {
    proxyLoading.value = false
  }
}

// 测试代理连接
const testProxyConnection = async () => {
  if (!props.account || !proxyForm.value.Host || !proxyForm.value.Port) {
    ElMessage.warning('请先配置代理信息')
    return
  }

  proxyTesting.value = true
  proxyStatus.value = 'testing'

  try {
    const response = await loginApi.testProxy({
      Type: proxyForm.value.Type,
      Host: proxyForm.value.Host,
      Port: proxyForm.value.Port,
      ProxyUser: proxyForm.value.ProxyUser || '',
      ProxyPassword: proxyForm.value.ProxyPassword || ''
    })

    if (response.Success && response.Data) {
      if (response.Data.status === 'success') {
        proxyStatus.value = 'active'
        const responseTime = response.Data.responseTime ? ` (${response.Data.responseTime}ms)` : ''
        ElMessage.success(`代理连接测试成功${responseTime}`)
      } else {
        proxyStatus.value = 'error'
        ElMessage.error(`代理连接测试失败: ${response.Data.error || '未知错误'}`)
      }
    } else {
      proxyStatus.value = 'error'
      ElMessage.error(response.Message || '代理连接测试失败')
    }
  } catch (error: any) {
    proxyStatus.value = 'error'
    // 如果是404错误，说明后端接口还没有实现
    if (error.message?.includes('404') || error.message?.includes('不存在')) {
      ElMessage.warning('代理测试接口暂未实现，请手动验证代理配置')
      console.log('代理测试接口暂未实现')
    } else {
      ElMessage.error('代理连接测试失败')
      console.error('代理连接测试失败:', error)
    }
  } finally {
    proxyTesting.value = false
  }
}

// 获取代理状态类型
const getProxyStatusType = (status: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const statusMap: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    'active': 'success',
    'testing': 'warning',
    'error': 'danger',
    'inactive': 'info'
  }
  return statusMap[status] || 'info'
}

// 获取代理状态标签
const getProxyStatusLabel = (status: string) => {
  const statusMap = {
    'active': '连接正常',
    'testing': '测试中',
    'error': '连接失败',
    'inactive': '未测试'
  }
  return statusMap[status as keyof typeof statusMap] || '未知'
}

const generateQRCode = async () => {
  if (!props.account) return

  // 清除之前的所有定时器
  clearQRTimer()

  qrLoading.value = true
  qrStatus.value = '正在获取二维码...'

  try {
    // 使用设备复用专用接口生成二维码
    const response = await loginApi.getQRCodeForDeviceReuse({
      DeviceID: props.account.deviceId || props.account.imei || '',
      DeviceName: props.account.deviceName,
      Proxy: props.account.proxy
    })

    // 检查响应格式：Code: 1 表示成功，或者 Success: true
    if ((response.Code === 1 || response.Success === true) && response.Data) {
      // 优先使用QrBase64，不要使用QrUrl
      if (response.Data.QrBase64) {
        qrCodeUrl.value = response.Data.QrBase64
        currentUuid.value = response.Data.Uuid || response.Data.Uuid || ''
        qrStatus.value = '请使用微信扫描二维码'

        // 开始检查二维码状态
        if (currentUuid.value) {
          startQRCodeCheck()
        }
      } else if (response.Data.QrUrl) {
        // 备用方案：如果没有QrBase64但有QrUrl
        qrCodeUrl.value = response.Data.QrUrl
        currentUuid.value = response.Data.Uuid || ''
        qrStatus.value = '请使用微信扫描二维码'

        // 开始检查二维码状态
        if (currentUuid.value) {
          startQRCodeCheck()
        }
      } else {
        throw new Error('响应中没有找到二维码数据')
      }
    } else {
      throw new Error(response.Message || '生成二维码失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '生成二维码失败')
    console.error('生成二维码失败:', error)
    qrStatus.value = '生成二维码失败'
  } finally {
    qrLoading.value = false
  }
}

const refreshQRCode = () => {
  generateQRCode()
}

// 开始检查二维码状态
const startQRCodeCheck = () => {
  if (!currentUuid.value) return

  const checkKey = `account-modal-${props.account?.wxid || 'unknown'}`

  // 使用全局二维码管理器
  startCheck(checkKey, {
    uuid: currentUuid.value,
    onSuccess: async (data) => {
      qrStatus.value = '登录成功！正在初始化...'

      // 如果账号有代理配置，登录成功后自动设置代理
      if (props.account?.proxy && props.account.proxy.Host) {
        try {
          console.log('登录成功，正在设置代理...', props.account.proxy)
          const proxyResponse = await loginApi.setProxy({
            Wxid: data.wxid,
            Proxy: {
              Type: props.account.proxy.Type || 'SOCKS5',
              Host: props.account.proxy.Host,
              Port: props.account.proxy.Port,
              ProxyUser: props.account.proxy.ProxyUser || '',
              ProxyPassword: props.account.proxy.ProxyPassword || ''
            }
          })

          if (proxyResponse.Success) {
            console.log('代理设置成功:', proxyResponse)
            ElMessage.success('扫码登录成功，代理已自动配置')
          } else {
            console.warn('代理设置失败:', proxyResponse.Message)
            ElMessage.warning(`扫码登录成功，但代理设置失败: ${proxyResponse.Message}`)
          }
        } catch (error) {
          console.error('设置代理时发生错误:', error)
          ElMessage.warning('扫码登录成功，但代理设置失败')
        }
      } else {
        ElMessage.success('扫码登录成功！')
      }

      // 执行二次登录
      if (data && data.wxid) {
        await performSecondAuth(data.wxid)
      }

      // 关闭模态框并刷新
      setTimeout(() => {
        showReloginDialog.value = false
        emit('refresh')
      }, 2000)
    },
    onStatusChange: (status) => {
      qrStatus.value = status
    },
    onError: (error) => {
      qrStatus.value = `检测失败: ${error}`
    },
    onExpired: () => {
      qrStatus.value = '二维码已过期，请刷新'
    },
    onCancelled: () => {
      qrStatus.value = '用户取消登录'
    }
  })
}

// 检查二维码状态 - 现在由 qrCodeManager 统一处理

// 执行二次登录
const performSecondAuth = async (wxid: string) => {
  try {
    const response = await fetch('http://localhost:8059/api/Login/LoginTwiceAutoAuth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `wxid=${encodeURIComponent(wxid)}`
    })

    const result = await response.json()

    if (result.Success) {
      qrStatus.value = '二次登录成功！'
    } else {
      qrStatus.value = `二次登录失败: ${result.Message}`
    }
  } catch (error: any) {
    console.error('二次登录失败:', error)
    qrStatus.value = `二次登录失败: ${error.message}`
  }
}

// 获取状态样式类
const getStatusClass = () => {
  const status = qrStatus.value
  if (status.includes('成功') || status.includes('已扫码')) {
    return 'status-success'
  } else if (status.includes('失败') || status.includes('过期') || status.includes('取消') || status.includes('错误')) {
    return 'status-error'
  } else if (status.includes('等待') || status.includes('扫码')) {
    return 'status-warning'
  }
  return 'status-info'
}

// 清理定时器
const clearQRTimer = () => {
  console.log('清理二维码定时器...')
  const checkKey = `account-modal-${props.account?.wxid || 'unknown'}`

  // 使用全局管理器停止检查
  stopCheck(checkKey)

  // 兼容旧的定时器清理
  if (qrCheckTimer.value) {
    clearInterval(qrCheckTimer.value)
    qrCheckTimer.value = null
    console.log('已清理 qrCheckTimer')
  }
  if (qrTimeoutTimer.value) {
    clearTimeout(qrTimeoutTimer.value)
    qrTimeoutTimer.value = null
    console.log('已清理 qrTimeoutTimer')
  }
}

// 开启心跳
const enableHeartbeat = async () => {
  if (!props.account) return

  try {
    await ElMessageBox.confirm(
      `确定要为账号 ${props.account.nickname} 开启心跳吗？`,
      '确认开启心跳',
      { type: 'info' }
    )

    heartbeatLoading.value = true
    // 发送心跳请求
    const response = await fetch(`http://localhost:8059/api/Login/AutoHeartBeat?wxid=${props.account.wxid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const result = await response.text()
      ElMessage.success(`心跳开启成功: ${result}`)
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      console.error('开启心跳失败:', error)
      ElMessage.error(`开启心跳失败: ${error.message}`)
    }
  } finally {
    heartbeatLoading.value = false
  }
}

const disconnectAccount = async () => {
  if (!props.account) return

  try {
    await ElMessageBox.confirm(
      `确定要断开账号 ${props.account.nickname} 的连接吗？`,
      '确认断开',
      { type: 'warning' }
    )

    disconnectLoading.value = true
    // 这里应该调用断开连接的API
    // 暂时模拟断开
    authStore.updateAccountStatus(props.account.wxid, 'offline')
    ElMessage.success('账号已断开连接')
    emit('account-updated', { ...props.account, status: 'offline' })
  } catch {
    // 用户取消
  } finally {
    disconnectLoading.value = false
  }
}

const removeAccount = async () => {
  if (!props.account) return

  try {
    await ElMessageBox.confirm(
      `确定要删除账号 ${props.account.nickname} 吗？此操作不可恢复！`,
      '确认删除',
      {
        type: 'error',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        dangerouslyUseHTMLString: true,
        message: `
          <div>
            <p>确定要删除账号 <strong>${props.account.nickname}</strong> 吗？</p>
            <p style="color: #f56c6c; font-size: 12px;">此操作将调用API删除账号，不可恢复！</p>
          </div>
        `
      }
    )

    removeLoading.value = true

    try {
      // 调用删除账号API
      console.log(`🗑️ 开始删除账号: ${props.account.wxid}`)
      const result = await loginApi.deleteAccount(props.account.wxid, false)

      if (result.Success) {
        // API调用成功，从本地存储中移除账号
        authStore.removeAccount(props.account.wxid)
        ElMessage.success('账号删除成功')
        console.log(`✅ 账号删除成功: ${props.account.wxid}`)
        visible.value = false
        emit('account-deleted', props.account.wxid)
      } else {
        // API调用失败
        ElMessage.error(`删除账号失败: ${result.Message || '未知错误'}`)
        console.error(`❌ 删除账号API失败:`, result)
      }
    } catch (apiError: any) {
      console.error(`❌ 删除账号API调用异常:`, apiError)
      ElMessage.error(`删除账号失败: ${apiError.message || '网络错误'}`)
    }
  } catch {
    // 用户取消
    console.log('用户取消删除账号操作')
  } finally {
    removeLoading.value = false
  }
}

// 监听重新登录对话框打开，生成二维码
watch(showReloginDialog, (show) => {
  if (show) {
    qrCodeUrl.value = ''
    qrStatus.value = '等待获取二维码'
    generateQRCode()
  } else {
    // 对话框关闭时清理定时器
    clearQRTimer()
    qrCodeUrl.value = ''
    currentUuid.value = ''
    qrStatus.value = '等待获取二维码'
  }
})

// 监听主模态框关闭，确保清理所有定时器
watch(visible, (show) => {
  if (!show) {
    // 主模态框关闭时清理所有定时器
    clearQRTimer()
    // 同时关闭重新登录对话框
    showReloginDialog.value = false
  }
})

// 自动同意好友相关方法
const loadAutoAcceptStatus = async () => {
  if (!props.account?.wxid) return

  try {
    const response = await friendApi.getAutoAcceptFriendStatus({
      Wxid: props.account.wxid
    })

    if (response.Success && response.Data) {
      // 后端返回的数据结构中使用的是 enable 字段
      autoAcceptFriend.value = response.Data.enable || false
    }
  } catch (error) {
    console.error('获取自动同意好友状态失败:', error)
  }
}

const handleAutoAcceptChange = async (enabled: boolean) => {
  if (!props.account?.wxid) return

  autoAcceptLoading.value = true
  try {
    const response = await friendApi.setAutoAcceptFriendStatus({
      Wxid: props.account.wxid,
      Enable: enabled
    })

    if (response.Success) {
      ElMessage.success(enabled ? '已开启自动同意好友' : '已关闭自动同意好友')
    } else {
      // 如果设置失败，恢复原状态
      autoAcceptFriend.value = !enabled
      ElMessage.error(response.Message || '设置失败')
    }
  } catch (error: any) {
    // 如果设置失败，恢复原状态
    autoAcceptFriend.value = !enabled
    ElMessage.error(error.message || '设置失败')
    console.error('设置自动同意好友状态失败:', error)
  } finally {
    autoAcceptLoading.value = false
  }
}

// 监听账号变化，加载自动同意状态
watch(() => props.account, (newAccount) => {
  if (newAccount && visible.value) {
    loadAutoAcceptStatus()
  }
}, { immediate: true })

// 监听模态框打开，加载自动同意状态
watch(visible, (show) => {
  if (show && props.account) {
    loadAutoAcceptStatus()
  }
})

// 组件挂载时加载代理列表
onMounted(() => {
  loadAvailableProxies()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  console.log('AccountManagementModal 组件卸载，清理所有定时器')
  clearQRTimer()
  stopAllChecks() // 停止所有二维码检查
})
</script>

<style scoped lang="scss">
.account-management {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  height: auto;
  // 移除内部滚动条，让外层对话框处理滚动
  overflow-y: visible;

  .account-info-card,
  .proxy-card,
  .actions-card {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .status-tag {
        margin-left: 8px;
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .account-details {
    display: flex;
    gap: 20px;

    .avatar-section {
      flex-shrink: 0;
    }

    .info-section {
      flex: 1;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      .info-item {
        display: flex;

        label {
          font-weight: 400;
          color: #8a8a8a;
          min-width: 80px;
          font-size: 13px;
        }

        span {
          color: #1a1a1a;
          word-break: break-all;
          font-size: 13px;
        }
      }
    }
  }

  .proxy-form {
    .proxy-mode-selection {
      margin-bottom: var(--spacing-lg);
      padding: var(--spacing-md);
      background: var(--bg-secondary);
      border-radius: var(--radius-medium);
      border: 1px solid var(--border-light);

      .mode-label {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin-bottom: var(--spacing-sm);
        font-weight: 500;
      }

      .mode-radios {
        display: flex;
        gap: var(--spacing-lg);
      }
    }

    .proxy-preset-section {
      margin-bottom: var(--spacing-lg);

      .el-form-item {
        margin-bottom: var(--spacing-md);
      }

      .proxy-preset-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-md);
      }
    }

    .proxy-presets {
      margin-bottom: var(--spacing-lg);

      .preset-label {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin-bottom: var(--spacing-sm);
      }

      .preset-buttons {
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }
    }

    .proxy-input-group {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-lg);

      .proxy-type {
        width: 120px;
        flex-shrink: 0;
      }

      .proxy-address {
        flex: 1;
      }

      .proxy-port {
        width: 100px;
        flex-shrink: 0;
      }
    }

    .proxy-auth {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-lg);
    }

    .proxy-actions {
      display: flex;
      gap: var(--spacing-sm);
      justify-content: flex-end;
    }
  }

  .proxy-disabled {
    text-align: center;
    padding: 40px 0;

    .disabled-text {
      color: #8a8a8a;
      font-size: 14px;
    }
  }

  .auto-accept-section {
    margin: var(--spacing-lg) 0;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-medium);
    border: 1px solid var(--border-light);

    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .setting-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: var(--text-primary);

        .info-icon {
          color: var(--text-tertiary);
          cursor: help;
          font-size: 14px;

          &:hover {
            color: var(--primary-color);
          }
        }
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: var(--spacing-md);
    flex-wrap: wrap;

    .warning-button {
      border-color: var(--warning-color) !important;
      color: var(--warning-color) !important;

      &:hover {
        background: rgba(250, 173, 20, 0.05) !important;
        border-color: #ffc53d !important;
        color: #ffc53d !important;
      }
    }

    .danger-button {
      border-color: var(--danger-color) !important;
      color: var(--danger-color) !important;

      &:hover {
        background: rgba(255, 77, 79, 0.05) !important;
        border-color: #ff7875 !important;
        color: #ff7875 !important;
      }
    }

    .el-button--success.is-plain {
      border-color: #67c23a !important;
      color: #67c23a !important;

      &:hover {
        background: rgba(103, 194, 58, 0.05) !important;
        border-color: #85ce61 !important;
        color: #85ce61 !important;
      }

      .el-icon {
        margin-right: 6px;
      }
    }
  }
}

.qr-login {
  text-align: center;

  .qr-container {
    margin-bottom: var(--spacing-lg);

    .qr-image {
      width: 200px;
      height: 200px;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-medium);
    }
  }

  .qr-tip {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
    font-size: var(--font-size-base);
  }

  .qr-status {
    margin: var(--spacing-md) 0;
    text-align: center;

    .qr-status-text {
      margin: 0;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: var(--font-size-sm);
      font-weight: 500;
      transition: all 0.3s ease;

      &.status-info {
        background: rgba(64, 158, 255, 0.1);
        color: #409eff;
        border: 1px solid rgba(64, 158, 255, 0.2);
      }

      &.status-success {
        background: rgba(103, 194, 58, 0.1);
        color: #67c23a;
        border: 1px solid rgba(103, 194, 58, 0.2);
      }

      &.status-warning {
        background: rgba(230, 162, 60, 0.1);
        color: #e6a23c;
        border: 1px solid rgba(230, 162, 60, 0.2);
      }

      &.status-error {
        background: rgba(245, 108, 108, 0.1);
        color: #f56c6c;
        border: 1px solid rgba(245, 108, 108, 0.2);
      }
    }
  }
}

// 响应式账号管理对话框样式
:deep(.account-management-modal.responsive-modal) {
  .el-dialog {
    margin: 0 auto;

    // 小屏幕适配
    @media (max-width: 768px) {
      width: 95vw !important;
      margin: 2vh auto;
      min-width: unset;
    }

    // 中等屏幕适配
    @media (min-width: 769px) and (max-width: 1200px) {
      width: 85vw !important;
      max-width: 900px;
      margin: 5vh auto;
    }

    // 大屏幕适配
    @media (min-width: 1201px) {
      width: 80vw !important;
      max-width: 1200px;
      margin: 5vh auto;
    }
  }

  // 统一的对话框主体样式 - 只在内容超出时显示滚动条
  .el-dialog__body {
    // 使用 calc 计算精确高度，减去头部和底部空间
    max-height: calc(90vh - 120px);
    overflow-y: auto;
    padding: 20px;

    @media (max-width: 768px) {
      max-height: calc(95vh - 100px);
      padding: 15px;
    }

    @media (min-width: 769px) and (max-width: 1200px) {
      max-height: calc(92vh - 110px);
      padding: 18px;
    }
  }
}

// 代理管理对话框高度和宽度限制
:deep(.proxy-management-dialog) {
  .el-dialog {
    height: 80vh !important;
    max-width: 95vw;
    min-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;

    // 小屏幕适配
    @media (max-width: 768px) {
      min-width: unset;
      width: 95vw !important;
    }
  }

  .el-dialog__body {
    height: calc(80vh - 120px) !important;
    overflow-y: auto;
    padding: 0;
    flex: 1;
  }
}

.qr-loading {
  text-align: center;

  p {
    margin-top: var(--spacing-lg);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
  }
}
</style>
