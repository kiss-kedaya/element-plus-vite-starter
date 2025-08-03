<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

// 强制使用浅色模式，禁用自动夜间模式检测
// const isDark = useDark()
const authStore = useAuthStore()

// 应用初始化
onMounted(async () => {
  console.log('应用启动，初始化认证状态...')
  try {
    // 获取已登录账号并设置当前账号
    await authStore.fetchLoggedAccounts()
  } catch (error) {
    console.error('应用初始化失败:', error)
  }
})
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
