<template>
  <div class="base-table">
    <!-- 表格工具栏 -->
    <div v-if="showToolbar" class="table-toolbar">
      <div class="toolbar-left">
        <slot name="toolbar-left">
          <el-button
            v-if="showRefresh"
            @click="handleRefresh"
            :loading="loading"
          >
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </slot>
      </div>
      
      <div class="toolbar-right">
        <slot name="toolbar-right">
          <!-- 列设置 -->
          <el-dropdown v-if="showColumnSetting" trigger="click">
            <el-button>
              <el-icon><Setting /></el-icon>
              列设置
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="col in columns"
                  :key="col.prop"
                  @click="toggleColumn(col)"
                >
                  <el-checkbox :model-value="!col.hidden">
                    {{ col.label }}
                  </el-checkbox>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </slot>
      </div>
    </div>

    <!-- 表格主体 -->
    <el-table
      ref="tableRef"
      :data="data"
      :loading="loading"
      :height="height"
      :max-height="maxHeight"
      :stripe="stripe"
      :border="border"
      :size="size"
      :empty-text="emptyText"
      :row-key="rowKey"
      :default-sort="defaultSort"
      @selection-change="handleSelectionChange"
      @sort-change="handleSortChange"
      @row-click="handleRowClick"
      @row-dblclick="handleRowDblClick"
      v-bind="$attrs"
    >
      <!-- 选择列 -->
      <el-table-column
        v-if="showSelection"
        type="selection"
        :width="selectionWidth"
        :selectable="selectable"
      />

      <!-- 序号列 -->
      <el-table-column
        v-if="showIndex"
        type="index"
        label="序号"
        :width="indexWidth"
        :index="indexMethod"
      />

      <!-- 数据列 -->
      <template v-for="column in visibleColumns" :key="column.prop">
        <el-table-column
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :sortable="column.sortable"
          :align="column.align"
          :header-align="column.headerAlign"
          :show-overflow-tooltip="column.showOverflowTooltip"
          :formatter="column.formatter as any"
        >
          <!-- 自定义列头 -->
          <template v-if="column.headerSlot" #header="scope">
            <slot :name="`header-${column.prop}`" v-bind="scope">
              {{ column.label }}
            </slot>
          </template>

          <!-- 自定义列内容 -->
          <template #default="scope">
            <slot
              v-if="column.slot"
              :name="column.prop"
              v-bind="scope"
            >
              {{ scope.row[column.prop] }}
            </slot>
            
            <!-- 默认渲染 -->
            <template v-else>
              {{ formatCellValue(scope.row, column) }}
            </template>
          </template>
        </el-table-column>
      </template>

      <!-- 操作列 -->
      <el-table-column
        v-if="showActions"
        label="操作"
        :width="actionsWidth"
        :fixed="actionsFixed"
        align="center"
      >
        <template #default="scope">
          <slot name="actions" v-bind="scope">
            <el-button size="small" @click="handleEdit(scope.row)">
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(scope.row)"
            >
              删除
            </el-button>
          </slot>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页器 -->
    <div v-if="showPagination" class="table-pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="currentPageSize"
        :total="total"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        :background="paginationBackground"
        @size-change="handlePageSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Refresh, Setting } from '@element-plus/icons-vue'

// 临时类型定义
interface TableColumn {
  prop: string
  label: string
  width?: string | number
  minWidth?: string | number
  fixed?: boolean | 'left' | 'right'
  sortable?: boolean | 'custom'
  align?: 'left' | 'center' | 'right'
  headerAlign?: 'left' | 'center' | 'right'
  showOverflowTooltip?: boolean
  hidden?: boolean
  slot?: boolean
  headerSlot?: boolean
  formatter?: (row: any, column: TableColumn, cellValue: any) => string
}

interface TableSort {
  column: any
  prop: string
  order: 'ascending' | 'descending' | null
}

// Props定义
interface Props {
  // 数据相关
  data: any[]
  columns: TableColumn[]
  loading?: boolean
  emptyText?: string
  
  // 表格配置
  height?: string | number
  maxHeight?: string | number
  stripe?: boolean
  border?: boolean
  size?: 'large' | 'default' | 'small'
  rowKey?: string | ((row: any) => string)
  
  // 功能开关
  showToolbar?: boolean
  showRefresh?: boolean
  showColumnSetting?: boolean
  showSelection?: boolean
  showIndex?: boolean
  showActions?: boolean
  showPagination?: boolean
  
  // 选择相关
  selectionWidth?: number
  selectable?: (row: any, index: number) => boolean
  
  // 序号相关
  indexWidth?: number
  indexMethod?: (index: number) => number
  
  // 操作列相关
  actionsWidth?: number
  actionsFixed?: boolean | string
  
  // 分页相关
  page?: number
  pageSize?: number
  total?: number
  pageSizes?: number[]
  paginationLayout?: string
  paginationBackground?: boolean
  
  // 排序相关
  defaultSort?: TableSort
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  emptyText: '暂无数据',
  stripe: true,
  border: true,
  size: 'default',
  showToolbar: true,
  showRefresh: true,
  showColumnSetting: true,
  showSelection: false,
  showIndex: false,
  showActions: true,
  showPagination: true,
  selectionWidth: 55,
  indexWidth: 60,
  actionsWidth: 150,
  actionsFixed: 'right',
  page: 1,
  pageSize: 20,
  total: 0,
  pageSizes: () => [10, 20, 50, 100],
  paginationLayout: 'total, sizes, prev, pager, next, jumper',
  paginationBackground: true
})

// Emits定义
const emit = defineEmits<{
  refresh: []
  selectionChange: [selection: any[]]
  sortChange: [sort: TableSort]
  rowClick: [row: any, column: any, event: Event]
  rowDblClick: [row: any, column: any, event: Event]
  edit: [row: any]
  delete: [row: any]
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
}>()

// 响应式数据
const tableRef = ref()
const currentPage = ref(props.page)
const currentPageSize = ref(props.pageSize)

// 计算属性
const visibleColumns = computed(() => {
  return props.columns.filter(col => !col.hidden)
})

// 监听分页变化
watch(() => props.page, (newPage) => {
  currentPage.value = newPage
})

watch(() => props.pageSize, (newPageSize) => {
  currentPageSize.value = newPageSize
})

// 格式化单元格值
const formatCellValue = (row: any, column: TableColumn) => {
  const value = row[column.prop]
  
  if (column.formatter) {
    return column.formatter(row, column, value)
  }
  
  return value
}

// 切换列显示/隐藏
const toggleColumn = (column: TableColumn) => {
  column.hidden = !column.hidden
}

// 事件处理
const handleRefresh = () => {
  emit('refresh')
}

const handleSelectionChange = (selection: any[]) => {
  emit('selectionChange', selection)
}

const handleSortChange = (sort: TableSort) => {
  emit('sortChange', sort)
}

const handleRowClick = (row: any, column: any, event: Event) => {
  emit('rowClick', row, column, event)
}

const handleRowDblClick = (row: any, column: any, event: Event) => {
  emit('rowDblClick', row, column, event)
}

const handleEdit = (row: any) => {
  emit('edit', row)
}

const handleDelete = (row: any) => {
  emit('delete', row)
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  emit('pageChange', page)
}

const handlePageSizeChange = (pageSize: number) => {
  currentPageSize.value = pageSize
  currentPage.value = 1
  emit('pageSizeChange', pageSize)
}

// 暴露方法
const clearSelection = () => {
  tableRef.value?.clearSelection()
}

const toggleRowSelection = (row: any, selected?: boolean) => {
  tableRef.value?.toggleRowSelection(row, selected)
}

const toggleAllSelection = () => {
  tableRef.value?.toggleAllSelection()
}

const setCurrentRow = (row: any) => {
  tableRef.value?.setCurrentRow(row)
}

const clearSort = () => {
  tableRef.value?.clearSort()
}

const doLayout = () => {
  tableRef.value?.doLayout()
}

defineExpose({
  clearSelection,
  toggleRowSelection,
  toggleAllSelection,
  setCurrentRow,
  clearSort,
  doLayout
})
</script>

<style scoped lang="scss">
.base-table {
  .table-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    .toolbar-left,
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  
  .table-pagination {
    margin-top: 16px;
    text-align: right;
  }
}
</style>
