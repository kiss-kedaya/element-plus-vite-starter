<template>
  <div class="emoji-image-wrapper">


    <div v-if="loading" class="emoji-loading">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <div style="font-size: 10px; margin-top: 4px;">加载中...</div>
    </div>
    <div v-else-if="error" class="emoji-error">
      <el-icon class="emoji-error-icon">
        <Picture />
      </el-icon>
      <span class="emoji-error-text">[表情]</span>
      <div style="font-size: 10px; margin-top: 4px;">加载失败</div>
    </div>
    <div v-else-if="blobUrl" class="emoji-success">
      <img
        :src="blobUrl"
        :style="imageStyle"
        class="emoji-content"
        @click="handlePreview"
        @load="handleImageLoad"
        @error="handleImageError"
        alt="表情"
      />
    </div>
    <div v-else class="emoji-unknown">
      <div style="font-size: 12px; color: #999;">未知状态</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Loading, Picture } from '@element-plus/icons-vue'
import { downloadCdnImage } from '@/api/chat'
import { useChatStore } from '@/stores/chat'

interface Props {
  emojiUrl?: string
  emojiThumbUrl?: string
  emojiExternUrl?: string
  emojiAesKey?: string
  emojiMd5?: string
  emojiWidth?: number
  emojiHeight?: number
  maxWidth?: number
  maxHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: 200,
  maxHeight: 200
})

const chatStore = useChatStore()

const loading = ref(true)
const error = ref(false)
const blobUrl = ref('')

// 计算图片样式
const imageStyle = computed(() => {
  const maxWidth = props.maxWidth
  const maxHeight = props.maxHeight
  const minWidth = 60
  const minHeight = 60

  let width = props.emojiWidth || 120
  let height = props.emojiHeight || 120

  // 如果尺寸过大，按比例缩放
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.floor(width * ratio)
    height = Math.floor(height * ratio)
  }

  // 如果尺寸过小，设置最小值
  if (width < minWidth) width = minWidth
  if (height < minHeight) height = minHeight

  return {
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: `${maxWidth}px`,
    maxHeight: `${maxHeight}px`,
    borderRadius: '4px',
    cursor: 'pointer'
  }
})

// 尝试多种方法加载图片
const tryLoadWithFetch = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    mode: 'cors',
    ...options
  })

  if (response.ok) {
    const blob = await response.blob()

    // 检查blob是否为有效图片
    if (blob.size === 0) {
      throw new Error('Blob大小为0')
    }

    // 如果没有正确的MIME类型，尝试根据内容判断
    if (!blob.type || !blob.type.startsWith('image/')) {
      // 但仍然尝试创建URL，有些服务器不返回正确的Content-Type
    }

    return URL.createObjectURL(blob)
  }
  throw new Error(`HTTP ${response.status}`)
}

const tryLoadWithImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(url)
    img.onerror = reject
    img.src = url
  })
}

// 使用微信API解密表情图片
const tryDecryptWithWeChatAPI = async (url: string): Promise<string | null> => {
  if (!props.emojiAesKey || !props.emojiMd5) {
    return null
  }

  try {

    // 从URL中提取FileNo参数
    const fileNoMatch = url.match(/filekey=([^&]+)/)
    if (!fileNoMatch) {
      return null
    }

    const response = await downloadCdnImage({
      Wxid: chatStore.currentSession?.id || '',
      FileAesKey: props.emojiAesKey,
      FileNo: fileNoMatch[1]
    })

    if (response.data && response.data.length > 0) {
      // 假设API返回base64编码的图片数据
      const base64Data = response.data
      const imageUrl = `data:image/png;base64,${base64Data}`
      return imageUrl
    }

    return null
  } catch (error) {
    return null
  }
}

// 加载表情图片
const loadEmojiImage = async () => {
  // 根据你的要求：优先使用cdnurl，然后是encrypturl
  // emojiUrl 通常是 cdnurl，emojiThumbUrl 通常是 encrypturl
  const primaryUrl = props.emojiUrl || props.emojiThumbUrl  // 优先cdnurl
  const fallbackUrl = props.emojiThumbUrl || props.emojiUrl  // 备用encrypturl

  if (!primaryUrl) {
    error.value = true
    loading.value = false
    return
  }



  // 定义多种加载策略，包括备用URL
  const urlsToTry = [primaryUrl]
  if (fallbackUrl && fallbackUrl !== primaryUrl) {
    urlsToTry.push(fallbackUrl)
  }
  // 添加外部URL作为第三选择
  if (props.emojiExternUrl && props.emojiExternUrl !== primaryUrl && props.emojiExternUrl !== fallbackUrl) {
    urlsToTry.push(props.emojiExternUrl)
  }

  // 对每个URL尝试多种加载方法
  for (const currentUrl of urlsToTry) {

    const strategies = [
      // 策略1: 直接使用原始URL（最简单的方法）
      () => tryLoadWithImage(currentUrl),

      // 策略2: 带微信Referer的fetch
      () => tryLoadWithFetch(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://wx.qq.com/'
        }
      }),

      // 策略3: 普通fetch
      () => tryLoadWithFetch(currentUrl),

      // 策略4: 使用微信API解密（如果有AES密钥）
      () => tryDecryptWithWeChatAPI(currentUrl),

      // 策略5: 无跨域限制的fetch，直接返回原URL
      () => Promise.resolve(currentUrl)
    ]

    // 依次尝试各种策略
    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = await strategies[i]()
        // 跳过null结果
        if (result === null) {
          continue
        }
        blobUrl.value = result
        loading.value = false
        error.value = false

        return
      } catch (err) {
        // 静默处理失败，继续尝试下一个策略
      }
    }
  }

  // 所有策略都失败
  console.error('所有加载策略都失败了')
  error.value = true
  loading.value = false
}

// 预览图片
const handlePreview = () => {
  if (props.emojiUrl && props.emojiUrl !== blobUrl.value) {
    // 如果有高清图片URL，打开预览
    window.open(props.emojiUrl, '_blank')
  }
}

// 图片加载成功
const handleImageLoad = () => {
  // 图片加载成功，无需额外处理
}

// 图片加载失败
const handleImageError = async (event: Event) => {
  // 如果是blob URL失败，尝试使用原始URL
  if (blobUrl.value && blobUrl.value.startsWith('blob:')) {
    const originalUrl = props.emojiThumbUrl || props.emojiUrl
    if (originalUrl) {
      // 清理旧的blob URL
      URL.revokeObjectURL(blobUrl.value)
      // 尝试直接使用原始URL
      blobUrl.value = originalUrl
      return // 不设置error，让它再试一次
    }
  }

  error.value = true
}

onMounted(() => {
  loadEmojiImage()
})

onUnmounted(() => {
  // 清理blob URL
  if (blobUrl.value && blobUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl.value)
  }
})
</script>

<style lang="scss" scoped>
.emoji-image-wrapper {
  display: inline-block;
}

.emoji-loading {
  display: flex;
  flex-direction: column;
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

.emoji-content {
  background: transparent;
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
