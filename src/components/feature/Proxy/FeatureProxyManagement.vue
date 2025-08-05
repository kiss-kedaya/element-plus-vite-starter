<template>
  <div class="feature-proxy-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>代理管理</span>
          <div class="header-actions">
            <el-button type="primary" @click="showImportDialog = true">
              <el-icon><Plus /></el-icon>
              批量导入
            </el-button>
          </div>
        </div>
      </template>

      <!-- 统计信息 -->
      <div class="stats-section">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-statistic title="总数" :value="stats.total" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="可用" :value="stats.active" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="未测试" :value="stats.inactive" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="错误" :value="stats.error" />
          </el-col>
        </el-row>
      </div>

      <!-- 筛选区域 -->
      <div class="filter-section">
        <el-row :gutter="16">
          <el-col :span="4">
            <el-select v-model="filters.status" placeholder="状态筛选" clearable @change="handleFilterChange">
              <el-option label="全部" value="" />
              <el-option label="可用" value="active" />
              <el-option label="未测试" value="inactive" />
              <el-option label="测试中" value="testing" />
              <el-option label="错误" value="error" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-select v-model="filters.country" placeholder="地区筛选" clearable @change="handleFilterChange">
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
              测试选中 ({{ selectedProxies.length }})
            </el-button>
          </el-col>
        </el-row>
      </div>

      <!-- 代理表格 -->
      <BaseTable
        :data="proxyList?.list || []"
        :columns="tableColumns"
        :loading="loading"
        :show-selection="true"
        :show-pagination="true"
        :page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        @selection-change="handleSelectionChange"
        @refresh="refreshProxyList"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        @edit="editProxy"
        @delete="deleteProxy"
      >
        <!-- 状态列 -->
        <template #status="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>

        <!-- 响应时间列 -->
        <template #response_time="{ row }">
          <span v-if="row.response_time > 0">{{ row.response_time }}ms</span>
          <span v-else>-</span>
        </template>

        <!-- 操作列 -->
        <template #actions="{ row }">
          <el-button size="small" @click="testSingleProxy(row.id)">
            测试
          </el-button>
          <el-button size="small" @click="editProxy(row)">
            编辑
          </el-button>
          <el-button size="small" type="danger" @click="deleteProxy(row)">
            删除
          </el-button>
        </template>
      </BaseTable>
    </el-card>

    <!-- 导入对话框 -->
    <!-- <ProxyImportDialog
      v-model="showImportDialog"
      @import-success="handleImportSuccess"
    /> -->

    <!-- 编辑对话框 -->
    <!-- <ProxyEditDialog
      v-model="showEditDialog"
      :proxy="currentProxy"
      @save-success="handleSaveSuccess"
    /> -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Connection } from '@element-plus/icons-vue'

// 组件导入
import BaseTable from '@/components/base/Table/index.vue'
// 注意：以下组件需要创建，暂时注释掉避免编译错误
// import ProxyStats from './components/ProxyStats.vue'
// import ProxyFilter from './components/ProxyFilter.vue'
// import ProxyImportDialog from './components/ProxyImportDialog.vue'
// import ProxyEditDialog from './components/ProxyEditDialog.vue'

// Hooks导入
import { usePaginationApi } from '@/composables/useApi'
import { useTimer } from '@/composables/useTimer'

// API和类型导入
import { proxyApi, type ProxyInfo, proxyStatusMap, getProxyCountries } from '@/api/proxy'
import type { TableColumn } from '@/components/base/Table/types'

// 响应式数据
const showImportDialog = ref(false)
const showEditDialog = ref(false)
const currentProxy = ref<ProxyInfo | null>(null)
const selectedProxies = ref<ProxyInfo[]>([])

// 筛选条件
const filters = reactive({
  status: '',
  country: '',
  keyword: ''
})

// 统计信息
const stats = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  testing: 0,
  error: 0
})

// 分页状态
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 创建API适配器
const adaptedGetProxyList = async (params: any) => {
  const response = await proxyApi.getProxyList(params)
  return {
    Code: 200,
    Success: true,
    Message: 'success',
    Data: {
      list: response.data?.list || [],
      total: response.data?.total || 0
    }
  }
}

// 使用分页API Hook
const {
  data: proxyList,
  loading,
  page,
  pageSize,
  total,
  execute: loadProxies,
  refresh: refreshProxyList,
  goToPage,
  changePageSize
} = usePaginationApi(adaptedGetProxyList, {
  defaultPageSize: 20,
  immediate: true
})

// 同步分页状态
watch([page, pageSize, total], ([newPage, newPageSize, newTotal]) => {
  pagination.page = newPage
  pagination.pageSize = newPageSize
  pagination.total = newTotal
})

// 处理分页变化
const handlePageChange = (newPage: number) => {
  goToPage(newPage)
}

const handlePageSizeChange = (newPageSize: number) => {
  changePageSize(newPageSize)
}

// 表格列配置
const tableColumns = computed<TableColumn[]>(() => [
  { prop: 'ip', label: 'IP地址', width: 150 },
  { prop: 'port', label: '端口', width: 80 },
  { prop: 'username', label: '用户名', width: 120 },
  { prop: 'password', label: '密码', width: 120 },
  { prop: 'status', label: '状态', width: 100, slot: true },
  { prop: 'response_time', label: '响应时间', width: 100, slot: true },
  { prop: 'country', label: '地区', width: 100 },
  { prop: 'region', label: '区域', width: 100 },
  { prop: 'last_test', label: '最后测试', width: 150 },
  { prop: 'expire_date', label: '过期时间', width: 150 },
  { prop: 'actions', label: '操作', width: 200, slot: true, fixed: 'right' }
])

// 获取可用国家列表
const countries = computed(() => {
  return getProxyCountries(proxyList.value?.list || [])
})

// 自动刷新定时器
const { start: startAutoRefresh, stop: stopAutoRefresh } = useTimer(() => {
  refreshProxyList()
  refreshStats()
}, 30000) // 30秒刷新一次

// 获取状态类型
const getStatusType = (status: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const statusInfo = proxyStatusMap[status as keyof typeof proxyStatusMap]
  const color = statusInfo?.color || 'info'
  return ['success', 'warning', 'info', 'primary', 'danger'].includes(color)
    ? color as 'success' | 'warning' | 'info' | 'primary' | 'danger'
    : 'info'
}

// 获取状态标签
const getStatusLabel = (status: string) => {
  const statusInfo = proxyStatusMap[status as keyof typeof proxyStatusMap]
  return statusInfo?.label || '未知'
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
  loadProxies(filters)
}

// 处理选择变化
const handleSelectionChange = (selection: ProxyInfo[]) => {
  selectedProxies.value = selection
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
      ElMessage.success('代理测试已开始，请稍后查看结果')
      // 3秒后刷新列表查看测试结果
      setTimeout(() => {
        refreshProxyList()
        refreshStats()
      }, 3000)
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
      setTimeout(() => {
        refreshProxyList()
        refreshStats()
      }, 3000)
    }
  } catch (error) {
    console.error('测试代理失败:', error)
    ElMessage.error('测试代理失败')
  }
}

// 编辑代理
const editProxy = (proxy: ProxyInfo) => {
  currentProxy.value = { ...proxy }
  showEditDialog.value = true
}

// 删除代理
const deleteProxy = async (proxy: ProxyInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除代理 ${proxy.ip}:${proxy.port} 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await proxyApi.deleteProxy(proxy.id)
    if (response.code === 0) {
      ElMessage.success('删除成功')
      refreshProxyList()
      refreshStats()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除代理失败:', error)
      ElMessage.error('删除代理失败')
    }
  }
}

// 处理导入成功
const handleImportSuccess = () => {
  refreshProxyList()
  refreshStats()
}

// 处理保存成功
const handleSaveSuccess = () => {
  refreshProxyList()
  refreshStats()
}

// 组件挂载时初始化
onMounted(() => {
  refreshStats()
})

// 组件卸载时停止自动刷新
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
.feature-proxy-management {
  padding: 20px;
}
</style>
