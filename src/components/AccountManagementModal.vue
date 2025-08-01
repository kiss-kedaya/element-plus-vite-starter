<template>
  <BaseModal v-model="visible" :title="`管理账号 - ${account?.nickname || ''}`" width="800px"
    custom-class="account-management-modal" @close="handleClose">
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
            <span>代理设置</span>
            <el-switch v-model="proxyEnabled" @change="handleProxyToggle" :loading="proxyLoading" />
          </div>
        </template>

        <div v-if="proxyEnabled" class="proxy-form">
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
          <div class="proxy-auth" v-if="needAuth">
            <el-input v-model="proxyForm.ProxyUser" placeholder="用户名 (可选)" size="large" />
            <el-input v-model="proxyForm.ProxyPassword" type="password" placeholder="密码 (可选)" size="large"
              show-password />
          </div>

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
  <BaseModal v-model="showReloginDialog" title="设备复用重新登录" width="400px" append-to-body>
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseModal from '@/components/common/BaseModal.vue'
import { Refresh, SwitchButton, Delete, Timer } from '@element-plus/icons-vue'
import type { LoginAccount, ProxyConfig } from '@/types/auth'
import { loginApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

// Props
const props = defineProps<{
  modelValue: boolean
  account: LoginAccount | null
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'account-updated': [account: LoginAccount]
}>()

// Store
const authStore = useAuthStore()

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

// 代理预设配置
const proxyPresets = [
  { name: 'V2Ray', Type: 'SOCKS5', Host: '127.0.0.1', Port: 1080 },
  { name: 'Clash', Type: 'SOCKS5', Host: '127.0.0.1', Port: 7890 },
  { name: 'SSR', Type: 'SOCKS5', Host: '127.0.0.1', Port: 1086 },
  { name: 'HTTP代理', Type: 'HTTP', Host: '127.0.0.1', Port: 8080 }
]

// 是否需要认证
const needAuth = computed(() => {
  return proxyForm.value.ProxyUser || proxyForm.value.ProxyPassword
})

// 应用预设配置
const applyPreset = (preset) => {
  proxyForm.value.Type = preset.Type
  proxyForm.value.Host = preset.Host
  proxyForm.value.Port = preset.Port
  // 清空认证信息
  proxyForm.value.ProxyUser = ''
  proxyForm.value.ProxyPassword = ''
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
watch(() => props.account, (newAccount) => {
  if (newAccount) {
    if (newAccount.proxy) {
      proxyEnabled.value = true
      proxyForm.value = { ...newAccount.proxy }
    } else {
      proxyEnabled.value = false
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
}, { immediate: true })

// 方法
const formatTime = (time: string | Date | undefined) => {
  if (!time) return '无'
  const date = typeof time === 'string' ? new Date(time) : time
  return date.toLocaleString('zh-CN')
}

const handleClose = () => {
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
        currentUuid.value = response.Data.Uuid || response.Data.uuid || ''
        qrStatus.value = '请使用微信扫描二维码'

        // 开始检查二维码状态
        if (currentUuid.value) {
          startQRCodeCheck()
        }
      } else if (response.Data.QrUrl) {
        // 备用方案：如果没有QrBase64但有QrUrl
        qrCodeUrl.value = response.Data.QrUrl
        currentUuid.value = response.Data.Uuid || response.Data.uuid || ''
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
  // 清除之前的检查定时器
  if (qrCheckTimer.value) {
    clearInterval(qrCheckTimer.value)
    qrCheckTimer.value = null
  }

  // 清除之前的超时定时器
  if (qrTimeoutTimer.value) {
    clearTimeout(qrTimeoutTimer.value)
    qrTimeoutTimer.value = null
  }

  // 每2秒检查一次二维码状态
  qrCheckTimer.value = setInterval(async () => {
    try {
      await checkQRCodeStatus()
    } catch (error) {
      console.error('检测二维码状态失败:', error)
    }
  }, 2000)

  // 设置5分钟超时
  qrTimeoutTimer.value = setTimeout(() => {
    if (qrCheckTimer.value) {
      clearInterval(qrCheckTimer.value)
      qrCheckTimer.value = null
    }
    if (qrTimeoutTimer.value) {
      clearTimeout(qrTimeoutTimer.value)
      qrTimeoutTimer.value = null
    }
    qrStatus.value = '二维码已过期，请刷新'
  }, 300000) // 5分钟
}

// 检查二维码状态
const checkQRCodeStatus = async () => {
  if (!currentUuid.value) return

  try {
    const response = await loginApi.checkQRCodeStatus({ Uuid: currentUuid.value })

    if (response.Success && response.Message === "登录成功") {
      // 登录成功
      clearQRTimer()

      qrStatus.value = '登录成功！正在初始化...'
      ElMessage.success('扫码登录成功！')

      // 执行二次登录
      if (response.Data && response.Data.wxid) {
        await performSecondAuth(response.Data.wxid)
      }

      // 关闭模态框并刷新
      setTimeout(() => {
        showReloginDialog.value = false
        emit('refresh')
      }, 2000)

    } else if (response.Success && response.Data) {
      // API调用成功，根据Data中的状态判断
      const data = response.Data

      if (data.expiredTime <= 0) {
        // 二维码已过期
        clearQRTimer()
        qrStatus.value = '二维码已过期，请刷新'

      } else if (data.status === 0) {
        // 等待扫码
        qrStatus.value = `等待扫码... (${data.expiredTime}秒后过期)`

      } else if (data.status === 1) {
        // 已扫码，等待确认
        qrStatus.value = `${data.nickName || '用户'}已扫码，请在手机上确认登录 (${data.expiredTime}秒后过期)`

      } else if (data.status === 4) {
        // 用户取消登录
        clearQRTimer()
        qrStatus.value = '用户取消登录'

      } else {
        // 其他状态
        qrStatus.value = `状态: ${data.status} (${data.expiredTime}秒后过期)`
      }

    } else {
      // API调用失败
      console.error('二维码检测失败:', response)
      qrStatus.value = `检测失败: ${response.Message || '未知错误'}`
    }
  } catch (error: any) {
    console.error('检测二维码状态失败:', error)
    qrStatus.value = '网络错误，检测失败'
  }
}

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
  if (qrCheckTimer.value) {
    clearInterval(qrCheckTimer.value)
    qrCheckTimer.value = null
  }
  if (qrTimeoutTimer.value) {
    clearTimeout(qrTimeoutTimer.value)
    qrTimeoutTimer.value = null
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
      { type: 'error' }
    )

    removeLoading.value = true
    authStore.removeAccount(props.account.wxid)
    ElMessage.success('账号已删除')
    visible.value = false
  } catch {
    // 用户取消
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

// 组件卸载时清理定时器
onUnmounted(() => {
  clearQRTimer()
})
</script>

<style scoped lang="scss">
.account-management {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  height: 80vh;
  overflow-y: auto;

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

.qr-loading {
  text-align: center;

  p {
    margin-top: var(--spacing-lg);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
  }
}
</style>
