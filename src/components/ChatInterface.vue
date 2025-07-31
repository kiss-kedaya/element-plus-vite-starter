<script setup lang="ts">
import type { ChatSession } from '@/types/chat'
import {
  ChatDotRound,
  Close,
  Delete,
  Document,
  Loading,
  Picture,
  Position,
  Refresh,
  RefreshRight,
  Search,
  Select,
  User,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useFriendStore } from '@/stores/friend'
import { closeWebSocketConnection, createWebSocketConnection } from '@/utils/websocket'

// Props
const props = defineProps<{
  account: any
}>()

// Stores
const chatStore = useChatStore()
const friendStore = useFriendStore()

// 响应式数据
const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()
const searchKeyword = ref('')

// 右键菜单相关
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  message: null as any
})

// 计算属性
const filteredSessions = computed(() => {
  if (!searchKeyword.value)
    return chatStore.sessions
  return chatStore.sessions.filter(session =>
    session.name.toLowerCase().includes(searchKeyword.value.toLowerCase()),
  )
})

// 方法
function selectSession(session: ChatSession) {
  chatStore.setCurrentSession(session.id)
  scrollToBottom()
}

async function loadFriendsAsSessions() {
  if (!props.account?.wxid)
    return

  try {
    await friendStore.loadFriends(props.account.wxid)
    const friends = friendStore.currentFriends(props.account.wxid)

    const sessions: ChatSession[] = friends.map(friend => ({
      id: friend.wxid,
      name: friend.remark || friend.nickname,
      avatar: friend.avatar,
      type: 'friend',
      lastMessage: '',
      lastMessageTime: new Date(),
      unreadCount: 0,
      isOnline: friend.isOnline,
    }))

    chatStore.setSessions(sessions)
    // 好友会话加载完成，不显示提示
  }
  catch (error) {
    ElMessage.error('加载好友列表失败')
    console.error('加载好友失败:', error)
  }
}

async function sendMessage() {
  if (!messageInput.value.trim() || !props.account || !chatStore.currentSession) {
    return
  }

  const content = messageInput.value.trim()
  messageInput.value = ''

  try {
    await chatStore.sendTextMessage(
      props.account.wxid,
      chatStore.currentSession.id,
      content,
    )
    scrollToBottom()
  }
  catch (error) {
    ElMessage.error('发送消息失败')
    console.error('发送消息失败:', error)
  }
}

async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items)
    return

  for (const item of items) {
    if (item.type.includes('image')) {
      const file = item.getAsFile()
      if (file) {
        await sendImage(file)
      }
    }
  }
}

async function sendImage(file: File) {
  if (!props.account || !chatStore.currentSession) {
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target?.result as string
      await chatStore.sendImageMessage(
        props.account!.wxid,
        chatStore.currentSession!.id,
        imageData,
      )
      scrollToBottom()
    }
    reader.readAsDataURL(file)
  }
  catch (error) {
    ElMessage.error('发送图片失败')
    console.error('发送图片失败:', error)
  }
}

function selectFile() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (file.type.startsWith('image/')) {
      sendImage(file)
    }
    else {
      ElMessage.info('暂不支持该文件类型')
    }
  }
}

async function clearCurrentMessages() {
  if (!chatStore.currentSession)
    return

  try {
    await ElMessageBox.confirm('确定要清空当前会话的所有消息吗？', '确认清空', {
      type: 'warning',
    })

    chatStore.clearMessages(chatStore.currentSession.id)
    // 消息清空完成，不显示提示
  }
  catch {
    // 用户取消
  }
}

// 重试发送消息
async function retryMessage(message: any) {
  if (!props.account || !chatStore.currentSession) return

  try {
    await chatStore.retryMessage(
      props.account.wxid,
      chatStore.currentSession.id,
      message.id
    )
  } catch (error) {
    ElMessage.error('重试发送失败')
    console.error('重试发送失败:', error)
  }
}

// 显示右键菜单
function showContextMenu(event: MouseEvent, message: any) {
  event.preventDefault()

  // 只有自己发送的消息才能撤回
  if (!message.fromMe || message.type === 'system') return

  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    message
  }
}

// 隐藏右键菜单
function hideContextMenu() {
  contextMenu.value.visible = false
  contextMenu.value.message = null
}

// 撤回消息
async function recallMessage() {
  if (!props.account || !chatStore.currentSession || !contextMenu.value.message) return

  try {
    await ElMessageBox.confirm('确定要撤回这条消息吗？', '撤回消息', {
      type: 'warning'
    })

    await chatStore.recallMessage(
      props.account.wxid,
      chatStore.currentSession.id,
      contextMenu.value.message.id
    )

    hideContextMenu()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('撤回消息失败')
      console.error('撤回消息失败:', error)
    }
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function formatTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 1000 * 60)
    return '刚刚'
  if (diff < 1000 * 60 * 60)
    return `${Math.floor(diff / (1000 * 60))}分钟前`
  if (diff < 1000 * 60 * 60 * 24)
    return `${Math.floor(diff / (1000 * 60 * 60))}小时前`

  return date.toLocaleDateString()
}

function formatMessageTime(time: Date) {
  return time.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSessionTime(timestamp: Date | string): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    // 今天，显示时间
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (messageDate.getTime() === yesterday.getTime()) {
    // 昨天
    return '昨天'
  } else if (now.getTime() - date.getTime() < 7 * 86400000) {
    // 一周内，显示星期
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[date.getDay()]
  } else {
    // 更早，显示日期
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }
}

function showMessageTime(message: any) {
  // 简化：每条消息都显示时间
  return true
}

// 监听账号变化
watch(() => props.account?.wxid, async (newWxid, oldWxid) => {
  if (oldWxid) {
    closeWebSocketConnection(oldWxid)
  }

  if (newWxid) {
    // 清空之前的数据
    chatStore.clearAllData()

    // 加载新账号的好友作为会话
    await loadFriendsAsSessions()

    // 尝试建立 WebSocket 连接（静默失败）
    try {
      await createWebSocketConnection(newWxid)
      console.log('WebSocket连接成功')
    }
    catch (error) {
      console.warn('WebSocket连接失败，将在模拟模式下运行')
      // 不显示错误消息，因为这在开发环境中是正常的
    }
  }
})

onMounted(async () => {
  if (props.account?.wxid) {
    await loadFriendsAsSessions()

    // 尝试建立 WebSocket 连接（静默失败）
    try {
      await createWebSocketConnection(props.account.wxid)
      console.log('WebSocket连接成功')
    }
    catch (error) {
      console.warn('WebSocket连接失败，将在模拟模式下运行')
      // 不显示错误消息，因为这在开发环境中是正常的
    }
  }

  // 添加全局点击事件监听器来隐藏右键菜单
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  if (props.account?.wxid) {
    closeWebSocketConnection(props.account.wxid)
  }

  // 移除全局点击事件监听器
  document.removeEventListener('click', hideContextMenu)
})
</script>

<template>
  <div class="chat-interface">
    <!-- 聊天会话列表 -->
    <div class="chat-sessions">
      <div class="sessions-header">
        <div class="search-container">
          <el-input v-model="searchKeyword" placeholder="搜索" size="small" class="search-input">
            <template #prefix>
              <el-icon class="search-icon">
                <Search />
              </el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <div class="sessions-list">
        <div v-if="filteredSessions.length === 0" class="empty-sessions">
          <div class="empty-content">
            <el-icon class="empty-icon"><User /></el-icon>
            <p>暂无聊天记录</p>
            <el-button link @click="loadFriendsAsSessions">从好友列表加载</el-button>
          </div>
        </div>

        <div v-for="session in filteredSessions" :key="session.id" class="session-item"
          :class="{ active: chatStore.currentSession?.id === session.id }" @click="selectSession(session)">
          <div class="session-avatar">
            <el-avatar :src="session.avatar" :size="40">
              <span class="avatar-text">{{ session.name.charAt(0) }}</span>
            </el-avatar>
          </div>
          <div class="session-content">
            <div class="session-top">
              <div class="session-name">{{ session.name }}</div>
              <div class="session-time">{{ formatSessionTime(session.lastMessageTime) }}</div>
            </div>
            <div class="session-bottom">
              <div class="session-last-message">{{ session.lastMessage || '暂无消息' }}</div>
              <div v-if="session.unreadCount" class="unread-badge">
                {{ session.unreadCount > 99 ? '99+' : session.unreadCount }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="chat-area">
      <div v-if="!chatStore.currentSession" class="no-session">
        <el-result icon="info" title="请选择一个聊天会话">
          <template #sub-title>
            <p>从左侧选择一个会话开始聊天，或者从好友列表发起新的聊天</p>
          </template>
        </el-result>
      </div>

      <div v-else class="chat-content">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <div class="chat-info">
            <el-avatar :src="chatStore.currentSession.avatar" :size="32" class="chat-avatar">
              <span class="avatar-text">{{ chatStore.currentSession.name.charAt(0) }}</span>
            </el-avatar>
            <div class="chat-title">
              <div class="chat-name">{{ chatStore.currentSession.name }}</div>
            </div>
          </div>
          <div class="chat-actions">
            <el-button link class="action-btn" @click="clearCurrentMessages">
              清空消息
            </el-button>
          </div>
        </div>

        <!-- 消息列表 -->
        <div ref="messagesContainer" class="messages-container">
          <div class="messages-list">
            <!-- 空消息状态 -->
            <div v-if="chatStore.currentMessages.length === 0" class="empty-messages">
              <div class="empty-messages-content">
                <el-icon class="empty-messages-icon"><ChatDotRound /></el-icon>
                <p>暂无聊天记录</p>
                <span>发送一条消息开始聊天吧</span>
              </div>
            </div>

            <div v-for="message in chatStore.currentMessages" :key="message.id" class="message-item">
              <!-- 时间显示 - 居中 -->
              <div v-if="showMessageTime(message)" class="message-time-center">
                {{ formatMessageTime(message.timestamp) }}
              </div>

              <div
                class="message-content"
                :class="{ 'from-me': message.fromMe }"
                @contextmenu="showContextMenu($event, message)"
              >
                <div class="message-bubble">
                  <div v-if="message.type === 'text'" class="message-text">
                    {{ message.content }}
                  </div>

                  <div v-else-if="message.type === 'image'" class="message-image">
                    <img :src="message.imageData" alt="图片">
                  </div>

                  <div v-else-if="message.type === 'system'" class="message-system">
                    {{ message.content }}
                  </div>

                  <!-- 失败重试按钮 -->
                  <div v-if="message.status === 'failed' && message.canRetry" class="message-retry">
                    <el-button
                      type="danger"
                      size="small"
                      :icon="RefreshRight"
                      circle
                      @click="retryMessage(message)"
                      title="重新发送"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右键菜单 -->
        <div
          v-if="contextMenu.visible"
          class="context-menu"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
          @click.stop
        >
          <div class="context-menu-item" @click="recallMessage">
            <el-icon><Delete /></el-icon>
            撤回消息
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area">
          <div class="input-toolbar">
            <el-button link class="toolbar-btn" @click="selectFile">
              <el-icon><Picture /></el-icon>
              图片
            </el-button>
            <el-button link class="toolbar-btn">
              <el-icon><Document /></el-icon>
              文件
            </el-button>
          </div>

          <div class="input-container">
            <div class="input-wrapper">
              <el-input
                v-model="messageInput"
                type="textarea"
                :rows="3"
                placeholder="输入消息内容，支持粘贴图片..."
                class="message-input"
                @keydown.ctrl.enter="sendMessage"
                @paste="handlePaste"
              />
            </div>
            <div class="input-actions">
              <span class="input-tip">Ctrl+Enter 发送</span>
              <el-button
                type="primary"
                :loading="chatStore.isSending"
                @click="sendMessage"
                class="send-btn"
              >
                发送
              </el-button>
            </div>
          </div>

          <input ref="fileInputRef" type="file" accept="image/*,*/*" style="display: none" @change="handleFileSelect">
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-interface {
  height: 100%;
  display: flex;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.chat-sessions {
  width: 300px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
}

.sessions-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}

.search-container {
  position: relative;
}

.search-input {
  width: 100%;

  :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    backdrop-filter: blur(10px);

    &:hover, &.is-focus {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }
  }

  :deep(.el-input__inner) {
    color: #333;
    font-size: 14px;

    &::placeholder {
      color: rgba(0, 0, 0, 0.4);
    }
  }
}

.search-icon {
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
}

.empty-sessions {
  padding: 60px 20px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon {
  font-size: 48px;
  color: rgba(0, 0, 0, 0.2);
}

.empty-content p {
  margin: 0;
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  &.active {
    background: rgba(255, 255, 255, 0.9);
    border-left: 3px solid #409eff;
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
  }
}

.session-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
}

.session-content {
  flex: 1;
  min-width: 0;
}

.session-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.session-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.session-time {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  margin-left: 8px;
  flex-shrink: 0;
}

.session-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-last-message {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.unread-badge {
  background: linear-gradient(135deg, #409eff, #67c23a);
  color: white;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}



.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
}

.no-session {
  flex: 1;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
}

.chat-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04);
}

.chat-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-avatar {
  flex-shrink: 0;
}

.chat-title {
  flex: 1;
}

.chat-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}



.chat-actions {
  display: flex;
  align-items: center;
}

.action-btn {
  color: #409eff;
  font-size: 14px;
  transition: all 0.3s ease;

  &:hover {
    color: #66b1ff;
    transform: translateY(-1px);
  }
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

.messages-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.empty-messages {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.empty-messages-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
}

.empty-messages-icon {
  font-size: 64px;
  color: rgba(0, 0, 0, 0.2);
}

.empty-messages-content p {
  margin: 0;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.6);
  font-weight: 500;
}

.empty-messages-content span {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.4);
}

.message-item {
  margin-bottom: 16px;
  animation: messageSlideIn 0.3s ease-out;
}

// 居中时间显示样式
.message-time-center {
  text-align: center;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  margin: 16px auto 8px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  display: block;
  width: fit-content;
}

.message-content {
  display: flex;
  align-items: flex-end;
  gap: 8px;

  &.from-me {
    justify-content: flex-end;

    .message-bubble {
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      margin-left: 60px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-bottom-right-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }

  &:not(.from-me) {
    justify-content: flex-start;

    .message-bubble {
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      margin-right: 60px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-bottom-left-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  position: relative;
  word-wrap: break-word;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);

  // 移除sender-name样式，不再需要

  .message-text {
    word-wrap: break-word;
    line-height: 1.5;
    font-size: 14px;
  }

  .message-image {
    padding: 0;

    img {
      max-width: 200px;
      border-radius: 8px;
      transition: transform 0.2s ease;

      &:hover {
        transform: scale(1.02);
      }
    }
  }
}

// 系统消息样式
.message-system {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  text-align: center;
  font-style: italic;
  padding: 8px 12px;
}

// 重试按钮样式
.message-retry {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);

  .el-button {
    width: 24px;
    height: 24px;
    min-height: 24px;

    &:hover {
      background-color: #f56c6c;
      border-color: #f56c6c;
    }
  }
}

// 右键菜单样式
.context-menu {
  position: fixed;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  z-index: 9999;
  min-width: 120px;
  overflow: hidden;

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .el-icon {
      font-size: 16px;
      color: #f56c6c;
    }
  }
}

// 移除消息状态样式，不再需要

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 移除spin动画，不再需要

.input-area {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  padding: 12px 20px;
}

.input-toolbar {
  margin-bottom: 12px;
  display: flex;
  gap: 16px;
}

.toolbar-btn {
  color: #409eff;
  font-size: 14px;
  padding: 4px 8px;
  transition: all 0.3s ease;
  border-radius: 6px;

  &:hover {
    color: #66b1ff;
    background: rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
  }
}

.input-container {
  position: relative;
}

.input-wrapper {
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  :deep(.el-textarea) {
    .el-textarea__inner {
      border: none;
      background: transparent;
      resize: none;
      font-size: 14px;
      line-height: 1.4;
      padding: 12px;

      &:focus {
        box-shadow: none;
      }

      &::placeholder {
        color: rgba(0, 0, 0, 0.4);
      }
    }
  }
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.input-tip {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
}

.send-btn {
  background: linear-gradient(135deg, #409eff, #67c23a);
  border: none;
  border-radius: 6px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);

  &:hover {
    background: linear-gradient(135deg, #66b1ff, #85ce61);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.4);
  }
}
</style>
