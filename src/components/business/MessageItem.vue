<script setup lang="ts">
// 暂时注释掉 LazyImage 导入
// import LazyImage from '@/components/common/LazyImage.vue'
import type { ChatMessage } from '@/types/chat'
import { Document, Picture, RefreshRight, Loading } from '@element-plus/icons-vue'
import EmojiImage from '@/components/common/EmojiImage.vue'
import ImageMessage from '@/components/common/ImageMessage.vue'
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'

interface Props {
  message: ChatMessage
  showTime?: boolean
  avatar?: string
  avatarText?: string
  myAvatar?: string
  myAvatarText?: string
}

interface Emits {
  (e: 'retry', message: ChatMessage): void
  (e: 'contextmenu', event: MouseEvent, message: ChatMessage): void
}

const props = withDefaults(defineProps<Props>(), {
  showTime: false,
  avatar: '',
  avatarText: '',
  myAvatar: '',
  myAvatarText: '我',
})

const chatStore = useChatStore()

// 安全地解析消息ID为数字
const getMsgId = computed(() => {
  const id = props.message.id
  if (!id) return 0

  // 如果已经是数字，直接返回
  if (typeof id === 'number') return id

  // 如果是字符串，尝试解析
  const parsed = parseInt(id.toString(), 10)
  return isNaN(parsed) ? 0 : parsed
})

const emit = defineEmits<Emits>()

const messageClass = computed(() => {
  const classes = []

  if (props.message.fromMe) {
    classes.push('message-from-me')
  }
  else {
    classes.push('message-from-other')
  }

  if (props.message.type === 'system') {
    classes.push('message-system-type')
  }

  return classes.join(' ')
})

const contentClass = computed(() => {
  const classes = [`message-${props.message.type}`]

  if (props.message.fromMe) {
    classes.push('content-from-me')
  }
  else {
    classes.push('content-from-other')
  }

  if (props.message.status === 'failed') {
    classes.push('content-failed')
  }

  return classes.join(' ')
})

function formatTime(timestamp: Date) {
  try {
    // 确保timestamp是有效的Date对象
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)

    // 检查日期是否有效
    if (Number.isNaN(date.getTime())) {
      return '时间无效'
    }

    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }
  catch (error) {
    console.error('格式化时间失败:', error, timestamp)
    return '时间错误'
  }
}

function formatFileSize(size?: number) {
  if (!size)
    return '未知大小'

  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let fileSize = size

  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024
    index++
  }

  return `${fileSize.toFixed(1)} ${units[index]}`
}

function handleRetry() {
  emit('retry', props.message)
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  emit('contextmenu', event, props.message)
}

// 获取发送者显示名称
function getSenderDisplayName() {
  if (props.message.isGroupMessage && props.message.actualSenderName) {
    // 如果有实际发送者名称，使用它
    return props.message.actualSenderName
  }
  if (props.message.actualSender) {
    // 否则使用actualSender（通常是wxid）
    return props.message.actualSender
  }
  return '未知用户'
}


</script>

<template>
  <div class="message-item" :class="messageClass" @contextmenu="handleContextMenu">
    <!-- 时间显示 -->
    <div v-if="showTime" class="message-time">
      {{ formatTime(message.timestamp) }}
    </div>

    <!-- 系统消息布局 -->
    <div v-if="message.type === 'system'" class="message-wrapper message-system-wrapper">
      <div class="message-content message-system-content">
        <div class="message-system">
          {{ message.content }}
        </div>
      </div>
    </div>

    <!-- 对方消息布局 -->
    <div v-else-if="!message.fromMe" class="message-wrapper message-from-other">
      <!-- 左侧头像 -->
      <div class="message-avatar">
        <el-avatar :src="avatar" :size="32">
          {{ avatarText || getSenderDisplayName().charAt(0) }}
        </el-avatar>
      </div>

      <!-- 消息内容区域 -->
      <div class="message-content-area">
        <!-- 群聊消息发送者信息 -->
        <div v-if="message.isGroupMessage" class="sender-info">
          <div class="sender-name">
            {{ getSenderDisplayName() }}
          </div>
        </div>

        <!-- 消息内容 -->
        <div class="message-content" :class="contentClass">
          <!-- 文本消息 -->
          <div v-if="message.type === 'text'" class="message-text">
            {{ message.content }}
          </div>

          <!-- 图片消息 -->
          <div v-else-if="message.type === 'image'" class="message-image">
            <ImageMessage
              v-if="chatStore.currentSession"
              :msg-id="getMsgId"
              :wxid="chatStore.currentSession.sessionId"
              :to-wxid="message.fromMe ? message.sessionId : chatStore.currentSession.sessionId"
              :aes-key="message.imageAesKey"
              :md5="message.imageMd5"
              :data-len="message.imageDataLen"
              :compress-type="message.imageCompressType"
              :image-data="message.imageData"
              :image-path="message.imagePath"
            />
            <div v-else class="image-placeholder">
              <el-icon class="image-placeholder-icon">
                <Picture />
              </el-icon>
              <span class="image-placeholder-text">图片</span>
            </div>
          </div>

          <!-- 文件消息 -->
          <div v-else-if="message.type === 'file'" class="message-file">
            <div class="file-icon">
              <el-icon>
                <Document />
              </el-icon>
            </div>
            <div class="file-info">
              <div class="file-name">
                {{ message.fileData?.name }}
              </div>
              <div class="file-size">
                {{ formatFileSize(message.fileData?.size) }}
              </div>
            </div>
          </div>

          <!-- 表情消息 -->
          <div v-else-if="message.type === 'emoji'" class="message-emoji">
            <!-- 如果有表情URL，显示表情图片 -->
            <EmojiImage
              v-if="message.emojiUrl || message.emojiThumbUrl"
              :emoji-url="message.emojiUrl"
              :emoji-thumb-url="message.emojiThumbUrl"
              :emoji-extern-url="message.emojiExternUrl"
              :emoji-aes-key="message.emojiAesKey"
              :emoji-md5="message.emojiMd5"
              :emoji-width="message.emojiWidth"
              :emoji-height="message.emojiHeight"
            />
            <!-- 如果没有URL，显示占位符 -->
            <div v-else class="emoji-placeholder">
              <el-icon class="emoji-icon">
                <Picture />
              </el-icon>
              <span class="emoji-text">{{ message.content }}</span>
            </div>
          </div>
        </div>

        <!-- 重试按钮 -->
        <div v-if="message.status === 'failed' && message.canRetry" class="message-retry">
          <el-button type="danger" size="small" :icon="RefreshRight" circle title="重新发送" @click="handleRetry" />
        </div>
      </div>
    </div>

    <!-- 自己消息布局 -->
    <div v-else class="message-wrapper message-from-me">
      <!-- 消息内容区域 -->
      <div class="message-content-area">
        <!-- 消息内容 -->
        <div class="message-content" :class="contentClass">
          <!-- 文本消息 -->
          <div v-if="message.type === 'text'" class="message-text">
            {{ message.content }}
          </div>

          <!-- 图片消息 -->
          <div v-else-if="message.type === 'image'" class="message-image">
            <ImageMessage
              v-if="chatStore.currentSession"
              :msg-id="getMsgId"
              :wxid="chatStore.currentSession.sessionId"
              :to-wxid="message.fromMe ? message.sessionId : chatStore.currentSession.sessionId"
              :aes-key="message.imageAesKey"
              :md5="message.imageMd5"
              :data-len="message.imageDataLen"
              :compress-type="message.imageCompressType"
              :image-data="message.imageData"
              :image-path="message.imagePath"
            />
            <div v-else class="image-placeholder">
              <el-icon class="image-placeholder-icon">
                <Picture />
              </el-icon>
              <span class="image-placeholder-text">图片</span>
            </div>
          </div>

          <!-- 文件消息 -->
          <div v-else-if="message.type === 'file'" class="message-file">
            <div class="file-icon">
              <el-icon>
                <Document />
              </el-icon>
            </div>
            <div class="file-info">
              <div class="file-name">
                {{ message.fileData?.name }}
              </div>
              <div class="file-size">
                {{ formatFileSize(message.fileData?.size) }}
              </div>
            </div>
          </div>

          <!-- 表情消息 -->
          <div v-else-if="message.type === 'emoji'" class="message-emoji">
            <!-- 如果有表情URL，显示表情图片 -->
            <EmojiImage
              v-if="message.emojiUrl || message.emojiThumbUrl"
              :emoji-url="message.emojiUrl"
              :emoji-thumb-url="message.emojiThumbUrl"
              :emoji-extern-url="message.emojiExternUrl"
              :emoji-aes-key="message.emojiAesKey"
              :emoji-md5="message.emojiMd5"
              :emoji-width="message.emojiWidth"
              :emoji-height="message.emojiHeight"
            />
            <!-- 如果没有URL，显示占位符 -->
            <div v-else class="emoji-placeholder">
              <el-icon class="emoji-icon">
                <Picture />
              </el-icon>
              <span class="emoji-text">{{ message.content }}</span>
            </div>
          </div>
        </div>

        <!-- 重试按钮 -->
        <div v-if="message.status === 'failed' && message.canRetry" class="message-retry">
          <el-button type="danger" size="small" :icon="RefreshRight" circle title="重新发送" @click="handleRetry" />
        </div>
      </div>

      <!-- 右侧头像 -->
      <div class="message-avatar">
        <el-avatar :size="32" :src="myAvatar">
          {{ myAvatarText }}
        </el-avatar>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-item {
  margin-bottom: 16px;

  &.message-system-type {
    text-align: center;
    margin: 8px 0;

    .message-wrapper {
      justify-content: center;
    }

    .message-system-content {
      background: transparent;
      border: none;
      box-shadow: none;
      padding: 4px 8px;
      max-width: 80%;
      backdrop-filter: none;
    }

    .message-system {
      background: transparent;
      color: #999999;
      font-size: 12px;
      padding: 0;
      text-align: center;
      line-height: 1.4;
    }
  }
}

.message-time {
  text-align: center;
  font-size: 12px;
  color: #999999;
  margin-bottom: 8px;
}

.message-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.message-from-me {
  justify-content: flex-end;
}

.message-from-other {
  justify-content: flex-start;
}

.message-system-wrapper {
  justify-content: center;
}

.sender-info {
  margin-bottom: 4px;
  padding-left: 8px;

  .sender-name {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }
}

.message-from-me .sender-info {
  padding-left: 0;
  padding-right: 8px;
  text-align: right;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.message-from-me .message-content-area {
  align-items: flex-end;
}

.message-from-other .message-content-area {
  align-items: flex-start;
}

/* 修复row-reverse导致的间距和对齐问题 */
.message-from-me .message-wrapper {
  gap: 8px;
}

.message-from-me .message-wrapper .message-content-area {
  margin-left: 8px;
  margin-right: 0;
}

/* 修复row-reverse导致的发送者信息对齐问题 */
.message-from-me .sender-info {
  text-align: right;
  padding-left: 0;
  padding-right: 8px;
}

.message-content {
  position: relative;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  background: rgba(255, 255, 255, 0.9);
  color: var(--el-text-color-primary);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(10px);
  max-width: 70%;
  min-width: 0; /* 确保可以收缩 */
  box-sizing: border-box; /* 确保padding不会导致溢出 */

  &.content-failed {
    opacity: 0.8;
    border-color: rgba(245, 108, 108, 0.3);
    background: rgba(254, 240, 240, 0.9);
  }
}

.message-text {
  line-height: 1.4;
  font-size: 14px;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap; /* 保持换行符 */
  max-width: 100%;
  overflow: hidden; /* 防止内容溢出 */
}

.message-image {
  .image-content {
    max-width: 200px;
    max-height: 200px;
    border-radius: 4px;
  }

  .image-placeholder,
  .image-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 200px;
    height: 120px;
    background: var(--el-color-info-light-9);
    border: 1px dashed var(--el-color-info-light-5);
    border-radius: 4px;
    color: var(--el-text-color-secondary);

    .image-placeholder-icon,
    .image-error-icon {
      font-size: 32px;
      margin-bottom: 8px;
      color: var(--el-color-info);
    }

    .image-placeholder-text,
    .image-error-text {
      font-size: 12px;
    }
  }

  .image-error {
    background: var(--el-color-danger-light-9);
    border-color: var(--el-color-danger-light-5);

    .image-error-icon {
      color: var(--el-color-danger);
    }
  }
}

.message-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;

  .file-icon {
    font-size: 24px;
    color: var(--el-color-primary);
  }

  .file-info {
    flex: 1;

    .file-name {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .file-size {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
}

.message-emoji {
  .emoji-image {
    .emoji-content {
      border-radius: 4px;
      background: transparent;
    }

    .emoji-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 120px;
      height: 120px;
      background: var(--el-color-info-light-9);
      border-radius: 4px;
      color: var(--el-color-info);

      .is-loading {
        font-size: 24px;
        animation: rotating 2s linear infinite;
      }
    }

    .emoji-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 120px;
      height: 80px;
      background: var(--el-color-warning-light-9);
      border: 1px dashed var(--el-color-warning-light-5);
      border-radius: 4px;
      color: var(--el-text-color-secondary);

      .emoji-error-icon {
        font-size: 24px;
        margin-bottom: 4px;
        color: var(--el-color-warning);
      }

      .emoji-error-text {
        font-size: 12px;
      }
    }
  }

  .emoji-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 80px;
    background: var(--el-color-warning-light-9);
    border: 1px dashed var(--el-color-warning-light-5);
    border-radius: 4px;
    color: var(--el-text-color-secondary);

    .emoji-icon {
      font-size: 24px;
      margin-bottom: 4px;
      color: var(--el-color-warning);
    }

    .emoji-text {
      font-size: 12px;
    }
  }
}

.message-system {
  background: transparent;
  color: #999999;
  font-size: 12px;
  padding: 0;
  text-align: center;
  line-height: 1.4;
}

.message-retry {
  .el-button {
    --el-button-size: 20px;
  }
}

@keyframes rotating {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
