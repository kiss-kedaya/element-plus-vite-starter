<template>
  <div class="group-management">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>群组管理</span>
          <el-button type="primary" size="small" @click="refreshGroups">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>
      
      <div class="groups-list">
        <div v-if="groupsLoading" class="loading-container">
          <el-skeleton :rows="3" animated />
        </div>
        
        <div v-else-if="groups.length === 0" class="empty-groups">
          <el-empty description="暂无群组" />
        </div>
        
        <div v-else class="groups-grid">
          <div v-for="group in groups" :key="group.id" class="group-item">
            <el-avatar :src="group.avatar" :size="50" shape="square">
              {{ group.name.charAt(0) }}
            </el-avatar>
            <div class="group-info">
              <div class="group-name">{{ group.name }}</div>
              <div class="group-members">{{ group.memberCount }} 人</div>
              <div class="group-desc" v-if="group.description">{{ group.description }}</div>
            </div>
            <div class="group-actions">
              <el-button type="primary" size="small" @click="viewGroupDetails(group)">
                详情
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

// Props
const props = defineProps<{
  account: any
}>()

// 响应式数据
const groupsLoading = ref(false)

// 群组数据
const groups = ref([])

// 方法
const refreshGroups = async () => {
  groupsLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    ElMessage.success('群组列表已刷新')
  } catch (error) {
    ElMessage.error('刷新失败')
  } finally {
    groupsLoading.value = false
  }
}

const viewGroupDetails = (group) => {
  ElMessage.info(`查看群组 ${group.name} 的详情`)
}

onMounted(() => {
  refreshGroups()
})
</script>

<style scoped lang="scss">
.group-management {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.groups-list {
  height: 400px;
  overflow-y: auto;
}

.loading-container {
  padding: 20px;
}

.empty-groups {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  gap: 16px;
}

.group-info {
  flex: 1;
  
  .group-name {
    font-weight: 500;
    margin-bottom: 4px;
  }
  
  .group-members {
    font-size: 14px;
    color: #666;
    margin-bottom: 4px;
  }
  
  .group-desc {
    font-size: 12px;
    color: #999;
  }
}
</style>
