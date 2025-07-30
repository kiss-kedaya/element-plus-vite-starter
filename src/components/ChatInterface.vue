<template>
  <div class="chat-interface">
    <!-- 聊天会话列表 -->
    <div class="chat-sessions">
      <div class="sessions-header">
        <h3>聊天会话</h3>
        <el-button type="primary" size="small" @click="refreshSessions">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
      
      <div class="sessions-list">
        <div v-if="sessions.length === 0" class="empty-sessions">
          <el-empty description="暂无聊天会话" :image-size="80" />
        </div>
        
        <div v-for="session in sessions" :key="session.id" 
             class="session-item"
             :class="{ active: currentSession?.id === session.id }"
             @click="selectSession(session)">
          <el-avatar :src="session.avatar" :size="40">
            {{ session.name.charAt(0) }}
          </el-avatar>
          <div class="session-info">
            <div class="session-name">{{ session.name }}</div>
            <div class="last-message">{{ session.lastMessage || '暂无消息' }}</div>
          </div>
          <div class="session-meta">
            <div class="time">{{ formatTime(session.lastTime) }}</div>
            <el-badge v-if="session.unreadCount > 0" :value="session.unreadCount" class="unread-badge" />
          </div>
        </div>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="chat-area">
      <div v-if="!currentSession" class="no-session">
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
            <el-avatar :src="currentSession.avatar" :size="32">
              {{ currentSession.name.charAt(0) }}
            </el-avatar>
            <div class="chat-title">
              <div class="name">{{ currentSession.name }}</div>
              <div class="status">{{ currentSession.type === 'group' ? '群聊' : '私聊' }}</div>
            </div>
          </div>
          <div class="chat-actions">
            <el-button type="text" @click="clearMessages">
              <el-icon><Delete /></el-icon>
              清空消息
            </el-button>
          </div>
        </div>
        
        <!-- 消息列表 -->
        <div class="messages-container" ref="messagesContainer">
          <div class="messages-list">
            <div v-for="message in currentMessages" :key="message.id" class="message-item">
              <div class="message-time" v-if="showMessageTime(message)">
                {{ formatMessageTime(message.timestamp) }}
              </div>
              
              <div class="message-content" :class="{ 'is-self': message.isSelf }">
                <el-avatar v-if="!message.isSelf" :src="message.avatar" :size="32">
                  {{ message.sender.charAt(0) }}
                </el-avatar>
                
                <div class="message-bubble">
                  <div class="sender-name" v-if="!message.isSelf && currentSession.type === 'group'">
                    {{ message.sender }}
                  </div>
                  
                  <div class="message-text" v-if="message.type === 'text'">
                    {{ message.content }}
                  </div>
                  
                  <div class="message-image" v-else-if="message.type === 'image'">
                    <el-image :src="message.content" fit="cover" style="max-width: 200px; max-height: 200px;" />
                  </div>
                  
                  <div class="message-status" v-if="message.isSelf">
                    <el-icon v-if="message.status === 'sending'" class="is-loading"><Loading /></el-icon>
                    <el-icon v-else-if="message.status === 'sent'" color="#67c23a"><Select /></el-icon>
                    <el-icon v-else-if="message.status === 'failed'" color="#f56c6c"><Close /></el-icon>
                  </div>
                </div>
                
                <el-avatar v-if="message.isSelf" :src="account.avatar" :size="32">
                  {{ account.nickname.charAt(0) }}
                </el-avatar>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 输入区域 -->
        <div class="input-area">
          <div class="input-toolbar">
            <el-button link @click="$refs.imageInput.click()">
              <el-icon><Picture /></el-icon>
              图片
            </el-button>
            <el-button link @click="pasteImage">
              <el-icon><DocumentCopy /></el-icon>
              粘贴
            </el-button>
          </div>
          
          <div class="input-container">
            <el-input v-model="messageInput" 
                     type="textarea" 
                     :rows="3" 
                     placeholder="输入消息内容..."
                     @keydown.ctrl.enter="sendMessage"
                     @paste="handlePaste" />
            <div class="input-actions">
              <span class="input-tip">Ctrl+Enter 发送</span>
              <el-button type="primary" :loading="sendLoading" @click="sendMessage">
                发送
              </el-button>
            </div>
          </div>
          
          <input ref="imageInput" type="file" accept="image/*" style="display: none" @change="handleImageSelect" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Loading, Select, Close, Picture, DocumentCopy } from '@element-plus/icons-vue'
import { chatApi } from '@/api/chat'
import type { SendTextMessageRequest, SendImageMessageRequest } from '@/types/chat'

// Props
const props = defineProps<{
  account: any
}>()

// 响应式数据
const currentSession = ref(null)
const messageInput = ref('')
const sendLoading = ref(false)
const messagesContainer = ref(null)

// 会话数据
const sessions = ref([])

// 消息数据
const messages = ref({})

// 计算属性
const currentMessages = computed(() => {
  if (!currentSession.value) return []
  return messages.value[currentSession.value.id] || []
})

// 方法
const selectSession = (session) => {
  currentSession.value = session
  session.unreadCount = 0
  nextTick(() => {
    scrollToBottom()
  })
}

const refreshSessions = async () => {
  try {
    // 模拟刷新会话列表
    await new Promise(resolve => setTimeout(resolve, 1000))
    ElMessage.success('会话列表已刷新')
  } catch (error) {
    ElMessage.error('刷新失败')
  }
}

const sendMessage = async () => {
  if (!messageInput.value.trim() || !currentSession.value) return

  const message = {
    id: `msg_${Date.now()}`,
    sender: props.account?.nickname || '我',
    content: messageInput.value.trim(),
    type: 'text',
    timestamp: new Date(),
    isSelf: true,
    status: 'sending'
  }

  // 添加到消息列表
  if (!messages.value[currentSession.value.id]) {
    messages.value[currentSession.value.id] = []
  }
  messages.value[currentSession.value.id].push(message)

  // 更新会话最后消息
  currentSession.value.lastMessage = message.content
  currentSession.value.lastTime = message.timestamp

  messageInput.value = ''
  sendLoading.value = true

  nextTick(() => {
    scrollToBottom()
  })

  try {
    const params: SendTextMessageRequest = {
      Wxid: props.account.wxid,
      ToWxid: currentSession.value.id,
      Content: message.content,
      Type: 1,
      At: ''
    }

    const response = await chatApi.sendTextMessage(params)

    if (response.Success) {
      message.status = 'sent'
      ElMessage.success('消息发送成功')
    } else {
      throw new Error(response.Message || '发送失败')
    }
  } catch (error: any) {
    message.status = 'failed'
    ElMessage.error(error.message || '消息发送失败')
    console.error('发送消息失败:', error)
  } finally {
    sendLoading.value = false
  }
}

const handleImageSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    sendImageMessage(file)
  }
}

const handlePaste = (event) => {
  const items = event.clipboardData?.items
  if (items) {
    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile()
        if (file) {
          event.preventDefault()
          sendImageMessage(file)
        }
      }
    }
  }
}

const pasteImage = async () => {
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const clipboardItem of clipboardItems) {
      for (const type of clipboardItem.types) {
        if (type.startsWith('image/')) {
          const blob = await clipboardItem.getType(type)
          sendImageMessage(blob)
          return
        }
      }
    }
    ElMessage.warning('剪贴板中没有图片')
  } catch (error) {
    ElMessage.error('读取剪贴板失败')
  }
}

const sendImageMessage = async (file) => {
  if (!currentSession.value) return

  // 创建图片URL
  const imageUrl = URL.createObjectURL(file)

  const message = {
    id: `img_${Date.now()}`,
    sender: props.account?.nickname || '我',
    content: imageUrl,
    type: 'image',
    timestamp: new Date(),
    isSelf: true,
    status: 'sending'
  }

  if (!messages.value[currentSession.value.id]) {
    messages.value[currentSession.value.id] = []
  }
  messages.value[currentSession.value.id].push(message)

  currentSession.value.lastMessage = '[图片]'
  currentSession.value.lastTime = message.timestamp

  nextTick(() => {
    scrollToBottom()
  })

  try {
    // 模拟上传图片
    await new Promise(resolve => setTimeout(resolve, 2000))
    message.status = 'sent'
    ElMessage.success('图片发送成功')
  } catch (error) {
    message.status = 'failed'
    ElMessage.error('图片发送失败')
  }
}

const clearMessages = async () => {
  if (!currentSession.value) return

  try {
    await ElMessageBox.confirm('确定要清空当前会话的所有消息吗？', '确认清空', {
      type: 'warning'
    })

    messages.value[currentSession.value.id] = []
    currentSession.value.lastMessage = ''
    ElMessage.success('消息已清空')
  } catch {
    // 用户取消
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (time) => {
  const now = new Date()
  const diff = now.getTime() - time.getTime()
  
  if (diff < 1000 * 60) return '刚刚'
  if (diff < 1000 * 60 * 60) return `${Math.floor(diff / (1000 * 60))}分钟前`
  if (diff < 1000 * 60 * 60 * 24) return `${Math.floor(diff / (1000 * 60 * 60))}小时前`
  
  return time.toLocaleDateString()
}

const formatMessageTime = (time) => {
  return time.toLocaleString()
}

const showMessageTime = (message) => {
  // 简化：每条消息都显示时间
  return true
}

onMounted(() => {
  if (sessions.value.length > 0) {
    selectSession(sessions.value[0])
  }
})
</script>

<style scoped lang="scss">
.chat-interface {
  height: 100%;
  display: flex;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.chat-sessions {
  width: 300px;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
}

.sessions-header {
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    color: #333;
  }
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
}

.empty-sessions {
  padding: 40px 20px;
  text-align: center;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  border-bottom: 1px solid #f5f5f5;
  
  &:hover {
    background: #f8f9fa;
  }
  
  &.active {
    background: #e3f2fd;
    border-right: 3px solid #409eff;
  }
}

.session-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
  
  .session-name {
    font-weight: 500;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .last-message {
    font-size: 12px;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.session-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  
  .time {
    font-size: 11px;
    color: #999;
  }
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.no-session {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-info {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .chat-title {
    .name {
      font-weight: 500;
      margin-bottom: 2px;
    }
    
    .status {
      font-size: 12px;
      color: #666;
    }
  }
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.message-item {
  margin-bottom: 16px;
}

.message-time {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.message-content {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  
  &.is-self {
    flex-direction: row-reverse;
    
    .message-bubble {
      background: #409eff;
      color: white;
      
      .sender-name {
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }
}

.message-bubble {
  max-width: 60%;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 8px;
  position: relative;
  
  .sender-name {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }
  
  .message-text {
    word-wrap: break-word;
    line-height: 1.4;
  }
  
  .message-image {
    padding: 0;
    
    :deep(.el-image) {
      border-radius: 4px;
    }
  }
}

.message-status {
  margin-left: 4px;
  display: flex;
  align-items: center;
}

.input-area {
  border-top: 1px solid #e9ecef;
  padding: 16px 20px;
}

.input-toolbar {
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
}

.input-container {
  position: relative;
  
  .input-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    
    .input-tip {
      font-size: 12px;
      color: #999;
    }
  }
}
</style>
