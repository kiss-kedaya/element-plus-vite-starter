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
      <el-aside class="accounts-sidebar">
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

          <div v-for="account in authStore.accounts" :key="account?.wxid || 'unknown'"
               class="account-item"
               :class="{ active: authStore.currentAccount?.wxid === account?.wxid }"
               @click="selectAccount(account)">
            <!-- 头像和消息徽章 -->
            <div class="avatar-container">
              <el-badge
                :value="getAccountUnreadCount(account?.wxid)"
                :hidden="getAccountUnreadCount(account?.wxid) === 0"
                :max="99"
                class="account-badge"
              >
                <el-avatar :src="account?.headUrl || account?.avatar" :size="40">
                  {{ account?.nickname?.charAt(0) || '?' }}
                </el-avatar>
              </el-badge>
            </div>
            <div class="account-info">
              <div class="nickname">
                {{ account?.nickname || '未知账号' }}
                <span v-if="account?.alias" class="alias-inline">[{{ account.alias }}]</span>
                <!-- 消息提醒图标 -->
                <el-icon v-if="getAccountUnreadCount(account?.wxid) > 0" class="message-indicator" color="#f56c6c">
                  <ChatDotRound />
                </el-icon>
              </div>
              <div class="account-details">
                <div class="account-wxid">{{ account?.wxid || '' }}</div>
              </div>
              <div class="status">
                <el-tag :type="account?.status === 'online' ? 'primary' : 'danger'" size="small" effect="light">
                  {{ account?.status === 'online' ? '在线' : '离线' }}
                </el-tag>
              </div>
            </div>
            <div class="account-actions">
              <el-button
                type="success"
                size="small"
                @click.stop="reconnectAccount(account.wxid, 'heartbeat')"
                title="开启心跳"
              >
                <el-icon><Connection /></el-icon>
              </el-button>
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
            <el-tab-pane label="文件缓存管理" name="fileCache">
              <PresetFileCacheManager />
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-main>
    </el-container>

    <!-- 登录对话框 -->
    <el-dialog
      v-model="showLoginDialog"
      title="账号登录"
      width="650px"
      top="5vh"
      :close-on-click-modal="false"
      :destroy-on-close="true"
      :modal="true"
      class="login-dialog"
      @close="handleLoginDialogClose"
    >
      <LoginForm
        v-if="showLoginDialog"
        @login-success="handleLoginSuccess"
        @close="handleLoginDialogClose"
      />
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

    <!-- 好友请求通知 -->
    <FriendRequestNotification />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Plus, MoreFilled, Connection, ChatDotRound } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useCrossAccountMessageStore } from '@/stores/crossAccountMessage'
import { useChatStore } from '@/stores/chat'
import { useRoute, useRouter } from 'vue-router'
import { loginApi } from '@/api/auth'
import { accountSwitchManager } from '@/utils/accountSwitchManager'

// 组件导入
import LoginForm from '@/components/LoginForm.vue'
import FriendManagement from '@/components/FriendManagement.vue'
import ChatInterface from '@/components/ChatInterface.vue'
import AccountManager from '@/components/AccountManager.vue'
import AccountManagementModal from '@/components/AccountManagementModal.vue'
import FriendRequestNotification from '@/components/FriendRequestNotification.vue'
import PresetFileCacheManager from '@/components/business/PresetFileCacheManager.vue'

// Store
const authStore = useAuthStore()
const crossAccountMessageStore = useCrossAccountMessageStore()
const chatStore = useChatStore()
const route = useRoute()
const router = useRouter()

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

// 获取账号未读消息计数
const getAccountUnreadCount = (wxid: string | undefined): number => {
  if (!wxid) return 0
  return authStore.getAccountUnreadCount(wxid)
}

// 方法
const selectAccount = async (account: any) => {
  if (!account || !account.wxid) {
    console.error('无效的账号数据:', account)
    return
  }

  try {
    const previousAccount = authStore.currentAccount
    const previousWxid = previousAccount?.wxid || null

    // 使用统一的账号切换管理器
    const result = await accountSwitchManager.switchAccount(account.wxid, previousWxid)

    if (result.success) {
      if (previousWxid && previousWxid !== account.wxid) {
        ElMessage.success(`已切换到账号：${account.nickname}，相关数据已重置`)
      } else {
        ElMessage.success(`已切换到账号：${account.nickname}`)
      }
    } else {
      throw new Error(result.error || '账号切换失败')
    }
  } catch (error) {
    console.error('切换账号时发生错误:', error)
    ElMessage.error('切换账号失败')
  }
}

const handleLoginSuccess = (accountData) => {
  authStore.addAccount(accountData)

  // 延迟关闭对话框，给用户看到成功提示
  setTimeout(() => {
    handleLoginDialogClose()
    ElMessage.success('登录成功！')

    // 刷新页面数据
    nextTick(() => {
      // 这里可以添加刷新逻辑，比如重新加载账号列表等
      console.log('账号列表已更新')
    })
  }, 2000)
}

const handleLoginDialogClose = () => {
  showLoginDialog.value = false
  // 确保组件被完全销毁，清理所有定时器
  console.log('登录对话框关闭，组件将被销毁')
}

// 重连账号（心跳、初始化等）
const reconnectAccount = async (wxid: string, type: string) => {
  let apiUrl = ''
  let buttonText = ''

  switch (type) {
    case 'auto':
      apiUrl = '/Login/LoginTwiceAutoAuth'
      buttonText = '自动重连'
      break
    case 'awaken':
      apiUrl = '/Login/LoginAwaken'
      buttonText = '唤醒登录'
      break
    case 'heartbeat':
      apiUrl = '/Login/AutoHeartBeat'
      buttonText = '开启心跳'
      break
    case 'init':
      apiUrl = '/Login/Newinit'
      buttonText = '重新初始化'
      break
    default:
      ElMessage.error('未知的重连类型')
      return
  }

  try {
    ElMessage.info(`正在执行${buttonText}...`)

    const response = await loginApi.autoHeartBeat(wxid)

    if (response.Success) {
      ElMessage.success(`${buttonText}成功！`)
      // 延迟刷新账号状态
      setTimeout(() => {
        // 这里可以添加刷新账号状态的逻辑
        console.log('账号状态已刷新')
      }, 2000)
    } else {
      ElMessage.error(`${buttonText}失败: ${response.Message}`)
    }
  } catch (error) {
    console.error(`${buttonText}失败:`, error)
    ElMessage.error(`${buttonText}失败: ${error.message}`)
  }
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
      await ElMessageBox.confirm(
        `确定要删除账号 ${account.nickname} 吗？此操作将调用API删除账号，不可恢复！`,
        '确认删除',
        {
          type: 'error',
          confirmButtonText: '确认删除',
          cancelButtonText: '取消'
        }
      )

      try {
        // 调用删除账号API
        const { loginApi } = await import('@/api/auth')
        console.log(`🗑️ 开始删除账号: ${wxid}`)
        const result = await loginApi.deleteAccount(wxid, false)

        if (result.Success) {
          // API调用成功，从本地存储中移除账号
          authStore.removeAccount(wxid)
          ElMessage.success('账号删除成功')
          console.log(`✅ 账号删除成功: ${wxid}`)
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
    }
  }
}

// 监听路由变化，处理tab参数
watch(() => route.query.tab, (newTab) => {
  if (newTab && typeof newTab === 'string') {
    activeTab.value = newTab
  }
}, { immediate: true })

// 监听activeTab变化，同步更新URL
watch(activeTab, (newTab) => {
  // 只有当URL中的tab参数与当前activeTab不一致时才更新
  if (route.query.tab !== newTab) {
    router.push({
      path: route.path,
      query: {
        ...route.query,
        tab: newTab
      }
    })
  }
})

onMounted(async () => {
  // 检查URL参数，如果有tab参数则切换到对应标签
  if (route.query.tab) {
    activeTab.value = route.query.tab as string
  }

  // 初始化跨账号消息监听
  crossAccountMessageStore.initializeCrossAccountMessaging()

  // 获取已登录的账号
  try {
    const accounts = await authStore.fetchLoggedAccounts()

    if (accounts && accounts.length > 0) {
      ElMessage.success(`成功获取 ${accounts.length} 个已登录账号`)
    } else {
      ElMessage.info('当前没有已登录的账号')
    }
  } catch (error: any) {
    console.error('获取已登录账号失败:', error)
    ElMessage.error(`获取已登录账号失败: ${error.message || '未知错误'}`)
  }
})
</script>

<style scoped lang="scss">
.dashboard-container {
  height: 100vh;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  font-family: var(--font-family);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 20% 80%, rgba(0, 122, 255, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(52, 199, 89, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(255, 149, 0, 0.05) 0%, transparent 50%);
    pointer-events: none;
  }
}

.header {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-primary);
  box-shadow: var(--shadow-light);
  position: relative;

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
  width: 380px;
  min-width: 350px;
  max-width: 450px;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-primary);
  position: relative;

  /* 响应式设计 */
  @media (max-width: 1200px) {
    width: 350px;
    min-width: 320px;
  }

  @media (max-width: 768px) {
    width: 300px;
    min-width: 280px;
  }

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
  align-items: flex-start;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-xs);
  background: var(--bg-secondary);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-small);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: var(--spacing-md);
  border: 1px solid var(--border-primary);
  min-height: 80px;

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

  .avatar-container {
    position: relative;
    flex-shrink: 0;
    margin-top: 4px;

    .account-badge {
      :deep(.el-badge__content) {
        background-color: #f56c6c;
        border: 2px solid #fff;
        font-size: 10px;
        min-width: 16px;
        height: 16px;
        line-height: 12px;
        font-weight: 600;
      }
    }
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

      .alias-inline {
        font-weight: 400;
        font-size: var(--font-size-xs);
        color: var(--text-tertiary);
        font-family: 'Courier New', monospace;
        margin-left: 4px;
      }

      .message-indicator {
        margin-left: 8px;
        animation: pulse 2s infinite;

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      }
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
        line-height: 1.3;
        word-break: break-all;
        font-family: 'Courier New', monospace;

        /* 对于较长的微信号，允许换行显示 */
        white-space: normal;
        max-width: 100%;

        /* 如果需要限制高度，可以设置最大行数 */
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }

    .status {
      display: flex;
      align-items: center;
    }
  }

  .account-actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-top: 4px;

    .el-button {
      font-size: var(--font-size-xs);
      padding: 4px 8px;
      height: auto;
      min-height: 24px;
    }
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

/* 登录弹窗样式 */
.login-dialog {
  :deep(.el-dialog) {
    margin: 0 !important;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-dialog__header) {
    padding: 20px 24px 16px;
    border-bottom: 1px solid #ebeef5;
    flex-shrink: 0;
  }

  :deep(.el-dialog__body) {
    padding: 20px 24px;
    flex: 1;
    overflow-y: auto;
    max-height: calc(90vh - 120px);
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px 20px;
    border-top: 1px solid #ebeef5;
    flex-shrink: 0;
  }
}
</style>
