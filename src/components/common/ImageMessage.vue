<template>
  <div class="image-message-wrapper">
    <div v-if="loading" class="image-loading">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <div style="font-size: 10px; margin-top: 4px;">图片加载中...</div>
    </div>
    <div v-else-if="error" class="image-error">
      <el-icon class="image-error-icon">
        <Picture />
      </el-icon>
      <span class="image-error-text">[图片]</span>
      <div style="font-size: 10px; margin-top: 4px;">加载失败</div>
    </div>
    <div v-else-if="imageUrl" class="image-success">
      <el-image
        :src="imageUrl"
        fit="contain"
        :preview-src-list="[imageUrl]"
        class="image-content"
        :hide-on-click-modal="true"
        :lazy="false"
        @load="handleImageLoad"
        @error="handleImageError"
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
    <div v-else class="image-placeholder">
      <el-icon class="image-placeholder-icon">
        <Picture />
      </el-icon>
      <span class="image-placeholder-text">图片</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Loading, Picture } from '@element-plus/icons-vue'
import { downloadImage, downloadCdnImage } from '@/api/chat'
import { useChatStore } from '@/stores/chat'

// 图片缓存 - 使用持久化存储
const CACHE_PREFIX = 'wechat_image_cache_'
const CACHE_EXPIRY_DAYS = 7 // 缓存7天

// 内存缓存（用于快速访问）
const imageCache = new Map<string, string>()

// 持久化缓存工具函数
const getCachedImage = (key: string): string | null => {
  try {
    // 先检查内存缓存
    if (imageCache.has(key)) {
      return imageCache.get(key)!
    }

    // 检查localStorage缓存
    const cacheKey = CACHE_PREFIX + key
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const cacheData = JSON.parse(cached)
      const now = Date.now()

      // 检查是否过期
      if (now - cacheData.timestamp < CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
        // 添加到内存缓存以便快速访问
        imageCache.set(key, cacheData.data)
        return cacheData.data
      } else {
        // 过期了，删除缓存
        localStorage.removeItem(cacheKey)
      }
    }
  } catch (error) {
    console.warn('读取图片缓存失败:', error)
  }
  return null
}

const setCachedImage = (key: string, data: string): void => {
  try {
    // 设置内存缓存
    imageCache.set(key, data)

    // 设置localStorage缓存
    const cacheKey = CACHE_PREFIX + key
    const cacheData = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('保存图片缓存失败:', error)
    // 如果localStorage满了，尝试清理过期缓存
    cleanExpiredCache()
  }
}

const cleanExpiredCache = (): void => {
  try {
    const now = Date.now()
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const cacheData = JSON.parse(cached)
            if (now - cacheData.timestamp >= CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
              keysToRemove.push(key)
            }
          }
        } catch (e) {
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.log('清理了', keysToRemove.length, '个过期的图片缓存')
  } catch (error) {
    console.warn('清理过期缓存失败:', error)
  }
}

interface Props {
  msgId?: number
  wxid?: string
  toWxid?: string
  aesKey?: string
  md5?: string
  dataLen?: number
  compressType?: number
  imageData?: string
  imagePath?: string
  // CDN下载参数
  cdnFileAesKey?: string
  cdnFileNo?: string
}

const props = defineProps<Props>()
const chatStore = useChatStore()

const loading = ref(false)
const error = ref(false)
const imageUrl = ref<string>('')

// 如果已经有图片数据，直接使用
const hasDirectImageData = computed(() => {
  return props.imageData && (
    props.imageData.startsWith('data:image/') || 
    props.imageData.startsWith('http://') || 
    props.imageData.startsWith('https://')
  )
})

onMounted(() => {
  // 定期清理过期缓存（每次组件挂载时检查一次）
  if (Math.random() < 0.1) { // 10%的概率执行清理，避免每次都清理
    cleanExpiredCache()
  }

  if (hasDirectImageData.value) {
    imageUrl.value = props.imageData!
  } else {
    loadImage()
  }
})

// 生成缓存键 - 使用多个参数确保唯一性
const getCacheKey = computed(() => {
  // 优先使用MD5作为唯一标识，因为相同的图片MD5相同
  if (props.md5) {
    return `md5_${props.md5}`
  }
  // 备用方案：使用消息相关信息
  if (props.msgId && props.wxid) {
    return `msg_${props.wxid}_${props.toWxid}_${props.msgId}`
  }
  // 最后备用方案：使用CDN参数
  if (props.cdnFileNo) {
    return `cdn_${props.cdnFileNo}`
  }
  // 如果都没有，使用时间戳（这种情况下不会缓存）
  return `temp_${Date.now()}`
})

// 加载图片
const loadImage = async () => {
  console.log('loadImage 调用，参数检查:', {
    msgId: props.msgId,
    wxid: props.wxid,
    toWxid: props.toWxid,
    dataLen: props.dataLen,
    compressType: props.compressType,
    aesKey: props.aesKey,
    md5: props.md5,
    cdnFileAesKey: props.cdnFileAesKey,
    cdnFileNo: props.cdnFileNo
  })

  if (!props.wxid) {
    console.error('图片加载失败：缺少wxid参数')
    error.value = true
    return
  }

  // 检查缓存
  const cacheKey = getCacheKey.value
  const cachedImage = getCachedImage(cacheKey)
  if (cachedImage) {
    console.log('从缓存加载图片:', cacheKey)
    imageUrl.value = cachedImage
    return
  }

  loading.value = true
  error.value = false

  try {
    let response: any = null

    // 优先使用CDN下载
    if (props.cdnFileAesKey && props.cdnFileNo) {
      console.log('使用CDN下载图片，参数:', {
        Wxid: props.wxid,
        FileAesKey: props.cdnFileAesKey,
        FileNo: props.cdnFileNo
      })

      try {
        response = await downloadCdnImage({
          Wxid: props.wxid,
          FileAesKey: props.cdnFileAesKey,
          FileNo: props.cdnFileNo
        })
        console.log('CDN下载成功:', response)
      } catch (cdnError) {
        console.warn('CDN下载失败，尝试备用方案:', cdnError)
        response = null
      }
    }

    // 如果CDN下载失败或不可用，使用备用的普通下载
    if (!response && props.msgId && props.toWxid && props.dataLen) {
      console.log('使用备用下载方案，参数:', {
        Wxid: props.wxid,
        ToWxid: props.toWxid,
        MsgId: props.msgId,
        DataLen: props.dataLen,
        CompressType: props.compressType || 0
      })

      const downloadParams = {
        Wxid: props.wxid,
        ToWxid: props.toWxid,
        MsgId: props.msgId,
        DataLen: props.dataLen,
        CompressType: props.compressType || 0
      }

      response = await downloadImage(downloadParams)
      console.log('备用下载成功:', response)
    }

    if (!response) {
      throw new Error('所有下载方案都失败了')
    }

    console.log('图片下载API响应:', response)

    // 检查响应格式，处理不同的API响应结构
    let base64Data = ''

    // 处理CDN下载接口的响应格式 {Success: true, Data: {Image: "base64数据"}}
    if (response.Success === true && response.Data && response.Data.Image) {
      base64Data = response.Data.Image
      console.log('使用CDN接口响应格式，Image字段:', base64Data.substring(0, 50) + '...')
    }
    // 处理CDN下载接口的其他可能格式 {Success: true, Data: "base64数据"}
    else if (response.Success === true && response.Data && typeof response.Data === 'string') {
      base64Data = response.Data
      console.log('使用CDN接口响应格式，Data字段:', base64Data.substring(0, 50) + '...')
    }
    // 处理普通下载接口的响应格式
    else if (response.Success && response.Data) {
      if (response.Data.buffer) {
        base64Data = response.Data.buffer
      } else if (response.Data.data && response.Data.data.buffer) {
        base64Data = response.Data.data.buffer
      } else {
        base64Data = response.Data
      }
    }
    // 处理直接返回data字段的情况
    else if (response.data) {
      if (response.data.buffer) {
        base64Data = response.data.buffer
      } else {
        base64Data = response.data
      }
    }
    else {
      console.error('无法解析API响应:', response)
      throw new Error('API返回空数据或格式不正确')
    }

    if (base64Data && base64Data.length > 0) {
      let finalImageUrl = ''
      // 检查是否已经是完整的data URL
      if (base64Data.startsWith('data:image/')) {
        finalImageUrl = base64Data
      } else {
        // 假设API返回base64编码的图片数据
        const mimeType = detectImageMimeType(base64Data)
        finalImageUrl = `data:${mimeType};base64,${base64Data}`
      }

      // 设置图片URL并添加到缓存
      imageUrl.value = finalImageUrl
      setCachedImage(getCacheKey.value, finalImageUrl)

      console.log('图片URL设置成功并已缓存:', finalImageUrl.substring(0, 50) + '...')
    } else {
      throw new Error('API返回空数据')
    }
  } catch (err) {
    console.error('图片下载失败:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

// 检测图片MIME类型
const detectImageMimeType = (base64Data: string): string => {
  // 简单的MIME类型检测，基于base64数据的开头
  if (base64Data.startsWith('/9j/')) return 'image/jpeg'
  if (base64Data.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64Data.startsWith('R0lGOD')) return 'image/gif'
  if (base64Data.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg' // 默认为JPEG
}

// 图片加载成功
const handleImageLoad = () => {
  // 图片加载成功，无需额外处理
}

// 图片加载失败
const handleImageError = () => {
  error.value = true
}
</script>

<style scoped>
.image-message-wrapper {
  display: inline-block;
  max-width: 300px;
  min-width: 100px;
  width: auto;
}

.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  color: #666;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #fef0f0;
  border-radius: 8px;
  color: #f56c6c;
}

.image-error-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.image-error-text {
  font-size: 12px;
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  color: #999;
}

.image-placeholder-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.image-placeholder-text {
  font-size: 12px;
}

.image-success {
  border-radius: 8px;
  overflow: hidden;
  width: auto;
  height: auto;
}

.image-content {
  max-width: 300px;
  max-height: 300px;
  width: auto;
  height: auto;
  border-radius: 8px;
  display: block;
}

.image-content :deep(.el-image__inner) {
  border-radius: 8px;
  width: auto !important;
  height: auto !important;
  max-width: 300px;
  max-height: 300px;
  object-fit: contain;
}
</style>
