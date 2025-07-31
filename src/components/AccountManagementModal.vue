<template>
  <el-dialog
    v-model="visible"
    :title="`管理账号 - ${account?.nickname || ''}`"
    width="800px"
    :before-close="handleClose"
  >
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
            <el-switch
              v-model="proxyEnabled"
              @change="handleProxyToggle"
              :loading="proxyLoading"
            />
          </div>
        </template>

        <div v-if="proxyEnabled" class="proxy-form">
          <!-- 快速预设 -->
          <div class="proxy-presets">
            <div class="preset-label">快速设置</div>
            <div class="preset-buttons">
              <el-button
                v-for="preset in proxyPresets"
                :key="preset.name"
                size="small"
                @click="applyPreset(preset)"
                plain
              >
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
              <el-input
                v-model="proxyForm.Host"
                placeholder="如: 127.0.0.1"
                size="large"
              />
            </div>

            <div class="proxy-port">
              <el-input-number
                v-model="proxyForm.Port"
                :min="1"
                :max="65535"
                placeholder="端口"
                size="large"
                controls-position="right"
              />
            </div>
          </div>

          <!-- 认证信息 -->
          <div class="proxy-auth" v-if="needAuth">
            <el-input
              v-model="proxyForm.ProxyUser"
              placeholder="用户名 (可选)"
              size="large"
            />
            <el-input
              v-model="proxyForm.ProxyPassword"
              type="password"
              placeholder="密码 (可选)"
              size="large"
              show-password
            />
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
          <el-button
            v-if="account.status === 'offline'"
            type="primary"
            @click="showReloginDialog = true"
            :loading="reloginLoading"
          >
            <el-icon><Refresh /></el-icon>
            设备复用重新登录
          </el-button>

          <el-button
            v-else
            type="default"
            @click="disconnectAccount"
            :loading="disconnectLoading"
            class="warning-button"
          >
            <el-icon><SwitchButton /></el-icon>
            断开连接
          </el-button>

          <el-button
            v-if="account.status === 'online'"
            type="success"
            @click="enableHeartbeat"
            :loading="heartbeatLoading"
            plain
          >
            <el-icon><Timer /></el-icon>
            开启心跳
          </el-button>

          <el-button
            type="default"
            @click="removeAccount"
            :loading="removeLoading"
            class="danger-button"
          >
            <el-icon><Delete /></el-icon>
            删除账号
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 重新登录对话框 -->
    <el-dialog
      v-model="showReloginDialog"
      title="设备复用重新登录"
      width="400px"
      append-to-body
    >
      <div v-if="qrCodeUrl" class="qr-login">
        <div class="qr-container">
          <img :src="qrCodeUrl" alt="登录二维码" class="qr-image" />
        </div>
        <p class="qr-tip">请使用微信扫描二维码登录</p>
        <el-button @click="refreshQRCode" :loading="qrLoading">
          刷新二维码
        </el-button>
      </div>
      
      <div v-else class="qr-loading">
        <el-skeleton :rows="3" animated />
        <p>正在生成登录二维码...</p>
      </div>
      
      <template #footer>
        <el-button @click="showReloginDialog = false">取消</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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

  qrLoading.value = true
  try {
    // 使用设备复用生成二维码
    const response = await loginApi.getQRCode(props.account.deviceType || 'iPad', {
      DeviceID: props.account.deviceId || props.account.imei || '',
      DeviceName: props.account.deviceName,
      Proxy: props.account.proxy
    })

    if (response.Success && response.Data?.QRCodeUrl) {
      qrCodeUrl.value = response.Data.QRCodeUrl
    } else {
      throw new Error(response.Message || '生成二维码失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '生成二维码失败')
    console.error('生成二维码失败:', error)
  } finally {
    qrLoading.value = false
  }
}

const refreshQRCode = () => {
  generateQRCode()
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
      method: 'GET',
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
    generateQRCode()
  }
})
</script>

<style scoped lang="scss">
.account-management {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;

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
