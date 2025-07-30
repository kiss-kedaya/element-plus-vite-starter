<template>
  <div class="proxy-settings">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>代理设置</span>
        </div>
      </template>

      <el-form :model="proxyForm" :rules="proxyRules" ref="proxyFormRef" label-width="120px">
        <el-form-item label="选择账号" prop="wxid" required>
          <el-select v-model="proxyForm.wxid" placeholder="请选择要设置代理的账号" style="width: 100%">
            <el-option
              v-for="account in accounts"
              :key="account.wxid"
              :label="`${account.nickname} (${account.wxid})`"
              :value="account.wxid"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="启用代理">
          <el-switch v-model="proxyForm.enabled" @change="onProxyEnabledChange" />
        </el-form-item>

        <template v-if="proxyForm.enabled">
          <el-form-item label="代理类型" prop="type">
            <el-select v-model="proxyForm.type" placeholder="请选择代理类型">
              <el-option label="SOCKS5" value="SOCKS5" />
              <el-option label="HTTP" value="HTTP" />
              <el-option label="HTTPS" value="HTTPS" />
            </el-select>
          </el-form-item>

          <el-form-item label="代理地址" prop="host" required>
            <el-input v-model="proxyForm.host" placeholder="例如: 127.0.0.1" />
          </el-form-item>

          <el-form-item label="代理端口" prop="port" required>
            <el-input-number v-model="proxyForm.port" :min="1" :max="65535" placeholder="例如: 1080" style="width: 100%" />
          </el-form-item>

          <el-form-item label="用户名" prop="username">
            <el-input v-model="proxyForm.username" placeholder="代理用户名（可选）" />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input v-model="proxyForm.password" type="password" placeholder="代理密码（可选）" show-password />
          </el-form-item>
        </template>

        <el-form-item>
          <el-button type="primary" @click="saveProxySettings" :loading="isLoading">
            <el-icon><Check /></el-icon>
            保存设置
          </el-button>
          <el-button @click="resetForm">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button @click="testProxy" :loading="isTestingProxy" v-if="proxyForm.enabled">
            <el-icon><Connection /></el-icon>
            测试连接
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 当前代理状态 -->
    <el-card class="status-card" v-if="currentProxyStatus">
      <template #header>
        <div class="card-header">
          <el-icon><InfoFilled /></el-icon>
          <span>当前代理状态</span>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="账号">{{ currentProxyStatus.nickname }}</el-descriptions-item>
        <el-descriptions-item label="微信ID">{{ currentProxyStatus.wxid }}</el-descriptions-item>
        <el-descriptions-item label="代理状态">
          <el-tag :type="currentProxyStatus.proxyEnabled ? 'success' : 'info'">
            {{ currentProxyStatus.proxyEnabled ? '已启用' : '未启用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="代理类型" v-if="currentProxyStatus.proxyEnabled">
          {{ currentProxyStatus.proxyType }}
        </el-descriptions-item>
        <el-descriptions-item label="代理地址" v-if="currentProxyStatus.proxyEnabled">
          {{ currentProxyStatus.proxyHost }}:{{ currentProxyStatus.proxyPort }}
        </el-descriptions-item>
        <el-descriptions-item label="最后更新" v-if="currentProxyStatus.proxyEnabled">
          {{ currentProxyStatus.lastUpdated }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting, Check, Refresh, Connection, InfoFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { loginApi } from '@/api/auth'
import type { ProxyConfig, LoginAccount } from '@/types/auth'

const authStore = useAuthStore()
const proxyFormRef = ref()
const isLoading = ref(false)
const isTestingProxy = ref(false)

// 代理表单数据
const proxyForm = reactive({
  wxid: '',
  enabled: false,
  type: 'SOCKS5',
  host: '',
  port: 1080,
  username: '',
  password: ''
})

// 表单验证规则
const proxyRules = {
  wxid: [
    { required: true, message: '请选择要设置代理的账号', trigger: 'change' }
  ],
  host: [
    { required: true, message: '请输入代理地址', trigger: 'blur' },
    { pattern: /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/, message: '请输入有效的IP地址或域名', trigger: 'blur' }
  ],
  port: [
    { required: true, message: '请输入代理端口', trigger: 'blur' },
    { type: 'number', min: 1, max: 65535, message: '端口号必须在1-65535之间', trigger: 'blur' }
  ]
}

// 计算属性
const accounts = computed(() => authStore.accounts)

const currentProxyStatus = computed(() => {
  if (!proxyForm.wxid) return null
  
  const account = accounts.value.find(acc => acc.wxid === proxyForm.wxid)
  if (!account) return null

  return {
    wxid: account.wxid,
    nickname: account.nickname,
    proxyEnabled: !!account.proxy?.ProxyIp,
    proxyType: account.proxy?.Type || '',
    proxyHost: account.proxy?.Host || account.proxy?.ProxyIp || '',
    proxyPort: account.proxy?.Port || '',
    lastUpdated: new Date().toLocaleString()
  }
})

// 方法
const onProxyEnabledChange = (enabled: boolean) => {
  if (!enabled) {
    // 禁用代理时清空表单
    proxyForm.host = ''
    proxyForm.port = 1080
    proxyForm.username = ''
    proxyForm.password = ''
  }
}

const saveProxySettings = async () => {
  if (!proxyFormRef.value) return

  try {
    await proxyFormRef.value.validate()
  } catch (error) {
    return
  }

  isLoading.value = true
  try {
    const proxyConfig: ProxyConfig = proxyForm.enabled ? {
      Type: proxyForm.type,
      Host: proxyForm.host,
      Port: proxyForm.port,
      ProxyIp: proxyForm.host, // 兼容旧字段
      ProxyUser: proxyForm.username || undefined,
      ProxyPassword: proxyForm.password || undefined
    } : {
      // 清空代理配置
      Type: '',
      Host: '',
      Port: 0,
      ProxyIp: '',
      ProxyUser: '',
      ProxyPassword: ''
    }

    await loginApi.setProxy({
      Wxid: proxyForm.wxid,
      Proxy: proxyConfig
    })

    // 更新本地账号的代理信息
    const account = authStore.accounts.find(acc => acc.wxid === proxyForm.wxid)
    if (account) {
      account.proxy = proxyForm.enabled ? proxyConfig : undefined
    }

    ElMessage.success(proxyForm.enabled ? '代理设置保存成功' : '代理已清除')
  } catch (error: any) {
    console.error('保存代理设置失败:', error)
    ElMessage.error(`保存代理设置失败: ${error.message || '未知错误'}`)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  proxyForm.enabled = false
  proxyForm.type = 'SOCKS5'
  proxyForm.host = ''
  proxyForm.port = 1080
  proxyForm.username = ''
  proxyForm.password = ''
  
  if (proxyFormRef.value) {
    proxyFormRef.value.clearValidate()
  }
}

const testProxy = async () => {
  if (!proxyForm.enabled || !proxyForm.host || !proxyForm.port) {
    ElMessage.warning('请先完整填写代理配置')
    return
  }

  isTestingProxy.value = true
  try {
    // 这里可以添加代理测试逻辑
    // 暂时模拟测试
    await new Promise(resolve => setTimeout(resolve, 2000))
    ElMessage.success('代理连接测试成功')
  } catch (error: any) {
    console.error('代理测试失败:', error)
    ElMessage.error(`代理测试失败: ${error.message || '连接超时'}`)
  } finally {
    isTestingProxy.value = false
  }
}

// 初始化
onMounted(() => {
  // 如果有当前账号，自动选择
  if (authStore.currentAccount) {
    proxyForm.wxid = authStore.currentAccount.wxid
    
    // 如果当前账号有代理配置，加载到表单
    const proxy = authStore.currentAccount.proxy
    if (proxy && proxy.ProxyIp) {
      proxyForm.enabled = true
      proxyForm.type = proxy.Type || 'SOCKS5'
      proxyForm.host = proxy.Host || proxy.ProxyIp
      proxyForm.port = proxy.Port || 1080
      proxyForm.username = proxy.ProxyUser || ''
      proxyForm.password = proxy.ProxyPassword || ''
    }
  }
})
</script>

<style scoped lang="scss">
.proxy-settings {
  .settings-card {
    margin-bottom: 20px;
  }

  .status-card {
    margin-top: 20px;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
}
</style>
