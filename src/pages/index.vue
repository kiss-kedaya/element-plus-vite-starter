<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
// import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { User, ChatDotRound, UserFilled, Setting } from '@element-plus/icons-vue'

const router = useRouter()
// const authStore = useAuthStore()

const isLoading = ref(false)

// onMounted(() => {
//   // 检查是否有已登录的账号
//   if (authStore.isLoggedIn) {
//     router.push('/chat')
//   }
// })

const goToLogin = () => {
  router.push('/login')
}

const goToChat = () => {
  router.push('/dashboard')
}

const goToProxyTest = () => {
  router.push('/proxy-test')
}
</script>

<template>
  <div class="home-container">
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="title">微信机器人管理平台</h1>
        <p class="subtitle">
          支持多账号登录、好友管理、智能聊天等功能
        </p>

        <div class="feature-grid">
          <div class="feature-card">
            <el-icon size="48" color="#409EFF">
              <User />
            </el-icon>
            <h3>多账号管理</h3>
            <p>支持同时管理多个微信账号，快速切换操作</p>
          </div>

          <div class="feature-card">
            <el-icon size="48" color="#67C23A">
              <ChatDotRound />
            </el-icon>
            <h3>智能聊天</h3>
            <p>支持文本、图片、文件等多种消息类型发送</p>
          </div>

          <div class="feature-card">
            <el-icon size="48" color="#E6A23C">
              <UserFilled />
            </el-icon>
            <h3>好友管理</h3>
            <p>批量添加好友、管理好友列表、处理好友请求</p>
          </div>
        </div>

        <div class="action-buttons">
          <el-button
            type="primary"
            size="large"
            @click="goToLogin"
            :loading="isLoading"
          >
            开始使用
          </el-button>

          <el-button
            type="success"
            size="large"
            @click="goToChat"
          >
            进入聊天
          </el-button>

          <el-button
            type="warning"
            size="large"
            @click="goToProxyTest"
          >
            <el-icon><Setting /></el-icon>
            代理管理
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.hero-section {
  text-align: center;
  max-width: 1200px;
  padding: 2rem;
}

.hero-content {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 3rem;
  font-weight: bold;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, #fff, #f0f0f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 1.2rem;
  margin-bottom: 3rem;
  opacity: 0.9;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-card h3 {
  margin: 1rem 0;
  font-size: 1.3rem;
}

.feature-card p {
  opacity: 0.8;
  line-height: 1.6;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.account-status {
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .title {
    font-size: 2rem;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>
