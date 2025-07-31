<script setup lang="ts">
import type { SearchContactRequest, SendFriendRequestRequest } from '@/types/friend'
import { ChatDotRound, Delete, Edit, MoreFilled, Refresh, Search, UserFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { friendApi } from '@/api/friend'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

// 定义好友类型
interface Friend {
  wxid: string
  nickname: string
  alias: string
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
  alias: string
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

// Stores
const authStore = useAuthStore()
const chatStore = useChatStore()
const router = useRouter()

// 响应式数据
const searchForm = ref({
  type: 'wxid',
  keyword: '',
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
  remark: '',
})

// 添加好友表单数据
const addFriendForm = ref({
  verifyContent: '你好，我想加你为好友',
  scene: 1,
})

// 好友数据
const friends = ref<Friend[]>([])

// 右键菜单相关
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  friend: null as Friend | null,
})

// 虚拟滚动相关
const scrollContainer = ref<HTMLElement>()
const itemHeight = 80 // 每个好友项的高度
const containerHeight = 400 // 容器高度
const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 // 可见项数量 + 缓冲
const scrollTop = ref(0)

// 计算属性
const validFriends = computed(() => {
  // 确保只返回有效的好友（昵称和wxid都不为空）
  return friends.value.filter((friend) => {
    const nickname = getDisplayValue(friend.nickname).trim()
    const wxid = getDisplayValue(friend.wxid).trim()
    return nickname !== '' && wxid !== ''
  })
})

const filteredFriends = computed(() => {
  if (!friendFilter.value)
    return validFriends.value

  const keyword = friendFilter.value.toLowerCase()
  return validFriends.value.filter((friend) => {
    const nickname = getDisplayValue(friend.nickname).toLowerCase()
    const wxid = getDisplayValue(friend.wxid).toLowerCase()
    const alias = getDisplayValue(friend.alias).toLowerCase()
    const remark = getDisplayValue(friend.remark).toLowerCase()

    return nickname.includes(keyword)
      || wxid.includes(keyword)
      || alias.includes(keyword)
      || remark.includes(keyword)
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
function handleScroll(event: Event) {
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
async function searchUser() {
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
      SearchScene: 1,
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
        antispamTicket: response.Data.AntispamTicket,
      }

      // 搜索完成，不显示提示
    }
    else {
      throw new Error(response.Message || '未找到用户')
    }
  }
  catch (error: any) {
    ElMessage.error(error.message || '搜索失败')
    console.error('搜索用户失败:', error)
    searchResult.value = null
  }
  finally {
    searchLoading.value = false
  }
}

// 显示添加好友对话框
function openAddFriendDialog() {
  if (!searchResult.value) {
    ElMessage.warning('请先搜索用户')
    return
  }
  showAddFriendDialog.value = true
}

// 确认添加好友
async function confirmAddFriend() {
  if (!searchResult.value || !props.account?.wxid)
    return

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
      VerifyContent: addFriendForm.value.verifyContent,
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
    }
    else {
      throw new Error(response.Message || '发送好友请求失败')
    }
  }
  catch (error: any) {
    ElMessage.error(error.message || '添加好友失败')
    console.error('添加好友失败:', error)
  }
  finally {
    addFriendLoading.value = false
  }
}

// 为指定账号获取通讯录的通用函数
async function refreshFriendsForAccount(wxid: string, forceRefresh: boolean = false) {
  if (!wxid) {
    ElMessage.error('账号ID不能为空')
    return
  }

  friendsLoading.value = true
  try {
    const params = {
      Wxid: wxid,
      CurrentWxcontactSeq: 0,
      CurrentChatRoomContactSeq: 0,
      force_refresh: forceRefresh,
    }

    console.log('获取通讯录参数:', params)

    // 使用完整接口
    const response = await friendApi.getTotalContactList(params)

    console.log('通讯录响应:', response)

    if (response.Success) {
      // 处理不同的响应格式
      let contactList = []

      if (response.Data?.details && Array.isArray(response.Data.details)) {
        contactList = []
        response.Data.details.forEach((detail: any) => {
          if (detail.ContactList && Array.isArray(detail.ContactList)) {
            contactList.push(...detail.ContactList)
          }
        })
      }
      else if (Array.isArray(response.Data)) {
        contactList = response.Data
      }
      else {
        console.log('未知的响应格式:', response.Data)
      }

      if (contactList && contactList.length > 0) {
        friends.value = contactList
          .map((contact: any) => {
            // 处理可能是对象格式的字段
            const getNickName = (contact: any) => {
              let nickname = ''
              if (contact.NickName) {
                if (typeof contact.NickName === 'object') {
                  // 检查是否是空对象或有有效的 string 属性
                  if (contact.NickName.string !== undefined && contact.NickName.string !== null && contact.NickName.string !== '') {
                    nickname = contact.NickName.string
                  }
                  else {
                    nickname = ''
                  }
                }
                else {
                  nickname = contact.NickName
                }
              }
              else {
                nickname = contact.Nickname || contact.nickname || ''
              }
              return String(nickname || '')
            }

            const getUserName = (contact: any) => {
              let username = ''
              if (contact.UserName) {
                if (typeof contact.UserName === 'object') {
                  // 检查是否是空对象或有有效的 string 属性
                  if (contact.UserName.string !== undefined && contact.UserName.string !== null && contact.UserName.string !== '') {
                    username = contact.UserName.string
                  }
                  else {
                    username = ''
                  }
                }
                else {
                  username = contact.UserName
                }
              }
              else {
                username = contact.Wxid || contact.wxid || ''
              }
              return String(username || '')
            }

            const getAlias = (contact: any) => {
              let alias = ''
              if (contact.Alias) {
                if (typeof contact.Alias === 'object') {
                  // 检查是否是空对象或有有效的 string 属性
                  if (contact.Alias.string !== undefined && contact.Alias.string !== null && contact.Alias.string !== '') {
                    alias = contact.Alias.string
                  }
                  else {
                    alias = ''
                  }
                }
                else {
                  alias = contact.Alias
                }
              }
              else {
                alias = contact.alias || ''
              }
              return String(alias || '')
            }

            const getRemark = (contact: any) => {
              let remark = ''
              if (contact.Remark) {
                if (typeof contact.Remark === 'object') {
                  // 如果是对象，检查是否有 string 属性
                  if (contact.Remark.string !== undefined && contact.Remark.string !== null && contact.Remark.string !== '') {
                    remark = contact.Remark.string
                  }
                  else {
                    // 如果是空对象 {}，返回空字符串
                    remark = ''
                  }
                }
                else {
                  remark = contact.Remark
                }
              }
              else {
                remark = contact.remark || ''
              }
              return String(remark || '')
            }

            const nickname = getNickName(contact)
            const wxid = getUserName(contact)
            const alias = getAlias(contact)

            return {
              wxid,
              nickname,
              alias, // 微信号
              avatar: contact.BigHeadImgUrl || contact.HeadImgUrl || contact.avatar || '',
              remark: getRemark(contact),
              signature: contact.Signature || contact.signature || '',
              sex: contact.Sex || contact.sex || 0,
              isOnline: false,
              // 添加标记用于过滤
              isValid: nickname.trim() !== '' && wxid.trim() !== '',
            }
          })
          .filter((friend: any) => {
            // 过滤掉昵称和wxid都为空的联系人
            return friend.isValid && friend.nickname !== '未知用户'
          })
          .map((friend: any) => {
            // 移除临时的 isValid 属性
            const { isValid, ...cleanFriend } = friend
            return cleanFriend
          })

        // 成功获取通讯录，不显示提示
      }
      else {
        friends.value = []
        ElMessage.info('该账号暂无好友数据')
      }
    }
    else {
      ElMessage.error(response.Message || '获取通讯录失败')
    }
  }
  catch (error: any) {
    ElMessage.error(error.message || '获取通讯录失败')
    console.error('获取通讯录失败:', error)
  }
  finally {
    friendsLoading.value = false
  }
}

async function refreshFriends() {
  if (!props.account?.wxid) {
    ElMessage.error('请先登录账号')
    return
  }

  await refreshFriendsForAccount(props.account.wxid, forceRefreshCache.value)
}

async function handleFriendAction(command: string) {
  const [action, wxid] = command.split('-')
  const friend = friends.value.find(f => f.wxid === wxid)

  if (!friend) {
    ElMessage.error('未找到该好友')
    return
  }

  if (action === 'chat') {
    await startChatWithFriend(friend)
  }
  else if (action === 'remark') {
    currentFriend.value = friend
    remarkForm.value.remark = getDisplayValue(friend.remark)
    showRemarkDialog.value = true
  }
  else if (action === 'delete') {
    try {
      await ElMessageBox.confirm(`确定要删除好友 ${getDisplayValue(friend.nickname)} 吗？`, '确认删除', {
        type: 'warning',
      })

      const index = friends.value.findIndex(f => f.wxid === wxid)
      friends.value.splice(index, 1)
      ElMessage.success('好友已删除')
    }
    catch {
      // 用户取消
    }
  }
}

// 右键菜单相关方法
function showContextMenu(event: MouseEvent, friend: Friend) {
  event.preventDefault()

  // 计算菜单位置，确保不超出屏幕边界
  const menuWidth = 120
  const menuHeight = 120
  let x = event.clientX
  let y = event.clientY

  // 检查右边界
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }

  // 检查下边界
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  // 确保不超出左上边界
  x = Math.max(10, x)
  y = Math.max(10, y)

  contextMenu.value = {
    visible: true,
    x,
    y,
    friend,
  }
}

function hideContextMenu() {
  contextMenu.value.visible = false
  contextMenu.value.friend = null
}

// 开始与好友聊天的完整流程
async function startChatWithFriend(friend: Friend) {
  try {
    if (!props.account?.wxid) {
      ElMessage.error('请先登录账号')
      return
    }

    const friendName = getDisplayValue(friend.nickname) || getDisplayValue(friend.alias) || '未知好友'
    // 准备聊天，不显示提示

    console.log('开始聊天流程:', {
      account: props.account.wxid,
      friend: friend.wxid,
      friendName,
    })

    // 1. 确保WebSocket连接
    const isConnected = await chatStore.connectWebSocket(props.account.wxid)
    if (!isConnected) {
      ElMessage.warning('WebSocket连接失败，但仍可尝试发送消息')
    }
    else {
      console.log('WebSocket连接成功')
    }

    // 2. 创建或获取聊天会话
    const session = chatStore.createOrGetSession(friend)
    console.log('聊天会话已创建/获取:', session)

    // 3. 同步消息历史
    try {
      await chatStore.syncMessages(props.account.wxid)
      console.log('消息历史同步完成')
    }
    catch (error) {
      console.warn('消息历史同步失败:', error)
    }

    // 4. 跳转到聊天功能标签
    // 确保跳转到聊天页面，即使当前已经在聊天页面
    const currentRoute = router.currentRoute.value
    if (currentRoute.query.tab !== 'chat') {
      await router.push('/dashboard?tab=chat')
    }

    // 5. 设置当前会话
    chatStore.setCurrentSession(session.id)

    // 聊天开始成功，不显示提示
  }
  catch (error: any) {
    console.error('开始聊天失败:', error)
    ElMessage.error(error.message || '开始聊天失败，请重试')
  }
}

async function handleContextMenuAction(action: string) {
  if (!contextMenu.value.friend)
    return

  const friend = contextMenu.value.friend
  hideContextMenu()

  if (action === 'chat') {
    await startChatWithFriend(friend)
  }
  else if (action === 'remark') {
    currentFriend.value = friend
    remarkForm.value.remark = getDisplayValue(friend.remark)
    showRemarkDialog.value = true
  }
  else if (action === 'delete') {
    try {
      await ElMessageBox.confirm(`确定要删除好友 ${getDisplayValue(friend.nickname)} 吗？`, '确认删除', {
        type: 'warning',
      })

      const index = friends.value.findIndex(f => f.wxid === friend.wxid)
      friends.value.splice(index, 1)
      ElMessage.success('好友已删除')
    }
    catch {
      // 用户取消
    }
  }
}

// 处理可能是对象的显示值
function getDisplayValue(value: any): string {
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

async function updateRemark() {
  if (!currentFriend.value)
    return

  try {
    // 模拟更新备注
    await new Promise(resolve => setTimeout(resolve, 500))

    currentFriend.value.remark = remarkForm.value.remark
    showRemarkDialog.value = false
    ElMessage.success('备注修改成功')
  }
  catch (error) {
    ElMessage.error('修改备注失败')
  }
}

onMounted(() => {
  refreshFriends()

  // 添加全局点击事件监听器，用于隐藏右键菜单
  document.addEventListener('click', hideContextMenu)
  document.addEventListener('contextmenu', hideContextMenu)
})

onUnmounted(() => {
  // 清理事件监听器
  document.removeEventListener('click', hideContextMenu)
  document.removeEventListener('contextmenu', hideContextMenu)
})

// 监听当前账号变化，切换账号时清空好友列表并自动获取新账号的通讯录
watch(
  () => authStore.currentAccount?.wxid,
  async (newWxid, oldWxid) => {
    // 如果账号发生了变化（不是初始化）
    if (oldWxid && newWxid && newWxid !== oldWxid) {
      console.log(`账号从 ${oldWxid} 切换到 ${newWxid}，清空好友列表并获取新账号通讯录`)

      // 清空当前好友列表
      friends.value = []

      // 重置搜索和过滤状态
      friendFilter.value = ''
      searchForm.value.keyword = ''
      searchResult.value = null

      // 切换账号，不显示提示

      // 自动获取新账号的缓存通讯录
      await refreshFriendsForAccount(newWxid)
    }
  },
  { immediate: false }, // 不立即执行，避免初始化时触发
)
</script>

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
        <el-divider content-position="left">
          搜索结果
        </el-divider>
        <div class="user-card">
          <el-avatar :src="searchResult.avatar" :size="50">
            {{ getDisplayValue(searchResult.nickname).charAt(0) || '?' }}
          </el-avatar>
          <div class="user-info">
            <div class="nickname">
              {{ getDisplayValue(searchResult.nickname) }}
            </div>
            <div class="wxid">
              <span v-if="getDisplayValue(searchResult.alias).trim()">微信号：{{ getDisplayValue(searchResult.alias) }}</span>
              <span class="wxid-info">[{{ getDisplayValue(searchResult.wxid) }}]</span>
            </div>
            <div v-if="getDisplayValue(searchResult.region)" class="region">
              地区：{{ getDisplayValue(searchResult.region) }}
            </div>
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
          <span>好友列表 ({{ filteredFriends.length }}{{ filteredFriends.length !== validFriends.length ? ` / ${validFriends.length}` : '' }})</span>
          <div class="header-actions">
            <el-input v-model="friendFilter" placeholder="搜索好友" size="small" style="width: 200px">
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-checkbox v-model="forceRefreshCache" size="small" style="margin-right: 10px">
              强制刷新缓存
            </el-checkbox>
            <el-button type="primary" size="small" :loading="friendsLoading" @click="refreshFriends">
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
            <el-button type="primary" :loading="friendsLoading" @click="refreshFriends">
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
                  @contextmenu.prevent="showContextMenu($event, friend)"
                >
                  <el-avatar :src="friend.avatar" :size="40" lazy>
                    {{ getDisplayValue(friend.nickname).charAt(0) || '?' }}
                  </el-avatar>
                  <div class="friend-info">
                    <div class="nickname" :title="getDisplayValue(friend.nickname)">
                      {{ getDisplayValue(friend.nickname) || '未知用户' }}
                      <span v-if="getDisplayValue(friend.remark).trim()" class="remark-inline">({{ getDisplayValue(friend.remark) }})</span>
                    </div>
                    <div class="wxid">
                      <span v-if="getDisplayValue(friend.alias).trim()" class="alias">{{ getDisplayValue(friend.alias) }}</span>
                      <span class="wxid-bracket">[{{ getDisplayValue(friend.wxid) || '未知ID' }}]</span>
                    </div>
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
      <div v-if="searchResult" class="add-friend-content">
        <div class="friend-info">
          <el-avatar :src="searchResult.avatar" :size="60">
            <el-icon><UserFilled /></el-icon>
          </el-avatar>
          <div class="info">
            <div class="nickname">
              {{ searchResult.nickname }}
            </div>
            <div class="wxid">
              <span v-if="getDisplayValue(searchResult.alias).trim()">微信号：{{ getDisplayValue(searchResult.alias) }}</span>
              <span class="wxid-info">[{{ getDisplayValue(searchResult.wxid) }}]</span>
            </div>
            <div v-if="searchResult.signature" class="signature">
              {{ searchResult.signature }}
            </div>
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
        <el-button @click="showAddFriendDialog = false">
          取消
        </el-button>
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
        <el-button @click="showRemarkDialog = false">
          取消
        </el-button>
        <el-button type="primary" @click="updateRemark">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }"
      @click.stop
    >
      <div class="context-menu-item" @click="handleContextMenuAction('chat')">
        <el-icon><ChatDotRound /></el-icon>
        <span>发送消息</span>
      </div>
      <div class="context-menu-item" @click="handleContextMenuAction('remark')">
        <el-icon><Edit /></el-icon>
        <span>修改备注</span>
      </div>
      <div class="context-menu-divider" />
      <div class="context-menu-item danger" @click="handleContextMenuAction('delete')">
        <el-icon><Delete /></el-icon>
        <span>删除好友</span>
      </div>
    </div>

    <!-- 右键菜单遮罩层 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu-overlay"
      @click="hideContextMenu"
      @contextmenu.prevent="hideContextMenu"
    />
  </div>
</template>

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

        .wxid,
        .region {
          font-size: 14px;
          color: #666;
          margin-bottom: 2px;

          .wxid-info {
            color: #999;
            margin-left: 6px;
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          }
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
  cursor: pointer;

  &:hover {
    background: #fafafa;
    border-color: #e0e0e0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  &:active {
    background: #f0f0f0;
    transform: scale(0.98);
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

      .alias {
        color: #666;
        font-weight: 500;
        margin-right: 6px;
      }

      .wxid-bracket {
        color: #999;
        font-weight: normal;
      }
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

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  z-index: 9999;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 120px;
  user-select: none;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f7fa;
  }

  &.danger {
    color: #f56c6c;

    &:hover {
      background-color: #fef0f0;
    }
  }

  .el-icon {
    margin-right: 8px;
    font-size: 16px;
  }
}

.context-menu-divider {
  height: 1px;
  background-color: #e4e7ed;
  margin: 4px 0;
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  background: transparent;
}
</style>
