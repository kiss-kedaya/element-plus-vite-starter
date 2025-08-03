<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCrossAccountMessageStore } from '@/stores/crossAccountMessage'

// 强制使用浅色模式，禁用自动夜间模式检测
// const isDark = useDark()
const authStore = useAuthStore()
const crossAccountMessageStore = useCrossAccountMessageStore()

// 应用初始化
onMounted(async () => {
  console.log('应用启动，初始化认证状态...')
  try {
    // 获取已登录账号并设置当前账号
    await authStore.fetchLoggedAccounts()

    // 初始化跨账号消息监听
    crossAccountMessageStore.initializeCrossAccountMessaging()
  } catch (error) {
    console.error('应用初始化失败:', error)
  }
})

// 应用销毁时清理
onUnmounted(() => {
  crossAccountMessageStore.destroy()
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
