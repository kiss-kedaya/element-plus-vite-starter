<script setup lang="ts">
// import { useDark } from '@vueuse/core'
// import { useAuthStore } from '@/stores/auth'

// 强制使用浅色模式，禁用自动夜间模式检测
// const isDark = useDark()
// const authStore = useAuthStore()
</script>

<template>
  <div id="app" class="app-container">
    <el-config-provider namespace="ep" :z-index="3000">
      <router-view />
    </el-config-provider>
  </div>
</template>

<style>
#app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  color: var(--ep-text-color-primary);
}

.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 修复Element Plus MessageBox样式 - 使用ep命名空间 */
.ep-message-box__wrapper {
  z-index: 9999 !important;
}

.ep-message-box {
  z-index: 10000 !important;
  background-color: #ffffff !important;
  border: 1px solid #dcdfe6 !important;
  border-radius: 4px !important;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1) !important;
}

.ep-message-box__header {
  background-color: #ffffff !important;
  border-bottom: 1px solid #ebeef5 !important;
}

.ep-message-box__content {
  background-color: #ffffff !important;
  color: #606266 !important;
}

.ep-message-box__btns {
  background-color: #ffffff !important;
  border-top: 1px solid #ebeef5 !important;
}

/* 确保MessageBox的遮罩层样式正确 */
.ep-overlay {
  z-index: 9998 !important;
  background-color: rgba(0, 0, 0, 0.5) !important;
}
</style>
