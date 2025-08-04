<script setup lang="ts">
import type { ChatSession } from '@/types/chat'
import {
  ChatDotRound,
  Close,
  Delete,
  Document,
  Edit,
  Loading,
  Picture,
  Position,
  Refresh,
  RefreshRight,
  Search,
  Select,
  Tools,
  User,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { friendApi } from '@/api/friend'
// 移除旧的WebSocket导入，使用chatStore的WebSocket管理
import MessageItem from '@/components/business/MessageItem.vue'
// 暂时注释掉虚拟滚动相关导入
// import VirtualMessageList from '@/components/common/VirtualMessageList.vue'
// import LazyImage from '@/components/common/LazyImage.vue'
import { useNotification } from '@/composables'
import { useChatStore } from '@/stores/chat'
import { useFriendStore } from '@/stores/friend'
import { useAuthStore } from '@/stores/auth'
import { useContactStore } from '@/stores/contact'

// Props
const props = defineProps<{
  account: any
}>()

// Stores
const chatStore = useChatStore()
const friendStore = useFriendStore()
const authStore = useAuthStore()
const contactStore = useContactStore()

// Composables
const { showError, showSuccess, confirmDelete } = useNotification()

// 响应式数据
const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()
const imageInputRef = ref<HTMLInputElement>()
const isDragOver = ref(false)
const searchKeyword = ref('')

// 暂时注释掉虚拟滚动相关变量
// const virtualListRef = ref<InstanceType<typeof VirtualMessageList>>()
// const messagesContainerHeight = ref(400)
// const isLoadingHistory = ref(false)

// 右键菜单相关
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  message: null as any,
})

// 聊天列表右键菜单
const sessionContextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  session: null as ChatSession | null,
})

// 备注对话框
const showRemarkDialog = ref(false)
const remarkForm = ref({
  remark: '',
})
const currentRemarkSession = ref<ChatSession | null>(null)

// 计算属性
const filteredSessions = computed(() => {
  // 使用refreshTrigger来强制重新计算
  chatStore.refreshTrigger

  if (!searchKeyword.value)
    return chatStore.sessions
  return chatStore.sessions.filter(session =>
    session.name.toLowerCase().includes(searchKeyword.value.toLowerCase()),
  )
})

// 方法
function selectSession(session: ChatSession) {
  // 延迟加载：只有在点击会话时才设置当前会话和加载消息
  chatStore.setCurrentSession(session.id)

  // 延迟滚动，确保消息渲染完成
  nextTick(() => {
    scrollToBottom()
  })
}

async function loadFriendsAsSessions() {
  if (!props.account?.wxid)
    return

  try {
    await friendStore.loadFriends(props.account.wxid)
    const friends = friendStore.currentFriends(props.account.wxid)

    const sessions: ChatSession[] = friends.map(friend => ({
      id: friend.wxid,
      name: friend.remark || friend.nickname,
      avatar: friend.avatar,
      type: 'friend',
      lastMessage: '',
      lastMessageTime: new Date(),
      unreadCount: 0,
      isOnline: friend.isOnline,
    }))

    chatStore.setSessions(sessions)
    // 好友会话加载完成，不显示提示
  }
  catch (error) {
    showError('加载好友列表失败')
    console.error('加载好友失败:', error)
  }
}

async function sendMessage() {
  if (!messageInput.value.trim() || !props.account || !chatStore.currentSession) {
    return
  }

  const content = messageInput.value.trim()
  messageInput.value = ''

  try {
    await chatStore.sendTextMessage(
      props.account.wxid,
      chatStore.currentSession.id,
      content,
    )
    scrollToBottom()
  }
  catch (error) {
    showError('发送消息失败')
    console.error('发送消息失败:', error)
  }
}

async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items)
    return

  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        if (file.type.startsWith('image/')) {
          await sendImage(file)
        } else {
          await sendFile(file)
        }
      }
    }
  }
}

async function sendImage(file: File) {
  if (!props.account || !chatStore.currentSession) {
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target?.result as string
      await chatStore.sendImageMessage(
        props.account!.wxid,
        chatStore.currentSession!.id,
        imageData,
      )
      scrollToBottom()
    }
    reader.readAsDataURL(file)
  }
  catch (error) {
    showError('发送图片失败')
    console.error('发送图片失败:', error)
  }
}

// 选择图片文件
function selectImageFile() {
  imageInputRef.value?.click()
}

// 选择任意文件
function selectFile() {
  fileInputRef.value?.click()
}

// 处理图片选择
function handleImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    sendImage(file)
  }
  // 清空input值，允许重复选择同一文件
  target.value = ''
}

// 处理文件选择
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (file.type.startsWith('image/')) {
      sendImage(file)
    } else {
      sendFile(file)
    }
  }
  // 清空input值，允许重复选择同一文件
  target.value = ''
}

// 发送文件
async function sendFile(file: File) {
  if (!chatStore.currentSession || !authStore.currentAccount) {
    showError('请先选择聊天对象')
    return
  }

  try {
    await chatStore.sendFileMessage(
      authStore.currentAccount.wxid,
      chatStore.currentSession.id,
      file
    )
    showSuccess('文件发送成功')
  } catch (error) {
    showError('发送文件失败')
    console.error('发送文件失败:', error)
  }
}

// 拖拽相关事件处理
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  // 只有当离开整个拖拽区域时才设置为false
  const currentTarget = event.currentTarget as Element
  const relatedTarget = event.relatedTarget as Node
  if (!currentTarget?.contains(relatedTarget)) {
    isDragOver.value = false
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('image/')) {
      sendImage(file)
    } else {
      sendFile(file)
    }
  }
}

async function clearCurrentMessages() {
  if (!chatStore.currentSession)
    return

  try {
    await ElMessageBox.confirm('确定要清空当前会话的所有消息吗？', '确认清空', {
      type: 'warning',
    })

    const sessionId = chatStore.currentSession.id
    console.log(`UI: 开始清空会话 ${sessionId} 的消息`)

    // 清空消息
    chatStore.clearMessages(sessionId)

    // 显示成功提示
    ElMessage.success('消息已清空')
    console.log(`UI: 会话 ${sessionId} 消息清空操作完成`)
  }
  catch {
    // 用户取消
    console.log('用户取消了清空消息操作')
  }
}

// 暂时注释掉虚拟滚动相关方法
// function loadMoreHistory() {
//   if (isLoadingHistory.value || !chatStore.currentSession) return
//
//   isLoadingHistory.value = true
//
//   // 模拟加载历史消息
//   setTimeout(() => {
//     // 这里应该调用实际的API加载历史消息
//     // chatStore.loadHistoryMessages(chatStore.currentSession.id)
//     isLoadingHistory.value = false
//   }, 1000)
// }

// function handleReachBottom() {
//   // 到达底部时的处理
// }

// function handleMessagesScroll(scrollTop: number) {
//   // 滚动时的处理
// }

// 重试发送消息
async function retryMessage(message: any) {
  if (!props.account || !chatStore.currentSession)
    return

  try {
    await chatStore.retryMessage(
      props.account.wxid,
      chatStore.currentSession.id,
      message.id,
    )
  }
  catch (error) {
    showError('重试发送失败')
    console.error('重试发送失败:', error)
  }
}

// 显示右键菜单
function showContextMenu(event: MouseEvent, message: any) {
  event.preventDefault()

  console.log('右键点击消息详情:', {
    id: message.id,
    content: message.content,
    fromMe: message.fromMe,
    type: message.type,
    status: message.status,
    canRecall: message.canRecall,
    canRetry: message.canRetry,
  })

  // 只有自己发送的消息且可以撤回的才显示右键菜单
  if (!message.fromMe || message.type === 'system' || !message.canRecall) {
    console.log('不显示右键菜单，原因:', {
      notFromMe: !message.fromMe,
      isSystem: message.type === 'system',
      cannotRecall: !message.canRecall,
    })
    return
  }

  // 获取聊天容器的位置
  const chatContainer = document.querySelector('.chat-interface')
  const containerRect = chatContainer?.getBoundingClientRect()

  // 计算相对于视口的位置，考虑页面滚动
  let x = event.clientX
  let y = event.clientY

  // 确保菜单不会超出视口边界
  const menuWidth = 120
  const menuHeight = 50

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }

  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  contextMenu.value = {
    visible: true,
    x,
    y,
    message,
  }
}

// 隐藏右键菜单
function hideContextMenu() {
  contextMenu.value.visible = false
  contextMenu.value.message = null
}

// 显示聊天列表右键菜单
function showSessionContextMenu(event: MouseEvent, session: ChatSession) {
  event.preventDefault()
  event.stopPropagation()

  console.log('显示右键菜单:', session.name, { x: event.clientX, y: event.clientY })

  // 计算菜单位置，确保不超出视口
  let x = event.clientX
  let y = event.clientY

  const menuWidth = 150
  const menuHeight = 140

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }

  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  sessionContextMenu.value = {
    visible: true,
    x,
    y,
    session,
  }

  console.log('菜单已设置为可见:', sessionContextMenu.value)
}

// 隐藏聊天列表右键菜单
function hideSessionContextMenu() {
  sessionContextMenu.value.visible = false
  sessionContextMenu.value.session = null
}

// 处理聊天列表右键菜单操作
function handleSessionContextMenuAction(action: string) {
  console.log('菜单项被点击:', action)
  const session = sessionContextMenu.value.session
  if (!session) {
    console.error('没有选中的会话')
    return
  }

  console.log('处理会话操作:', action, session.name)

  switch (action) {
    case 'remark':
      // 修改备注
      currentRemarkSession.value = session
      // 使用当前显示的名称作为默认备注
      remarkForm.value.remark = session.name || ''
      showRemarkDialog.value = true
      break
    case 'deleteSession':
      // 删除会话（只删除本地聊天记录）
      handleDeleteSession(session)
      break
    case 'deleteFriend':
      // 删除好友（调用API删除好友关系）
      handleDeleteFriend(session)
      break
  }
  hideSessionContextMenu()
}

// 删除会话（只删除本地聊天记录）
async function handleDeleteSession(session: ChatSession) {
  try {
    await ElMessageBox.confirm(
      `确定要删除与 "${session.name}" 的聊天记录吗？这不会删除好友关系。`,
      '删除会话',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      }
    )

    // 只删除本地会话和聊天记录
    chatStore.removeSession(session.id)
    ElMessage.success('聊天记录已删除')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除会话失败:', error)
    }
  }
}

// 删除好友（调用API删除好友关系）
async function handleDeleteFriend(session: ChatSession) {
  try {
    await ElMessageBox.confirm(
      `确定要删除好友 "${session.name}" 吗？这将永久删除好友关系和聊天记录。`,
      '删除好友',
      {
        type: 'error',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      }
    )

    if (!props.account) {
      ElMessage.error('账号信息不存在')
      return
    }

    // 调用删除好友API
    await friendApi.deleteFriend({
      Wxid: props.account.wxid,
      ToWxid: session.id,
    })

    // 删除本地会话和聊天记录
    chatStore.removeSession(session.id)
    ElMessage.success('好友删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除好友失败:', error)
      ElMessage.error(error.message || '删除好友失败')
    }
  }
}

// 更新备注
async function updateSessionRemark() {
  if (!currentRemarkSession.value || !props.account) return

  try {
    const session = currentRemarkSession.value
    const newRemark = remarkForm.value.remark.trim()

    if (!newRemark) {
      ElMessage.warning('请输入备注名称')
      return
    }

    // 根据会话类型调用不同的API
    if (session.type === 'friend') {
      // 好友备注
      await friendApi.setFriendRemark({
        Wxid: props.account.wxid,
        ToWxid: session.id,
        Remarks: newRemark,
      })
    } else if (session.type === 'group') {
      // 群聊备注 - 需要添加群组API
      ElMessage.warning('群聊备注功能暂未实现')
      return
    }

    // 更新本地会话名称
    chatStore.updateSessionName(session.id, newRemark)

    ElMessage.success('备注修改成功')
    showRemarkDialog.value = false
    currentRemarkSession.value = null
    remarkForm.value.remark = ''
  } catch (error: any) {
    console.error('修改备注失败:', error)
    ElMessage.error(error.message || '修改备注失败')
  }
}

// 取消备注对话框
function cancelRemarkDialog() {
  showRemarkDialog.value = false
  currentRemarkSession.value = null
  remarkForm.value.remark = ''
}

// 撤回消息
async function recallMessage() {
  if (!props.account || !chatStore.currentSession || !contextMenu.value.message)
    return

  try {
    await ElMessageBox.confirm('确定要撤回这条消息吗？', '撤回消息', {
      type: 'warning',
    })

    await chatStore.recallMessage(
      props.account.wxid,
      chatStore.currentSession.id,
      contextMenu.value.message.id,
    )
    hideContextMenu()
  }
  catch (error) {
    if (error !== 'cancel') {
      showError('撤回消息失败')
      console.error('撤回消息失败:', error)
    }
  }
}

function scrollToBottom() {
  // 减少延迟，提升响应速度
  nextTick(() => {
    if (messagesContainer.value) {
      const container = messagesContainer.value
      // 使用平滑滚动，减少突兀感
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

function formatTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 1000 * 60)
    return '刚刚'
  if (diff < 1000 * 60 * 60)
    return `${Math.floor(diff / (1000 * 60))}分钟前`
  if (diff < 1000 * 60 * 60 * 24)
    return `${Math.floor(diff / (1000 * 60 * 60))}小时前`

  return date.toLocaleDateString()
}

function formatMessageTime(time: Date) {
  return time.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSessionTime(timestamp: Date | string): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    // 今天，显示时间
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  else if (messageDate.getTime() === yesterday.getTime()) {
    // 昨天
    return '昨天'
  }
  else if (now.getTime() - date.getTime() < 7 * 86400000) {
    // 一周内，显示星期
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[date.getDay()]
  }
  else {
    // 更早，显示日期
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }
}

function showMessageTime(message: any, index: number) {
  // 第一条消息总是显示时间
  if (index === 0)
    return true

  // 获取当前消息和前一条消息
  const messages = chatStore.currentMessages
  const prevMessage = messages[index - 1]

  if (!prevMessage)
    return true

  // 比较时间，如果是同一分钟则不显示
  const currentTime = new Date(message.timestamp)
  const prevTime = new Date(prevMessage.timestamp)

  const currentMinute = currentTime.getHours() * 60 + currentTime.getMinutes()
  const prevMinute = prevTime.getHours() * 60 + prevTime.getMinutes()

  // 如果不是同一天，显示时间
  if (currentTime.toDateString() !== prevTime.toDateString()) {
    return true
  }

  // 如果不是同一分钟，显示时间
  return currentMinute !== prevMinute
}

// 获取联系人头像
function getContactAvatar(message: any) {
  // 如果不是自己的消息，获取对方的头像
  if (!message.fromMe) {
    // 对于个人聊天，使用当前会话的头像
    if (!message.isGroupMessage && chatStore.currentSession) {
      return chatStore.currentSession.avatar || ''
    }

    // 对于群聊消息，暂时返回空，让MessageItem使用默认头像
    // 后续可以通过API获取实际发送者的头像
    return ''
  }

  // 自己的消息不需要在这里处理头像，由MessageItem的myAvatar属性处理
  return ''
}

// 获取联系人头像文字
function getContactAvatarText(message: any) {
  // 如果是自己的消息，返回空字符串（由MessageItem的myAvatar属性处理）
  if (message.fromMe) {
    return ''
  }

  // 对于对方的消息，按优先级获取头像文字
  let avatarText = ''

  // 1. 优先使用实际发送者名称
  if (message.actualSenderName && message.actualSenderName.trim()) {
    avatarText = message.actualSenderName.trim().charAt(0)
  }
  // 2. 如果是群聊且有发送者ID，使用发送者ID
  else if (message.isGroupMessage && message.actualSender && message.actualSender.trim()) {
    avatarText = message.actualSender.trim().charAt(0)
  }
  // 3. 使用当前会话名称
  else if (chatStore.currentSession && chatStore.currentSession.name.trim()) {
    avatarText = chatStore.currentSession.name.trim().charAt(0)
  }
  // 4. 使用会话ID作为兜底
  else if (message.sessionId && message.sessionId.trim()) {
    avatarText = message.sessionId.trim().charAt(0)
  }
  // 5. 最后的兜底
  else {
    avatarText = '?'
  }

  // 确保返回的是有效字符
  return avatarText || '?'
}

// 刷新联系人信息
const isRefreshingContact = ref(false)

async function refreshContactInfo() {
  if (!props.account?.wxid || !chatStore.currentSession || isRefreshingContact.value) {
    return
  }

  isRefreshingContact.value = true

  try {
    console.log('开始刷新联系人信息:', chatStore.currentSession.id)

    // 调用friendApi获取联系人详情，强制刷新
    const result = await friendApi.getFriendDetail({
      Wxid: props.account.wxid,
      Towxids: chatStore.currentSession.id,
      ChatRoom: chatStore.currentSession.id.includes('@chatroom') ? chatStore.currentSession.id : '',
      force_refresh: true, // 强制刷新
    })

    if (result.Success && result.Data) {
      let contactData = null

      // 处理两种不同的数据格式
      if (Array.isArray(result.Data) && result.Data.length > 0) {
        // 格式1: Data 是数组
        contactData = result.Data[0]
      }
      else if (result.Data.ContactList && result.Data.ContactList.length > 0) {
        // 格式2: Data 是对象，联系人信息在 ContactList 中
        contactData = result.Data.ContactList[0]
      }

      if (contactData) {
        console.log('获取到联系人详情:', contactData)

        // 判断是否为群聊
        const isGroup = chatStore.currentSession.id.includes('@chatroom')

        // 更新当前会话信息
        let updatedName = chatStore.currentSession.name
        let updatedAvatar = chatStore.currentSession.avatar

        if (isGroup) {
          // 对于群聊，优先从ContactList中获取群名称
          if (contactData.ContactList && contactData.ContactList.length > 0) {
            updatedName = contactData.ContactList[0].NickName?.string || chatStore.currentSession.name
          }
          else {
            updatedName = contactData.NickName?.string || contactData.Remark?.string || chatStore.currentSession.name
          }
          updatedAvatar = contactData.SmallHeadImgUrl || contactData.BigHeadImgUrl || chatStore.currentSession.avatar
        }
        else {
          // 个人联系人：优先显示备注，其次昵称
          updatedName = contactData.Remark?.string || contactData.NickName?.string || contactData.Alias || chatStore.currentSession.name
          updatedAvatar = contactData.SmallHeadImgUrl || contactData.BigHeadImgUrl || chatStore.currentSession.avatar
        }

        // 使用chatStore的updateSessionInfo方法更新会话信息
        const updatedSession = chatStore.updateSessionInfo(chatStore.currentSession.id, {
          name: updatedName,
          avatar: updatedAvatar,
          type: isGroup ? 'group' : 'friend',
        })

        if (updatedSession) {
          console.log('联系人信息已更新:', updatedName, updatedAvatar)
          showSuccess('联系人信息已更新')
        }
        else {
          console.warn('未找到对应的会话')
          showError('更新会话信息失败')
        }
      }
      else {
        console.warn('未获取到联系人详情数据')
        showError('未能获取到联系人详情')
      }
    }
    else {
      console.warn('API调用失败或返回数据为空')
      showError('未能获取到联系人详情')
    }
  }
  catch (error) {
    console.error('刷新联系人信息失败:', error)
    showError('刷新联系人信息失败')
  }
  finally {
    isRefreshingContact.value = false
  }
}

// 测试自动更新功能
async function testAutoUpdate() {
  if (!props.account?.wxid || !chatStore.currentSession) {
    ElMessage.warning('请先选择一个会话')
    return
  }

  console.log('🧪 测试自动更新功能')
  ElMessage.info('开始测试自动更新...')

  try {
    await autoUpdateSenderInfo(chatStore.currentSession.id)
    ElMessage.success('测试完成，请查看控制台日志')
  } catch (error) {
    console.error('测试失败:', error)
    ElMessage.error('测试失败')
  }
}

// 强制刷新UI
function forceRefreshUI() {
  console.log('🔄 手动触发强制刷新UI')
  chatStore.forceRefreshUI()
  ElMessage.success('UI已强制刷新')
}

// 自动更新消息发送者信息
const autoUpdateSenderInfo = async (sessionId: string) => {
  if (!props.account?.wxid) {
    console.warn('自动更新联系人信息失败: 账号信息为空')
    return
  }

  console.log(`🔄 开始自动更新联系人信息: sessionId=${sessionId}, accountWxid=${props.account.wxid}`)

  try {
    // 异步更新发送者信息，强制刷新以获取最新的头像和昵称
    const result = await chatStore.updateSessionContactInfo(props.account.wxid, sessionId, true)
    if (result) {
      console.log('✅ 自动更新联系人信息完成:', {
        sessionId,
        name: result.name,
        avatar: result.avatar,
        type: result.type
      })
    } else {
      console.warn('⚠️ 自动更新联系人信息返回空结果:', sessionId)
    }
  } catch (error) {
    console.error('❌ 自动更新发送者信息失败:', error)
  }
}

// 监听账号变化
watch(() => props.account?.wxid, async (newWxid, oldWxid) => {
  if (newWxid && newWxid !== oldWxid) {
    // 使用新的账号切换功能，自动保存旧账号数据并加载新账号缓存
    chatStore.switchAccount(newWxid, oldWxid)

    // 加载新账号的好友作为会话（如果缓存中没有会话）
    if (chatStore.sessions.length === 0) {
      await loadFriendsAsSessions()
    }

    // 尝试建立或切换 WebSocket 连接（确保事件监听器正确绑定）
    try {
      console.log(`🔄 账号切换，重新建立WebSocket连接: ${newWxid}`)
      // 无论是否已连接，都重新连接以确保事件监听器正确绑定
      const connected = await chatStore.connectWebSocket(newWxid)
      if (connected) {
        console.log(`✅ WebSocket已连接到账号: ${newWxid}`)
      } else {
        console.warn(`❌ WebSocket连接失败: ${newWxid}，将使用离线模式`)
      }
    }
    catch (error) {
      console.warn(`WebSocket连接失败: ${newWxid}，将使用离线模式`, error)
      // 不显示错误消息，因为这在开发环境中是正常的
    }
  }
})

// 监听消息变化，自动更新发送者信息
watch(() => chatStore.currentMessages, (newMessages, oldMessages) => {
  if (!props.account?.wxid || !newMessages || !oldMessages) {
    console.log('⏭️ 跳过消息监听: 账号或消息为空')
    return
  }

  // 检查是否有新消息
  if (newMessages.length > oldMessages.length) {
    const newMessage = newMessages[newMessages.length - 1]
    console.log('📨 检测到新消息:', {
      fromMe: newMessage.fromMe,
      sessionId: newMessage.sessionId,
      content: newMessage.content?.substring(0, 20) + '...'
    })

    // 如果是收到的消息（非自己发送），自动更新发送者信息
    if (!newMessage.fromMe && newMessage.sessionId) {
      console.log('🚀 触发自动更新联系人信息:', newMessage.sessionId)
      autoUpdateSenderInfo(newMessage.sessionId)
    } else {
      console.log('⏭️ 跳过自动更新: 消息来自自己或无sessionId')
    }
  }
}, { deep: true })

// 监听当前会话变化，切换会话时滚动到底部
watch(
  () => chatStore.currentSession,
  (newSession, oldSession) => {
    if (newSession && newSession !== oldSession) {
      // 只在真正切换会话时滚动，避免初始加载时滚动
      nextTick(() => {
        scrollToBottom()
      })
    }
  }
)

// 监听新消息，只在收到新消息时滚动（不是加载历史消息）
let lastMessageCount = 0
watch(
  () => chatStore.currentMessages.length,
  (newCount) => {
    if (newCount > lastMessageCount && lastMessageCount > 0) {
      // 只有消息数量增加且不是初始加载时才滚动
      scrollToBottom()
    }
    lastMessageCount = newCount
  }
)

// 暂时注释掉容器高度计算
// function calculateMessagesContainerHeight() {
//   nextTick(() => {
//     const container = document.querySelector('.chat-main')
//     if (container) {
//       const containerRect = container.getBoundingClientRect()
//       const headerHeight = 60 // 聊天头部高度
//       const inputHeight = 120 // 输入区域高度
//       const padding = 40 // 内边距
//
//       messagesContainerHeight.value = containerRect.height - headerHeight - inputHeight - padding
//     }
//   })
// }

// function handleResize() {
//   calculateMessagesContainerHeight()
// }

onMounted(async () => {
  if (props.account?.wxid) {
    // 首先加载缓存数据
    chatStore.loadCachedData(props.account.wxid)

    // 如果缓存中没有会话，则从好友列表加载
    if (chatStore.sessions.length === 0) {
      await loadFriendsAsSessions()
    }

    // 无论WebSocket是否已连接，都重新建立连接以确保事件监听器正确绑定
    try {
      console.log(`🔄 页面挂载，重新建立WebSocket连接: ${props.account.wxid}`)
      const connected = await chatStore.connectWebSocket(props.account.wxid)
      if (connected) {
        console.log(`✅ WebSocket连接成功: ${props.account.wxid}`)
      } else {
        console.warn('❌ WebSocket连接失败，将使用离线模式')
      }
    }
    catch (error) {
      console.warn('WebSocket连接失败，将使用离线模式')
      // 不显示错误消息，因为这在开发环境中是正常的
    }
  }

  // 暂时注释掉容器高度计算
  // calculateMessagesContainerHeight()

  // 监听窗口大小变化
  // window.addEventListener('resize', handleResize)

  // 添加全局点击事件监听器来隐藏右键菜单
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  // 清理事件监听器
  // window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', hideContextMenu)
  document.removeEventListener('click', hideSessionContextMenu)

  // 注意：不要在这里断开WebSocket连接，让WebSocketService管理连接生命周期
  // 只有在真正需要断开时（比如用户退出登录）才断开
})
</script>

<template>
  <div class="chat-interface">
    <!-- 聊天会话列表 -->
    <div class="chat-sessions">
      <div class="sessions-header">
        <div class="search-container">
          <el-input v-model="searchKeyword" placeholder="搜索" size="small" class="search-input">
            <template #prefix>
              <el-icon class="search-icon">
                <Search />
              </el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <div class="sessions-list">
        <div v-if="filteredSessions.length === 0" class="empty-sessions">
          <div class="empty-content">
            <el-icon class="empty-icon">
              <User />
            </el-icon>
            <p>暂无聊天记录</p>
            <el-button link @click="loadFriendsAsSessions">
              从好友列表加载
            </el-button>
          </div>
        </div>

        <div v-for="session in filteredSessions" :key="session.id" class="session-item"
          :class="{ active: chatStore.currentSession?.id === session.id }" @click="selectSession(session)"
          @contextmenu="showSessionContextMenu($event, session)">
          <div class="session-avatar">
            <el-avatar :src="session.avatar || ''" :size="40">
              <template #default>
                <span class="avatar-text">{{ session.name?.charAt(0) || '?' }}</span>
              </template>
            </el-avatar>
          </div>
          <div class="session-content">
            <div class="session-top">
              <div class="session-name">
                {{ session.name }}
              </div>
              <div class="session-time">
                {{ formatSessionTime(session.lastMessageTime) }}
              </div>
            </div>
            <div class="session-bottom">
              <div class="session-last-message">
                {{ session.lastMessage || '暂无消息' }}
              </div>
              <div v-if="session.unreadCount" class="unread-badge">
                {{ session.unreadCount > 99 ? '99+' : session.unreadCount }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="chat-area">
      <div v-if="!chatStore.currentSession" class="no-session">
        <el-result icon="info" title="请选择一个聊天会话">
          <template #sub-title>
            <p>从左侧选择一个会话开始聊天，或者从好友列表发起新的聊天</p>
          </template>
        </el-result>
      </div>

      <div v-else class="chat-content">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <div class="chat-info">
            <el-avatar :src="chatStore.currentSession.avatar" :size="32" class="chat-avatar">
              <span class="avatar-text">{{ chatStore.currentSession.name.charAt(0) }}</span>
            </el-avatar>
            <div class="chat-title">
              <div class="chat-name">
                {{ chatStore.currentSession.name }}
              </div>
            </div>
          </div>
          <div class="chat-actions">
            <el-button link class="action-btn" :loading="isRefreshingContact" @click="refreshContactInfo">
              <el-icon>
                <Refresh />
              </el-icon>
              刷新信息
            </el-button>

            <el-button link class="action-btn" @click="testAutoUpdate">
              <el-icon>
                <Tools />
              </el-icon>
              测试自动更新
            </el-button>

            <el-button link class="action-btn" @click="forceRefreshUI">
              <el-icon>
                <RefreshRight />
              </el-icon>
              强制刷新UI
            </el-button>

            <el-button link class="action-btn" @click="clearCurrentMessages">
              清空消息
            </el-button>
          </div>
        </div>

        <!-- 消息列表 -->
        <div ref="messagesContainer" class="messages-container">
          <!-- 未选择会话状态 -->
          <div v-if="!chatStore.currentSession" class="empty-messages">
            <div class="empty-messages-content">
              <el-icon class="empty-messages-icon">
                <ChatDotRound />
              </el-icon>
              <p>请选择一个会话</p>
              <span>点击左侧会话列表开始聊天</span>
            </div>
          </div>

          <!-- 空消息状态 -->
          <div v-else-if="chatStore.currentMessages.length === 0" class="empty-messages">
            <div class="empty-messages-content">
              <el-icon class="empty-messages-icon">
                <ChatDotRound />
              </el-icon>
              <p>暂无聊天记录</p>
              <span>发送一条消息开始聊天吧</span>
            </div>
          </div>

          <!-- 传统消息列表（暂时替换虚拟滚动） -->
          <div v-else-if="chatStore.currentSession && chatStore.currentMessages.length > 0" class="messages-list">
            <MessageItem v-for="(message, index) in chatStore.currentMessages" :key="message.id" :message="message"
              :show-time="showMessageTime(message, index)" :avatar="getContactAvatar(message)"
              :avatar-text="getContactAvatarText(message)" :my-avatar="props.account?.headUrl || props.account?.avatar"
              :my-avatar-text="props.account?.nickname?.charAt(0) || '我'" @retry="retryMessage"
              @contextmenu="showContextMenu" />
          </div>
        </div>

        <!-- 右键菜单 -->
        <Teleport to="body">
          <div v-if="contextMenu.visible" class="context-menu"
            :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
            <div class="context-menu-item" @click="recallMessage">
              <el-icon>
                <Delete />
              </el-icon>
              撤回消息
            </div>
          </div>
        </Teleport>

        <!-- 输入区域 -->
        <div class="input-area" @drop="handleDrop" @dragover="handleDragOver" @dragenter="handleDragEnter"
          @dragleave="handleDragLeave" :class="{ 'drag-over': isDragOver }">
          <div class="input-toolbar">
            <el-button link class="toolbar-btn" @click="selectImageFile">
              <el-icon>
                <Picture />
              </el-icon>
              图片
            </el-button>
            <el-button link class="toolbar-btn" @click="selectFile">
              <el-icon>
                <Document />
              </el-icon>
              文件
            </el-button>
          </div>

          <div class="input-container">
            <div class="input-wrapper">
              <el-input v-model="messageInput" type="textarea" :rows="3" placeholder="输入消息内容，支持粘贴图片..."
                class="message-input" @keydown.ctrl.enter="sendMessage" @paste="handlePaste" />
            </div>
            <div class="input-actions">
              <span class="input-tip">Ctrl+Enter 发送</span>
              <el-button type="primary" :loading="chatStore.isSending" class="send-btn" @click="sendMessage">
                发送
              </el-button>
            </div>
          </div>

          <input ref="imageInputRef" type="file" accept="image/*" style="display: none" @change="handleImageSelect">
          <input ref="fileInputRef" type="file" style="display: none" @change="handleFileSelect">
        </div>
      </div>
    </div>

    <!-- 聊天列表右键菜单 -->
    <Teleport to="body">
      <!-- 右键菜单遮罩层 -->
      <div v-if="sessionContextMenu.visible" class="context-menu-overlay" @click="hideSessionContextMenu"
        @contextmenu.prevent="hideSessionContextMenu"></div>

      <div v-if="sessionContextMenu.visible" class="session-context-menu" :style="{
        left: sessionContextMenu.x + 'px',
        top: sessionContextMenu.y + 'px'
      }" @click.stop>
        <div class="context-menu-item" @click="handleSessionContextMenuAction('remark')">
          <el-icon>
            <Edit />
          </el-icon>
          <span>修改备注</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="handleSessionContextMenuAction('deleteSession')">
          <el-icon>
            <ChatDotRound />
          </el-icon>
          <span>删除会话</span>
        </div>
        <div class="context-menu-item danger" @click="handleSessionContextMenuAction('deleteFriend')">
          <el-icon>
            <Delete />
          </el-icon>
          <span>删除好友</span>
        </div>
      </div>
    </Teleport>

    <!-- 备注修改对话框 -->
    <el-dialog v-model="showRemarkDialog" title="修改备注" width="400px" :before-close="cancelRemarkDialog">
      <el-form :model="remarkForm" label-width="80px">
        <el-form-item label="备注名称">
          <el-input v-model="remarkForm.remark" placeholder="请输入备注名称" maxlength="50" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelRemarkDialog">取消</el-button>
          <el-button type="primary" @click="updateSessionRemark">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.chat-interface {
  height: 100%;
  display: flex;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.chat-sessions {
  width: 300px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
}

.sessions-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}

.search-container {
  position: relative;
}

.search-input {
  width: 100%;

  :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    backdrop-filter: blur(10px);

    &:hover,
    &.is-focus {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }
  }

  :deep(.el-input__inner) {
    color: #333;
    font-size: 14px;

    &::placeholder {
      color: rgba(0, 0, 0, 0.4);
    }
  }
}

.search-icon {
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  max-height: 65vh;
  /* 限制最大高度为视口高度的50% */

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
}

.empty-sessions {
  padding: 60px 20px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon {
  font-size: 48px;
  color: rgba(0, 0, 0, 0.2);
}

.empty-content p {
  margin: 0;
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  &.active {
    background: rgba(255, 255, 255, 0.9);
    border-left: 3px solid #409eff;
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
  }
}

.session-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
}

.session-content {
  flex: 1;
  min-width: 0;
}

.session-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.session-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.session-time {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  margin-left: 8px;
  flex-shrink: 0;
}

.session-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-last-message {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.unread-badge {
  background: rgba(255, 255, 255, 0.95);
  color: #666666;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 12px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
}

.no-session {
  flex: 1;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
}

.chat-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04);
}

.chat-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-avatar {
  flex-shrink: 0;
  margin-right: 12px;
}

.chat-title {
  flex: 1;
}

.chat-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.chat-actions {
  display: flex;
  align-items: center;
}

.action-btn {
  color: #409eff;
  font-size: 14px;
  transition: all 0.3s ease;

  &:hover {
    color: #66b1ff;
    transform: translateY(-1px);
  }
}

.messages-container {
  flex: 1;
  overflow-y: scroll;
  /* 强制显示滚动条 */
  overflow-x: hidden;
  padding: 16px 20px;
  height: 0;
  /* 让flex: 1生效 */
  max-height: 50vh;
  /* 限制最大高度为视口高度的50% */
  position: relative;
  min-height: 0;
  /* 确保可以收缩 */

  /* 强制显示滚动条 */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0.05);

  /* 确保滚动条可见 */
  &::-webkit-scrollbar {
    width: 8px;
    display: block;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;

    &:hover {
      background: rgba(0, 0, 0, 0.5);
    }
  }

  /* 确保内容可以滚动 */
  &:hover::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.4);
  }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
  /* 确保可以收缩 */
  /* 确保消息列表不会超出容器宽度 */
}

.empty-messages {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.empty-messages-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
}

.empty-messages-icon {
  font-size: 64px;
  color: rgba(0, 0, 0, 0.2);
}

.empty-messages-content p {
  margin: 0;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.6);
  font-weight: 500;
}

.empty-messages-content span {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.4);
}

.message-item {
  margin-bottom: 16px;
  animation: messageSlideIn 0.3s ease-out;
}

// 居中时间显示样式
.message-time-center {
  text-align: center;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  margin: 16px auto 8px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  display: block;
  width: fit-content;
}

.message-content {
  display: flex;
  align-items: flex-end;
  gap: 8px;

  &.from-me {
    justify-content: flex-end;

    .message-bubble {
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      margin-left: 60px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-bottom-right-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }

  &:not(.from-me) {
    justify-content: flex-start;

    .message-bubble {
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      margin-right: 60px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-bottom-left-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  position: relative;
  word-wrap: break-word;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);

  // 移除sender-name样式，不再需要

  .message-text {
    word-wrap: break-word;
    line-height: 1.5;
    font-size: 14px;
  }

  .message-image {
    padding: 0;

    img {
      max-width: 200px;
      border-radius: 8px;
      transition: transform 0.2s ease;

      &:hover {
        transform: scale(1.02);
      }
    }
  }
}

// 系统消息样式
.message-system {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  text-align: center;
  font-style: italic;
  padding: 8px 12px;
}

// 重试按钮样式
.message-retry {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);

  .el-button {
    width: 24px;
    height: 24px;
    min-height: 24px;

    &:hover {
      background-color: #f56c6c;
      border-color: #f56c6c;
    }
  }
}

// 右键菜单样式
.context-menu {
  position: fixed;
  background: #ffffff;
  border: 2px solid #409eff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 120px;
  overflow: hidden;

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .el-icon {
      font-size: 16px;
      color: #f56c6c;
    }
  }
}

// 移除消息状态样式，不再需要

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 移除spin动画，不再需要

.input-area {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  padding: 12px 20px;
  position: relative;
  transition: all 0.3s ease;

  &.drag-over {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
    border-style: dashed;

    &::before {
      content: '拖拽文件到此处发送';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: var(--el-color-primary);
      font-size: 16px;
      font-weight: 500;
      pointer-events: none;
      background: rgba(255, 255, 255, 0.9);
      padding: 8px 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }
}

.input-toolbar {
  margin-bottom: 12px;
  display: flex;
  gap: 16px;
}

.toolbar-btn {
  color: #409eff;
  font-size: 14px;
  padding: 4px 8px;
  transition: all 0.3s ease;
  border-radius: 6px;

  &:hover {
    color: #66b1ff;
    background: rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
  }
}

.input-container {
  position: relative;
}

.input-wrapper {
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  :deep(.el-textarea) {
    .el-textarea__inner {
      border: none;
      background: transparent;
      resize: none;
      font-size: 14px;
      line-height: 1.4;
      padding: 12px;

      &:focus {
        box-shadow: none;
      }

      &::placeholder {
        color: rgba(0, 0, 0, 0.4);
      }
    }
  }
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.input-tip {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
}

.send-btn {
  background: linear-gradient(135deg, #409eff, #67c23a);
  border: none;
  border-radius: 6px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);

  &:hover {
    background: linear-gradient(135deg, #66b1ff, #85ce61);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.4);
  }
}

// 聊天列表右键菜单样式
.session-context-menu {
  position: fixed;
  background: #ffffff;
  border: 2px solid #409eff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 150px;
  overflow: hidden;
  z-index: 9999;

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    &.danger {
      .el-icon {
        color: #f56c6c;
      }

      &:hover {
        background: rgba(245, 108, 108, 0.1);
      }
    }

    .el-icon {
      font-size: 16px;
      color: #409eff;
    }
  }
}

.context-menu-divider {
  height: 1px;
  background-color: #e4e7ed;
  margin: 0;
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  z-index: 9998;
}
</style>
