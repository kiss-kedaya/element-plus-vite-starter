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
                <el-button @click="generateRandomDeviceInfo">随机生成</el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="设备名称">
            <el-input v-model="qrForm.deviceName" placeholder="自动生成随机设备名称" />
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
import { ref, onMounted, onUnmounted } from 'vue'
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
  deviceType: 'Car',
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

// 组件挂载时自动生成随机设备信息
onMounted(() => {
  generateRandomDeviceInfo()
})

// 生成随机设备ID
const generateDeviceId = () => {
  // 生成类似车载设备的ID格式
  const prefix = 'CAR'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substr(2, 6).toUpperCase()
  return `${prefix}_${timestamp}_${random}`
}

// 生成随机车载设备名称
const generateCarDeviceName = () => {
  const carBrands = ['奔驰', '宝马', '奥迪', '特斯拉', '蔚来', '理想', '小鹏', '比亚迪', '吉利', '长城']
  const carModels = ['智能座舱', '车载系统', '中控屏', '智能终端', '车机']
  const versions = ['Pro', 'Max', 'Plus', 'Elite', 'Premium']

  const brand = carBrands[Math.floor(Math.random() * carBrands.length)]
  const model = carModels[Math.floor(Math.random() * carModels.length)]
  const version = versions[Math.floor(Math.random() * versions.length)]

  return `${brand}${model}${version}`
}

// 生成随机设备信息
const generateRandomDeviceInfo = () => {
  qrForm.value.deviceId = generateDeviceId()
  qrForm.value.deviceName = generateCarDeviceName()
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
      Proxy: qrForm.value.proxy.ProxyIp ? {
        Host: qrForm.value.proxy.ProxyIp,
        Port: qrForm.value.proxy.ProxyPort,
        ProxyUser: qrForm.value.proxy.ProxyUser || undefined,
        ProxyPassword: qrForm.value.proxy.ProxyPass || undefined,
        Type: 'SOCKS5'
      } : undefined
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

      if (response.Success && response.Data?.wxid) {
        clearInterval(countdownTimer!)

        // 如果使用了代理，登录成功后自动设置代理
        if (qrForm.value.proxy.ProxyIp) {
          try {
            console.log('登录成功，正在设置代理...', qrForm.value.proxy)
            const proxyResponse = await loginApi.setProxy({
              Wxid: response.Data.wxid,
              Type: 'SOCKS5', // 默认使用SOCKS5
              Host: qrForm.value.proxy.ProxyIp,
              Port: qrForm.value.proxy.Port,
              User: qrForm.value.proxy.ProxyUser || '',
              Password: qrForm.value.proxy.ProxyPassword || ''
            })

            if (proxyResponse.Success) {
              console.log('代理设置成功:', proxyResponse)
              ElMessage.success('登录成功，代理已自动配置')
            } else {
              console.warn('代理设置失败:', proxyResponse.Message)
              ElMessage.warning(`登录成功，但代理设置失败: ${proxyResponse.Message}`)
            }
          } catch (error) {
            console.error('设置代理时发生错误:', error)
            ElMessage.warning('登录成功，但代理设置失败')
          }
        } else {
          ElMessage.success('登录成功')
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
  clearTimer()
})

// 监听组件关闭事件
const handleClose = () => {
  clearTimer()
  emit('close')
}

// 暴露清理方法给父组件
defineExpose({
  clearTimer,
  resetQRCode
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
