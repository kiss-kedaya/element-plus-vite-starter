<template>
  <el-dialog
    v-model="visible"
    :title="title"
    :width="width"
    :top="top"
    :before-close="handleClose"
    :append-to-body="appendToBody"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :show-close="showClose"
    :modal="modal"
    :lock-scroll="lockScroll"
    :custom-class="customClass"
    @open="handleOpen"
    @opened="handleOpened"
    @close="handleClose"
    @closed="handleClosed"
  >
    <!-- 头部插槽 -->
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <!-- 主体内容 -->
    <div class="base-modal-body" :class="bodyClass">
      <slot />
    </div>

    <!-- 底部插槽 -->
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>

    <!-- 默认底部按钮 -->
    <template v-else-if="showDefaultFooter" #footer>
      <div class="base-modal-footer">
        <el-button @click="handleCancel">
          {{ cancelText }}
        </el-button>
        <el-button 
          type="primary" 
          :loading="confirmLoading"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  width?: string | number
  top?: string
  appendToBody?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  showClose?: boolean
  modal?: boolean
  lockScroll?: boolean
  customClass?: string
  bodyClass?: string
  showDefaultFooter?: boolean
  cancelText?: string
  confirmText?: string
  confirmLoading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'open'): void
  (e: 'opened'): void
  (e: 'close'): void
  (e: 'closed'): void
  (e: 'cancel'): void
  (e: 'confirm'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '50%',
  top: '15vh',
  appendToBody: true,
  closeOnClickModal: true,
  closeOnPressEscape: true,
  showClose: true,
  modal: true,
  lockScroll: true,
  customClass: '',
  bodyClass: '',
  showDefaultFooter: false,
  cancelText: '取消',
  confirmText: '确定',
  confirmLoading: false
})

const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const handleOpen = () => {
  emit('open')
}

const handleOpened = () => {
  emit('opened')
}

const handleClose = () => {
  emit('close')
  emit('update:modelValue', false)
}

const handleClosed = () => {
  emit('closed')
}

const handleCancel = () => {
  emit('cancel')
  handleClose()
}

const handleConfirm = () => {
  emit('confirm')
}
</script>

<style lang="scss" scoped>
.base-modal-body {
  min-height: 100px;
  // 移除这里的滚动条，让对话框本身处理滚动
  overflow-y: visible;
}

.base-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

<style lang="scss">
// 响应式对话框样式 - 优化高度计算，避免不必要的滚动条
.el-dialog {
  margin: 0 auto;

  // 小屏幕适配
  @media (max-width: 768px) {
    width: 95vw !important;
    margin: 3vh auto;
    max-height: 94vh;

    .el-dialog__body {
      max-height: calc(94vh - 120px);
      overflow-y: auto;
    }
  }

  // 中等屏幕适配
  @media (min-width: 769px) and (max-width: 1200px) {
    width: 85vw !important;
    max-width: 900px;
    margin: 5vh auto;
    max-height: 90vh;

    .el-dialog__body {
      max-height: calc(90vh - 120px);
      overflow-y: auto;
    }
  }

  // 大屏幕适配
  @media (min-width: 1201px) {
    max-width: 1000px;
    margin: 8vh auto;
    max-height: 84vh;

    .el-dialog__body {
      max-height: calc(84vh - 120px);
      overflow-y: auto;
    }
  }
}
</style>
