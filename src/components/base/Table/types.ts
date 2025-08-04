// 表格列配置
export interface TableColumn {
  prop: string                    // 字段名
  label: string                   // 列标题
  width?: string | number         // 列宽度
  minWidth?: string | number      // 最小宽度
  fixed?: boolean | 'left' | 'right'  // 固定列
  sortable?: boolean | 'custom'   // 是否可排序
  align?: 'left' | 'center' | 'right'  // 对齐方式
  headerAlign?: 'left' | 'center' | 'right'  // 表头对齐方式
  showOverflowTooltip?: boolean   // 是否显示溢出提示
  hidden?: boolean                // 是否隐藏
  slot?: boolean                  // 是否使用插槽
  headerSlot?: boolean            // 是否使用表头插槽
  formatter?: (row: any, column: TableColumn, cellValue: any) => string  // 格式化函数
}

// 表格排序
export interface TableSort {
  column: any
  prop: string
  order: 'ascending' | 'descending' | null
}

// 表格选择
export interface TableSelection {
  selection: any[]
  row?: any
  selected?: boolean
}

// 分页配置
export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
  pageSizes?: number[]
  layout?: string
  background?: boolean
}

// 表格操作按钮
export interface TableAction {
  label: string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  icon?: string
  disabled?: boolean | ((row: any) => boolean)
  visible?: boolean | ((row: any) => boolean)
  handler: (row: any) => void
}

// 表格配置
export interface TableConfig {
  // 基础配置
  height?: string | number
  maxHeight?: string | number
  stripe?: boolean
  border?: boolean
  size?: 'large' | 'default' | 'small'
  
  // 功能配置
  showSelection?: boolean
  showIndex?: boolean
  showActions?: boolean
  showPagination?: boolean
  showToolbar?: boolean
  
  // 分页配置
  pagination?: PaginationConfig
  
  // 操作配置
  actions?: TableAction[]
}

// 表格事件
export interface TableEvents {
  onRefresh?: () => void
  onSelectionChange?: (selection: any[]) => void
  onSortChange?: (sort: TableSort) => void
  onRowClick?: (row: any, column: any, event: Event) => void
  onRowDblClick?: (row: any, column: any, event: Event) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

// 表格实例方法
export interface TableMethods {
  clearSelection: () => void
  toggleRowSelection: (row: any, selected?: boolean) => void
  toggleAllSelection: () => void
  setCurrentRow: (row: any) => void
  clearSort: () => void
  doLayout: () => void
}

// 表格组件Props
export interface TableProps {
  data: any[]
  columns: TableColumn[]
  loading?: boolean
  config?: TableConfig
  events?: TableEvents
}

// 导出所有类型（重命名以避免冲突）
export type {
  TableColumn as BaseTableColumn,
  TableSort as BaseTableSort,
  TableSelection as BaseTableSelection,
  PaginationConfig as BasePaginationConfig,
  TableAction as BaseTableAction,
  TableConfig as BaseTableConfig,
  TableEvents as BaseTableEvents,
  TableMethods as BaseTableMethods,
  TableProps as BaseTableProps
}
