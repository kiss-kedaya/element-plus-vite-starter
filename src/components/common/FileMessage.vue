<template>
  <div class="file-message-wrapper">
    <div class="file-container">
      <div class="file-icon">
        <el-icon :size="32">
          <Document v-if="isDocument" />
          <VideoPlay v-else-if="isVideo" />
          <Picture v-else-if="isImage" />
          <Files v-else />
        </el-icon>
      </div>
      
      <div class="file-info">
        <div class="file-name" :title="fileName">{{ fileName }}</div>
        <div class="file-size">{{ formatFileSize(fileSize) }}</div>
      </div>
      
      <div class="file-actions">
        <!-- 有直接下载链接 -->
        <el-button
          v-if="fileUrl"
          type="primary"
          size="small"
          @click="downloadFile"
          :loading="downloading"
        >
          <el-icon><Download /></el-icon>
          下载
        </el-button>
        <!-- 有CDN信息可以下载 -->
        <el-button
          v-else-if="cdnUrl && !fromMe"
          type="warning"
          size="small"
          @click="downloadCdnFile"
          :loading="downloading"
        >
          <el-icon><Download /></el-icon>
          下载
        </el-button>
        <!-- 自己发送的消息，根据状态显示 -->
        <el-button
          v-else-if="fromMe && messageStatus === 'sent'"
          type="success"
          size="small"
          disabled
        >
          <el-icon><Check /></el-icon>
          已发送
        </el-button>
        <el-button
          v-else-if="fromMe && messageStatus === 'failed'"
          type="danger"
          size="small"
          disabled
        >
          <el-icon><Close /></el-icon>
          发送失败
        </el-button>
        <el-button
          v-else-if="fromMe && messageStatus === 'sending'"
          type="info"
          size="small"
          disabled
        >
          <el-icon><Loading /></el-icon>
          发送中
        </el-button>
        <!-- 其他情况显示处理中 -->
        <el-button
          v-else
          type="info"
          size="small"
          disabled
        >
          <el-icon><Loading /></el-icon>
          处理中
        </el-button>


      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Document, VideoPlay, Picture, Files, Download, Loading, Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { downloadFile as downloadFileAPI } from '@/api/index'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'

interface Props {
  fileName: string
  fileSize: number
  fileUrl?: string
  mimeType?: string
  cdnUrl?: string
  aesKey?: string
  attachId?: string
  wxid?: string
  userName?: string
  appId?: string
  originalContent?: string  // 原始XML内容，用于缓存匹配
  messageStatus?: string    // 消息状态：sending, sent, failed
  fromMe?: boolean          // 是否是自己发送的消息
}

const props = defineProps<Props>()

const downloading = ref(false)

// 获取store实例
const chatStore = useChatStore()
const authStore = useAuthStore()



// 根据文件类型判断图标
const isDocument = computed(() => {
  const docTypes = ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.xls', '.xlsx', '.ppt', '.pptx']
  return docTypes.some(type => props.fileName.toLowerCase().endsWith(type))
})

const isVideo = computed(() => {
  const videoTypes = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm']
  return videoTypes.some(type => props.fileName.toLowerCase().endsWith(type))
})

const isImage = computed(() => {
  const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
  return imageTypes.some(type => props.fileName.toLowerCase().endsWith(type))
})

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 下载文件
const downloadFile = async () => {
  if (!props.fileUrl) {
    ElMessage.warning('文件链接不可用')
    return
  }

  downloading.value = true
  try {
    // 创建下载链接
    const link = document.createElement('a')
    link.href = props.fileUrl
    link.download = props.fileName
    link.target = '_blank'

    // 触发下载
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    ElMessage.success('文件下载已开始')
  } catch (error) {
    console.error('下载文件失败:', error)
    ElMessage.error('下载文件失败')
  } finally {
    downloading.value = false
  }
}

// 下载CDN文件
const downloadCdnFile = async () => {
  console.log('downloadCdnFile 函数开始执行')
  console.log('Props检查:', {
    attachId: props.attachId,
    wxid: props.wxid,
    userName: props.userName,
    fileSize: props.fileSize
  })

  if (!props.attachId || !props.wxid || !props.userName) {
    console.error('参数验证失败:', {
      attachId: !!props.attachId,
      wxid: !!props.wxid,
      userName: !!props.userName
    })
    ElMessage.warning('文件下载参数不完整')
    return
  }

  downloading.value = true
  console.log('设置downloading为true，开始下载流程')

  try {
    const downloadParams = {
      Wxid: props.wxid,
      AppID: props.appId || 'wx6618f1cfc6c132f8', // 默认AppID
      AttachId: props.attachId,
      UserName: props.userName,
      DataLen: props.fileSize,
      Section: {
        StartPos: 0,
        DataLen: props.fileSize
      }
    }

    console.log('开始下载文件:', {
      fileName: props.fileName,
      attachId: props.attachId,
      wxid: props.wxid,
      userName: props.userName,
      fileSize: props.fileSize,
      downloadParams
    })

    console.log('即将调用downloadFileAPI...')
    console.log('downloadFileAPI函数类型:', typeof downloadFileAPI)
    console.log('downloadFileAPI函数:', downloadFileAPI)

    if (typeof downloadFileAPI !== 'function') {
      throw new Error('downloadFileAPI不是一个函数，可能导入失败')
    }

    let response
    try {
      response = await downloadFileAPI(downloadParams)
      console.log('downloadFileAPI调用成功，响应:', response)
    } catch (apiError: any) {
      console.error('downloadFileAPI调用异常:', apiError)
      console.error('异常详情:', {
        name: apiError.name,
        message: apiError.message,
        stack: apiError.stack,
        response: apiError.response
      })
      throw apiError
    }

    console.log('下载API响应:', response)

    // 检查响应格式
    if (response && response.Success && response.Data) {
      // 从响应中获取文件数据
      const fileData = response.Data.data || response.Data.Data
      const base64Data = fileData?.buffer || fileData?.Buffer

      console.log('文件数据信息:', {
        totalLen: response.Data.totalLen,
        dataLen: response.Data.dataLen,
        hasBuffer: !!base64Data
      })

      if (!base64Data) {
        throw new Error('服务器未返回文件数据')
      }

      // 将base64转换为blob并下载
      try {
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray])

        console.log('文件下载信息:', {
          fileName: props.fileName,
          originalSize: response.Data.totalLen,
          downloadedSize: byteArray.length,
          blobSize: blob.size
        })

        // 创建下载链接
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = props.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        ElMessage.success(`文件下载成功 (${blob.size} 字节)`)
      } catch (decodeError) {
        console.error('Base64解码失败:', decodeError)
        throw new Error('文件数据格式错误')
      }
    } else {
      const errorMsg = response?.Message || '下载失败：服务器响应格式错误'
      throw new Error(errorMsg)
    }
  } catch (error: any) {
    console.error('下载文件失败:', error)
    console.error('错误详情:', {
      message: error.message,
      response: error.response,
      stack: error.stack
    })

    let errorMessage = '下载文件失败'
    if (error.message) {
      errorMessage = error.message
    } else if (error.response?.data?.Message) {
      errorMessage = error.response.data.Message
    }

    ElMessage.error(errorMessage)
  } finally {
    downloading.value = false
  }
}


</script>

<style scoped lang="scss">
.file-message-wrapper {
  display: inline-block;
  max-width: 300px;
  min-width: 200px;
}

.file-container {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  gap: 12px;
  transition: all 0.3s ease;

  &:hover {
    background: #ecf5ff;
    border-color: #b3d8ff;
  }
}

.file-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #e1f3d8;
  border-radius: 6px;
  color: #67c23a;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

.file-actions {
  flex-shrink: 0;
}

// 不同文件类型的图标颜色
.file-container {
  .file-icon {
    // 文档类型
    &:has(.el-icon:first-child) {
      background: #e1f3d8;
      color: #67c23a;
    }
  }
}

// 视频文件图标样式
.file-container:has(.file-name[title*=".mp4"]),
.file-container:has(.file-name[title*=".avi"]),
.file-container:has(.file-name[title*=".mov"]) {
  .file-icon {
    background: #fdf6ec;
    color: #e6a23c;
  }
}

// 图片文件图标样式  
.file-container:has(.file-name[title*=".jpg"]),
.file-container:has(.file-name[title*=".png"]),
.file-container:has(.file-name[title*=".gif"]) {
  .file-icon {
    background: #fef0f0;
    color: #f56c6c;
  }
}
</style>
