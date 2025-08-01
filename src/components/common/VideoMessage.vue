<template>
  <div class="video-message-wrapper">
    <div v-if="loading" class="video-loading">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <div style="font-size: 10px; margin-top: 4px;">视频加载中...</div>
    </div>
    <div v-else-if="error" class="video-error">
      <el-icon class="video-error-icon">
        <VideoPlay />
      </el-icon>
      <span class="video-error-text">[视频]</span>
      <div style="font-size: 10px; margin-top: 4px;">加载失败</div>
    </div>
    <div v-else-if="videoUrl" class="video-success">
      <video
        :src="videoUrl"
        controls
        preload="metadata"
        class="video-content"
        @loadstart="handleVideoLoadStart"
        @loadeddata="handleVideoLoaded"
        @error="handleVideoError"
      >
        您的浏览器不支持视频播放
      </video>
      <div v-if="playLength" class="video-duration">
        {{ formatDuration(playLength) }}
      </div>
    </div>
    <div v-else class="video-placeholder">
      <el-icon class="video-placeholder-icon">
        <VideoPlay />
      </el-icon>
      <span class="video-placeholder-text">视频</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Loading, VideoPlay } from '@element-plus/icons-vue'
import { downloadVideo } from '@/api/chat'
import { useChatStore } from '@/stores/chat'

// 视频缓存 - 使用持久化存储
const CACHE_PREFIX = 'wechat_video_cache_'
const CACHE_EXPIRY_DAYS = 3 // 视频缓存3天（比图片短一些）

interface Props {
  msgId?: number
  wxid?: string
  toWxid?: string
  aesKey?: string
  md5?: string
  newMd5?: string
  dataLen?: number
  compressType?: number
  playLength?: number
  cdnVideoUrl?: string
  fromUserName?: string
  videoData?: string
  videoPath?: string
}

const props = defineProps<Props>()
const chatStore = useChatStore()

const loading = ref(false)
const error = ref(false)
const videoUrl = ref<string>('')

// 如果已经有视频数据，直接使用
const hasDirectVideoData = computed(() => {
  return props.videoData && (
    props.videoData.startsWith('data:video/') || 
    props.videoData.startsWith('http://') || 
    props.videoData.startsWith('https://')
  )
})

// 视频缓存工具函数
const getCachedVideo = (key: string): string | null => {
  try {
    const cacheKey = CACHE_PREFIX + key
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const cacheData = JSON.parse(cached)
      const now = Date.now()
      
      if (now - cacheData.timestamp < CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
        return cacheData.data
      } else {
        localStorage.removeItem(cacheKey)
      }
    }
  } catch (error) {
    console.warn('读取视频缓存失败:', error)
  }
  return null
}

const setCachedVideo = (key: string, data: string): void => {
  try {
    const cacheKey = CACHE_PREFIX + key
    const cacheData = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('保存视频缓存失败:', error)
  }
}

// 生成缓存键
const getCacheKey = computed(() => {
  if (props.md5) {
    return `md5_${props.md5}`
  }
  if (props.newMd5) {
    return `newmd5_${props.newMd5}`
  }
  if (props.msgId && props.wxid) {
    return `msg_${props.wxid}_${props.toWxid}_${props.msgId}`
  }
  return `temp_${Date.now()}`
})

onMounted(() => {
  if (hasDirectVideoData.value) {
    videoUrl.value = props.videoData!
  } else {
    loadVideo()
  }
})

// 加载视频
const loadVideo = async () => {
  console.log('loadVideo 调用，参数检查:', {
    msgId: props.msgId,
    wxid: props.wxid,
    toWxid: props.toWxid,
    dataLen: props.dataLen,
    compressType: props.compressType,
    playLength: props.playLength
  })

  if (!props.wxid) {
    console.error('视频加载失败：缺少wxid参数')
    error.value = true
    return
  }

  // 检查缓存
  const cacheKey = getCacheKey.value
  const cachedVideo = getCachedVideo(cacheKey)
  if (cachedVideo) {
    console.log('从缓存加载视频:', cacheKey)
    videoUrl.value = cachedVideo
    return
  }

  loading.value = true
  error.value = false

  try {
    if (!props.msgId || !props.toWxid || !props.dataLen) {
      throw new Error('缺少必需的下载参数')
    }

    console.log('开始下载视频，参数:', {
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
      CompressType: props.compressType || 0,
      Section: {
        StartPos: 0,
        DataLen: props.dataLen
      }
    }

    const response = await downloadVideo(downloadParams)
    console.log('视频下载API响应:', response)

    // 处理响应数据
    let base64Data = ''
    if (response.Success === true && response.Data && response.Data.data && response.Data.data.buffer) {
      base64Data = response.Data.data.buffer
      console.log('使用视频接口响应格式，buffer字段:', base64Data.substring(0, 50) + '...')
    } else {
      console.error('无法解析视频API响应:', response)
      throw new Error('API返回空数据或格式不正确')
    }

    if (base64Data && base64Data.length > 0) {
      let finalVideoUrl = ''
      if (base64Data.startsWith('data:video/')) {
        finalVideoUrl = base64Data
      } else {
        // 假设API返回base64编码的视频数据
        finalVideoUrl = `data:video/mp4;base64,${base64Data}`
      }

      // 设置视频URL并添加到缓存
      videoUrl.value = finalVideoUrl
      setCachedVideo(getCacheKey.value, finalVideoUrl)

      console.log('视频URL设置成功并已缓存:', finalVideoUrl.substring(0, 50) + '...')
    } else {
      throw new Error('API返回空数据')
    }
  } catch (err) {
    console.error('视频下载失败:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

// 格式化播放时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 视频事件处理
const handleVideoLoadStart = () => {
  console.log('视频开始加载')
}

const handleVideoLoaded = () => {
  console.log('视频加载完成')
}

const handleVideoError = () => {
  console.error('视频播放错误')
  error.value = true
}
</script>

<style scoped>
.video-message-wrapper {
  display: inline-block;
  max-width: 300px;
  min-width: 200px;
  width: auto;
  position: relative;
}

.video-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: #f5f5f5;
  border-radius: 8px;
  color: #666;
}

.video-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: #fef0f0;
  border-radius: 8px;
  color: #f56c6c;
}

.video-error-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.video-error-text {
  font-size: 12px;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: #f5f5f5;
  border-radius: 8px;
  color: #999;
}

.video-placeholder-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.video-placeholder-text {
  font-size: 12px;
}

.video-success {
  border-radius: 8px;
  overflow: hidden;
  width: auto;
  height: auto;
  position: relative;
}

.video-content {
  max-width: 300px;
  max-height: 400px;
  width: auto;
  height: auto;
  border-radius: 8px;
  display: block;
  background: #000;
}

.video-duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  pointer-events: none;
}
</style>
