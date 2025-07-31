<script setup lang="ts">
// 暂时注释掉 LazyImage 导入
// import LazyImage from '@/components/common/LazyImage.vue'
import type { ChatMessage } from '@/types/chat'
import { Document, Picture, RefreshRight } from '@element-plus/icons-vue'
import { computed } from 'vue'

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
    if (isNaN(date.getTime())) {
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

// 暂时注释掉图片预览方法
// const handleImagePreview = (src: string) => {
//   // 图片预览逻辑，可以使用 Element Plus 的图片预览
//   // 或者自定义预览组件
//   console.log('预览图片:', src)
// }
</script>

<template>
  <div class="message-item" :class="messageClass" @contextmenu="handleContextMenu">
    <!-- 时间显示 -->
    <div v-if="showTime" class="message-time">
      {{ formatTime(message.timestamp) }}
    </div>

    <div class="message-wrapper">
      <!-- 群聊消息发送者信息 -->
      <div v-if="message.isGroupMessage && !message.fromMe" class="sender-info">
        <div class="sender-name">
          {{ getSenderDisplayName() }}
        </div>
      </div>

      <!-- 消息内容 -->
      <div class="message-content-wrapper">
        <div class="message-content" :class="contentClass">
          <!-- 文本消息 -->
          <div v-if="message.type === 'text'" class="message-text">
            {{ message.content }}
          </div>

          <!-- 图片消息 -->
          <div v-else-if="message.type === 'image'" class="message-image">
            <div v-if="!message.imageData" class="image-placeholder">
              <el-icon class="image-placeholder-icon">
                <Picture />
              </el-icon>
              <span class="image-placeholder-text">图片加载中...</span>
            </div>
            <el-image
              v-else
              :src="message.imageData"
              fit="cover"
              :preview-src-list="[message.imageData]"
              class="image-content"
              :hide-on-click-modal="true"
            >
              <template #error>
                <div class="image-error">
                  <el-icon class="image-error-icon">
                    <Picture />
                  </el-icon>
                  <span class="image-error-text">图片加载失败</span>
                </div>
              </template>
            </el-image>
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
            <div v-if="message.emojiUrl || message.emojiThumbUrl" class="emoji-image">
              <el-image
                :src="message.emojiThumbUrl || message.emojiUrl"
                fit="contain"
                class="emoji-content"
                :preview-src-list="[message.emojiUrl || message.emojiThumbUrl]"
                :hide-on-click-modal="true"
              >
                <template #error>
                  <div class="emoji-error">
                    <el-icon class="emoji-error-icon">
                      <Picture />
                    </el-icon>
                    <span class="emoji-error-text">{{ message.content }}</span>
                  </div>
                </template>
              </el-image>
            </div>
            <!-- 如果没有URL，显示占位符 -->
            <div v-else class="emoji-placeholder">
              <el-icon class="emoji-icon">
                <Picture />
              </el-icon>
              <span class="emoji-text">{{ message.content }}</span>
            </div>
          </div>

          <!-- 系统消息 -->
          <div v-else-if="message.type === 'system'" class="message-system">
            {{ message.content }}
          </div>
        </div>

        <!-- 重试按钮 -->
        <div v-if="message.status === 'failed' && message.canRetry" class="message-retry">
          <el-button type="danger" size="small" :icon="RefreshRight" circle title="重新发送" @click="handleRetry" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-item {
  margin-bottom: 16px;

  &.message-system-type {
    text-align: center;

    .message-wrapper {
      justify-content: center;
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
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.sender-info {
  margin-left: 8px;
  margin-bottom: 2px;

  .sender-name {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }
}

.message-from-me .message-wrapper {
  justify-content: flex-end;
}

.message-from-other .message-wrapper {
  justify-content: flex-start;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  max-width: 70%;
}

.message-content {
  position: relative;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
  background: rgba(255, 255, 255, 0.9);
  color: var(--el-text-color-primary);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(10px);

  &.content-failed {
    opacity: 0.8;
    border-color: rgba(245, 108, 108, 0.3);
    background: rgba(254, 240, 240, 0.9);
  }
}

.message-text {
  line-height: 1.4;
  font-size: 14px;
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
      max-width: 120px;
      max-height: 120px;
      border-radius: 4px;
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
  background: var(--el-color-info-light-8);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.message-retry {
  .el-button {
    --el-button-size: 20px;
  }
}
</style>
