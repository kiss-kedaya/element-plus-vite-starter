<template>
  <el-button
    :type="type"
    :size="size"
    :plain="plain"
    :round="round"
    :circle="circle"
    :loading="loading"
    :disabled="disabled"
    :icon="icon"
    :autofocus="autofocus"
    :native-type="nativeType"
    :auto-insert-space="autoInsertSpace"
    :color="color"
    :dark="dark"
    :link="link"
    :text="text"
    :bg="bg"
    :tag="tag"
    :class="buttonClass"
    @click="handleClick"
  >
    <slot />
  </el-button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

type ButtonType = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
type ButtonSize = 'large' | 'default' | 'small'
type NativeType = 'button' | 'submit' | 'reset'

interface Props {
  type?: ButtonType
  size?: ButtonSize
  plain?: boolean
  round?: boolean
  circle?: boolean
  loading?: boolean
  disabled?: boolean
  icon?: string | Component
  autofocus?: boolean
  nativeType?: NativeType
  autoInsertSpace?: boolean
  color?: string
  dark?: boolean
  link?: boolean
  text?: boolean
  bg?: boolean
  tag?: string | Component
  variant?: 'solid' | 'outline' | 'ghost' | 'soft'
  block?: boolean
}

interface Emits {
  (e: 'click', event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  size: 'default',
  plain: false,
  round: false,
  circle: false,
  loading: false,
  disabled: false,
  autofocus: false,
  nativeType: 'button',
  autoInsertSpace: true,
  dark: false,
  link: false,
  text: false,
  bg: false,
  tag: 'button',
  variant: 'solid',
  block: false
})

const emit = defineEmits<Emits>()

const buttonClass = computed(() => {
  const classes = []
  
  if (props.variant) {
    classes.push(`base-button--${props.variant}`)
  }
  
  if (props.block) {
    classes.push('base-button--block')
  }
  
  return classes.join(' ')
})

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style lang="scss" scoped>
.base-button--outline {
  border: 1px solid var(--el-button-border-color);
  background: transparent;
  
  &:hover {
    background: var(--el-button-hover-bg-color);
  }
}

.base-button--ghost {
  border: none;
  background: transparent;
  
  &:hover {
    background: var(--el-button-hover-bg-color);
  }
}

.base-button--soft {
  border: none;
  background: var(--el-button-bg-color);
  opacity: 0.8;
  
  &:hover {
    opacity: 1;
  }
}

.base-button--block {
  width: 100%;
  display: block;
}
</style>
