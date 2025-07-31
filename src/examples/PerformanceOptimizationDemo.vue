<template>
  <div class="performance-demo">
    <h1>性能优化示例</h1>
    
    <!-- 虚拟滚动示例 -->
    <section class="demo-section">
      <h2>虚拟滚动 - 大量数据列表</h2>
      <div class="demo-controls">
        <el-button @click="generateLargeList">生成 10000 条数据</el-button>
        <el-button @click="clearList">清空列表</el-button>
        <span>当前数据量: {{ largeList.length }}</span>
      </div>
      
      <VirtualList
        :items="largeList"
        :item-height="60"
        :container-height="400"
        class="demo-virtual-list"
      >
        <template #default="{ item, index }">
          <div class="list-item">
            <div class="item-index">#{{ index + 1 }}</div>
            <div class="item-content">
              <h4>{{ item.title }}</h4>
              <p>{{ item.description }}</p>
            </div>
            <div class="item-actions">
              <el-button size="small">操作</el-button>
            </div>
          </div>
        </template>
      </VirtualList>
    </section>

    <!-- 虚拟消息列表示例 -->
    <section class="demo-section">
      <h2>虚拟消息列表 - 聊天场景</h2>
      <div class="demo-controls">
        <el-button @click="generateMessages">生成 1000 条消息</el-button>
        <el-button @click="addMessage">添加消息</el-button>
        <el-button @click="clearMessages">清空消息</el-button>
        <span>当前消息数: {{ messages.length }}</span>
      </div>
      
      <VirtualMessageList
        ref="messageListRef"
        :items="messages"
        :container-height="400"
        :estimated-item-height="80"
        class="demo-message-list"
        @reach-top="loadMoreMessages"
      >
        <template #default="{ item: message }">
          <div class="message-demo-item" :class="{ 'from-me': message.fromMe }">
            <div class="message-avatar">
              <el-avatar :size="32">{{ message.fromMe ? '我' : 'U' }}</el-avatar>
            </div>
            <div class="message-content">
              <div class="message-bubble">
                {{ message.content }}
              </div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>
        </template>
      </VirtualMessageList>
    </section>

    <!-- 图片懒加载示例 -->
    <section class="demo-section">
      <h2>图片懒加载</h2>
      <div class="demo-controls">
        <el-button @click="generateImages">生成 50 张图片</el-button>
        <el-button @click="clearImages">清空图片</el-button>
        <span>当前图片数: {{ images.length }}</span>
      </div>
      
      <div class="image-grid">
        <LazyImage
          v-for="image in images"
          :key="image.id"
          :src="image.url"
          :width="200"
          :height="150"
          :previewable="true"
          class="demo-image"
          @load="handleImageLoad"
          @error="handleImageError"
        />
      </div>
    </section>

    <!-- 懒加载指令示例 -->
    <section class="demo-section">
      <h2>懒加载指令</h2>
      <div class="demo-controls">
        <el-button @click="generateDirectiveImages">生成指令图片</el-button>
        <el-button @click="clearDirectiveImages">清空指令图片</el-button>
      </div>
      
      <div class="directive-images">
        <img
          v-for="image in directiveImages"
          :key="image.id"
          v-lazy="image.url"
          :alt="image.alt"
          class="directive-image"
          @lazy-loaded="handleLazyLoaded"
          @lazy-error="handleLazyError"
        />
      </div>
    </section>

    <!-- 性能监控 -->
    <section class="demo-section">
      <h2>性能监控</h2>
      <div class="performance-stats">
        <div class="stat-item">
          <label>平均加载时间:</label>
          <span>{{ averageLoadTime.toFixed(2) }}ms</span>
        </div>
        <div class="stat-item">
          <label>成功加载:</label>
          <span>{{ loadStats.success }}</span>
        </div>
        <div class="stat-item">
          <label>加载失败:</label>
          <span>{{ loadStats.error }}</span>
        </div>
      </div>
      
      <el-button @click="showPerformanceReport">查看详细报告</el-button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VirtualList from '@/components/common/VirtualList.vue'
import VirtualMessageList from '@/components/common/VirtualMessageList.vue'
import LazyImage from '@/components/common/LazyImage.vue'
import { performanceMonitor } from '@/utils/lazyLoad'

// 大量数据列表
const largeList = ref<any[]>([])

// 消息列表
const messages = ref<any[]>([])
const messageListRef = ref<InstanceType<typeof VirtualMessageList>>()

// 图片列表
const images = ref<any[]>([])
const directiveImages = ref<any[]>([])

// 性能统计
const loadStats = ref({
  success: 0,
  error: 0
})

const averageLoadTime = computed(() => {
  return performanceMonitor.getAverageLoadTime()
})

// 生成大量数据
function generateLargeList() {
  const newList = []
  for (let i = 0; i < 10000; i++) {
    newList.push({
      id: i,
      title: `项目 ${i + 1}`,
      description: `这是第 ${i + 1} 个项目的描述信息，包含一些详细内容...`
    })
  }
  largeList.value = newList
}

function clearList() {
  largeList.value = []
}

// 生成消息
function generateMessages() {
  const newMessages = []
  for (let i = 0; i < 1000; i++) {
    newMessages.push({
      id: i,
      content: `这是第 ${i + 1} 条消息内容，可能包含很长的文本...`,
      timestamp: new Date(Date.now() - i * 60000),
      fromMe: Math.random() > 0.5
    })
  }
  messages.value = newMessages
}

function addMessage() {
  const newMessage = {
    id: messages.value.length,
    content: `新消息 ${messages.value.length + 1}`,
    timestamp: new Date(),
    fromMe: true
  }
  messages.value.push(newMessage)
}

function clearMessages() {
  messages.value = []
}

function loadMoreMessages() {
  console.log('加载更多历史消息...')
}

// 生成图片
function generateImages() {
  const newImages = []
  for (let i = 0; i < 50; i++) {
    newImages.push({
      id: i,
      url: `https://picsum.photos/200/150?random=${i}`,
      alt: `图片 ${i + 1}`
    })
  }
  images.value = newImages
}

function clearImages() {
  images.value = []
}

function generateDirectiveImages() {
  const newImages = []
  for (let i = 0; i < 30; i++) {
    newImages.push({
      id: i,
      url: `https://picsum.photos/150/100?random=${i + 100}`,
      alt: `指令图片 ${i + 1}`
    })
  }
  directiveImages.value = newImages
}

function clearDirectiveImages() {
  directiveImages.value = []
}

// 事件处理
function handleImageLoad(event: Event) {
  loadStats.value.success++
  performanceMonitor.end('image-load')
}

function handleImageError(event: Event) {
  loadStats.value.error++
  performanceMonitor.error('image-load', new Error('Image load failed'))
}

function handleLazyLoaded(event: CustomEvent) {
  console.log('懒加载成功:', event.detail.src)
  loadStats.value.success++
}

function handleLazyError(event: CustomEvent) {
  console.log('懒加载失败:', event.detail.src)
  loadStats.value.error++
}

function formatTime(timestamp: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}

function showPerformanceReport() {
  const report = performanceMonitor.getReport()
  console.log('性能报告:', report)
  alert(`性能报告已输出到控制台\n平均加载时间: ${averageLoadTime.value.toFixed(2)}ms`)
}

onMounted(() => {
  // 开始性能监控
  performanceMonitor.start('image-load')
})
</script>

<style lang="scss" scoped>
.performance-demo {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.demo-section {
  margin-bottom: 40px;
  padding: 20px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--border-radius-lg);
  background: var(--color-bg-page);
}

.demo-controls {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.demo-virtual-list {
  border: 1px solid var(--color-border-light);
  border-radius: var(--border-radius-md);
}

.list-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-lighter);
  
  &:last-child {
    border-bottom: none;
  }
}

.item-index {
  width: 60px;
  font-weight: bold;
  color: var(--color-text-secondary);
}

.item-content {
  flex: 1;
  
  h4 {
    margin: 0 0 4px 0;
    font-size: var(--font-size-base);
  }
  
  p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}

.demo-message-list {
  border: 1px solid var(--color-border-light);
  border-radius: var(--border-radius-md);
  background: var(--color-bg-container);
}

.message-demo-item {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  
  &.from-me {
    flex-direction: row-reverse;
    
    .message-content {
      align-items: flex-end;
    }
    
    .message-bubble {
      background: var(--color-primary);
      color: white;
    }
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 70%;
}

.message-bubble {
  padding: 8px 12px;
  border-radius: var(--border-radius-md);
  background: var(--color-fill-light);
  word-wrap: break-word;
}

.message-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
  margin-top: 4px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.demo-image {
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.directive-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.directive-image {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: var(--border-radius-sm);
}

.performance-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  padding: 12px;
  background: var(--color-fill-light);
  border-radius: var(--border-radius-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  label {
    font-weight: 500;
  }
  
  span {
    font-weight: bold;
    color: var(--color-primary);
  }
}
</style>
