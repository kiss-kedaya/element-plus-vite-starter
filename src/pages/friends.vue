<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFriendStore } from '@/stores/friend'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  User, 
  Search, 
  Plus, 
  Refresh,
  Phone,
  Message,
  Delete,
  UserFilled
} from '@element-plus/icons-vue'
import type { Friend } from '@/types/friend'

// 临时内联常量定义，避免导入问题
const FRIEND_SCENE = {
  QQ: 1,              // QQ来源
  EMAIL: 2,           // 邮箱来源
  WECHAT_ID: 3,       // 微信号来源
  ADDRESS_BOOK: 13,   // 通讯录来源
  CHAT_ROOM: 14,      // 群聊来源
  PHONE: 15,          // 手机号来源
  NEARBY: 18,         // 附近的人
  BOTTLE: 25,         // 漂流瓶
  SHAKE: 29,          // 摇一摇
  QRCODE: 30          // 二维码
} as const

const router = useRouter()
const authStore = useAuthStore()
const friendStore = useFriendStore()

const activeTab = ref('list')
const searchKeyword = ref('')
const selectedFriends = ref<string[]>([])

// 搜索表单
const searchForm = reactive({
  keyword: '',
  searchType: 'wxid' // wxid 或 phone
})

// 批量添加表单
const batchForm = reactive({
  targets: '',
  message: '你好，我想加你为好友'
})

// 搜索结果
const searchResults = ref<any[]>([])
const isSearching = ref(false)

onMounted(() => {
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }
  
  loadFriends()
})

const currentFriends = computed(() => {
  if (!authStore.currentAccount) return []
  const friends = friendStore.currentFriends(authStore.currentAccount.wxid)
  
  if (searchKeyword.value) {
    return friends.filter(friend => 
      friend.nickname.includes(searchKeyword.value) ||
      friend.wxid.includes(searchKeyword.value) ||
      (friend.remark && friend.remark.includes(searchKeyword.value))
    )
  }
  
  return friends
})

const loadFriends = async () => {
  if (!authStore.currentAccount) return
  
  try {
    await friendStore.loadFriends(authStore.currentAccount.wxid, true)
    ElMessage.success('好友列表加载完成')
  } catch (error) {
    ElMessage.error('加载好友列表失败')
    console.error('加载好友列表失败:', error)
  }
}

const searchContact = async () => {
  if (!searchForm.keyword.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  
  if (!authStore.currentAccount) {
    ElMessage.error('请先选择账号')
    return
  }

  isSearching.value = true
  searchResults.value = []
  
  try {
    const result = await friendStore.searchContact(
      authStore.currentAccount.wxid,
      searchForm.keyword.trim()
    )
    
    if (result.Success && result.Data) {
      searchResults.value = [{
        wxid: result.Data.UserName?.string || '',
        nickname: result.Data.NickName?.string || '',
        avatar: result.Data.SmallHeadImgUrl || '',
        signature: result.Data.Signature || '',
        sex: result.Data.Sex || 0,
        // 根据新的响应数据结构设置V1和V2
        v1: result.Data.UserName?.string || '', // V1使用UserName (v3_...@stranger)
        v2: result.Data.AntispamTicket || '' // V2使用AntispamTicket (v4_...@stranger)
      }]
      ElMessage.success('搜索完成')
    } else {
      ElMessage.warning(result.Message || '未找到相关用户')
    }
  } catch (error) {
    ElMessage.error('搜索失败')
    console.error('搜索失败:', error)
  } finally {
    isSearching.value = false
  }
}

const addFriend = async (contact: any, verifyMessage?: string) => {
  if (!authStore.currentAccount) {
    ElMessage.error('请先选择账号')
    return
  }

  // 验证必要参数
  if (!contact.v1 || !contact.v2) {
    ElMessage.error('联系人信息不完整，请重新搜索')
    return
  }

  try {
    const message = verifyMessage || `你好，我是${authStore.currentAccount.nickname}`
    const result = await friendStore.sendFriendRequest(
      authStore.currentAccount.wxid,
      contact.v1,
      contact.v2,
      message,
      FRIEND_SCENE.WECHAT_ID // 通过微信号搜索添加
    )

    if (result.Success) {
      ElMessage.success('好友请求发送成功')
    } else {
      ElMessage.error(result.Message || '发送好友请求失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '发送好友请求失败')
    console.error('发送好友请求失败:', error)
  }
}

const batchAddFriends = async () => {
  if (!batchForm.targets.trim()) {
    ElMessage.warning('请输入要添加的好友列表')
    return
  }
  
  if (!authStore.currentAccount) {
    ElMessage.error('请先选择账号')
    return
  }

  const targets = batchForm.targets
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(identifier => ({
      identifier,
      message: batchForm.message
    }))

  if (targets.length === 0) {
    ElMessage.warning('请输入有效的好友标识')
    return
  }

  try {
    const results = await friendStore.batchAddFriends(authStore.currentAccount.wxid, targets)
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount
    
    ElMessage.success(`批量添加完成：成功 ${successCount} 个，失败 ${failCount} 个`)
    
    // 显示详细结果
    const failedTargets = results.filter(r => !r.success)
    if (failedTargets.length > 0) {
      const failedList = failedTargets.map(r => `${r.target}: ${r.message}`).join('\n')
      ElMessageBox.alert(failedList, '失败详情', { type: 'warning' })
    }
  } catch (error) {
    ElMessage.error('批量添加失败')
    console.error('批量添加失败:', error)
  }
}

const deleteFriend = async (friend: Friend) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除好友 ${friend.nickname} 吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    // 这里调用删除好友的API
    ElMessage.success('删除成功')
    loadFriends()
  } catch (error) {
    // 用户取消删除
  }
}

const sendMessage = async (friend: Friend) => {
  if (!authStore.currentAccount) {
    ElMessage.error('请先选择账号')
    return
  }

  try {
    // 导入聊天store
    const { useChatStore } = await import('@/stores/chat')
    const chatStore = useChatStore()

    // 创建或获取聊天会话
    const session = chatStore.createOrGetSession(friend)

    // 设置当前会话
    chatStore.setCurrentSession(session.id)

    // 跳转到dashboard页面的聊天功能标签
    await router.push('/dashboard?tab=chat')

    ElMessage.success(`已开始与 ${friend.nickname} 的聊天`)
  } catch (error) {
    console.error('开始聊天失败:', error)
    ElMessage.error('开始聊天失败，请重试')
  }
}

const goBack = () => {
  router.push('/dashboard')
}

const selectAccount = async (account: any) => {
  // 如果切换到不同的账号，先清空当前好友列表
  if (authStore.currentAccount?.wxid !== account.wxid) {
    friends.value = []
    filteredFriends.value = []
    searchKeyword.value = ''
    ElMessage.info(`已切换到账号：${account.nickname}，正在获取通讯录...`)
  }

  authStore.setCurrentAccount(account.wxid)

  // 自动获取新账号的缓存通讯录
  await loadFriends()
}

const getSexText = (sex: number) => {
  switch (sex) {
    case 1: return '男'
    case 2: return '女'
    default: return '未知'
  }
}

// 处理可能是对象的显示值
const getDisplayValue = (value: any): string => {
  if (value === null || value === undefined) {
    return ''
  }

  // 如果是字符串，直接返回
  if (typeof value === 'string') {
    return value
  }

  // 如果是数字，转换为字符串
  if (typeof value === 'number') {
    return String(value)
  }

  // 如果是对象，尝试各种可能的属性
  if (typeof value === 'object') {
    // 检查是否是空对象
    if (Object.keys(value).length === 0) {
      return ''
    }

    // 尝试 string 属性
    if (value.string !== undefined && value.string !== null && value.string !== '') {
      return String(value.string)
    }

    // 尝试 value 属性
    if (value.value !== undefined && value.value !== null && value.value !== '') {
      return String(value.value)
    }

    // 尝试 text 属性
    if (value.text !== undefined && value.text !== null && value.text !== '') {
      return String(value.text)
    }

    // 如果都没有有效值，返回空字符串
    return ''
  }

  // 其他情况直接转换为字符串
  return String(value)
}
</script>

<template>
  <div class="friends-container">
    <!-- 左侧账号选择 -->
    <div class="account-sidebar">
      <div class="sidebar-header">
        <h3>选择账号</h3>
      </div>
      
      <div class="account-list">
        <div 
          v-for="account in authStore.accounts" 
          :key="account.wxid"
          :class="['account-item', { active: authStore.currentAccount?.wxid === account.wxid }]"
          @click="selectAccount(account)"
        >
          <el-avatar :src="account.avatar" :size="32">
            <el-icon><User /></el-icon>
          </el-avatar>
          <div class="account-info">
            <div class="nickname">{{ account.nickname }}</div>
            <div class="status">{{ account.status === 'online' ? '在线' : '离线' }}</div>
          </div>
        </div>
      </div>
      
      <div class="sidebar-footer">
        <el-button @click="goBack" link>
          返回聊天
        </el-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <div class="content-header">
        <h2>好友管理</h2>
        <div class="header-actions">
          <el-button @click="loadFriends" :loading="friendStore.isLoading">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="content-tabs">
        <!-- 好友列表 -->
        <el-tab-pane label="好友列表" name="list">
          <div class="friends-list-panel">
            <div class="list-header">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索好友..."
                style="width: 300px;"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              
              <div class="friend-stats">
                共 {{ currentFriends.length }} 个好友
              </div>
            </div>
            
            <div class="friends-grid">
              <div 
                v-for="friend in currentFriends" 
                :key="friend.wxid"
                class="friend-card"
              >
                <el-avatar :src="friend.avatar" :size="60">
                  <el-icon><UserFilled /></el-icon>
                </el-avatar>
                
                <div class="friend-info">
                  <div class="friend-name">{{ getDisplayValue(friend.remark) || getDisplayValue(friend.nickname) }}</div>
                  <div class="friend-wxid">{{ getDisplayValue(friend.wxid) }}</div>
                  <div class="friend-meta">
                    {{ getSexText(friend.sex) }}
                    <span v-if="getDisplayValue(friend.signature)" class="signature">
                      | {{ getDisplayValue(friend.signature) }}
                    </span>
                  </div>
                </div>
                
                <div class="friend-actions">
                  <el-button size="small" @click="sendMessage(friend)">
                    <el-icon><Message /></el-icon>
                    聊天
                  </el-button>
                  <el-button size="small" type="danger" @click="deleteFriend(friend)">
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 搜索添加 -->
        <el-tab-pane label="搜索添加" name="search">
          <div class="search-panel">
            <el-form :model="searchForm" label-width="100px">
              <el-form-item label="搜索类型">
                <el-radio-group v-model="searchForm.searchType">
                  <el-radio value="wxid">微信号</el-radio>
                  <el-radio value="phone">手机号</el-radio>
                </el-radio-group>
              </el-form-item>
              
              <el-form-item label="关键词">
                <el-input
                  v-model="searchForm.keyword"
                  :placeholder="searchForm.searchType === 'wxid' ? '输入微信号' : '输入手机号'"
                  style="width: 300px;"
                >
                  <template #append>
                    <el-button @click="searchContact" :loading="isSearching">
                      <el-icon><Search /></el-icon>
                      搜索
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
            </el-form>
            
            <div v-if="searchResults.length > 0" class="search-results">
              <h4>搜索结果</h4>
              <div class="result-list">
                <div 
                  v-for="contact in searchResults" 
                  :key="contact.wxid"
                  class="result-item"
                >
                  <el-avatar :src="contact.avatar" :size="50">
                    <el-icon><UserFilled /></el-icon>
                  </el-avatar>
                  
                  <div class="contact-info">
                    <div class="contact-name">{{ getDisplayValue(contact.nickname) }}</div>
                    <div class="contact-wxid">{{ getDisplayValue(contact.wxid) }}</div>
                    <div class="contact-signature">{{ getDisplayValue(contact.signature) || '暂无签名' }}</div>
                  </div>
                  
                  <el-button type="primary" @click="addFriend(contact)">
                    <el-icon><Plus /></el-icon>
                    添加好友
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 批量添加 -->
        <el-tab-pane label="批量添加" name="batch">
          <div class="batch-panel">
            <el-form :model="batchForm" label-width="100px">
              <el-form-item label="验证消息">
                <el-input
                  v-model="batchForm.message"
                  placeholder="输入好友验证消息"
                  style="width: 400px;"
                />
              </el-form-item>
              
              <el-form-item label="好友列表">
                <el-input
                  v-model="batchForm.targets"
                  type="textarea"
                  :rows="10"
                  placeholder="每行一个微信号或手机号，例如：&#10;wxid_123456&#10;13800138000&#10;wxid_abcdef"
                  style="width: 400px;"
                />
              </el-form-item>
              
              <el-form-item>
                <el-button 
                  type="primary" 
                  @click="batchAddFriends"
                  :loading="friendStore.isAdding"
                >
                  <el-icon><Plus /></el-icon>
                  开始批量添加
                </el-button>
              </el-form-item>
            </el-form>
            
            <el-alert
              title="批量添加说明"
              type="info"
              :closable="false"
              show-icon
            >
              <p>1. 每行输入一个微信号或手机号</p>
              <p>2. 系统会自动搜索并发送好友请求</p>
              <p>3. 为避免频率限制，每个请求间隔2秒</p>
              <p>4. 建议单次添加不超过50个好友</p>
            </el-alert>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
.friends-container {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}

/* 左侧账号栏 */
.account-sidebar {
  width: 250px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid #e8e8e8;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.account-list {
  flex: 1;
  overflow-y: auto;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.account-item:hover {
  background: #f0f0f0;
}

.account-item.active {
  background: #e6f7ff;
  border-right: 3px solid #1890ff;
}

.account-info {
  margin-left: 0.75rem;
  flex: 1;
}

.nickname {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

.status {
  font-size: 0.8rem;
  color: #999;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid #e8e8e8;
  text-align: center;
}

/* 主要内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
}

.content-header {
  padding: 1rem 2rem;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.content-header h2 {
  margin: 0;
  color: #333;
}

.content-tabs {
  flex: 1;
  padding: 0 2rem;
}

/* 好友列表 */
.friends-list-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-header {
  padding: 1rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.friend-stats {
  color: #666;
  font-size: 0.9rem;
}

.friends-grid {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.friend-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: box-shadow 0.2s;
}

.friend-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-wxid {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.friend-meta {
  font-size: 0.8rem;
  color: #999;
}

.signature {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-actions {
  display: flex;
  gap: 0.5rem;
}

/* 搜索面板 */
.search-panel {
  padding: 2rem 0;
}

.search-results {
  margin-top: 2rem;
}

.search-results h4 {
  margin-bottom: 1rem;
  color: #333;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.contact-info {
  flex: 1;
}

.contact-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

.contact-wxid {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.contact-signature {
  font-size: 0.8rem;
  color: #999;
}

/* 批量添加面板 */
.batch-panel {
  padding: 2rem 0;
}

.batch-panel .el-alert {
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .account-sidebar {
    width: 200px;
  }

  .friends-grid {
    grid-template-columns: 1fr;
  }

  .content-header {
    padding: 1rem;
  }

  .content-tabs {
    padding: 0 1rem;
  }
}
</style>
