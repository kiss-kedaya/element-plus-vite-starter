<template>
  <!-- 磨砂玻璃模态框 -->
  <Teleport to="body">
    <Transition name="glass-overlay" appear>
      <div
        v-if="visible"
        class="glass-modal-overlay"
        @click="handleOverlayClick"
      >
        <div class="glass-modal-container" @click.stop>
          <Transition name="glass-modal" appear>
            <div
              v-if="visible"
              class="glass-modal"
              :class="[customClass, glassMorphismClass]"
              :style="modalStyle"
            >
              <!-- 头部 -->
              <div v-if="title || $slots.header || showClose" class="glass-modal-header">
                <slot name="header">
                  <h3 class="glass-modal-title">{{ title }}</h3>
                </slot>

                <button
                  v-if="showClose"
                  class="glass-modal-close"
                  @click="handleClose"
                  :aria-label="closeAriaLabel"
                >
                  <svg class="glass-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <!-- 主体内容 -->
              <div class="glass-modal-body" :class="bodyClass">
                <slot />
              </div>

              <!-- 底部 -->
              <div v-if="$slots.footer || showDefaultFooter" class="glass-modal-footer">
                <slot name="footer">
                  <div v-if="showDefaultFooter" class="glass-modal-actions">
                    <button
                      class="glass-button glass-button-secondary"
                      @click="handleCancel"
                      :disabled="confirmLoading"
                    >
                      {{ cancelText }}
                    </button>
                    <button
                      class="glass-button glass-button-primary"
                      @click="handleConfirm"
                      :disabled="confirmLoading"
                    >
                      <span v-if="confirmLoading" class="glass-loading-spinner"></span>
                      {{ confirmText }}
                    </button>
                  </div>
                </slot>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  width?: string | number
  height?: string | number
  maxWidth?: string | number
  maxHeight?: string | number
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  showClose?: boolean
  lockScroll?: boolean
  customClass?: string
  bodyClass?: string
  showDefaultFooter?: boolean
  cancelText?: string
  confirmText?: string
  confirmLoading?: boolean
  closeAriaLabel?: string
  glassMorphism?: boolean
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
  width: '600px',
  height: 'auto',
  maxWidth: '90vw',
  maxHeight: '90vh',
  closeOnClickModal: true,
  closeOnPressEscape: true,
  showClose: true,
  lockScroll: true,
  customClass: '',
  bodyClass: '',
  showDefaultFooter: false,
  cancelText: '取消',
  confirmText: '确定',
  confirmLoading: false,
  closeAriaLabel: '关闭',
  glassMorphism: true
})

const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 计算模态框样式
const modalStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: props.height !== 'auto' ? (typeof props.height === 'number' ? `${props.height}px` : props.height) : undefined,
  maxWidth: typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth,
  maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
}))

// 计算磨砂玻璃样式类
const glassMorphismClass = computed(() => ({
  'glass-modal-enhanced': props.glassMorphism,
  'glass-modal-standard': !props.glassMorphism
}))

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.closeOnPressEscape && visible.value) {
    handleClose()
  }
}

// 遮罩层点击处理
const handleOverlayClick = () => {
  if (props.closeOnClickModal) {
    handleClose()
  }
}

// 生命周期管理
onMounted(() => {
  if (props.closeOnPressEscape) {
    document.addEventListener('keydown', handleKeydown)
  }

  if (props.lockScroll && visible.value) {
    document.body.style.overflow = 'hidden'
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})

// 事件处理方法
const handleOpen = () => {
  if (props.lockScroll) {
    document.body.style.overflow = 'hidden'
  }
  emit('open')
}

const handleOpened = () => {
  emit('opened')
}

const handleClose = () => {
  if (props.lockScroll) {
    document.body.style.overflow = ''
  }
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

// 磨砂玻璃模态框容器
.glass-modal-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2001;

  @media (max-width: 768px) {
    padding: 16px;
    align-items: flex-start;
    padding-top: 10vh;
  }
}

// 增强的磨砂玻璃效果
.glass-modal-enhanced {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 50%,
      rgba(255, 255, 255, 0.1) 100%
    );
    border-radius: inherit;
    pointer-events: none;
  }
}

// 标准模态框样式（回退）
.glass-modal-standard {
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

// 模态框动作按钮组
.glass-modal-actions {
  display: flex;
  gap: 16px;

  @media (max-width: 480px) {
    flex-direction: column-reverse;
    gap: 8px;
  }
}

// 加载动画
.glass-loading-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: glass-spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes glass-spin {
  to {
    transform: rotate(360deg);
  }
}

// 过渡动画
.glass-overlay-enter-active,
.glass-overlay-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-overlay-enter-from,
.glass-overlay-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
  -webkit-backdrop-filter: blur(0);
}

.glass-modal-enter-active,
.glass-modal-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-modal-enter-from,
.glass-modal-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

// 响应式设计
@media (max-width: 480px) {
  .glass-modal {
    margin: 8px;
    border-radius: 12px;
  }

  .glass-modal-header {
    padding: 16px;

    .glass-modal-title {
      font-size: 16px;
      padding-right: 40px;
    }
  }

  .glass-modal-body {
    padding: 16px;
  }

  .glass-modal-footer {
    padding: 16px;
  }
}

// 可访问性增强
.glass-modal-close:focus {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}

.glass-button:focus {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}

// 高对比度模式支持
@media (prefers-contrast: high) {
  .glass-modal-enhanced {
    background: rgba(255, 255, 255, 0.98);
    border-color: rgba(0, 0, 0, 0.2);
  }

  .glass-modal-title {
    color: #000;
  }
}

// 减少动画模式支持
@media (prefers-reduced-motion: reduce) {
  .glass-overlay-enter-active,
  .glass-overlay-leave-active,
  .glass-modal-enter-active,
  .glass-modal-leave-active,
  .glass-button,
  .glass-modal-close {
    transition: none;
  }

  .glass-loading-spinner {
    animation: none;
  }
}
</style>
