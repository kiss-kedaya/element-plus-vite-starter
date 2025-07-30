<template>
  <div class="friend-management">
    <!-- 搜索和添加好友 -->
    <el-card class="search-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>添加好友</span>
        </div>
      </template>
      
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="搜索方式">
          <el-select v-model="searchForm.type" placeholder="选择搜索方式">
            <el-option label="微信号" value="wxid" />
            <el-option label="手机号" value="phone" />
            <el-option label="QQ号" value="qq" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="搜索内容">
          <el-input v-model="searchForm.keyword" placeholder="输入搜索内容" style="width: 200px" />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" :loading="searchLoading" @click="searchUser">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
        </el-form-item>
      </el-form>
      
      <!-- 搜索结果 -->
      <div v-if="searchResult" class="search-result">
        <el-divider content-position="left">搜索结果</el-divider>
        <div class="user-card">
          <el-avatar :src="searchResult.avatar" :size="50">
            {{ searchResult.nickname.charAt(0) }}
          </el-avatar>
          <div class="user-info">
            <div class="nickname">{{ searchResult.nickname }}</div>
            <div class="wxid">微信号：{{ searchResult.wxid }}</div>
            <div class="region" v-if="searchResult.region">地区：{{ searchResult.region }}</div>
          </div>
          <div class="actions">
            <el-button type="primary" :loading="addFriendLoading" @click="addFriend">
              <el-icon><UserFilled /></el-icon>
              添加好友
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 好友列表 -->
    <el-card class="friends-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>好友列表 ({{ filteredFriends.length }})</span>
          <div class="header-actions">
            <el-input v-model="friendFilter" placeholder="搜索好友" size="small" style="width: 200px">
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-checkbox v-model="forceRefreshCache" size="small" style="margin-right: 10px">
              强制刷新缓存
            </el-checkbox>
            <el-button type="primary" size="small" @click="refreshFriends" :loading="friendsLoading">
              <el-icon><Refresh /></el-icon>
              刷新通讯录
            </el-button>
          </div>
        </div>
      </template>
      
      <div class="friends-list">
        <div v-if="friendsLoading" class="loading-container">
          <el-skeleton :rows="5" animated />
        </div>
        
        <div v-else-if="filteredFriends.length === 0" class="empty-friends">
          <el-empty description="暂无好友">
            <el-button type="primary" @click="refreshFriends">刷新好友列表</el-button>
          </el-empty>
        </div>
        
        <div v-else class="friends-grid">
          <div v-for="friend in filteredFriends" :key="friend.wxid" class="friend-item">
            <el-avatar :src="friend.avatar" :size="40">
              {{ friend.nickname.charAt(0) }}
            </el-avatar>
            <div class="friend-info">
              <div class="nickname" :title="friend.nickname">{{ friend.nickname }}</div>
              <div class="wxid">{{ friend.wxid }}</div>
              <div class="remark" v-if="friend.remark">备注：{{ friend.remark }}</div>
            </div>
            <div class="friend-actions">
              <el-dropdown @command="handleFriendAction">
                <el-button link size="small">
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="`chat-${friend.wxid}`">
                      <el-icon><ChatDotRound /></el-icon>
                      发送消息
                    </el-dropdown-item>
                    <el-dropdown-item :command="`remark-${friend.wxid}`">
                      <el-icon><Edit /></el-icon>
                      修改备注
                    </el-dropdown-item>
                    <el-dropdown-item :command="`delete-${friend.wxid}`" divided>
                      <el-icon><Delete /></el-icon>
                      删除好友
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 修改备注对话框 -->
    <el-dialog v-model="showRemarkDialog" title="修改备注" width="400px">
      <el-form :model="remarkForm" label-width="80px">
        <el-form-item label="好友">
          <span>{{ currentFriend?.nickname }}</span>
        </el-form-item>
        <el-form-item label="备注名">
          <el-input v-model="remarkForm.remark" placeholder="输入备注名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRemarkDialog = false">取消</el-button>
        <el-button type="primary" @click="updateRemark">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, UserFilled, Refresh, MoreFilled, ChatDotRound, Edit, Delete } from '@element-plus/icons-vue'
import { friendApi } from '@/api/friend'
import type { SearchContactRequest, SendFriendRequestRequest } from '@/types/friend'

// Props
const props = defineProps<{
  account: any
}>()

// 响应式数据
const searchForm = ref({
  type: 'wxid',
  keyword: ''
})

const searchResult = ref(null)
const searchLoading = ref(false)
const addFriendLoading = ref(false)
const friendsLoading = ref(false)
const friendFilter = ref('')
const forceRefreshCache = ref(false)
const showRemarkDialog = ref(false)
const currentFriend = ref(null)
const remarkForm = ref({
  remark: ''
})

// 好友数据
const friends = ref([])

// 计算属性
const filteredFriends = computed(() => {
  if (!friendFilter.value) return friends.value
  
  const keyword = friendFilter.value.toLowerCase()
  return friends.value.filter(friend => 
    friend.nickname.toLowerCase().includes(keyword) ||
    friend.wxid.toLowerCase().includes(keyword) ||
    (friend.remark && friend.remark.toLowerCase().includes(keyword))
  )
})

// 方法
const searchUser = async () => {
  if (!searchForm.value.keyword.trim()) {
    ElMessage.warning('请输入搜索内容')
    return
  }

  if (!props.account?.wxid) {
    ElMessage.error('请先登录账号')
    return
  }

  searchLoading.value = true
  try {
    const params: SearchContactRequest = {
      Wxid: props.account.wxid,
      ToUserName: searchForm.value.keyword,
      FromScene: 0,
      SearchScene: 1
    }

    const response = await friendApi.searchContact(params)

    if (response.Success && response.Data) {
      searchResult.value = {
        wxid: response.Data.UserName?.string || searchForm.value.keyword,
        nickname: response.Data.NickName?.string || '未知用户',
        avatar: response.Data.BigHeadImgUrl || '',
        region: '未知',
        signature: response.Data.Signature || '',
        v1: response.Data.V1,
        v2: response.Data.V2,
        antispamTicket: response.Data.AntispamTicket
      }

      ElMessage.success('搜索完成')
    } else {
      throw new Error(response.Message || '未找到用户')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '搜索失败')
    console.error('搜索用户失败:', error)
    searchResult.value = null
  } finally {
    searchLoading.value = false
  }
}

const addFriend = async () => {
  if (!searchResult.value || !props.account?.wxid) return

  addFriendLoading.value = true
  try {
    const params: SendFriendRequestRequest = {
      Wxid: props.account.wxid,
      V1: searchResult.value.v1 || '',
      V2: searchResult.value.v2 || '',
      Opcode: 1,
      Scene: 1,
      VerifyContent: '你好，我想加你为好友'
    }

    const response = await friendApi.sendFriendRequest(params)

    if (response.Success) {
      ElMessage.success('好友请求已发送')
      searchResult.value = null
      searchForm.value.keyword = ''
      // 刷新好友列表
      await refreshFriends()
    } else {
      throw new Error(response.Message || '发送好友请求失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '添加好友失败')
    console.error('添加好友失败:', error)
  } finally {
    addFriendLoading.value = false
  }
}

const refreshFriends = async () => {
  if (!props.account?.wxid) {
    ElMessage.error('请先登录账号')
    return
  }

  friendsLoading.value = true
  try {
    const params = {
      Wxid: props.account.wxid,
      CurrentWxcontactSeq: 0,
      CurrentChatRoomContactSeq: 0,
      force_refresh: forceRefreshCache.value
    }

    console.log('刷新通讯录参数:', params)
    const response = await friendApi.getSimplifiedContactList(params)

    if (response.Success) {
      if (response.Data?.ContactList) {
        friends.value = response.Data.ContactList.map((contact: any) => ({
          wxid: contact.UserName,
          nickname: contact.NickName || contact.UserName,
          avatar: contact.BigHeadImgUrl || '',
          remark: contact.Remark || '',
          signature: contact.Signature || '',
          sex: contact.Sex || 0,
          isOnline: false
        }))

        // 显示加载结果，包含缓存信息
        let message = `已加载 ${friends.value.length} 个好友`
        if (response.Message?.includes('缓存')) {
          message += forceRefreshCache.value ? ' (已强制刷新)' : ` (${response.Message})`
        } else if (forceRefreshCache.value) {
          message += ' (已强制刷新)'
        }
        ElMessage.success(message)
      } else {
        friends.value = []
        ElMessage.info('通讯录为空')
      }
    } else {
      throw new Error(response.Message || '获取好友列表失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '刷新失败')
    console.error('刷新好友列表失败:', error)
  } finally {
    friendsLoading.value = false
  }
}

const handleFriendAction = async (command: string) => {
  const [action, wxid] = command.split('-')
  const friend = friends.value.find(f => f.wxid === wxid)
  
  if (action === 'chat') {
    ElMessage.info(`准备与 ${friend.nickname} 聊天`)
    // 这里可以切换到聊天界面
    // emit('switch-to-chat', friend)
  } else if (action === 'remark') {
    currentFriend.value = friend
    remarkForm.value.remark = friend.remark || ''
    showRemarkDialog.value = true
  } else if (action === 'delete') {
    try {
      await ElMessageBox.confirm(`确定要删除好友 ${friend.nickname} 吗？`, '确认删除', {
        type: 'warning'
      })
      
      const index = friends.value.findIndex(f => f.wxid === wxid)
      friends.value.splice(index, 1)
      ElMessage.success('好友已删除')
    } catch {
      // 用户取消
    }
  }
}

const updateRemark = async () => {
  if (!currentFriend.value) return
  
  try {
    // 模拟更新备注
    await new Promise(resolve => setTimeout(resolve, 500))
    
    currentFriend.value.remark = remarkForm.value.remark
    showRemarkDialog.value = false
    ElMessage.success('备注修改成功')
  } catch (error) {
    ElMessage.error('修改备注失败')
  }
}

onMounted(() => {
  refreshFriends()
})
</script>

<style scoped lang="scss">
.friend-management {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .search-form {
    margin-bottom: 0;
  }
  
  .search-result {
    margin-top: 16px;
    
    .user-card {
      display: flex;
      align-items: center;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      gap: 16px;
      
      .user-info {
        flex: 1;
        
        .nickname {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .wxid, .region {
          font-size: 14px;
          color: #666;
          margin-bottom: 2px;
        }
      }
    }
  }
}

.friends-card {
  flex: 1;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-actions {
      display: flex;
      gap: 8px;
    }
  }
  
  :deep(.el-card__body) {
    height: calc(100% - 60px);
    overflow: hidden;
  }
}

.friends-list {
  height: 100%;
  overflow-y: auto;
}

.loading-container {
  padding: 20px;
}

.empty-friends {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.friends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  padding: 8px;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.3s;
  gap: 12px;
  
  &:hover {
    background: #e9ecef;
  }
  
  .friend-info {
    flex: 1;
    min-width: 0;
    
    .nickname {
      font-weight: 500;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .wxid {
      font-size: 12px;
      color: #666;
      margin-bottom: 2px;
    }
    
    .remark {
      font-size: 12px;
      color: #409eff;
    }
  }
  
  .friend-actions {
    flex-shrink: 0;
  }
}
</style>
