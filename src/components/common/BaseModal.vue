<template>
  <el-dialog
    v-model="visible"
    :title="title"
    :width="width"
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
  max-height: 60vh;
  overflow-y: auto;
}

.base-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
