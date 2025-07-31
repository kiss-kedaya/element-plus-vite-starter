<template>
  <div 
    class="message-item" 
    :class="messageClass"
    @contextmenu="handleContextMenu"
  >
    <!-- 时间显示 -->
    <div v-if="showTime" class="message-time">
      {{ formatTime(message.timestamp) }}
    </div>
    
    <div class="message-wrapper">
      <!-- 消息内容 -->
      <div class="message-content-wrapper">
        <div class="message-content" :class="contentClass">
          <!-- 文本消息 -->
          <div v-if="message.type === 'text'" class="message-text">
            {{ message.content }}
          </div>
          
          <!-- 图片消息 -->
          <div v-else-if="message.type === 'image'" class="message-image">
            <el-image
              :src="message.imageData"
              fit="cover"
              :preview-src-list="[message.imageData]"
              class="image-content"
            />
          </div>
          
          <!-- 文件消息 -->
          <div v-else-if="message.type === 'file'" class="message-file">
            <div class="file-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="file-info">
              <div class="file-name">{{ message.fileData?.name }}</div>
              <div class="file-size">{{ formatFileSize(message.fileData?.size) }}</div>
            </div>
          </div>
          
          <!-- 系统消息 -->
          <div v-else-if="message.type === 'system'" class="message-system">
            {{ message.content }}
          </div>
        </div>
        
        <!-- 重试按钮 -->
        <div v-if="message.status === 'failed' && message.canRetry" class="message-retry">
          <el-button
            type="danger"
            size="small"
            :icon="RefreshRight"
            circle
            @click="handleRetry"
            title="重新发送"
          />
        </div>
      </div>
      
      <!-- 我的头像 -->
      <div v-if="message.fromMe" class="message-avatar">
        <el-avatar :size="32" :src="myAvatar">
          {{ myAvatarText }}
        </el-avatar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Document, RefreshRight } from '@element-plus/icons-vue'
// 暂时注释掉 LazyImage 导入
// import LazyImage from '@/components/common/LazyImage.vue'
import type { ChatMessage } from '@/types/chat'

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
  myAvatarText: '我'
})

const emit = defineEmits<Emits>()

const messageClass = computed(() => {
  const classes = []
  
  if (props.message.fromMe) {
    classes.push('message-from-me')
  } else {
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
  } else {
    classes.push('content-from-other')
  }
  
  if (props.message.status === 'failed') {
    classes.push('content-failed')
  }
  
  return classes.join(' ')
})

const formatTime = (timestamp: Date) => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}

const formatFileSize = (size?: number) => {
  if (!size) return '未知大小'
  
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let fileSize = size
  
  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024
    index++
  }
  
  return `${fileSize.toFixed(1)} ${units[index]}`
}

const handleRetry = () => {
  emit('retry', props.message)
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  emit('contextmenu', event, props.message)
}

// 暂时注释掉图片预览方法
// const handleImagePreview = (src: string) => {
//   // 图片预览逻辑，可以使用 Element Plus 的图片预览
//   // 或者自定义预览组件
//   console.log('预览图片:', src)
// }
</script>

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
  align-items: flex-end;
  gap: 8px;
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
