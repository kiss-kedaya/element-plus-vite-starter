<template>
  <div class="auto-reply">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>自动回复设置</span>
          <el-switch v-model="autoReplyEnabled" @change="toggleAutoReply" />
        </div>
      </template>
      
      <div class="reply-rules">
        <div class="rules-header">
          <h4>回复规则</h4>
          <el-button type="primary" size="small" @click="addRule">
            <el-icon><Plus /></el-icon>
            添加规则
          </el-button>
        </div>
        
        <div v-if="rules.length === 0" class="empty-rules">
          <el-empty description="暂无自动回复规则">
            <el-button type="primary" @click="addRule">添加第一个规则</el-button>
          </el-empty>
        </div>
        
        <div v-else class="rules-list">
          <div v-for="(rule, index) in rules" :key="rule.id" class="rule-item">
            <div class="rule-content">
              <div class="rule-trigger">
                <span class="label">触发词：</span>
                <el-tag>{{ rule.trigger }}</el-tag>
              </div>
              <div class="rule-response">
                <span class="label">回复内容：</span>
                <span class="response-text">{{ rule.response }}</span>
              </div>
            </div>
            <div class="rule-actions">
              <el-switch v-model="rule.enabled" size="small" />
              <el-button link size="small" @click="editRule(rule)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button link size="small" @click="deleteRule(index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 添加/编辑规则对话框 -->
    <el-dialog v-model="showRuleDialog" :title="editingRule ? '编辑规则' : '添加规则'" width="500px">
      <el-form :model="ruleForm" label-width="80px">
        <el-form-item label="触发词">
          <el-input v-model="ruleForm.trigger" placeholder="输入触发关键词" />
        </el-form-item>
        <el-form-item label="回复内容">
          <el-input v-model="ruleForm.response" type="textarea" :rows="3" placeholder="输入自动回复内容" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRuleDialog = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'

// Props
const props = defineProps<{
  account: any
}>()

// 响应式数据
const autoReplyEnabled = ref(false)
const showRuleDialog = ref(false)
const editingRule = ref(null)

const ruleForm = ref({
  trigger: '',
  response: '',
  enabled: true
})

// 自动回复规则
const rules = ref([])

// 方法
const toggleAutoReply = (enabled) => {
  ElMessage.success(enabled ? '自动回复已启用' : '自动回复已关闭')
}

const addRule = () => {
  editingRule.value = null
  ruleForm.value = {
    trigger: '',
    response: '',
    enabled: true
  }
  showRuleDialog.value = true
}

const editRule = (rule) => {
  editingRule.value = rule
  ruleForm.value = { ...rule }
  showRuleDialog.value = true
}

const saveRule = () => {
  if (!ruleForm.value.trigger || !ruleForm.value.response) {
    ElMessage.warning('请填写完整的规则信息')
    return
  }

  if (editingRule.value) {
    // 编辑现有规则
    Object.assign(editingRule.value, ruleForm.value)
    ElMessage.success('规则更新成功')
  } else {
    // 添加新规则
    const newRule = {
      id: Date.now(),
      ...ruleForm.value
    }
    rules.value.push(newRule)
    ElMessage.success('规则添加成功')
  }

  showRuleDialog.value = false
}

const deleteRule = async (index) => {
  try {
    await ElMessageBox.confirm('确定要删除这个自动回复规则吗？', '确认删除', {
      type: 'warning'
    })
    
    rules.value.splice(index, 1)
    ElMessage.success('规则已删除')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.auto-reply {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  
  h4 {
    margin: 0;
    color: #333;
  }
}

.empty-rules {
  text-align: center;
  padding: 40px;
}

.rules-list {
  max-height: 400px;
  overflow-y: auto;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 12px;
}

.rule-content {
  flex: 1;
  
  .rule-trigger, .rule-response {
    margin-bottom: 8px;
    
    .label {
      font-weight: 500;
      color: #666;
      margin-right: 8px;
    }
  }
  
  .response-text {
    color: #333;
  }
}

.rule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
