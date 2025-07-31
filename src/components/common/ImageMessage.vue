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
        fit="cover"
        :preview-src-list="[imageUrl]"
        class="image-content"
        :hide-on-click-modal="true"
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
import { downloadImage } from '@/api/chat'
import { useChatStore } from '@/stores/chat'

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
  if (hasDirectImageData.value) {
    imageUrl.value = props.imageData!
  } else {
    loadImage()
  }
})

// 加载图片
const loadImage = async () => {
  console.log('loadImage 调用，参数检查:', {
    msgId: props.msgId,
    wxid: props.wxid,
    toWxid: props.toWxid,
    dataLen: props.dataLen,
    compressType: props.compressType
  })

  if (!props.msgId || props.msgId === 0 || !props.wxid || !props.toWxid) {
    console.error('图片加载失败：缺少必需参数', {
      msgId: props.msgId,
      wxid: props.wxid,
      toWxid: props.toWxid
    })
    error.value = true
    return
  }

  loading.value = true
  error.value = false

  try {
    console.log('开始下载图片，参数:', {
      Wxid: props.wxid,
      ToWxid: props.toWxid,
      MsgId: props.msgId,
      DataLen: props.dataLen || 0,
      CompressType: props.compressType || 0
    })

    // 构建下载参数
    const downloadParams: any = {
      Wxid: props.wxid,
      ToWxid: props.toWxid,
      MsgId: props.msgId,
      CompressType: props.compressType || 0
    }

    // 只有当DataLen大于0时才添加这个参数
    if (props.dataLen && props.dataLen > 0) {
      downloadParams.DataLen = props.dataLen
    }

    console.log('图片下载参数:', downloadParams)

    // 使用微信API下载图片
    const response = await downloadImage(downloadParams)

    console.log('图片下载API响应:', response)

    // 检查响应格式
    let base64Data = ''
    if (response.Success && response.Data) {
      // 如果API返回的是标准格式，检查Data中的buffer字段
      if (response.Data.buffer) {
        base64Data = response.Data.buffer
      } else if (response.Data.data && response.Data.data.buffer) {
        base64Data = response.Data.data.buffer
      } else {
        base64Data = response.Data
      }
    } else if (response.data) {
      // 如果API返回的是直接数据，检查data中的buffer字段
      if (response.data.buffer) {
        base64Data = response.data.buffer
      } else {
        base64Data = response.data
      }
    } else {
      throw new Error('API返回空数据')
    }

    if (base64Data && base64Data.length > 0) {
      // 检查是否已经是完整的data URL
      if (base64Data.startsWith('data:image/')) {
        imageUrl.value = base64Data
      } else {
        // 假设API返回base64编码的图片数据
        const mimeType = detectImageMimeType(base64Data)
        imageUrl.value = `data:${mimeType};base64,${base64Data}`
      }
      console.log('图片URL设置成功:', imageUrl.value.substring(0, 50) + '...')
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
}

.image-content {
  max-width: 300px;
  max-height: 300px;
  border-radius: 8px;
}

.image-content :deep(.el-image__inner) {
  border-radius: 8px;
}
</style>
