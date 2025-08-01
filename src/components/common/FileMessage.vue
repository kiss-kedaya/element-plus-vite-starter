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
import { Document, VideoPlay, Picture, Files, Download, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Props {
  fileName: string
  fileSize: number
  fileUrl?: string
  mimeType?: string
}

const props = defineProps<Props>()

const downloading = ref(false)

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
