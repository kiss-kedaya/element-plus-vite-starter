<template>
  <div class="file-cache-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>文件缓存管理</span>
          <div class="header-actions">
            <el-button size="small" @click="refreshCache">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-button size="small" type="danger" @click="clearAllCache">
              <el-icon><Delete /></el-icon>
              清空缓存
            </el-button>
          </div>
        </div>
      </template>

      <div class="cache-stats">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="缓存文件数量">
            {{ cacheStats.size }}
          </el-descriptions-item>
          <el-descriptions-item label="缓存状态">
            <el-tag :type="cacheStats.size > 0 ? 'success' : 'info'">
              {{ cacheStats.size > 0 ? '有缓存' : '无缓存' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="最后更新">
            {{ lastUpdateTime }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="cache-list" v-if="cacheStats.size > 0">
        <h4>缓存文件列表</h4>
        <el-table :data="cacheStats.files" stripe>
          <el-table-column prop="fileName" label="文件名" min-width="200">
            <template #default="{ row }">
              <el-tooltip :content="row.fileName" placement="top">
                <span class="file-name">{{ row.fileName }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          
          <el-table-column prop="fileSize" label="文件大小" width="120">
            <template #default="{ row }">
              {{ formatFileSize(row.fileSize) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="cacheTime" label="缓存时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.cacheTime) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button 
                size="small" 
                type="danger" 
                @click="removeFile(row.fileName, row.fileSize)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-else class="empty-cache">
        <el-empty description="暂无缓存文件">
          <template #image>
            <el-icon size="60" color="#c0c4cc"><Document /></el-icon>
          </template>
        </el-empty>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Document } from '@element-plus/icons-vue'
import { fileCacheManager, formatFileSize } from '@/utils/fileCache'

// 响应式数据
const cacheStats = ref({ size: 0, files: [] as any[] })
const lastUpdateTime = ref('')

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 更新最后更新时间
const updateLastUpdateTime = () => {
  lastUpdateTime.value = new Date().toLocaleString('zh-CN')
}

// 刷新缓存信息
const refreshCache = () => {
  cacheStats.value = fileCacheManager.getCacheStats()
  updateLastUpdateTime()
  console.log('缓存信息已刷新:', cacheStats.value)
}

// 清空所有缓存
const clearAllCache = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有文件缓存吗？此操作不可恢复。',
      '确认清空',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    fileCacheManager.clearCache()
    refreshCache()
    ElMessage.success('缓存已清空')
  } catch {
    // 用户取消操作
  }
}

// 删除单个文件缓存
const removeFile = async (fileName: string, fileSize: number) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 "${fileName}" 的缓存吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    const success = fileCacheManager.removeCachedFile(fileName, fileSize)
    if (success) {
      refreshCache()
      ElMessage.success('文件缓存已删除')
    } else {
      ElMessage.error('删除失败，文件缓存不存在')
    }
  } catch {
    // 用户取消操作
  }
}

// 组件挂载时刷新缓存信息
onMounted(() => {
  refreshCache()
})
</script>

<style scoped>
.file-cache-manager {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.cache-stats {
  margin-bottom: 20px;
}

.cache-list {
  margin-top: 20px;
}

.cache-list h4 {
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}

.file-name {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-cache {
  text-align: center;
  padding: 40px 0;
}
</style>
