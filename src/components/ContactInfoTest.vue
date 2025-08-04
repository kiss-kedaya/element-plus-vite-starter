<template>
  <div class="contact-info-test">
    <el-card header="联系人信息实时更新测试">
      <div class="test-controls">
        <el-form :model="testForm" label-width="120px">
          <el-form-item label="当前账号">
            <el-input v-model="testForm.accountWxid" placeholder="输入账号微信ID" />
          </el-form-item>
          <el-form-item label="联系人微信ID">
            <el-input v-model="testForm.contactWxid" placeholder="输入联系人微信ID" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="updateContactInfo" :loading="isUpdating">
              更新联系人信息
            </el-button>
            <el-button @click="clearCache">清除缓存</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="contact-display" v-if="contactInfo">
        <h3>联系人信息</h3>
        <div class="contact-item">
          <div class="contact-avatar">
            <img v-if="contactInfo.avatar" :src="contactInfo.avatar" alt="头像" />
            <div v-else class="avatar-placeholder">{{ getAvatarText(contactInfo.nickname || contactInfo.wxid) }}</div>
          </div>
          <div class="contact-details">
            <p><strong>微信ID:</strong> {{ contactInfo.wxid }}</p>
            <p><strong>昵称:</strong> {{ contactInfo.nickname || '无' }}</p>
            <p><strong>备注:</strong> {{ contactInfo.remark || '无' }}</p>
            <p><strong>微信号:</strong> {{ contactInfo.alias || '无' }}</p>
            <p><strong>类型:</strong> {{ contactInfo.isGroup ? '群聊' : '个人' }}</p>
            <p><strong>最后更新:</strong> {{ formatTime(contactInfo.lastUpdated) }}</p>
            <p v-if="contactInfo.isGroup"><strong>群成员数:</strong> {{ contactInfo.memberCount || '未知' }}</p>
            <p v-if="!contactInfo.isGroup"><strong>地区:</strong> {{ contactInfo.region || '未知' }}</p>
          </div>
        </div>
      </div>

      <div class="cache-info">
        <h3>缓存信息</h3>
        <p>当前缓存的联系人数量: {{ cachedContactsCount }}</p>
        <el-button @click="showCacheDetails = !showCacheDetails">
          {{ showCacheDetails ? '隐藏' : '显示' }}缓存详情
        </el-button>
        
        <div v-if="showCacheDetails" class="cache-details">
          <pre>{{ JSON.stringify(allContacts, null, 2) }}</pre>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useContactStore } from '@/stores/contact'

const contactStore = useContactStore()

// 表单数据
const testForm = ref({
  accountWxid: '',
  contactWxid: ''
})

// 状态
const isUpdating = ref(false)
const contactInfo = ref(null)
const showCacheDetails = ref(false)

// 计算属性
const cachedContactsCount = computed(() => {
  const accountContacts = contactStore.contacts[testForm.value.accountWxid]
  return accountContacts ? Object.keys(accountContacts).length : 0
})

const allContacts = computed(() => {
  return contactStore.contacts[testForm.value.accountWxid] || {}
})

// 方法
const updateContactInfo = async () => {
  if (!testForm.value.accountWxid || !testForm.value.contactWxid) {
    ElMessage.warning('请输入账号和联系人微信ID')
    return
  }

  isUpdating.value = true
  try {
    const result = await contactStore.updateContactInfo(
      testForm.value.accountWxid,
      testForm.value.contactWxid,
      true // 强制刷新
    )

    if (result) {
      contactInfo.value = result
      ElMessage.success('联系人信息更新成功')
    } else {
      ElMessage.error('更新联系人信息失败')
    }
  } catch (error) {
    console.error('更新联系人信息失败:', error)
    ElMessage.error('更新联系人信息失败')
  } finally {
    isUpdating.value = false
  }
}

const clearCache = () => {
  if (testForm.value.accountWxid) {
    contactStore.clearContactCache(testForm.value.accountWxid)
    contactInfo.value = null
    ElMessage.success('缓存已清除')
  } else {
    ElMessage.warning('请先输入账号微信ID')
  }
}

const getAvatarText = (name: string): string => {
  return name ? name.charAt(0).toUpperCase() : '?'
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString()
}

// 生命周期
onMounted(() => {
  // 可以在这里设置默认的测试数据
  // testForm.value.accountWxid = 'your_test_wxid'
})
</script>

<style scoped>
.contact-info-test {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-controls {
  margin-bottom: 20px;
}

.contact-display {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.contact-item {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.contact-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.contact-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
}

.contact-details p {
  margin: 5px 0;
  line-height: 1.5;
}

.cache-info {
  margin-top: 30px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}

.cache-details {
  margin-top: 10px;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
