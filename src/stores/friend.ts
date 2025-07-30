import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Friend, FriendRequest } from '@/types/friend'
import { friendApi } from '@/api/friend'

export const useFriendStore = defineStore('friend', () => {
  // 状态
  const friends = ref<Record<string, Friend[]>>({}) // 按wxid分组的好友列表
  const friendRequests = ref<FriendRequest[]>([])
  const isLoading = ref(false)
  const isSearching = ref(false)
  const isAdding = ref(false)

  // 计算属性
  const currentFriends = computed(() => {
    return (wxid: string) => friends.value[wxid] || []
  })

  const pendingRequests = computed(() => {
    return friendRequests.value.filter(req => req.status === 'pending')
  })

  // 方法
  const setFriends = (wxid: string, friendList: Friend[]) => {
    friends.value[wxid] = friendList
  }

  const addFriend = (wxid: string, friend: Friend) => {
    if (!friends.value[wxid]) {
      friends.value[wxid] = []
    }
    const existingIndex = friends.value[wxid].findIndex(f => f.wxid === friend.wxid)
    if (existingIndex >= 0) {
      friends.value[wxid][existingIndex] = friend
    } else {
      friends.value[wxid].push(friend)
    }
  }

  const removeFriend = (wxid: string, friendWxid: string) => {
    if (friends.value[wxid]) {
      const index = friends.value[wxid].findIndex(f => f.wxid === friendWxid)
      if (index >= 0) {
        friends.value[wxid].splice(index, 1)
      }
    }
  }

  const loadFriends = async (wxid: string, forceRefresh = false) => {
    if (friends.value[wxid] && !forceRefresh) return

    isLoading.value = true
    try {
      const result = await friendApi.getFriendList({
        Wxid: wxid,
        CurrentWxcontactSeq: 0,
        CurrentChatRoomContactSeq: 0,
        force_refresh: forceRefresh
      })
      
      if (result.Success && result.Data) {
        // 处理好友列表数据
        const friendList: Friend[] = result.Data.ContactList?.map((contact: any) => ({
          wxid: contact.UserName?.string || '',
          nickname: contact.NickName?.string || '',
          avatar: contact.SmallHeadImgUrl || '',
          remark: contact.Remark || '',
          signature: contact.Signature || '',
          sex: contact.Sex || 0,
          isOnline: true // 这里可以根据实际情况判断
        })) || []
        
        setFriends(wxid, friendList)
      }
    } catch (error) {
      console.error('加载好友列表失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  const searchContact = async (wxid: string, keyword: string) => {
    isSearching.value = true
    try {
      const result = await friendApi.searchContact({
        Wxid: wxid,
        ToUserName: keyword,
        FromScene: 0,
        SearchScene: 1
      })
      return result
    } catch (error) {
      console.error('搜索联系人失败:', error)
      throw error
    } finally {
      isSearching.value = false
    }
  }

  const sendFriendRequest = async (wxid: string, v1: string, v2: string, verifyContent: string) => {
    isAdding.value = true
    try {
      const result = await friendApi.sendFriendRequest({
        Wxid: wxid,
        V1: v1,
        V2: v2,
        Opcode: 2,
        Scene: 3,
        VerifyContent: verifyContent
      })
      
      if (result.Success) {
        // 添加到好友请求列表
        const request: FriendRequest = {
          id: Date.now().toString(),
          wxid: v1,
          nickname: '未知',
          avatar: '',
          verifyContent,
          status: 'pending',
          timestamp: new Date()
        }
        friendRequests.value.push(request)
      }
      
      return result
    } catch (error) {
      console.error('发送好友请求失败:', error)
      throw error
    } finally {
      isAdding.value = false
    }
  }

  const batchAddFriends = async (wxid: string, targets: Array<{identifier: string, message: string}>) => {
    const results = []
    
    for (const target of targets) {
      try {
        // 添加延时避免频率限制
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // 先搜索
        const searchResult = await searchContact(wxid, target.identifier)
        
        if (searchResult.Success && searchResult.Data) {
          const v1 = searchResult.Data.UserName?.string
          const v2 = searchResult.Data.AntispamTicket
          
          if (v1 && v2) {
            const addResult = await sendFriendRequest(wxid, v1, v2, target.message)
            results.push({
              target: target.identifier,
              success: addResult.Success,
              message: addResult.Message
            })
          } else {
            results.push({
              target: target.identifier,
              success: false,
              message: '搜索结果中缺少必要参数'
            })
          }
        } else {
          results.push({
            target: target.identifier,
            success: false,
            message: searchResult.Message || '搜索失败'
          })
        }
      } catch (error) {
        results.push({
          target: target.identifier,
          success: false,
          message: error instanceof Error ? error.message : '未知错误'
        })
      }
    }
    
    return results
  }

  const updateRequestStatus = (requestId: string, status: FriendRequest['status']) => {
    const request = friendRequests.value.find(req => req.id === requestId)
    if (request) {
      request.status = status
    }
  }

  return {
    // 状态
    friends,
    friendRequests,
    isLoading,
    isSearching,
    isAdding,
    
    // 计算属性
    currentFriends,
    pendingRequests,
    
    // 方法
    setFriends,
    addFriend,
    removeFriend,
    loadFriends,
    searchContact,
    sendFriendRequest,
    batchAddFriends,
    updateRequestStatus
  }
})
