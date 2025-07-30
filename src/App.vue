<script setup lang="ts">
// import { useDark } from '@vueuse/core'
// import { useAuthStore } from '@/stores/auth'

// 强制使用浅色模式，禁用自动夜间模式检测
// const isDark = useDark()
// const authStore = useAuthStore()
</script>

<template>
  <div id="app" class="app-container">
    <el-config-provider namespace="ep">
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
</style>
