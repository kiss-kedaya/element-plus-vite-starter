<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useFriendStore } from '@/stores/friend'
import { ElMessage } from 'element-plus'
import { 
  User, 
  ChatDotRound, 
  Picture, 
  Document, 
  Send,
  Plus,
  Setting,
  Search
} from '@element-plus/icons-vue'
import type { ChatSession, ChatMessage } from '@/types/chat'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()
const friendStore = useFriendStore()

const messageInput = ref('')
const messageListRef = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }

  // 加载好友列表和聊天会话
  await loadInitialData()

  // 确保WebSocket连接
  if (authStore.currentAccount) {
    try {
      await chatStore.connectWebSocket(authStore.currentAccount.wxid)
    } catch (error) {
      console.error('WebSocket连接失败:', error)
    }
  }
})

onUnmounted(() => {
  // 组件卸载时断开WebSocket连接
  chatStore.disconnectWebSocket()
})

const loadInitialData = async () => {
  if (authStore.currentAccount) {
    try {
      await friendStore.loadFriends(authStore.currentAccount.wxid)
      // 将好友转换为聊天会话
      const friends = friendStore.currentFriends(authStore.currentAccount.wxid)
      const sessions: ChatSession[] = friends.map(friend => ({
        id: friend.wxid,
        name: friend.remark || friend.nickname,
        avatar: friend.avatar,
        type: 'friend',
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0,
        isOnline: friend.isOnline
      }))
      chatStore.setSessions(sessions)
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }
}

const selectAccount = async (account: any) => {
  const previousAccount = authStore.currentAccount

  // 如果切换到不同的账号，清空聊天相关数据
  if (previousAccount && previousAccount.wxid !== account.wxid) {
    // 清空聊天会话和消息
    chatStore.clearAllData()
    ElMessage.info(`已切换到账号：${account.nickname}，正在加载聊天数据...`)
  }

  authStore.setCurrentAccount(account.wxid)

  // 自动加载新账号的聊天数据
  await loadInitialData()
}

const selectSession = (session: ChatSession) => {
  chatStore.setCurrentSession(session.id)
  scrollToBottom()
}

const sendMessage = async () => {
  if (!messageInput.value.trim() || !authStore.currentAccount || !chatStore.currentSession) {
    return
  }

  const content = messageInput.value.trim()
  messageInput.value = ''

  try {
    await chatStore.sendTextMessage(
      authStore.currentAccount.wxid,
      chatStore.currentSession.id,
      content
    )
    scrollToBottom()
  } catch (error) {
    ElMessage.error('发送消息失败')
    console.error('发送消息失败:', error)
  }
}

const handlePaste = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile()
      if (file) {
        await sendImage(file)
      }
    }
  }
}

const sendImage = async (file: File) => {
  if (!authStore.currentAccount || !chatStore.currentSession) {
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target?.result as string
      await chatStore.sendImageMessage(
        authStore.currentAccount!.wxid,
        chatStore.currentSession!.id,
        imageData
      )
      scrollToBottom()
    }
    reader.readAsDataURL(file)
  } catch (error) {
    ElMessage.error('发送图片失败')
    console.error('发送图片失败:', error)
  }
}

const selectFile = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (file.type.startsWith('image/')) {
      sendImage(file)
    } else {
      // 处理其他文件类型
      ElMessage.info('暂不支持该文件类型')
    }
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const goToFriends = () => {
  router.push('/friends')
}

const logout = () => {
  if (authStore.currentAccount) {
    authStore.removeAccount(authStore.currentAccount.wxid)
  }
  if (!authStore.isLoggedIn) {
    router.push('/')
  }
}
</script>

<template>
  <div class="chat-container">
    <!-- 左侧账号列表 -->
    <div class="account-panel">
      <div class="panel-header">
        <h3>账号列表</h3>
        <el-button type="primary" size="small" @click="router.push('/login')">
          <el-icon><Plus /></el-icon>
          添加账号
        </el-button>
      </div>
      
      <div class="account-list">
        <div 
          v-for="account in authStore.accounts" 
          :key="account.wxid"
          :class="['account-item', { active: authStore.currentAccount?.wxid === account.wxid }]"
          @click="selectAccount(account)"
        >
          <el-avatar :src="account.avatar" :size="40">
            <el-icon><User /></el-icon>
          </el-avatar>
          <div class="account-info">
            <div class="nickname">{{ account.nickname }}</div>
            <div class="status" :class="account.status">
              {{ account.status === 'online' ? '在线' : '离线' }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="panel-footer">
        <el-button @click="goToFriends" link>
          <el-icon><User /></el-icon>
          好友管理
        </el-button>
        <el-button @click="logout" link>
          <el-icon><Setting /></el-icon>
          退出登录
        </el-button>
      </div>
    </div>

    <!-- 中间聊天列表 -->
    <div class="session-panel">
      <div class="panel-header">
        <h3>聊天列表</h3>
        <el-input 
          placeholder="搜索聊天" 
          size="small"
          style="width: 150px;"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
      
      <div class="session-list">
        <div 
          v-for="session in chatStore.sessions" 
          :key="session.id"
          :class="['session-item', { active: chatStore.currentSession?.id === session.id }]"
          @click="selectSession(session)"
        >
          <el-avatar :src="session.avatar" :size="40">
            <el-icon><User /></el-icon>
          </el-avatar>
          <div class="session-info">
            <div class="session-name">{{ session.name }}</div>
            <div class="last-message">{{ session.lastMessage || '暂无消息' }}</div>
          </div>
          <div class="session-meta">
            <div class="time">{{ formatTime(session.lastMessageTime) }}</div>
            <el-badge 
              v-if="session.unreadCount > 0" 
              :value="session.unreadCount" 
              class="unread-badge"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧聊天界面 -->
    <div class="chat-panel">
      <div v-if="!chatStore.currentSession" class="chat-placeholder">
        <el-icon size="64" color="#ccc">
          <ChatDotRound />
        </el-icon>
        <p>选择一个聊天开始对话</p>
      </div>
      
      <div v-else class="chat-content">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <el-avatar :src="chatStore.currentSession.avatar" :size="32">
            <el-icon><User /></el-icon>
          </el-avatar>
          <div class="chat-title">
            <div class="name">{{ chatStore.currentSession.name }}</div>
            <div class="status">{{ chatStore.currentSession.isOnline ? '在线' : '离线' }}</div>
          </div>
        </div>
        
        <!-- 消息列表 -->
        <div ref="messageListRef" class="message-list">
          <div 
            v-for="message in chatStore.currentMessages" 
            :key="message.id"
            :class="['message-item', { 'from-me': message.fromMe }]"
          >
            <div class="message-content">
              <div v-if="message.type === 'text'" class="text-message">
                {{ message.content }}
              </div>
              <div v-else-if="message.type === 'image'" class="image-message">
                <img :src="message.imageData" alt="图片" />
              </div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>
        </div>
        
        <!-- 输入区域 -->
        <div class="input-area">
          <div class="input-toolbar">
            <el-button @click="selectFile" link>
              <el-icon><Picture /></el-icon>
            </el-button>
            <el-button link>
              <el-icon><Document /></el-icon>
            </el-button>
          </div>
          
          <div class="input-box">
            <el-input
              v-model="messageInput"
              type="textarea"
              :rows="3"
              placeholder="输入消息内容，支持粘贴图片..."
              @keydown.ctrl.enter="sendMessage"
              @paste="handlePaste"
            />
            <el-button 
              type="primary" 
              @click="sendMessage"
              :loading="chatStore.isSending"
              class="send-button"
            >
              <el-icon><Send /></el-icon>
              发送
            </el-button>
          </div>
          
          <div class="input-tip">
            按 Ctrl+Enter 发送消息，支持粘贴图片
          </div>
        </div>
      </div>
    </div>
    
    <!-- 隐藏的文件输入 -->
    <input 
      ref="fileInputRef"
      type="file" 
      accept="image/*,*/*"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}

/* 左侧账号面板 */
.account-panel {
  width: 250px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 1rem;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.account-list {
  flex: 1;
  overflow-y: auto;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.account-item:hover {
  background: #f0f0f0;
}

.account-item.active {
  background: #e6f7ff;
  border-right: 3px solid #1890ff;
}

.account-info {
  margin-left: 0.75rem;
  flex: 1;
}

.nickname {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

.status {
  font-size: 0.8rem;
  color: #999;
}

.status.online {
  color: #52c41a;
}

.panel-footer {
  padding: 1rem;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-around;
}

/* 中间会话面板 */
.session-panel {
  width: 300px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.session-list {
  flex: 1;
  overflow-y: auto;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.session-item:hover {
  background: #f0f0f0;
}

.session-item.active {
  background: #e6f7ff;
}

.session-info {
  margin-left: 0.75rem;
  flex: 1;
  min-width: 0;
}

.session-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last-message {
  font-size: 0.8rem;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.time {
  font-size: 0.7rem;
  color: #999;
  margin-bottom: 0.25rem;
}

/* 右侧聊天面板 */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
}

.chat-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
}

.chat-title {
  margin-left: 0.75rem;
}

.chat-title .name {
  font-weight: 500;
  color: #333;
}

.chat-title .status {
  font-size: 0.8rem;
  color: #999;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
}

.message-item {
  margin-bottom: 1rem;
  display: flex;
}

.message-item.from-me {
  justify-content: flex-end;
}

.message-content {
  max-width: 70%;
  position: relative;
}

.text-message {
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  word-wrap: break-word;
}

.message-item.from-me .text-message {
  background: #1890ff;
  color: white;
}

.image-message img {
  max-width: 200px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message-time {
  font-size: 0.7rem;
  color: #999;
  text-align: center;
  margin-top: 0.25rem;
}

.input-area {
  border-top: 1px solid #e8e8e8;
  background: white;
}

.input-toolbar {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.input-box {
  padding: 1rem;
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.input-box .el-textarea {
  flex: 1;
}

.send-button {
  height: 40px;
}

.input-tip {
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: #999;
  text-align: center;
  background: #f8f9fa;
}

@media (max-width: 768px) {
  .account-panel {
    width: 200px;
  }

  .session-panel {
    width: 250px;
  }

  .message-content {
    max-width: 85%;
  }
}
</style>
