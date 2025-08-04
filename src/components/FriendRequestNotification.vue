<template>
  <div class="friend-request-notification">
    <!-- 好友请求通知列表 -->
    <el-drawer
      v-model="showDrawer"
      title="好友请求"
      direction="rtl"
      size="400px"
      :before-close="handleClose"
    >
      <div class="request-list">
        <div v-if="friendRequests.length === 0" class="empty-state">
          <el-empty description="暂无好友请求" />
        </div>
        
        <div v-else>
          <div
            v-for="request in friendRequests"
            :key="request.id"
            class="request-item"
          >
            <div class="request-header">
              <el-avatar :src="request.avatar" :size="40">
                {{ request.nickname.charAt(0) }}
              </el-avatar>
              <div class="request-info">
                <div class="nickname">{{ request.nickname }}</div>
                <div class="alias" v-if="request.alias">微信号：{{ request.alias }}</div>
                <div class="time">{{ formatTime(request.timestamp) }}</div>
              </div>
            </div>
            
            <div class="request-content" v-if="request.content">
              <div class="content-label">验证消息：</div>
              <p>{{ request.content }}</p>
            </div>
            
            <div class="request-actions">
              <el-button
                type="success"
                size="small"
                @click="acceptRequest(request)"
                :loading="request.accepting"
              >
                同意
              </el-button>
              <el-button
                type="default"
                size="small"
                @click="rejectRequest(request)"
                :loading="request.rejecting"
              >
                拒绝
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 浮动通知按钮 -->
    <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
      <el-button
        type="primary"
        circle
        size="large"
        @click="showDrawer = true"
        class="notification-button"
      >
        <el-icon><User /></el-icon>
      </el-button>
    </el-badge>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { User } from '@element-plus/icons-vue'
import { friendApi } from '@/api/friend'
import { useAuthStore } from '@/stores/auth'
// 使用动态导入避免与其他地方的动态导入冲突

interface FriendRequest {
  id: string
  fromUserName: string
  nickname: string
  alias: string
  content: string
  avatar: string
  ticket: string
  timestamp: Date
  accepting?: boolean
  rejecting?: boolean
}

// 状态
const showDrawer = ref(false)
const friendRequests = ref<FriendRequest[]>([])
const authStore = useAuthStore()

// 计算属性
const unreadCount = computed(() => friendRequests.value.length)

// 方法
const formatTime = (time: Date) => {
  return time.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleClose = () => {
  showDrawer.value = false
}

const acceptRequest = async (request: FriendRequest) => {
  if (!authStore.currentAccount) {
    ElMessage.error('请先选择账号')
    return
  }

  request.accepting = true
  try {
    const response = await friendApi.acceptFriendRequest({
      Wxid: authStore.currentAccount.wxid,
      V1: request.fromUserName,
      V2: request.ticket,
      Scene: 3
    })

    if (response.Success) {
      ElMessage.success('已同意好友请求')
      // 从列表中移除
      const index = friendRequests.value.findIndex(r => r.id === request.id)
      if (index > -1) {
        friendRequests.value.splice(index, 1)
      }
    } else {
      ElMessage.error(response.Message || '同意好友请求失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '同意好友请求失败')
    console.error('同意好友请求失败:', error)
  } finally {
    request.accepting = false
  }
}

const rejectRequest = async (request: FriendRequest) => {
  // 直接从列表中移除（微信没有明确的拒绝接口）
  const index = friendRequests.value.findIndex(r => r.id === request.id)
  if (index > -1) {
    friendRequests.value.splice(index, 1)
    ElMessage.success('已拒绝好友请求')
  }
}

const handleFriendRequest = async (data: any, messageWxid?: string) => {
  console.log('收到好友请求:', data)

  // 检查好友请求是否属于当前账号
  if (messageWxid && authStore.currentAccount?.wxid && messageWxid !== authStore.currentAccount.wxid) {
    console.log(`好友请求属于账号 ${messageWxid}，但当前账号是 ${authStore.currentAccount.wxid}，跳过处理`)
    return
  }

  const request: FriendRequest = {
    id: Date.now().toString() + Math.random(),
    fromUserName: data.data.fromUserName,
    nickname: data.data.fromNickName,
    alias: data.data.alias,
    content: data.data.content,
    avatar: data.data.bigHeadImgUrl || data.data.smallHeadImgUrl || '',
    ticket: data.data.ticket,
    timestamp: data.timestamp || new Date()
  }

  // 检查是否开启了自动同意好友
  if (authStore.currentAccount) {
    try {
      const autoAcceptResponse = await friendApi.getAutoAcceptFriendStatus({
        Wxid: authStore.currentAccount.wxid
      })

      if (autoAcceptResponse.Success && autoAcceptResponse.Data?.enable) {
        // 自动同意好友请求
        console.log('自动同意好友请求:', request.nickname)

        const acceptResponse = await friendApi.acceptFriendRequest({
          Wxid: authStore.currentAccount.wxid,
          V1: request.fromUserName,
          V2: request.ticket,
          Scene: 3
        })

        if (acceptResponse.Success) {
          ElMessage.success(`已自动同意 ${request.nickname} 的好友请求`)
          return // 自动同意成功，不添加到请求列表
        } else {
          console.error('自动同意好友请求失败:', acceptResponse.Message)
        }
      }
    } catch (error) {
      console.error('检查自动同意状态失败:', error)
    }
  }

  // 添加到请求列表（如果没有自动同意或自动同意失败）
  friendRequests.value.unshift(request)

  // 显示通知
  ElMessage.info(`${request.nickname} 请求添加你为好友：${request.content || '无验证消息'}`)
}

// 生命周期
onMounted(async () => {
  try {
    const { webSocketService } = await import('@/services/websocket')
    // 监听好友请求事件
    webSocketService.on('friend_request', handleFriendRequest)
  } catch (error) {
    console.error('初始化好友请求监听失败:', error)
  }
})

onUnmounted(async () => {
  try {
    const { webSocketService } = await import('@/services/websocket')
    // 移除事件监听
    webSocketService.off('friend_request', handleFriendRequest)
  } catch (error) {
    console.error('移除好友请求监听失败:', error)
  }
})
</script>

<style scoped lang="scss">
.friend-request-notification {
  position: fixed;
  bottom: 80px;
  right: 30px;

  .notification-badge {
    .notification-button {
      width: 56px;
      height: 56px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      
      &:hover {
        transform: scale(1.05);
      }
    }
  }
}

.request-list {
  .request-item {
    padding: 16px;
    border-bottom: 1px solid var(--border-light);
    
    &:last-child {
      border-bottom: none;
    }

    .request-header {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;

      .request-info {
        flex: 1;

        .nickname {
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .alias {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .time {
          font-size: 12px;
          color: var(--text-tertiary);
        }
      }
    }

    .request-content {
      margin: 8px 0;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border-radius: var(--radius-small);
      border-left: 3px solid var(--primary-color);

      .content-label {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-bottom: 4px;
        font-weight: 500;
      }

      p {
        margin: 0;
        font-size: 14px;
        color: var(--text-primary);
        font-weight: 500;
      }
    }

    .request-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }
  }
}
</style>
