<template>
  <div class="preset-file-cache-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>预置文件缓存管理</span>
          <div class="header-actions">
            <el-button type="primary" :icon="Refresh" @click="refreshCache">
              刷新
            </el-button>
            <el-button type="success" :icon="Plus" @click="showAddDialog = true">
              添加预置文件
            </el-button>
            <el-button type="warning" :icon="Setting" @click="reinitializeCache">
              重新初始化
            </el-button>
          </div>
        </div>
      </template>

      <!-- 统计信息 -->
      <div class="stats-section">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-statistic title="预置文件数量" :value="presetFileCount" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="缓存文件总数" :value="cacheStats.size" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="初始化状态" :value="isInitialized ? '已初始化' : '未初始化'" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="最后更新" :value="lastUpdateTime" />
          </el-col>
        </el-row>
      </div>

      <!-- 预置文件列表 -->
      <div class="preset-files-section">
        <h3>预置文件列表</h3>
        <el-table :data="presetFiles" style="width: 100%">
          <el-table-column prop="fileName" label="文件名" min-width="200" />
          <el-table-column prop="fileSize" label="文件大小" width="120">
            <template #default="{ row }">
              {{ formatFileSize(row.fileSize) }}
            </template>
          </el-table-column>
          <el-table-column prop="attachId" label="附件ID" min-width="300" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="isFileInCache(row.fileName, row.fileSize) ? 'success' : 'warning'">
                {{ isFileInCache(row.fileName, row.fileSize) ? '已缓存' : '未缓存' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 添加预置文件对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加预置文件缓存"
      width="600px"
      :before-close="cancelAddDialog"
    >
      <el-form :model="addForm" :rules="addRules" ref="addFormRef" label-width="120px">
        <el-form-item label="文件名" prop="fileName">
          <el-input v-model="addForm.fileName" placeholder="请输入文件名，如：工作介绍.pptx" />
        </el-form-item>
        <el-form-item label="文件大小" prop="fileSize">
          <el-input-number v-model="addForm.fileSize" :min="1" placeholder="文件大小（字节）" />
        </el-form-item>
        <el-form-item label="附件ID" prop="attachId">
          <el-input v-model="addForm.attachId" type="textarea" :rows="3" placeholder="请输入附件ID" />
        </el-form-item>
        <el-form-item label="CDN URL" prop="cdnUrl">
          <el-input v-model="addForm.cdnUrl" type="textarea" :rows="2" placeholder="请输入CDN URL" />
        </el-form-item>
        <el-form-item label="AES密钥" prop="aesKey">
          <el-input v-model="addForm.aesKey" placeholder="请输入AES密钥" />
        </el-form-item>
        <el-form-item label="应用ID" prop="appId">
          <el-input v-model="addForm.appId" placeholder="请输入应用ID" />
        </el-form-item>
        <el-form-item label="原始内容" prop="originalContent">
          <el-input v-model="addForm.originalContent" type="textarea" :rows="8" placeholder="请输入完整的XML内容" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelAddDialog">取消</el-button>
          <el-button type="primary" @click="addPresetFile">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Setting } from '@element-plus/icons-vue'
import { 
  initPresetFileCache, 
  getPresetFileCacheInfo, 
  isPresetFileCacheInitialized,
  addPresetFileCache
} from '@/utils/presetFileCache'
import { fileCacheManager, formatFileSize } from '@/utils/fileCache'

// 响应式数据
const cacheStats = ref({ size: 0, files: [] as any[] })
const lastUpdateTime = ref('')
const showAddDialog = ref(false)
const addFormRef = ref()

// 预置文件信息
const presetFiles = ref(getPresetFileCacheInfo())
const presetFileCount = computed(() => presetFiles.value.length)
const isInitialized = ref(false)

// 添加表单
const addForm = ref({
  fileName: '',
  fileSize: 0,
  attachId: '',
  cdnUrl: '',
  aesKey: '',
  appId: '',
  originalContent: ''
})

// 表单验证规则
const addRules = {
  fileName: [{ required: true, message: '请输入文件名', trigger: 'blur' }],
  fileSize: [{ required: true, message: '请输入文件大小', trigger: 'blur' }],
  attachId: [{ required: true, message: '请输入附件ID', trigger: 'blur' }],
  originalContent: [{ required: true, message: '请输入原始内容', trigger: 'blur' }]
}

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
  isInitialized.value = isPresetFileCacheInitialized()
  updateLastUpdateTime()
  console.log('预置文件缓存信息已刷新:', { cacheStats: cacheStats.value, isInitialized: isInitialized.value })
}

// 检查文件是否在缓存中
const isFileInCache = (fileName: string, fileSize: number): boolean => {
  const cacheKey = `${fileName}_${fileSize}`
  return cacheStats.value.files.some(file => 
    file.fileName === fileName && file.fileSize === fileSize
  )
}

// 重新初始化缓存
const reinitializeCache = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重新初始化预置文件缓存吗？这将重新加载所有预置文件。',
      '确认重新初始化',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    initPresetFileCache()
    refreshCache()
    ElMessage.success('预置文件缓存重新初始化成功')
  } catch {
    // 用户取消操作
  }
}



// 添加预置文件
const addPresetFile = async () => {
  try {
    await addFormRef.value.validate()
    
    // 添加到预置缓存
    addPresetFileCache(addForm.value.fileName, addForm.value.fileSize, {
      fileName: addForm.value.fileName,
      fileSize: addForm.value.fileSize,
      originalContent: addForm.value.originalContent,
      attachId: addForm.value.attachId,
      cdnUrl: addForm.value.cdnUrl,
      aesKey: addForm.value.aesKey,
      appId: addForm.value.appId
    })
    
    refreshCache()
    showAddDialog.value = false
    resetAddForm()
    ElMessage.success('预置文件缓存添加成功')
  } catch (error) {
    console.error('添加预置文件缓存失败:', error)
    ElMessage.error('添加失败，请检查输入信息')
  }
}

// 取消添加对话框
const cancelAddDialog = () => {
  showAddDialog.value = false
  resetAddForm()
}

// 重置添加表单
const resetAddForm = () => {
  addForm.value = {
    fileName: '',
    fileSize: 0,
    attachId: '',
    cdnUrl: '',
    aesKey: '',
    appId: '',
    originalContent: ''
  }
  addFormRef.value?.clearValidate()
}

// 组件挂载时刷新缓存信息
onMounted(() => {
  refreshCache()
})
</script>

<style scoped>
.preset-file-cache-manager {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.stats-section {
  margin-bottom: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.preset-files-section {
  margin-top: 20px;
}

.preset-files-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
