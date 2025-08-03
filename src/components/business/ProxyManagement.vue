<template>
  <div class="proxy-management">
    <div class="proxy-management-content">
      <!-- 头部操作区域 -->
      <div class="card-header" v-if="showTitle">
        <span>代理管理</span>
        <div class="header-actions">
          <el-button type="primary" @click="showImportDialog = true">
            <el-icon><Plus /></el-icon>
            批量导入
          </el-button>
          <el-button type="danger" @click="deleteSelectedProxies" :disabled="selectedProxies.length === 0">
            <el-icon><Delete /></el-icon>
            批量删除
          </el-button>
          <el-button @click="refreshProxyList">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <!-- 无标题时的操作按钮区域 -->
      <div class="actions-only" v-if="!showTitle">
        <div class="action-buttons">
          <el-button type="primary" @click="showImportDialog = true">
            <el-icon><Plus /></el-icon>
            批量导入
          </el-button>
          <el-button type="danger" @click="deleteSelectedProxies" :disabled="selectedProxies.length === 0">
            <el-icon><Delete /></el-icon>
            批量删除
          </el-button>
          <el-button @click="refreshProxyList">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-section">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-statistic title="总数" :value="stats.total" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="可用" :value="stats.active" value-style="color: #67c23a" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="未测试" :value="stats.inactive" value-style="color: #909399" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="错误" :value="stats.error" value-style="color: #f56c6c" />
          </el-col>
        </el-row>
      </div>

      <!-- 筛选条件 -->
      <div class="filter-section">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-select v-model="filters.status" placeholder="状态筛选" clearable @change="handleFilterChange">
              <el-option label="全部" value="" />
              <el-option label="可用" value="active" />
              <el-option label="未测试" value="inactive" />
              <el-option label="测试中" value="testing" />
              <el-option label="错误" value="error" />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-select v-model="filters.country" placeholder="地区筛选" clearable @change="handleFilterChange">
              <el-option label="全部" value="" />
              <el-option v-for="country in countries" :key="country" :label="country" :value="country" />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-input
              v-model="filters.keyword"
              placeholder="搜索IP或用户名"
              clearable
              @input="handleFilterChange"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-col>
          <el-col :span="4">
            <el-button type="warning" @click="testSelectedProxies" :disabled="selectedProxies.length === 0">
              <el-icon><Connection /></el-icon>
              测试选中
            </el-button>
          </el-col>
        </el-row>
      </div>

      <!-- 代理列表 -->
      <div class="proxy-list table-section">
        <el-table
          :data="proxyList"
          v-loading="loading"
          @selection-change="handleSelectionChange"
          stripe
          height="450"
          :table-layout="'fixed'"
          style="width: 100%"
          :header-cell-style="{ backgroundColor: '#f5f7fa', color: '#606266' }"
          :cell-style="{ padding: '8px 12px' }"
        >
          <el-table-column type="selection" width="55" />

          <el-table-column label="状态" min-width="80">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="ip" label="IP地址" min-width="150" />
          <el-table-column prop="port" label="端口" min-width="80" />
          <el-table-column prop="username" label="用户名" min-width="120" />
          <el-table-column prop="country" label="地区" min-width="180">
            <template #default="{ row }">
              <span>{{ row.country || '-' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="响应时间" min-width="100">
            <template #default="{ row }">
              <span v-if="row.response_time > 0">{{ row.response_time }}ms</span>
              <span v-else>-</span>
            </template>
          </el-table-column>

          <el-table-column prop="expire_date" label="过期时间" min-width="120" />

          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button size="small" @click="testSingleProxy(row.id)">测试</el-button>
                <el-button size="small" type="danger" @click="deleteProxy(row.id)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handlePageSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <el-dialog v-model="showImportDialog" title="批量导入代理" width="600px">
      <div class="import-dialog">
        <el-alert
          title="导入格式说明"
          type="info"
          :closable="false"
          style="margin-bottom: 16px"
        >
          <template #default>
            <p>每行一个代理，格式：IP|端口|用户名|密码|过期时间</p>
            <p>示例：124.225.78.57|18474|LT9RQDK6TB|03399060|2025-08-31</p>
          </template>
        </el-alert>

        <el-input
          v-model="importData.proxyList"
          type="textarea"
          :rows="10"
          placeholder="请粘贴代理列表..."
        />

        <div class="import-actions">
          <el-button @click="showImportDialog = false">取消</el-button>
          <el-button type="primary" @click="importProxies" :loading="importing">
            导入
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search, Connection, Delete } from '@element-plus/icons-vue'
import { proxyApi, type ProxyInfo, proxyStatusMap, getProxyCountries } from '@/api/proxy'

// 定义 props
const props = withDefaults(defineProps<{
  showTitle?: boolean
}>(), {
  showTitle: true
})

// 定义事件
const emit = defineEmits<{
  'proxy-updated': []
}>()

// 响应式数据
const loading = ref(false)
const importing = ref(false)
const showImportDialog = ref(false)
const proxyList = ref<ProxyInfo[]>([])
const selectedProxies = ref<ProxyInfo[]>([])

// 统计信息
const stats = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  testing: 0,
  error: 0
})

// 筛选条件
const filters = reactive({
  status: '',
  country: '',
  keyword: ''
})

// 分页信息
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 导入数据
const importData = reactive({
  proxyList: '',
  format: 'ip|port|username|password|expire'
})

// 计算属性
const countries = computed(() => {
  return getProxyCountries(proxyList.value)
})

// 获取状态类型
const getStatusType = (status: string) => {
  const statusInfo = proxyStatusMap[status as keyof typeof proxyStatusMap]
  return statusInfo?.color || 'info'
}

// 获取状态标签
const getStatusLabel = (status: string) => {
  const statusInfo = proxyStatusMap[status as keyof typeof proxyStatusMap]
  return statusInfo?.label || '未知'
}

// 刷新代理列表
const refreshProxyList = async () => {
  loading.value = true
  try {
    const response = await proxyApi.getProxyList({
      page: pagination.page,
      page_size: pagination.pageSize,
      status: filters.status,
      country: filters.country,
      keyword: filters.keyword
    })

    if (response.code === 0) {
      proxyList.value = response.data.list
      pagination.total = response.data.total
    }
  } catch (error) {
    console.error('获取代理列表失败:', error)
    ElMessage.error('获取代理列表失败')
  } finally {
    loading.value = false
  }
}

// 刷新统计信息
const refreshStats = async () => {
  try {
    const response = await proxyApi.getProxyStats()
    if (response.code === 0) {
      Object.assign(stats, response.data)
    }
  } catch (error) {
    console.error('获取统计信息失败:', error)
  }
}

// 处理筛选变化
const handleFilterChange = () => {
  pagination.page = 1
  refreshProxyList()
}

// 处理分页变化
const handlePageChange = (page: number) => {
  pagination.page = page
  refreshProxyList()
}

// 处理页面大小变化
const handlePageSizeChange = (pageSize: number) => {
  pagination.pageSize = pageSize
  pagination.page = 1
  refreshProxyList()
}

// 处理选择变化
const handleSelectionChange = (selection: ProxyInfo[]) => {
  selectedProxies.value = selection
}

// 导入代理
const importProxies = async () => {
  if (!importData.proxyList.trim()) {
    ElMessage.warning('请输入代理列表')
    return
  }

  importing.value = true
  try {
    const response = await proxyApi.importProxies({
      proxy_list: importData.proxyList,
      format: importData.format
    })

    if (response.code === 0) {
      ElMessage.success(`导入成功：${response.data.success_count}个代理`)
      showImportDialog.value = false
      importData.proxyList = ''
      refreshProxyList()
      refreshStats()
      emit('proxy-updated')
    } else {
      ElMessage.error(response.message || '导入失败')
    }
  } catch (error) {
    console.error('导入代理失败:', error)
    ElMessage.error('导入代理失败')
  } finally {
    importing.value = false
  }
}

// 测试选中的代理
const testSelectedProxies = async () => {
  if (selectedProxies.value.length === 0) {
    ElMessage.warning('请选择要测试的代理')
    return
  }

  try {
    const proxyIds = selectedProxies.value.map(proxy => proxy.id)
    const response = await proxyApi.testProxies({ proxy_ids: proxyIds })
    
    if (response.code === 0) {
      ElMessage.success('代理测试已开始')
      // 立即刷新一次，然后定时刷新列表查看测试结果
      refreshProxyList()
      emit('proxy-updated')
      setTimeout(() => {
        refreshProxyList()
        refreshStats()
        emit('proxy-updated')
        ElMessage.success('代理测试完成')
      }, 5000)
    }
  } catch (error) {
    console.error('测试代理失败:', error)
    ElMessage.error('测试代理失败')
  }
}

// 测试单个代理
const testSingleProxy = async (id: number) => {
  try {
    const response = await proxyApi.testProxies({ proxy_ids: [id] })
    if (response.code === 0) {
      ElMessage.success('代理测试已开始')
      refreshProxyList()
      emit('proxy-updated')
      setTimeout(() => {
        refreshProxyList()
        refreshStats()
        emit('proxy-updated')
      }, 5000)
    }
  } catch (error) {
    console.error('测试代理失败:', error)
    ElMessage.error('测试代理失败')
  }
}

// 删除代理
const deleteProxy = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这个代理吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const response = await proxyApi.deleteProxy(id)
    if (response.code === 0) {
      ElMessage.success('删除成功')
      refreshProxyList()
      refreshStats()
      emit('proxy-updated')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除代理失败:', error)
      ElMessage.error('删除代理失败')
    }
  }
}

// 批量更新代理地区信息
const updateProxyCountries = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将为所有没有地区信息的代理自动识别地区，可能需要一些时间。是否继续？',
      '确认更新',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await proxyApi.updateProxyCountries()
    if (response.code === 0) {
      ElMessage.success('地区信息更新已开始')
      // 立即刷新一次，然后延迟再刷新确保获取最新数据
      refreshProxyList()
      emit('proxy-updated')
      setTimeout(() => {
        refreshProxyList()
        emit('proxy-updated')
        ElMessage.success('地区信息更新完成')
      }, 5000)
    } else {
      ElMessage.error(response.message || '更新失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('更新地区信息失败:', error)
      ElMessage.error('更新地区信息失败')
    }
  }
}



// 批量删除选中的代理
const deleteSelectedProxies = async () => {
  if (selectedProxies.value.length === 0) {
    ElMessage.warning('请先选择要删除的代理')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedProxies.value.length} 个代理吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 获取选中代理的ID列表
    const proxyIds = selectedProxies.value.map(proxy => proxy.id)

    // 批量删除
    let successCount = 0
    let errorCount = 0

    for (const proxyId of proxyIds) {
      try {
        const response = await proxyApi.deleteProxy(proxyId)
        if (response.code === 0) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        errorCount++
      }
    }

    if (successCount > 0) {
      ElMessage.success(`成功删除 ${successCount} 个代理${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`)
      refreshProxyList()
      emit('proxy-updated')
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除代理失败:', error)
      ElMessage.error('批量删除代理失败')
    }
  }
}

// 组件挂载时初始化
onMounted(() => {
  refreshProxyList()
  refreshStats()
})
</script>

<style scoped>
.proxy-management {
  padding: 0;
}

.proxy-management-content {
  background: #fff;
  border-radius: 4px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;

  span {
    font-size: 16px;
    font-weight: 500;
    color: #303133;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.actions-only {
  padding: 16px 0;
  margin-bottom: 20px;
  border-bottom: 1px solid #ebeef5;

  .action-buttons {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}

/* 表格操作按钮样式 */
.action-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  white-space: nowrap;

  .el-button {
    margin: 0 !important;
    min-width: auto;
    padding: 4px 8px;
    font-size: 12px;

    &.el-button--small {
      padding: 4px 8px;
      font-size: 12px;
    }
  }
}

.stats-section {
  margin-bottom: 20px;
  margin-left: 20px;
  margin-right: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
}

.filter-section {
  margin-bottom: 20px;
  padding: 0 20px;
}

.table-section {
  padding: 0 20px;
  flex: 1;
  overflow: hidden;
}

.proxy-list :deep(.el-table) {
  width: 100%;

  .el-table__cell {
    white-space: nowrap;

    /* 操作列特殊处理 */
    &:last-child {
      white-space: nowrap;
      overflow: visible;
    }
  }

  .el-table__header-wrapper {
    background-color: #f5f7fa !important;
  }

  .el-table__header {
    background-color: #f5f7fa !important;
  }

  .el-table__header th {
    background-color: #f5f7fa !important;
  }

  .el-table__header-wrapper .el-table__header thead tr th {
    background-color: #f5f7fa !important;
  }

  thead tr th.el-table__cell {
    background-color: #f5f7fa !important;
  }

  .el-table__fixed-right {
    .el-table__cell {
      padding: 8px 12px;
    }
  }
}

.pagination {
  margin-top: 20px;
  padding: 0 20px 20px 20px;
  text-align: right;
}

.import-dialog {
  padding: 16px 0;
}

.import-actions {
  margin-top: 16px;
  text-align: right;
}

.import-actions .el-button {
  margin-left: 8px;
}
</style>
