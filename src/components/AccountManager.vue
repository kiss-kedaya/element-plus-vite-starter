<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

// 定义事件
const emit = defineEmits(['close'])

// Store
const authStore = useAuthStore()

// 方法
function formatTime(time) {
  return time.toLocaleString()
}

async function reconnect(account) {
  try {
    ElMessage.info(`正在重连账号 ${account.nickname}...`)
    await new Promise(resolve => setTimeout(resolve, 2000))
    account.status = 'online'
    account.loginTime = new Date()
    ElMessage.success('重连成功')
  }
  catch (error) {
    ElMessage.error('重连失败')
  }
}

async function disconnect(account) {
  try {
    await ElMessageBox.confirm(`确定要断开账号 ${account.nickname} 吗？`, '确认断开', {
      type: 'warning',
    })

    authStore.updateAccountStatus(account.wxid, 'offline')
    ElMessage.success('账号已断开')
  }
  catch {
    // 用户取消
  }
}

async function removeAccount(account) {
  try {
    await ElMessageBox.confirm(`确定要删除账号 ${account.nickname} 吗？此操作不可恢复！`, '确认删除', {
      type: 'error',
    })

    authStore.removeAccount(account.wxid)
    ElMessage.success('账号已删除')
  }
  catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="account-manager">
    <el-table :data="authStore.accounts" style="width: 100%">
      <el-table-column label="账号信息" width="250">
        <template #default="scope">
          <div class="account-info">
            <span class="nickname">{{ scope.row.nickname }}</span>
            <span class="wxid">[{{ scope.row.wxid }}]</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'online' ? 'success' : 'danger'">
            {{ scope.row.status === 'online' ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="loginTime" label="登录时间" width="150">
        <template #default="scope">
          {{ formatTime(scope.row.loginTime) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="scope">
          <el-button v-if="scope.row.status === 'offline'" type="primary" size="small" @click="reconnect(scope.row)">
            重连
          </el-button>
          <el-button v-else type="warning" size="small" @click="disconnect(scope.row)">
            断开
          </el-button>
          <el-button type="danger" size="small" @click="removeAccount(scope.row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped lang="scss">
.account-manager {
  height: 400px;
  overflow-y: auto;
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  
  .nickname {
    font-weight: 500;
    color: #303133;
    font-size: 14px;
  }
  
  .wxid {
    font-size: 12px;
    color: #909399;
    font-family: 'Courier New', monospace;
  }
}
</style>
