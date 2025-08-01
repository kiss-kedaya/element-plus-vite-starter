<template>
  <div class="proxy-filter">
    <el-card>
      <el-row :gutter="16">
        <el-col :span="6">
          <el-select
            v-model="localFilters.status"
            placeholder="状态筛选"
            clearable
            @change="handleFilterChange"
          >
            <el-option label="全部" value="" />
            <el-option label="可用" value="active" />
            <el-option label="未测试" value="inactive" />
            <el-option label="测试中" value="testing" />
            <el-option label="错误" value="error" />
          </el-select>
        </el-col>
        
        <el-col :span="6">
          <el-select
            v-model="localFilters.country"
            placeholder="地区筛选"
            clearable
            @change="handleFilterChange"
          >
            <el-option label="全部" value="" />
            <el-option
              v-for="country in countries"
              :key="country"
              :label="country"
              :value="country"
            />
          </el-select>
        </el-col>
        
        <el-col :span="8">
          <el-input
            v-model="localFilters.keyword"
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
          <div class="filter-actions">
            <el-button
              type="warning"
              @click="handleTestSelected"
              :disabled="selectedCount === 0"
            >
              <el-icon><Connection /></el-icon>
              测试选中 ({{ selectedCount }})
            </el-button>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Search, Connection } from '@element-plus/icons-vue'

// Props定义
interface Props {
  filters: {
    status: string
    country: string
    keyword: string
  }
  countries: string[]
  selectedCount: number
}

const props = defineProps<Props>()

// Emits定义
const emit = defineEmits<{
  'update:filters': [filters: typeof props.filters]
  'filter-change': []
  'test-selected': []
}>()

// 本地筛选条件
const localFilters = reactive({ ...props.filters })

// 监听props变化
watch(() => props.filters, (newFilters) => {
  Object.assign(localFilters, newFilters)
}, { deep: true })

// 处理筛选变化
const handleFilterChange = () => {
  emit('update:filters', { ...localFilters })
  emit('filter-change')
}

// 处理测试选中
const handleTestSelected = () => {
  emit('test-selected')
}
</script>

<style scoped lang="scss">
.proxy-filter {
  margin-bottom: 20px;
  
  .filter-actions {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
