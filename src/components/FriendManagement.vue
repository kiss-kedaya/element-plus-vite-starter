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
            {{ (searchResult.nickname || '').toString().charAt(0) || '?' }}
          </el-avatar>
          <div class="user-info">
            <div class="nickname">{{ searchResult.nickname }}</div>
            <div class="wxid">微信号：{{ searchResult.wxid }}</div>
            <div class="region" v-if="searchResult.region">地区：{{ searchResult.region }}</div>
          </div>
          <div class="actions">
            <el-button type="primary" :loading="addFriendLoading" @click="openAddFriendDialog">
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
          <span>好友列表 ({{ filteredFriends.length }}{{ filteredFriends.length !== friends.length ? ` / ${friends.length}` : '' }})</span>
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
          <el-empty description="暂无好友数据">
            <template #description>
              <p>可能的原因：</p>
              <ul style="text-align: left; margin: 10px 0;">
                <li>当前账号还没有好友</li>
                <li>需要刷新通讯录数据</li>
                <li>网络连接问题</li>
              </ul>
            </template>
            <el-button type="primary" @click="refreshFriends" :loading="friendsLoading">
              <el-icon><Refresh /></el-icon>
              刷新通讯录
            </el-button>
          </el-empty>
        </div>

        <div v-else class="friends-container">
          <div
            ref="scrollContainer"
            class="friends-scroll-container"
            @scroll="handleScroll"
          >
            <div
              class="friends-virtual-list"
              :style="{ height: `${totalHeight}px` }"
            >
              <div
                class="friends-visible-area"
                :style="{ transform: `translateY(${offsetY}px)` }"
              >
                <div
                  v-for="friend in visibleFriends"
                  :key="friend.wxid"
                  class="friend-item"
                  :style="{ height: `${itemHeight}px` }"
                >
                  <el-avatar :src="friend.avatar" :size="40" lazy>
                    {{ (friend.nickname || '').toString().charAt(0) || '?' }}
                  </el-avatar>
                  <div class="friend-info">
                    <div class="nickname" :title="friend.nickname">
                      {{ friend.nickname }}
                      <span v-if="friend.remark && String(friend.remark).trim()" class="remark-inline">({{ friend.remark }})</span>
                    </div>
                    <div class="wxid">{{ friend.wxid }}</div>
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
          </div>
        </div>
      </div>
    </el-card>

    <!-- 添加好友对话框 -->
    <el-dialog v-model="showAddFriendDialog" title="添加好友" width="500px">
      <div class="add-friend-content" v-if="searchResult">
        <div class="friend-info">
          <el-avatar :src="searchResult.avatar" :size="60">
            <el-icon><UserFilled /></el-icon>
          </el-avatar>
          <div class="info">
            <div class="nickname">{{ searchResult.nickname }}</div>
            <div class="wxid">微信号：{{ searchResult.wxid }}</div>
            <div class="signature" v-if="searchResult.signature">{{ searchResult.signature }}</div>
          </div>
        </div>

        <el-form :model="addFriendForm" label-width="100px" class="add-friend-form">
          <el-form-item label="打招呼内容" required>
            <el-input
              v-model="addFriendForm.verifyContent"
              type="textarea"
              :rows="4"
              placeholder="请输入打招呼内容..."
              maxlength="200"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="验证来源">
            <el-select v-model="addFriendForm.scene" placeholder="选择验证来源">
              <el-option label="通过搜索添加" :value="1" />
              <el-option label="通过群聊添加" :value="2" />
              <el-option label="通过名片添加" :value="3" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="showAddFriendDialog = false">取消</el-button>
        <el-button type="primary" :loading="addFriendLoading" @click="confirmAddFriend">
          <el-icon><UserFilled /></el-icon>
          发送好友请求
        </el-button>
      </template>
    </el-dialog>

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
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, UserFilled, Refresh, MoreFilled, ChatDotRound, Edit, Delete } from '@element-plus/icons-vue'
import { friendApi } from '@/api/friend'
import type { SearchContactRequest, SendFriendRequestRequest } from '@/types/friend'

// 定义好友类型
interface Friend {
  wxid: string
  nickname: string
  avatar: string
  remark: string
  signature: string
  sex: number
  isOnline: boolean
}

// 定义搜索结果类型
interface SearchResult {
  wxid: string
  nickname: string
  avatar: string
  region: string
  signature: string
  v1?: string
  v2?: string
  antispamTicket?: string
}

// Props
const props = defineProps<{
  account: any
}>()

// 响应式数据
const searchForm = ref({
  type: 'wxid',
  keyword: ''
})

const searchResult = ref<SearchResult | null>(null)
const searchLoading = ref(false)
const addFriendLoading = ref(false)
const friendsLoading = ref(false)
const friendFilter = ref('')
const forceRefreshCache = ref(false)
const showRemarkDialog = ref(false)
const showAddFriendDialog = ref(false)
const currentFriend = ref<Friend | null>(null)
const remarkForm = ref({
  remark: ''
})

// 添加好友表单数据
const addFriendForm = ref({
  verifyContent: '你好，我想加你为好友',
  scene: 1
})

// 好友数据
const friends = ref<Friend[]>([])

// 虚拟滚动相关
const scrollContainer = ref<HTMLElement>()
const itemHeight = 80 // 每个好友项的高度
const containerHeight = 400 // 容器高度
const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 // 可见项数量 + 缓冲
const scrollTop = ref(0)

// 计算属性
const filteredFriends = computed(() => {
  if (!friendFilter.value) return friends.value

  const keyword = friendFilter.value.toLowerCase()
  return friends.value.filter(friend => {
    const nickname = (friend.nickname || '').toString().toLowerCase()
    const wxid = (friend.wxid || '').toString().toLowerCase()
    const remark = (friend.remark || '').toString().toLowerCase()
    
    return nickname.includes(keyword) ||
           wxid.includes(keyword) ||
           remark.includes(keyword)
  })
})

// 虚拟滚动计算
const startIndex = computed(() => {
  return Math.floor(scrollTop.value / itemHeight)
})

const endIndex = computed(() => {
  return Math.min(startIndex.value + visibleCount, filteredFriends.value.length)
})

const visibleFriends = computed(() => {
  return filteredFriends.value.slice(startIndex.value, endIndex.value)
})

const totalHeight = computed(() => {
  return filteredFriends.value.length * itemHeight
})

const offsetY = computed(() => {
  return startIndex.value * itemHeight
})

// 滚动处理
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (target && typeof target.scrollTop === 'number') {
    scrollTop.value = target.scrollTop
  }
}

// 监听搜索条件变化，重置滚动位置
watch(friendFilter, () => {
  scrollTop.value = 0
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  }
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

// 显示添加好友对话框
const openAddFriendDialog = () => {
  if (!searchResult.value) {
    ElMessage.warning('请先搜索用户')
    return
  }
  showAddFriendDialog.value = true
}

// 确认添加好友
const confirmAddFriend = async () => {
  if (!searchResult.value || !props.account?.wxid) return

  if (!addFriendForm.value.verifyContent.trim()) {
    ElMessage.warning('请输入打招呼内容')
    return
  }

  addFriendLoading.value = true
  try {
    const params: SendFriendRequestRequest = {
      Wxid: props.account.wxid,
      V1: searchResult.value.v1 || '',
      V2: searchResult.value.v2 || '',
      Opcode: 1,
      Scene: addFriendForm.value.scene,
      VerifyContent: addFriendForm.value.verifyContent
    }

    const response = await friendApi.sendFriendRequest(params)

    if (response.Success) {
      ElMessage.success('好友请求已发送')
      showAddFriendDialog.value = false
      searchResult.value = null
      searchForm.value.keyword = ''
      // 重置表单
      addFriendForm.value.verifyContent = '你好，我想加你为好友'
      addFriendForm.value.scene = 1
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

    // 使用完整接口
    const response = await friendApi.getTotalContactList(params)

    console.log('通讯录响应:', response)

    if (response.Success) {
      // 处理不同的响应格式
      let contactList = []

      if (response.Data?.ContactList) {
        contactList = response.Data.ContactList
      } else if (response.Data?.MemberList) {
        contactList = response.Data.MemberList
      } else if (response.Data?.list) {
        // 处理新的响应格式: {wxid: 'xxx', total: 1749, list: Array(1749)}
        contactList = response.Data.list
      } else if (response.Data?.details) {
        // 处理包含details数组的格式: {wxid: 'xxx', usernames: Array, details: Array, cache_time: 'xxx', total_count: 46}
        // details数组中每个元素都包含ContactList数组，需要合并所有ContactList
        contactList = []
        response.Data.details.forEach((detail: any) => {
          if (detail.ContactList && Array.isArray(detail.ContactList)) {
            contactList.push(...detail.ContactList)
          }
        })
      } else if (Array.isArray(response.Data)) {
        contactList = response.Data
      } else {
        console.log('未知的响应格式:', response.Data)
      }

      if (contactList && contactList.length > 0) {
        friends.value = contactList.map((contact: any) => {
          // 处理可能是对象格式的字段
          const getNickName = (contact: any) => {
            if (contact.NickName) {
              return typeof contact.NickName === 'object' && contact.NickName.string
                ? contact.NickName.string
                : contact.NickName
            }
            return contact.Nickname || contact.nickname || contact.UserName || '未知用户'
          }

          const getUserName = (contact: any) => {
            if (contact.UserName) {
              return typeof contact.UserName === 'object' && contact.UserName.string
                ? contact.UserName.string
                : contact.UserName
            }
            return contact.Wxid || contact.wxid
          }

          const getRemark = (contact: any) => {
            if (contact.Remark) {
              return typeof contact.Remark === 'object' && contact.Remark.string
                ? contact.Remark.string
                : contact.Remark
            }
            return contact.remark || ''
          }

          return {
            wxid: getUserName(contact),
            nickname: getNickName(contact),
            avatar: contact.BigHeadImgUrl || contact.HeadImgUrl || contact.avatar || '',
            remark: getRemark(contact),
            signature: contact.Signature || contact.signature || '',
            sex: contact.Sex || contact.sex || 0,
            isOnline: false
          }
        })

        // 显示加载结果，包含缓存信息
        let message = `已加载 ${friends.value.length} 个好友`
        if (response.Data?.total) {
          message += ` (总计: ${response.Data.total})`
        } else if (response.Data?.total_count) {
          message += ` (总计: ${response.Data.total_count})`
        }
        if (response.Message?.includes('缓存')) {
          message += forceRefreshCache.value ? ' (已强制刷新)' : ` (${response.Message})`
        } else if (forceRefreshCache.value) {
          message += ' (已强制刷新)'
        }
        ElMessage.success(message)
      } else {
        friends.value = []
        ElMessage.info('通讯录为空或暂无好友')
      }
    } else {
      throw new Error(response.Message || '获取好友列表失败')
    }
  } catch (error: any) {
    console.error('刷新好友列表失败:', error)
    ElMessage.error(`刷新失败: ${error.message || '网络错误'}`)
    friends.value = []
  } finally {
    friendsLoading.value = false
  }
}

const handleFriendAction = async (command: string) => {
  const [action, wxid] = command.split('-')
  const friend = friends.value.find(f => f.wxid === wxid)

  if (!friend) {
    ElMessage.error('未找到该好友')
    return
  }

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

// 虚拟滚动容器样式
.friends-container {
  height: 400px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-medium);
}

.friends-scroll-container {
  height: 100%;
  overflow-y: auto;
  position: relative;
}

.friends-virtual-list {
  position: relative;
}

.friends-visible-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border-radius: 12px;
  transition: all 0.2s ease;
  gap: 16px;
  border: 1px solid #f0f0f0;
  margin-bottom: 8px;
  box-sizing: border-box;

  &:hover {
    background: #fafafa;
    border-color: #e0e0e0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  
  .friend-info {
    flex: 1;
    min-width: 0;
    
    .nickname {
      font-weight: 500;
      font-size: 15px;
      color: #1a1a1a;
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.4;
      
      .remark-inline {
        font-weight: 400;
        color: #666;
        font-size: 14px;
        margin-left: 4px;
      }
    }
    
    .wxid {
      font-size: 13px;
      color: #888;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      letter-spacing: 0.5px;
    }
  }
  
  .friend-actions {
    flex-shrink: 0;
    opacity: 0.6;
    transition: opacity 0.2s ease;
    
    &:hover {
      opacity: 1;
    }
  }
}



// 添加好友对话框样式
.add-friend-content {
  .friend-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--radius-medium);
    margin-bottom: var(--spacing-lg);

    .info {
      flex: 1;

      .nickname {
        font-size: var(--font-size-lg);
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: var(--spacing-xs);
      }

      .wxid {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin-bottom: var(--spacing-xs);
      }

      .signature {
        font-size: var(--font-size-sm);
        color: var(--text-tertiary);
        font-style: italic;
      }
    }
  }

  .add-friend-form {
    .el-form-item {
      margin-bottom: var(--spacing-lg);
    }

    .el-textarea {
      :deep(.el-textarea__inner) {
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-small);

        &:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px var(--primary-light);
        }
      }
    }
  }
}
</style>
