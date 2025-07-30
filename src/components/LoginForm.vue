<template>
  <div class="login-form">
    <el-tabs v-model="activeTab" class="login-tabs">
      <!-- 二维码登录 -->
      <el-tab-pane label="二维码登录" name="qrcode">
        <el-form :model="qrForm" label-width="100px" class="qr-form">
          <el-form-item label="设备类型">
            <el-select v-model="qrForm.deviceType" placeholder="选择设备类型">
              <el-option label="iPad" value="iPad" />
              <el-option label="Windows" value="Windows" />
              <el-option label="Android平板" value="AndroidPad" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="设备ID">
            <el-input v-model="qrForm.deviceId" placeholder="输入设备ID" />
          </el-form-item>
          
          <el-form-item label="设备名称">
            <el-input v-model="qrForm.deviceName" placeholder="输入设备名称" />
          </el-form-item>
          
          <!-- 代理配置 -->
          <el-collapse v-model="showProxyConfig">
            <el-collapse-item title="代理配置（可选）" name="proxy">
              <el-form-item label="代理IP">
                <el-input v-model="qrForm.proxy.ProxyIp" placeholder="代理服务器IP" />
              </el-form-item>
              <el-form-item label="代理端口">
                <el-input-number v-model="qrForm.proxy.ProxyPort" :min="1" :max="65535" />
              </el-form-item>
              <el-form-item label="用户名">
                <el-input v-model="qrForm.proxy.ProxyUser" placeholder="代理用户名（可选）" />
              </el-form-item>
              <el-form-item label="密码">
                <el-input v-model="qrForm.proxy.ProxyPass" type="password" placeholder="代理密码（可选）" />
              </el-form-item>
            </el-collapse-item>
          </el-collapse>
          
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
                <p class="countdown" v-if="countdown > 0">{{ countdown }}秒后自动登录成功（演示）</p>
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
            <el-input v-model="passwordForm.data62" type="textarea" :rows="3" 
                     placeholder="输入Data62数据" />
          </el-form-item>
          
          <el-form-item label="设备名称">
            <el-input v-model="passwordForm.deviceName" placeholder="输入设备名称" />
          </el-form-item>
          
          <!-- 代理配置 -->
          <el-collapse v-model="showPasswordProxyConfig">
            <el-collapse-item title="代理配置（可选）" name="proxy">
              <el-form-item label="代理IP">
                <el-input v-model="passwordForm.proxy.ProxyIp" placeholder="代理服务器IP" />
              </el-form-item>
              <el-form-item label="代理端口">
                <el-input-number v-model="passwordForm.proxy.ProxyPort" :min="1" :max="65535" />
              </el-form-item>
              <el-form-item label="用户名">
                <el-input v-model="passwordForm.proxy.ProxyUser" placeholder="代理用户名（可选）" />
              </el-form-item>
              <el-form-item label="密码">
                <el-input v-model="passwordForm.proxy.ProxyPass" type="password" placeholder="代理密码（可选）" />
              </el-form-item>
            </el-collapse-item>
          </el-collapse>
          
          <div class="login-actions">
            <el-button type="primary" :loading="isLoading" @click="loginWithPassword">
              登录
            </el-button>
          </div>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import QRCode from 'qrcode'
import { loginApi } from '@/api/auth'
import type { QRCodeLoginRequest, Data62LoginRequest } from '@/types/auth'

// 定义事件
const emit = defineEmits(['login-success', 'close'])

// 响应式数据
const activeTab = ref('qrcode')
const isLoading = ref(false)
const qrCodeUrl = ref('')
const countdown = ref(0)
const showProxyConfig = ref([])
const showPasswordProxyConfig = ref([])

// 表单数据
const qrForm = ref({
  deviceType: 'iPad',
  deviceId: '',
  deviceName: '',
  proxy: {
    ProxyIp: '',
    ProxyPort: 1080,
    ProxyUser: '',
    ProxyPass: ''
  }
})

const passwordForm = ref({
  username: '',
  password: '',
  data62: '',
  deviceName: '',
  proxy: {
    ProxyIp: '',
    ProxyPort: 1080,
    ProxyUser: '',
    ProxyPass: ''
  }
})

let countdownTimer: NodeJS.Timeout | null = null

// 生成设备ID
const generateDeviceId = () => {
  return 'DEV_' + Math.random().toString(36).substr(2, 9).toUpperCase()
}

// 生成二维码
const generateQRCode = async () => {
  if (!qrForm.value.deviceId) {
    qrForm.value.deviceId = generateDeviceId()
  }
  if (!qrForm.value.deviceName) {
    qrForm.value.deviceName = `微信机器人_${qrForm.value.deviceType}`
  }

  isLoading.value = true
  try {
    const params: QRCodeLoginRequest = {
      DeviceID: qrForm.value.deviceId,
      DeviceName: qrForm.value.deviceName,
      Proxy: qrForm.value.proxy.ProxyIp ? {
        Host: qrForm.value.proxy.ProxyIp,
        Port: qrForm.value.proxy.ProxyPort,
        ProxyUser: qrForm.value.proxy.ProxyUser || undefined,
        ProxyPassword: qrForm.value.proxy.ProxyPass || undefined,
        Type: 'SOCKS5'
      } : undefined
    }

    const response = await loginApi.getQRCode(qrForm.value.deviceType, params)

    if (response.Success && response.Data?.QRCodeData) {
      qrCodeUrl.value = await QRCode.toDataURL(response.Data.QRCodeData)
      ElMessage.success('二维码生成成功，请使用微信扫码登录')

      // 开始检查登录状态
      startLoginCheck(response.Data.DeviceId || qrForm.value.deviceId)
    } else {
      throw new Error(response.Message || '生成二维码失败')
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
  countdown.value = 120 // 2分钟超时
  countdownTimer = setInterval(async () => {
    countdown.value--

    try {
      const response = await loginApi.checkQRCodeStatus({
        Wxid: '',
        Uuid: deviceId
      })

      if (response.Success && response.Data?.wxid) {
        clearInterval(countdownTimer!)
        const accountData = {
          wxid: response.Data.wxid,
          nickname: response.Data.nickname || qrForm.value.deviceName,
          avatar: response.Data.avatar || '',
          status: 'online' as const,
          deviceType: qrForm.value.deviceType,
          deviceId: qrForm.value.deviceId,
          deviceName: qrForm.value.deviceName,
          loginTime: new Date(),
          proxy: qrForm.value.proxy.ProxyIp ? qrForm.value.proxy : undefined
        }
        emit('login-success', accountData)
        return
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

// 重置二维码
const resetQRCode = () => {
  qrCodeUrl.value = ''
  countdown.value = 0
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
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
      Proxy: passwordForm.value.proxy.ProxyIp ? {
        Host: passwordForm.value.proxy.ProxyIp,
        Port: passwordForm.value.proxy.ProxyPort,
        ProxyUser: passwordForm.value.proxy.ProxyUser || undefined,
        ProxyPassword: passwordForm.value.proxy.ProxyPass || undefined,
        Type: 'SOCKS5'
      } : undefined
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

// 清理定时器
onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
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
</style>
