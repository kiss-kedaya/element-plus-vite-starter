<template>
  <BaseModal
    v-model="visible"
    :title="title"
    width="400px"
    :show-default-footer="true"
    :confirm-loading="loading"
    :cancel-text="cancelText"
    :confirm-text="confirmText"
    :close-on-click-modal="closeOnClickModal"
    custom-class="glass-confirm-dialog"
    @confirm="handleConfirm"
    @cancel="handleCancel"
    @close="handleClose"
  >
    <div class="glass-confirm-content">
      <!-- 图标 -->
      <div v-if="type" class="glass-confirm-icon" :class="`glass-confirm-icon--${type}`">
        <component :is="iconComponent" />
      </div>
      
      <!-- 消息内容 -->
      <div class="glass-confirm-message">
        <p class="glass-confirm-text">{{ message }}</p>
        <p v-if="subMessage" class="glass-confirm-subtext">{{ subMessage }}</p>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { 
  QuestionFilled, 
  WarningFilled, 
  CircleCheckFilled, 
  CircleCloseFilled,
  InfoFilled 
} from '@element-plus/icons-vue'

type ConfirmType = 'info' | 'success' | 'warning' | 'error' | 'question'

interface Props {
  modelValue: boolean
  title?: string
  message: string
  subMessage?: string
  type?: ConfirmType
  confirmText?: string
  cancelText?: string
  closeOnClickModal?: boolean
  loading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认',
  type: 'question',
  confirmText: '确定',
  cancelText: '取消',
  closeOnClickModal: false,
  loading: false
})

const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 图标组件映射
const iconComponent = computed(() => {
  const iconMap = {
    info: InfoFilled,
    success: CircleCheckFilled,
    warning: WarningFilled,
    error: CircleCloseFilled,
    question: QuestionFilled
  }
  return iconMap[props.type || 'question']
})

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  visible.value = false
}

const handleClose = () => {
  emit('close')
  visible.value = false
}
</script>

<style lang="scss" scoped>
.glass-confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
}

.glass-confirm-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  
  &--info {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
  }
  
  &--success {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }
  
  &--warning {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
  }
  
  &--error {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
  }
  
  &--question {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }
}

.glass-confirm-message {
  flex: 1;
  min-width: 0;
}

.glass-confirm-text {
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
  margin: 0 0 8px 0;
  line-height: 1.5;
}

.glass-confirm-subtext {
  font-size: 14px;
  color: #4a4a4a;
  margin: 0;
  line-height: 1.4;
}

// 对话框特定样式
:deep(.glass-confirm-dialog) {
  .glass-modal {
    max-width: 480px;
  }
  
  .glass-modal-body {
    padding: 24px 24px 16px;
  }

  .glass-modal-footer {
    padding: 16px 24px 24px;
  }
}

// 响应式设计
@media (max-width: 480px) {
  .glass-confirm-content {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .glass-confirm-icon {
    align-self: center;
  }

  .glass-confirm-text {
    font-size: 15px;
  }

  .glass-confirm-subtext {
    font-size: 13px;
  }
}
</style>
