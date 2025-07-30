<template>
  <div class="dashboard-container">
    <!-- 顶部导航栏 -->
    <el-header class="header">
      <div class="header-content">
        <div class="logo">
          <div class="logo-text">微信机器人管理系统</div>
        </div>
        <div class="header-stats">
          <div class="stat-item">
            <span class="stat-label">在线账号</span>
            <span class="stat-value">{{ onlineAccountsCount }}</span>
          </div>
        </div>
      </div>
    </el-header>

    <!-- 主要内容区域 -->
    <el-container class="main-container">
      <!-- 左侧账号列表 -->
      <el-aside width="300px" class="accounts-sidebar">
        <div class="sidebar-header">
          <h3>在线账号</h3>
          <el-button type="primary" size="small" @click="showLoginDialog = true">
            <el-icon><Plus /></el-icon>
            添加账号
          </el-button>
        </div>
        
        <div class="accounts-list">
          <div v-if="authStore.accounts.length === 0" class="empty-accounts">
            <el-empty description="暂无在线账号">
              <el-button type="primary" @click="showLoginDialog = true">立即登录</el-button>
            </el-empty>
          </div>

          <div v-for="account in authStore.accounts" :key="account.wxid"
               class="account-item"
               :class="{ active: authStore.currentAccount?.wxid === account.wxid }"
               @click="selectAccount(account)">
            <el-avatar :src="account.headUrl || account.avatar" :size="40">
              {{ account.nickname.charAt(0) }}
            </el-avatar>
            <div class="account-info">
              <div class="nickname">{{ account.nickname }}</div>
              <div class="account-details">
                <div class="account-wxid">{{ account.wxid }}</div>
                <div class="account-device">{{ account.deviceType }}</div>
              </div>
              <div class="status">
                <el-tag :type="account.status === 'online' ? 'primary' : 'danger'" size="small" effect="light">
                  {{ account.status === 'online' ? '在线' : '离线' }}
                </el-tag>
              </div>
            </div>
            <div class="account-actions">
              <el-button
                type="primary"
                size="small"
                @click.stop="openAccountManagement(account)"
              >
                管理
              </el-button>
            </div>
          </div>
        </div>
      </el-aside>

      <!-- 右侧功能区域 -->
      <el-main class="main-content">
        <div v-if="!authStore.currentAccount" class="welcome-content">
          <el-result icon="info" title="欢迎使用微信机器人管理系统">
            <template #sub-title>
              <p>请先登录微信账号或选择已登录的账号开始使用</p>
            </template>
            <template #extra>
              <el-button type="primary" @click="showLoginDialog = true">立即登录</el-button>
            </template>
          </el-result>
        </div>

        <div v-else class="account-dashboard">
          <!-- 功能选项卡 -->
          <el-tabs v-model="activeTab" class="account-tabs">
            <el-tab-pane label="好友管理" name="friends">
              <FriendManagement :account="authStore.currentAccount" />
            </el-tab-pane>
            <el-tab-pane label="聊天功能" name="chat">
              <ChatInterface :account="authStore.currentAccount" />
            </el-tab-pane>
            <el-tab-pane label="群组管理" name="groups">
              <GroupManagement :account="authStore.currentAccount" />
            </el-tab-pane>
            <el-tab-pane label="自动回复" name="auto-reply">
              <AutoReply :account="authStore.currentAccount" />
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-main>
    </el-container>

    <!-- 登录对话框 -->
    <el-dialog v-model="showLoginDialog" title="账号登录" width="600px" :close-on-click-modal="false">
      <LoginForm @login-success="handleLoginSuccess" @close="showLoginDialog = false" />
    </el-dialog>

    <!-- 账号管理对话框 -->
    <el-dialog v-model="showAccountManager" title="账号管理" width="800px">
      <AccountManager @close="showAccountManager = false" />
    </el-dialog>

    <!-- 账号详细管理模态框 -->
    <AccountManagementModal
      v-model="showAccountManagement"
      :account="selectedAccountForManagement"
      @account-updated="handleAccountUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Plus, MoreFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

// 组件导入
import LoginForm from '@/components/LoginForm.vue'
import FriendManagement from '@/components/FriendManagement.vue'
import ChatInterface from '@/components/ChatInterface.vue'
import GroupManagement from '@/components/GroupManagement.vue'
import AutoReply from '@/components/AutoReply.vue'
import AccountManager from '@/components/AccountManager.vue'
import AccountManagementModal from '@/components/AccountManagementModal.vue'

// Store
const authStore = useAuthStore()

// 响应式数据
const showLoginDialog = ref(false)
const showAccountManager = ref(false)
const showAccountManagement = ref(false)
const selectedAccountForManagement = ref(null)
const activeTab = ref('friends')

// 计算属性
const onlineAccountsCount = computed(() => {
  return authStore.onlineAccounts.length
})

// 方法
const selectAccount = (account) => {
  authStore.setCurrentAccount(account.wxid)
  ElMessage.success(`已切换到账号：${account.nickname}`)
}

const handleLoginSuccess = (accountData) => {
  authStore.addAccount(accountData)
  showLoginDialog.value = false
  ElMessage.success('登录成功！')
}

const openAccountManagement = (account) => {
  selectedAccountForManagement.value = account
  showAccountManagement.value = true
}

const handleAccountUpdated = (updatedAccount) => {
  // 更新store中的账号信息
  authStore.addAccount(updatedAccount)
  ElMessage.success('账号信息已更新')
}

const handleAccountAction = async (command) => {
  const [action, wxid] = command.split('-')
  const account = authStore.accounts.find(acc => acc.wxid === wxid)

  if (!account) return

  if (action === 'logout') {
    try {
      await ElMessageBox.confirm(`确定要退出账号 ${account.nickname} 吗？`, '确认退出', {
        type: 'warning'
      })

      // 更新账号状态为离线
      authStore.updateAccountStatus(wxid, 'offline')
      ElMessage.success('账号已退出登录')
    } catch {
      // 用户取消
    }
  } else if (action === 'delete') {
    try {
      await ElMessageBox.confirm(`确定要删除账号 ${account.nickname} 吗？此操作不可恢复！`, '确认删除', {
        type: 'error'
      })

      authStore.removeAccount(wxid)
      ElMessage.success('账号已删除')
    } catch {
      // 用户取消
    }
  }
}

onMounted(async () => {
  // 获取已登录的账号
  try {
    console.log('开始获取已登录账号...')
    const accounts = await authStore.fetchLoggedAccounts()
    console.log('获取到的账号数据:', accounts)

    if (accounts && accounts.length > 0) {
      ElMessage.success(`成功获取 ${accounts.length} 个已登录账号`)
    } else {
      ElMessage.info('当前没有已登录的账号')
    }
  } catch (error) {
    console.error('获取已登录账号失败:', error)
    ElMessage.error(`获取已登录账号失败: ${error.message || '未知错误'}`)
  }
})
</script>

<style scoped lang="scss">
.dashboard-container {
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: var(--font-family);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%);
    pointer-events: none;
  }
}

.header {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-primary);
  box-shadow: var(--shadow-light);
  position: relative;
  z-index: 10;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--spacing-xl);
    height: 60px;

    .logo {
      display: flex;
      align-items: center;

      .logo-text {
        font-size: var(--font-size-lg);
        font-weight: 500;
        color: var(--text-primary);
      }
    }

    .header-stats {
      display: flex;
      align-items: center;
      gap: var(--spacing-xl);

      .stat-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--bg-secondary);
        border-radius: var(--radius-small);
        border: 1px solid var(--border-primary);

        .stat-label {
          font-size: var(--font-size-base);
          color: var(--text-secondary);
        }

        .stat-value {
          font-weight: 500;
          color: var(--primary-color);
          font-size: var(--font-size-md);
        }
      }
    }
  }
}

.main-container {
  height: calc(100vh - 60px);
}

.accounts-sidebar {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-primary);
  position: relative;
  z-index: 5;

  .sidebar-header {
    padding: var(--spacing-lg) var(--spacing-xl);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
    backdrop-filter: blur(10px);

    h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: var(--font-size-md);
      font-weight: 500;
    }
  }

  .accounts-list {
    padding: var(--spacing-sm) var(--spacing-md);
    height: calc(100% - 65px);
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--border-secondary);
      border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: var(--border-light);
    }
  }
}

.empty-accounts {
  padding: 60px 20px;
  text-align: center;

  .el-empty {
    :deep(.el-empty__description) {
      color: #8a8a8a;
      font-size: 13px;
    }
  }
}

.account-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  background: var(--bg-secondary);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-small);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: var(--spacing-md);
  border: 1px solid var(--border-primary);

  &:hover {
    background: var(--bg-primary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-medium);
    border-color: var(--border-secondary);
  }

  &.active {
    background: var(--primary-light);
    border-color: var(--primary-border);
    box-shadow: var(--shadow-card);
  }

  .account-info {
    flex: 1;
    min-width: 0;

    .nickname {
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--font-size-base);
      line-height: 1.4;
    }

    .account-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: var(--spacing-xs);

      .account-wxid,
      .account-device {
        font-size: var(--font-size-xs);
        color: var(--text-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.3;
      }
    }

    .status {
      display: flex;
      align-items: center;
    }
  }

  .account-actions {
    flex-shrink: 0;
  }
}

.main-content {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  padding: 0;
  overflow: hidden;
  position: relative;
}

.welcome-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.account-tabs {
  height: 100%;
  padding: 0 var(--spacing-xl);

  :deep(.el-tabs__header) {
    margin: 0;
    background: transparent;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0;
  }

  :deep(.el-tabs__nav) {
    border: none;
  }

  :deep(.el-tabs__item) {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-weight: 500;
    padding: 0 var(--spacing-lg);
    margin-right: var(--spacing-md);
    border-radius: var(--radius-small);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      color: var(--primary-color);
      background: var(--primary-light);
    }

    &.is-active {
      color: var(--primary-color);
      background: var(--primary-light);
      border-bottom: 2px solid var(--primary-color);
    }
  }

  :deep(.el-tabs__active-bar) {
    background-color: var(--primary-color);
  }

  :deep(.el-tabs__content) {
    height: calc(100% - 45px);
    overflow: hidden;
    padding: 0;
  }

  :deep(.el-tab-pane) {
    height: 100%;
    overflow-y: auto;
    padding: var(--spacing-xl) 0;
    background: var(--bg-primary);
  }
}
</style>
