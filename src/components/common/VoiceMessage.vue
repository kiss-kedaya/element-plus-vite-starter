<template>
  <div class="voice-message-wrapper">
    <div v-if="loading" class="voice-loading">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <div style="font-size: 10px; margin-top: 4px;">语音加载中...</div>
    </div>
    <div v-else-if="error" class="voice-error" @click="downloadVoiceFile">
      <el-icon class="voice-error-icon">
        <Microphone />
      </el-icon>
      <span class="voice-error-text">[语音]</span>
      <div style="font-size: 10px; margin-top: 4px;">
        {{ audioUrl ? (props.voiceFormat === '4' ? 'SILK格式，点击下载' : '播放失败，点击下载') : '加载失败' }}
      </div>
    </div>
    <div v-else class="voice-content" @click="togglePlay">
      <div class="voice-play-button" :class="{ playing: isPlaying }">
        <el-icon class="voice-icon">
          <VideoPlay v-if="!isPlaying" />
          <VideoPause v-else />
        </el-icon>
      </div>
      <div class="voice-info">
        <div class="voice-duration">{{ formatDuration(duration) }}</div>
        <div class="voice-waveform">
          <div v-for="i in 8" :key="i" class="wave-bar"
            :class="{ active: isPlaying && (currentTime * 8 / duration) > i - 1 }"></div>
        </div>
      </div>
      <audio ref="audioRef" :src="audioUrl" @loadeddata="handleAudioLoaded" @timeupdate="handleTimeUpdate"
        @ended="handleAudioEnded" @error="handleAudioError" style="display: none;" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { Loading, Microphone, VideoPlay, VideoPause } from '@element-plus/icons-vue'
import { downloadVoice } from '@/api/chat'
import { useChatStore } from '@/stores/chat'

// 语音缓存 - 使用持久化存储
const CACHE_PREFIX = 'wechat_voice_cache_'
const CACHE_EXPIRY_DAYS = 7 // 语音缓存7天

interface Props {
  msgId?: number
  wxid?: string
  fromUserName?: string
  aesKey?: string
  bufId?: string
  length?: number
  duration?: number
  durationSeconds?: string
  voiceFormat?: string
  voiceUrl?: string
  canDownload?: boolean
  downloadAPI?: string
  downloadParams?: any
}

const props = withDefaults(defineProps<Props>(), {
  canDownload: true,
  downloadAPI: '/api/Tools/DownloadVoice'
})

const loading = ref(false)
const error = ref(false)
const audioUrl = ref('')
const audioRef = ref<HTMLAudioElement>()
const isPlaying = ref(false)
const currentTime = ref(0)
// 防重复请求标记
const isLoadingRequest = ref(false)

// 计算语音时长（秒）
const duration = computed(() => {
  if (props.duration) {
    return Math.ceil(props.duration / 1000) // 毫秒转秒
  }
  if (props.durationSeconds) {
    return Math.ceil(parseFloat(props.durationSeconds))
  }
  return 0
})

// 检查是否有直接的语音数据
const hasDirectAudioData = computed(() => {
  return !!(props.voiceUrl && props.voiceUrl.startsWith('data:audio/'))
})

// 生成缓存键
const getCacheKey = computed(() => {
  if (props.aesKey) {
    return `aeskey_${props.aesKey}`
  }
  if (props.msgId && props.wxid) {
    return `msg_${props.wxid}_${props.fromUserName}_${props.msgId}`
  }
  return `temp_${Date.now()}`
})

// 缓存管理函数
const getCachedVoice = (key: string): string | null => {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (cached) {
      const data = JSON.parse(cached)
      const now = Date.now()
      if (now - data.timestamp < CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
        return data.audioUrl
      } else {
        localStorage.removeItem(`${CACHE_PREFIX}${key}`)
      }
    }
  } catch (error) {
    console.warn('读取语音缓存失败:', error)
  }
  return null
}

const setCachedVoice = (key: string, audioUrl: string) => {
  try {
    const data = {
      audioUrl,
      timestamp: Date.now()
    }
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data))
  } catch (error) {
    console.warn('保存语音缓存失败:', error)
  }
}

onMounted(() => {
  if (hasDirectAudioData.value) {
    audioUrl.value = props.voiceUrl!
  } else {
    loadVoice()
  }
})

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.currentTime = 0
  }
})

// 加载语音
const loadVoice = async () => {
  console.log('loadVoice 调用，参数检查:', {
    msgId: props.msgId,
    wxid: props.wxid,
    fromUserName: props.fromUserName,
    length: props.length,
    bufId: props.bufId,
    canDownload: props.canDownload
  })

  if (!props.wxid || !props.canDownload) {
    console.error('语音加载失败：缺少必要参数或不允许下载')
    error.value = true
    return
  }

  // 防止重复请求
  if (isLoadingRequest.value) {
    console.log('语音正在加载中，跳过重复请求')
    return
  }

  // 检查缓存
  const cacheKey = getCacheKey.value
  const cachedVoice = getCachedVoice(cacheKey)
  if (cachedVoice) {
    console.log('从缓存加载语音:', cacheKey)
    audioUrl.value = cachedVoice
    return
  }

  // 设置加载状态
  isLoadingRequest.value = true
  loading.value = true
  error.value = false

  try {
    if (!props.msgId || !props.fromUserName || !props.length || !props.bufId) {
      throw new Error('缺少必需的下载参数')
    }

    console.log('开始下载语音，参数:', {
      Wxid: props.wxid,
      FromUserName: props.fromUserName,
      MsgId: props.msgId,
      Length: props.length,
      Bufid: props.bufId
    })

    const downloadParams = {
      Wxid: props.wxid,
      FromUserName: props.fromUserName,
      MsgId: props.msgId,
      Length: props.length,
      Bufid: props.bufId || '0'
    }

    const response = await downloadVoice(downloadParams)
    console.log('语音下载API响应:', response)

    // 处理响应数据
    let audioData = ''
    console.log('语音下载API完整响应:', response)

    if (response.Success === true && response.Data) {
      // 尝试多种可能的响应格式
      if (response.Data.data && response.Data.data.buffer) {
        audioData = response.Data.data.buffer
        console.log('使用buffer字段:', audioData.substring(0, 50) + '...')
      } else if (response.Data.buffer) {
        audioData = response.Data.buffer
        console.log('使用Data.buffer字段:', audioData.substring(0, 50) + '...')
      } else if (typeof response.Data === 'string') {
        audioData = response.Data
        console.log('使用Data字符串:', audioData.substring(0, 50) + '...')
      } else {
        console.error('无法解析语音API响应结构:', response)
        throw new Error('API返回数据格式不正确')
      }
    } else {
      console.error('语音API返回失败:', response)
      throw new Error('API返回失败或空数据')
    }

    if (audioData && audioData.length > 0) {
      let finalAudioUrl = ''

      if (audioData.startsWith('data:audio/')) {
        // 如果已经是完整的data URL
        finalAudioUrl = audioData
        console.log('使用完整的data URL')
      } else if (audioData.startsWith('http')) {
        // 如果是HTTP URL
        finalAudioUrl = audioData
        console.log('使用HTTP URL')
      } else {
        // 检查是否是SILK格式的原始数据
        if (audioData.includes('#!SILK_V3') || props.voiceFormat === '4') {
          console.log('检测到SILK格式语音，浏览器不支持直接播放')
          // SILK格式浏览器不支持，显示错误状态让用户下载
          error.value = true
          // 仍然保存数据用于下载
          finalAudioUrl = `data:application/octet-stream;base64,${btoa(audioData)}`
          audioUrl.value = finalAudioUrl
          setCachedVoice(getCacheKey.value, finalAudioUrl)
          throw new Error('SILK格式语音需要专门的播放器，浏览器不支持')
        } else {
          // 假设是base64编码的音频数据
          console.log('处理base64音频数据，长度:', audioData.length)

          // 先尝试wav格式
          finalAudioUrl = `data:audio/wav;base64,${audioData}`
          console.log('使用wav格式的data URL')
        }
      }

      if (!error.value) {
        // 设置语音URL并添加到缓存
        audioUrl.value = finalAudioUrl
        setCachedVoice(getCacheKey.value, finalAudioUrl)
        console.log('语音URL设置成功并已缓存:', finalAudioUrl.substring(0, 100) + '...')
      }
    } else {
      throw new Error('API返回空的音频数据')
    }
  } catch (err) {
    console.error('语音下载失败:', err)
    error.value = true
  } finally {
    loading.value = false
    isLoadingRequest.value = false
  }
}

// 切换播放状态
const togglePlay = () => {
  if (!audioRef.value || !audioUrl.value) return

  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play()
  }
}

// 音频事件处理
const handleAudioLoaded = () => {
  console.log('语音加载完成')
}

const handleTimeUpdate = () => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

const handleAudioEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

const handleAudioError = (event: Event) => {
  console.error('语音播放错误:', event)
  const audio = event.target as HTMLAudioElement
  if (audio && audio.error) {
    console.error('音频错误详情:', {
      code: audio.error.code,
      message: audio.error.message,
      audioSrc: audio.src?.substring(0, 100) + '...'
    })
  }
  error.value = true
  isPlaying.value = false
}

// 监听播放状态变化
const handlePlayStateChange = () => {
  if (audioRef.value) {
    isPlaying.value = !audioRef.value.paused
  }
}

// 下载语音文件
const downloadVoiceFile = () => {
  if (!audioUrl.value) {
    console.warn('没有可下载的语音文件')
    return
  }

  try {
    const link = document.createElement('a')
    link.href = audioUrl.value
    // 根据格式设置文件扩展名
    const extension = props.voiceFormat === '4' ? 'silk' : 'wav'
    link.download = `voice_${props.msgId || Date.now()}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    console.log('语音文件下载开始')
  } catch (err) {
    console.error('下载语音文件失败:', err)
  }
}

// 格式化时长显示
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}"`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 监听音频播放状态
if (typeof window !== 'undefined') {
  document.addEventListener('play', handlePlayStateChange, true)
  document.addEventListener('pause', handlePlayStateChange, true)
}
</script>

<style lang="scss" scoped>
.voice-message-wrapper {
  display: inline-block;
  min-width: 120px;
  max-width: 200px;
}

.voice-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  color: #666;
  font-size: 12px;
}

.voice-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: #fef0f0;
  border-radius: 8px;
  color: #f56c6c;
  font-size: 12px;

  .voice-error-icon {
    font-size: 20px;
    margin-bottom: 4px;
  }
}

.voice-content {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #e8f4fd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 40px;

  &:hover {
    background: #d6ebfa;
  }

  &:active {
    transform: scale(0.98);
  }
}

.voice-play-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #409eff;
  border-radius: 50%;
  color: white;
  margin-right: 8px;
  transition: all 0.2s ease;

  &.playing {
    background: #f56c6c;
  }

  .voice-icon {
    font-size: 12px;
  }
}

.voice-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.voice-duration {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 16px;
}

.wave-bar {
  width: 3px;
  background: #ccc;
  border-radius: 1px;
  transition: all 0.3s ease;

  &:nth-child(1) {
    height: 8px;
  }

  &:nth-child(2) {
    height: 12px;
  }

  &:nth-child(3) {
    height: 6px;
  }

  &:nth-child(4) {
    height: 14px;
  }

  &:nth-child(5) {
    height: 10px;
  }

  &:nth-child(6) {
    height: 8px;
  }

  &:nth-child(7) {
    height: 12px;
  }

  &:nth-child(8) {
    height: 6px;
  }

  &.active {
    background: #409eff;
  }
}
</style>
