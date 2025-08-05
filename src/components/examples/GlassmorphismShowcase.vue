<template>
  <div class="glassmorphism-showcase">
    <div class="showcase-header">
      <h1>磨砂玻璃效果展示</h1>
      <p>Glassmorphism Design System Showcase</p>
    </div>
    
    <!-- 模态框示例 -->
    <section class="showcase-section">
      <h2>模态框示例</h2>
      <div class="showcase-buttons">
        <button class="glass-button glass-button-primary" @click="showStandardModal = true">
          标准模态框
        </button>
        <button class="glass-button glass-button-primary" @click="showConfirmDialog = true">
          确认对话框
        </button>
        <button class="glass-button glass-button-primary" @click="showCustomModal = true">
          自定义模态框
        </button>
      </div>
    </section>
    
    <!-- 卡片示例 -->
    <section class="showcase-section">
      <h2>卡片效果</h2>
      <div class="showcase-cards">
        <div class="glass-card" v-for="preset in cardPresets" :key="preset.name">
          <h3>{{ preset.name }}</h3>
          <p>{{ preset.description }}</p>
          <div class="card-preview" :class="`glass-${preset.type}`">
            预览效果
          </div>
        </div>
      </div>
    </section>
    
    <!-- 按钮示例 -->
    <section class="showcase-section">
      <h2>按钮效果</h2>
      <div class="showcase-buttons">
        <button class="glass-button">默认按钮</button>
        <button class="glass-button glass-button-primary">主要按钮</button>
        <button class="glass-button glass-button-secondary">次要按钮</button>
        <button class="glass-button" disabled>禁用按钮</button>
      </div>
    </section>
    
    <!-- 表单示例 -->
    <section class="showcase-section">
      <h2>表单效果</h2>
      <div class="showcase-form">
        <input class="glass-input" placeholder="磨砂玻璃输入框" />
        <textarea class="glass-input" placeholder="磨砂玻璃文本域" rows="3"></textarea>
        <select class="glass-input">
          <option>选择选项</option>
          <option>选项 1</option>
          <option>选项 2</option>
        </select>
      </div>
    </section>
    
    <!-- 模态框组件 -->
    <BaseModal
      v-model="showStandardModal"
      title="标准磨砂玻璃模态框"
      :show-default-footer="true"
      @confirm="showStandardModal = false"
      @cancel="showStandardModal = false"
    >
      <p>这是一个使用磨砂玻璃效果的标准模态框。</p>
      <p>具有以下特性：</p>
      <ul>
        <li>半透明背景</li>
        <li>背景模糊效果</li>
        <li>微妙的阴影和边框</li>
        <li>流畅的动画过渡</li>
      </ul>
    </BaseModal>
    
    <GlassConfirmDialog
      v-model="showConfirmDialog"
      title="确认操作"
      message="您确定要执行此操作吗？"
      sub-message="此操作不可撤销，请谨慎考虑。"
      type="warning"
      @confirm="handleConfirm"
      @cancel="showConfirmDialog = false"
    />
    
    <BaseModal
      v-model="showCustomModal"
      title="自定义磨砂玻璃模态框"
      width="600px"
      custom-class="custom-glass-modal"
    >
      <div class="custom-modal-content">
        <div class="glass-card">
          <h3>嵌套的磨砂玻璃卡片</h3>
          <p>这展示了磨砂玻璃效果的层次感。</p>
        </div>
        
        <div class="glass-card glass-card-interactive">
          <h3>交互式卡片</h3>
          <p>鼠标悬浮查看效果。</p>
        </div>
      </div>
      
      <template #footer>
        <button class="glass-button glass-button-secondary" @click="showCustomModal = false">
          关闭
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import GlassConfirmDialog from '@/components/common/GlassConfirmDialog.vue'
import { ElMessage } from 'element-plus'

const showStandardModal = ref(false)
const showConfirmDialog = ref(false)
const showCustomModal = ref(false)

const cardPresets = [
  {
    name: '标准卡片',
    description: '适用于大多数场景的标准磨砂玻璃效果',
    type: 'standard'
  },
  {
    name: '增强卡片',
    description: '更强的模糊效果和阴影，适用于重要内容',
    type: 'enhanced'
  },
  {
    name: '轻量卡片',
    description: '轻微的磨砂效果，适用于次要内容',
    type: 'light'
  },
  {
    name: '深度卡片',
    description: '最强的磨砂效果，适用于焦点内容',
    type: 'deep'
  }
]

const handleConfirm = () => {
  ElMessage.success('操作已确认')
  showConfirmDialog.value = false
}
</script>

<style lang="scss" scoped>
.glassmorphism-showcase {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 48px;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.15) 0%, transparent 50%);
    pointer-events: none;
  }
}

.showcase-header {
  text-align: center;
  margin-bottom: 48px;
  position: relative;
  z-index: 1;

  h1 {
    font-size: 3rem;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 16px;
  }

  p {
    font-size: 1.2rem;
    color: #4a4a4a;
    margin: 0;
  }
}

.showcase-section {
  @include glass-base;
  border-radius: var(--glass-radius-lg);
  padding: var(--glass-spacing-2xl);
  margin-bottom: var(--glass-spacing-2xl);
  position: relative;
  z-index: 1;
  
  h2 {
    color: var(--glass-text-primary);
    margin-bottom: var(--glass-spacing-lg);
    font-size: 1.5rem;
    font-weight: 600;
  }
}

.showcase-buttons {
  display: flex;
  gap: var(--glass-spacing-md);
  flex-wrap: wrap;
}

.showcase-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--glass-spacing-lg);
  
  .glass-card {
    padding: var(--glass-spacing-lg);
    
    h3 {
      color: var(--glass-text-primary);
      margin-bottom: var(--glass-spacing-sm);
      font-size: 1.2rem;
      font-weight: 600;
    }
    
    p {
      color: var(--glass-text-secondary);
      margin-bottom: var(--glass-spacing-md);
      line-height: 1.5;
    }
    
    .card-preview {
      padding: var(--glass-spacing-md);
      text-align: center;
      border-radius: var(--glass-radius-md);
      font-weight: 500;
      color: var(--glass-text-primary);
    }
  }
}

.showcase-form {
  display: flex;
  flex-direction: column;
  gap: var(--glass-spacing-md);
  max-width: 400px;
}

.custom-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--glass-spacing-lg);
}

// 自定义模态框样式
:deep(.custom-glass-modal) {
  .glass-modal-body {
    padding: var(--glass-spacing-2xl);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .glassmorphism-showcase {
    padding: var(--glass-spacing-lg);
  }
  
  .showcase-header h1 {
    font-size: 2rem;
  }
  
  .showcase-section {
    padding: var(--glass-spacing-lg);
  }
  
  .showcase-buttons {
    flex-direction: column;
  }
  
  .showcase-cards {
    grid-template-columns: 1fr;
  }
}
</style>
