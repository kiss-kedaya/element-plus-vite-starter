<template>
  <div class="friend-management">
    <!-- 欢迎提示 -->
    <el-card v-if="!searchResult" class="welcome-card" shadow="never">
      <div class="welcome-content">
        <el-icon class="welcome-icon" size="64"><UserFilled /></el-icon>
        <h3>好友管理</h3>
        <p>通过下方搜索功能查找并添加好友，或向已有好友发送消息</p>
        <el-divider />
        <div class="feature-list">
          <div class="feature-item">
            <el-icon><Search /></el-icon>
            <span>支持微信号、手机号、QQ号搜索</span>
          </div>
          <div class="feature-item">
            <el-icon><UserFilled /></el-icon>
            <span>快速添加陌生人为好友</span>
          </div>
          <div class="feature-item">
            <el-icon><ChatDotRound /></el-icon>
            <span>直接向好友发送消息</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 搜索和添加好友 -->
    <el-card class="search-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>添加好友</span>
        </div>
      </template>
      
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="搜索方式">
          <el-select v-model="searchForm.type" placeholder="选择搜索方式" style="width: 120px">
            <el-option label="微信号" value="wxid" />
            <el-option label="手机号" value="phone" />
            <el-option label="QQ号" value="qq" />
          </el-select>
        </el-form-item>

        <el-form-item label="搜索内容">
          <el-input
            v-model="searchForm.keyword"
            placeholder="输入搜索内容"
            style="width: 200px"
            @keyup.enter="searchUser"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="searchLoading"
            @click="searchUser"
            style="width: 80px"
          >
            <el-icon v-if="!searchLoading"><Search /></el-icon>
            {{ searchLoading ? '搜索中' : '搜索' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <!-- 搜索结果 -->
      <div v-if="searchResult" class="search-result">
        <el-divider content-position="left">搜索结果</el-divider>
        <div class="user-card">
          <el-avatar :src="searchResult.avatar" :size="50" @error="handleAvatarError">
            {{ getDisplayValue(searchResult.nickname).charAt(0) || '?' }}
          </el-avatar>
          <div class="user-info">
            <div class="nickname">
              {{ getDisplayValue(searchResult.nickname) }}
              <el-tag v-if="searchResult.sex === 1" type="info" size="small" style="margin-left: 8px;">男</el-tag>
              <el-tag v-if="searchResult.sex === 2" type="warning" size="small" style="margin-left: 8px;">女</el-tag>
              <el-tag v-if="searchResult.verifyFlag > 0" type="success" size="small" style="margin-left: 8px;">认证</el-tag>
            </div>
            <div class="wxid">
              <span v-if="getDisplayValue(searchResult.alias).trim()">微信号：{{ getDisplayValue(searchResult.alias) }}</span>
              <span class="wxid-info">[{{ getDisplayValue(searchResult.wxid) }}]</span>
            </div>
            <div class="region" v-if="getDisplayValue(searchResult.region)">地区：{{ getDisplayValue(searchResult.region) }}</div>
          </div>
          <div class="actions">
            <!-- 根据Sex字段显示不同的状态和操作 -->
            <el-tag
              :type="getStatusTagType(searchResult)"
              size="large"
              style="margin-right: 10px;"
            >
              {{ getStatusText(searchResult) }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 搜索到的好友操作区 -->
    <el-card v-if="searchResult" class="friend-actions-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>好友操作</span>
        </div>
      </template>

      <div class="friend-actions">
        <el-button
          type="primary"
          :loading="sendMessageLoading"
          @click="sendMessage"
          :disabled="getUserStatus(searchResult) === 'not-exist'"
        >
          <el-icon><ChatDotRound /></el-icon>
          发送消息
        </el-button>

        <el-button
          v-if="getUserStatus(searchResult) === 'stranger'"
          type="success"
          :loading="addFriendLoading"
          @click="openAddFriendDialog"
        >
          <el-icon><UserFilled /></el-icon>
          添加好友
        </el-button>

        <el-tag
          :type="getStatusTagType(searchResult)"
          size="large"
          style="margin-left: 10px;"
        >
          {{ getStatusText(searchResult) }}
        </el-tag>
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
            <div class="wxid">
              <span v-if="getDisplayValue(searchResult.alias).trim()">微信号：{{ getDisplayValue(searchResult.alias) }}</span>
              <span class="wxid-info">[{{ getDisplayValue(searchResult.wxid) }}]</span>
            </div>
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
              <el-option
                v-for="option in SCENE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
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

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{
        left: contextMenu.x + 'px',
        top: contextMenu.y + 'px'
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
      <div class="context-menu-divider"></div>
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
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, UserFilled, ChatDotRound, Edit, Delete } from '@element-plus/icons-vue'
import { friendApi } from '@/api/friend'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useRouter } from 'vue-router'
import type { SearchContactRequest, SendFriendRequestRequest } from '@/types/friend'

// 临时内联常量定义，避免导入问题
const FRIEND_OPCODE = {
  NO_VERIFY: 1,      // 免验证发送请求
  SEND_REQUEST: 2,   // 发送验证申请
  ACCEPT_REQUEST: 3  // 通过好友验证
} as const

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

const SCENE_OPTIONS = [
  { label: '通过微信号搜索', value: FRIEND_SCENE.WECHAT_ID },
  { label: '通过QQ添加', value: FRIEND_SCENE.QQ },
  { label: '通过邮箱添加', value: FRIEND_SCENE.EMAIL },
  { label: '通过通讯录添加', value: FRIEND_SCENE.ADDRESS_BOOK },
  { label: '通过群聊添加', value: FRIEND_SCENE.CHAT_ROOM },
  { label: '通过手机号添加', value: FRIEND_SCENE.PHONE },
  { label: '通过附近的人', value: FRIEND_SCENE.NEARBY },
  { label: '通过二维码添加', value: FRIEND_SCENE.QRCODE }
] as const

// 简化的验证函数
const validateFriendRequestParams = (params: SendFriendRequestRequest) => {
  const errors: string[] = []

  if (!params.Wxid?.trim()) errors.push('发送方微信ID不能为空')
  if (!params.V1?.trim()) errors.push('V1参数不能为空')
  if (!params.V2?.trim()) errors.push('V2参数不能为空')
  if (!params.VerifyContent?.trim()) errors.push('验证消息不能为空')

  if (params.V1 && !params.V1.startsWith('v3_')) {
    errors.push('V1参数格式不正确，应该以v3_开头')
  }

  if (params.V2 && !params.V2.startsWith('v4_')) {
    errors.push('V2参数格式不正确，应该以v4_开头')
  }

  return { isValid: errors.length === 0, errors }
}

const createFriendRequestParams = (
  wxid: string,
  v1: string,
  v2: string,
  verifyContent: string,
  scene: number = FRIEND_SCENE.WECHAT_ID,
  opcode: number = FRIEND_OPCODE.SEND_REQUEST
): SendFriendRequestRequest => {
  return {
    Wxid: wxid.trim(),
    V1: v1.trim(),
    V2: v2.trim(),
    Opcode: opcode,
    Scene: scene,
    VerifyContent: verifyContent.trim()
  }
}

const formatFriendRequestParams = (params: SendFriendRequestRequest): string => {
  return `好友请求参数: Wxid=${params.Wxid}, V1=${params.V1}, V2=${params.V2}, Opcode=${params.Opcode}, Scene=${params.Scene}, VerifyContent=${params.VerifyContent}`
}

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
  sex?: number
  verifyFlag?: number
  v1?: string
  v2?: string
  antispamTicket?: string
}

// 账号类型
interface Account {
  wxid: string
  nickname: string
  avatar?: string
  [key: string]: any
}

// Props
const props = defineProps<{
  account: Account
}>()

// Stores
const authStore = useAuthStore()
const chatStore = useChatStore()
const router = useRouter()

// 响应式数据
const searchForm = ref({
  type: 'wxid',
  keyword: ''
})

const searchResult = ref<SearchResult | null>(null)
const searchLoading = ref(false)
const addFriendLoading = ref(false)
const sendMessageLoading = ref(false)
const showAddFriendDialog = ref(false)

// 添加好友表单数据
const addFriendForm = ref({
  verifyContent: '你好，我想加你为好友',
  scene: FRIEND_SCENE.WECHAT_ID // 默认为通过微信号搜索
})

// 修改备注相关
const showRemarkDialog = ref(false)
const remarkForm = ref({
  remark: ''
})
const currentFriend = ref<Friend | null>(null)

// 右键菜单
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  friend: null as Friend | null
})



// 根据API响应数据判断用户状态
const getUserStatus = (searchData: SearchResult): 'not-exist' | 'friend' | 'stranger' => {
  // 检查是否有基本的用户信息（nickname和wxid）
  if (!searchData.nickname || !searchData.wxid) {
    return 'not-exist'
  }

  // 检查AntispamTicket字段来判断是否为好友
  const antispamTicket = searchData.antispamTicket || searchData.AntispamTicket || ''

  // 如果AntispamTicket包含@stranger，说明是陌生人
  if (antispamTicket.includes('@stranger')) {
    return 'stranger'
  }

  // 如果没有AntispamTicket，说明已经是好友
  if (!antispamTicket) {
    return 'friend'
  }

  // 其他情况视为陌生人
  return 'stranger'
}

// 获取状态文本
const getStatusText = (searchData: SearchResult): string => {
  switch (getUserStatus(searchData)) {
    case 'not-exist': return '用户不存在'
    case 'friend': return '已是好友'
    case 'stranger': return '可以添加'
    default: return '未知状态'
  }
}

// 获取状态标签类型
const getStatusTagType = (searchData: SearchResult): 'success' | 'primary' | 'warning' | 'info' | 'danger' => {
  switch (getUserStatus(searchData)) {
    case 'not-exist': return 'danger'
    case 'friend': return 'success'
    case 'stranger': return 'warning'
    default: return 'info'
  }
}

// 发送消息
const sendMessage = async () => {
  if (!searchResult.value || !props.account?.wxid) {
    ElMessage.error('缺少必要信息')
    return
  }

  if (getUserStatus(searchResult.value) === 'not-exist') {
    ElMessage.error('用户不存在，无法发送消息')
    return
  }

  sendMessageLoading.value = true
  try {
    // 创建或获取聊天会话
    const friend = {
      wxid: searchResult.value.wxid,
      nickname: searchResult.value.nickname,
      avatar: searchResult.value.avatar || '',
      remark: '',
      isOnline: true
    }

    const session = chatStore.createOrGetSession(friend)

    // 设置当前会话
    chatStore.setCurrentSession(session.id)

    // 跳转到聊天页面，并切换到聊天标签
    await router.push('/dashboard?tab=chat')
    ElMessage.success('已打开聊天窗口')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '打开聊天失败'
    ElMessage.error(errorMessage)
    console.error('打开聊天失败:', error)
  } finally {
    sendMessageLoading.value = false
  }
}

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
      console.log('搜索用户响应:', response)
      console.log('完整响应数据:', response.Data)
      console.log('可能的微信号字段:', {
        Province: (response.Data as any).Province,
        City: (response.Data as any).City,
        Alias: (response.Data as any).Alias,
        QuanPin: (response.Data as any).QuanPin?.string,
        Pyinitial: response.Data.Pyinitial?.string,
        searchKeyword: searchForm.value.keyword
      })

      // 尝试找到真正的微信号字段
      let wechatAlias = ''

      // 检查各个可能包含微信号的字段
      if ((response.Data as any).Alias && (response.Data as any).Alias.trim()) {
        wechatAlias = (response.Data as any).Alias
      } else if (searchForm.value.type === 'wxid' && searchForm.value.keyword.trim()) {
        // 如果是通过微信号搜索的，使用搜索关键词作为微信号
        // 因为API响应中通常不包含用户设置的自定义微信号，只有系统生成的微信ID
        wechatAlias = searchForm.value.keyword
      } else if (response.Data.QuanPin?.string && response.Data.QuanPin.string.trim() && !response.Data.QuanPin.string.startsWith('wxid_')) {
        // 如果QuanPin不是以wxid_开头，可能是微信号
        wechatAlias = response.Data.QuanPin.string
      }

      // 判断是否为陌生人（UserName包含@stranger）
      const isStranger = response.Data.UserName?.string?.includes('@stranger') || false

      searchResult.value = {
        // 对于陌生人，显示Pyinitial作为wxid；对于好友，显示UserName
        wxid: isStranger ? (response.Data.Pyinitial?.string || searchForm.value.keyword) : (response.Data.UserName?.string || searchForm.value.keyword),
        nickname: response.Data.NickName?.string || '未知用户',
        alias: wechatAlias, // 微信号
        avatar: response.Data.BigHeadImgUrl || response.Data.SmallHeadImgUrl || '',
        region: `${response.Data.Country || ''} ${response.Data.City || ''}`.trim() || '未知',
        signature: response.Data.Signature || '',
        sex: response.Data.Sex || 0,
        verifyFlag: response.Data.VerifyFlag || 0,
        // 根据新的响应数据结构设置V1和V2
        v1: response.Data.UserName?.string || '', // V1使用UserName (v3_...@stranger)
        v2: response.Data.AntispamTicket || '', // V2使用AntispamTicket (v4_...@stranger)
        antispamTicket: response.Data.AntispamTicket || ''
      }

      ElMessage.success('搜索完成')
    } else {
      throw new Error(response.Message || '未找到用户')
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '搜索失败'
    ElMessage.error(errorMessage)
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
  if (!searchResult.value || !props.account?.wxid) {
    ElMessage.error('缺少必要信息')
    return
  }

  if (!addFriendForm.value.verifyContent.trim()) {
    ElMessage.warning('请输入打招呼内容')
    return
  }

  // 验证V1和V2参数
  if (!searchResult.value.v1 || !searchResult.value.v2) {
    ElMessage.error('搜索结果缺少必要参数，请重新搜索')
    return
  }

  addFriendLoading.value = true
  try {
    // 创建请求参数
    const params = createFriendRequestParams(
      props.account.wxid,
      searchResult.value.v1,
      searchResult.value.v2,
      addFriendForm.value.verifyContent,
      addFriendForm.value.scene,
      FRIEND_OPCODE.SEND_REQUEST
    )

    // 验证参数
    const validation = validateFriendRequestParams(params)
    if (!validation.isValid) {
      ElMessage.error(`参数验证失败：${validation.errors.join(', ')}`)
      return
    }

    console.log('发送好友请求参数:', formatFriendRequestParams(params))
    const response = await friendApi.sendFriendRequest(params)

    if (response.Success) {
      ElMessage.success('好友请求已发送')
      showAddFriendDialog.value = false
      searchResult.value = null
      searchForm.value.keyword = ''
      // 重置表单
      addFriendForm.value.verifyContent = '你好，我想加你为好友'
      addFriendForm.value.scene = FRIEND_SCENE.WECHAT_ID
      // 添加成功后清空搜索结果
      console.log('好友请求发送成功')
    } else {
      throw new Error(response.Message || '发送好友请求失败')
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '添加好友失败'
    ElMessage.error(errorMessage)
    console.error('添加好友失败:', error)
  } finally {
    addFriendLoading.value = false
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

// 头像加载错误处理
const handleAvatarError = () => {
  console.warn('头像加载失败:', searchResult.value?.avatar)
  // 可以在这里设置默认头像或者其他处理
}

// 右键菜单相关方法
const hideContextMenu = () => {
  contextMenu.value.visible = false
  contextMenu.value.friend = null
}

const handleContextMenuAction = (action: string) => {
  const friend = contextMenu.value.friend
  if (!friend) return

  switch (action) {
    case 'chat':
      // 发送消息逻辑
      console.log('发送消息给:', friend.nickname)
      break
    case 'remark':
      // 修改备注逻辑
      currentFriend.value = friend
      remarkForm.value.remark = friend.remark || ''
      showRemarkDialog.value = true
      break
    case 'delete':
      // 删除好友逻辑
      console.log('删除好友:', friend.nickname)
      break
  }
  hideContextMenu()
}

// 修改备注
const updateRemark = async () => {
  if (!currentFriend.value) return

  try {
    // 这里应该调用API更新备注
    console.log('更新备注:', currentFriend.value.nickname, remarkForm.value.remark)
    ElMessage.success('备注修改成功')
    showRemarkDialog.value = false
  } catch (error) {
    console.error('修改备注失败:', error)
    ElMessage.error('修改备注失败')
  }
}


</script>

<style scoped lang="scss">
.friend-management {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 欢迎界面样式 */
.welcome-card {
  margin-bottom: 16px;
}

.welcome-content {
  text-align: center;
  padding: 40px 20px;
}

.welcome-icon {
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.welcome-content h3 {
  color: var(--el-text-color-primary);
  margin: 16px 0;
  font-size: 24px;
  font-weight: 600;
}

.welcome-content p {
  color: var(--el-text-color-regular);
  margin-bottom: 24px;
  font-size: 16px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
  margin: 0 auto;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.feature-item .el-icon {
  color: var(--el-color-primary);
  font-size: 18px;
}

.search-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .search-form {
    margin-bottom: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px;

    .el-form-item {
      margin-bottom: 0;
      margin-right: 0;
    }

    .el-form-item__label {
      white-space: nowrap;
    }
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

// 好友操作卡片样式
.friend-actions-card {
  margin-top: 16px;

  .friend-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
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
  background: transparent;
}
</style>
