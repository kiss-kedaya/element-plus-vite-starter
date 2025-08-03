<template>
  <div class="loading-spinner" :class="spinnerClass">
    <div v-if="type === 'default'" class="spinner-default">
      <div class="spinner-circle"></div>
    </div>

    <div v-else-if="type === 'dots'" class="spinner-dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>

    <div v-else-if="type === 'pulse'" class="spinner-pulse">
      <div class="pulse-circle"></div>
    </div>

    <el-icon v-else-if="type === 'element'" class="spinner-element" :size="iconSize">
      <Loading />
    </el-icon>

    <div v-if="text" class="spinner-text" :style="{ color: textColor }">
      {{ text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Loading } from '@element-plus/icons-vue'

type SpinnerType = 'default' | 'dots' | 'pulse' | 'element'
type SpinnerSize = 'small' | 'medium' | 'large'

interface Props {
  type?: SpinnerType
  size?: SpinnerSize
  color?: string
  textColor?: string
  text?: string
  overlay?: boolean
  fullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  size: 'medium',
  color: '#409eff',
  textColor: '#606266',
  text: '',
  overlay: false,
  fullscreen: false
})

const spinnerClass = computed(() => {
  const classes = [`spinner-${props.size}`]

  if (props.overlay) {
    classes.push('spinner-overlay')
  }

  if (props.fullscreen) {
    classes.push('spinner-fullscreen')
  }

  return classes.join(' ')
})

const iconSize = computed(() => {
  const sizeMap = {
    small: 16,
    medium: 24,
    large: 32
  }
  return sizeMap[props.size]
})
</script>

<style lang="scss" scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spinner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(2px);
}

.spinner-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
}

// 尺寸变体
.spinner-small {
  .spinner-circle {
    width: 16px;
    height: 16px;
  }

  .spinner-text {
    font-size: 12px;
  }
}

.spinner-medium {
  .spinner-circle {
    width: 24px;
    height: 24px;
  }

  .spinner-text {
    font-size: 14px;
  }
}

.spinner-large {
  .spinner-circle {
    width: 32px;
    height: 32px;
  }

  .spinner-text {
    font-size: 16px;
  }
}

// 默认旋转圆圈
.spinner-default {
  .spinner-circle {
    border: 2px solid #f3f3f3;
    border-top: 2px solid v-bind(color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

// 点状加载
.spinner-dots {
  display: flex;
  gap: 4px;

  .dot {
    width: 6px;
    height: 6px;
    background: v-bind(color);
    border-radius: 50%;
    animation: dot-pulse 1.4s ease-in-out infinite both;

    &:nth-child(1) {
      animation-delay: -0.32s;
    }

    &:nth-child(2) {
      animation-delay: -0.16s;
    }

    &:nth-child(3) {
      animation-delay: 0s;
    }
  }
}

// 脉冲效果
.spinner-pulse {
  .pulse-circle {
    width: 24px;
    height: 24px;
    background: v-bind(color);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }
}

// Element Plus 图标
.spinner-element {
  color: v-bind(color);
  animation: spin 1s linear infinite;
}

.spinner-text {
  margin-top: 8px;
  font-size: 14px;
  color: v-bind(textColor);
}

// 动画定义
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes dot-pulse {

  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }

  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0% {
    transform: scale(0);
    opacity: 1;
  }

  100% {
    transform: scale(1);
    opacity: 0;
  }
}
</style>
