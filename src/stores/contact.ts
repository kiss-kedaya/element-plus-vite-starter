import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { friendApi } from '@/api/friend'

// 联系人信息接口
export interface ContactInfo {
  wxid: string
  nickname: string
  alias?: string
  avatar?: string
  remark?: string
  isGroup: boolean
  lastUpdated: number
  // 群聊特有信息
  groupName?: string
  memberCount?: number
  // 个人联系人特有信息
  signature?: string
  sex?: number
  region?: string
}

// 联系人缓存配置
const CONTACT_CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存时间
const CONTACT_CACHE_KEY = 'wechat_contact_cache'

export const useContactStore = defineStore('contact', () => {
  // 状态
  const contacts = ref<Record<string, Record<string, ContactInfo>>>({}) // wxid -> contactWxid -> ContactInfo
  const isUpdating = ref<Record<string, boolean>>({}) // 正在更新的联系人
  const lastBatchUpdate = ref<Record<string, number>>({}) // 上次批量更新时间

  // 计算属性
  const getContactInfo = computed(() => {
    return (accountWxid: string, contactWxid: string): ContactInfo | null => {
      return contacts.value[accountWxid]?.[contactWxid] || null
    }
  })

  // 检查联系人信息是否过期
  const isContactInfoExpired = (contactInfo: ContactInfo): boolean => {
    return Date.now() - contactInfo.lastUpdated > CONTACT_CACHE_DURATION
  }

  // 从本地存储加载联系人缓存
  const loadContactCache = (accountWxid: string) => {
    try {
      const cacheKey = `${CONTACT_CACHE_KEY}_${accountWxid}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsedCache = JSON.parse(cached)
        if (!contacts.value[accountWxid]) {
          contacts.value[accountWxid] = {}
        }
        
        // 过滤掉过期的缓存
        Object.entries(parsedCache).forEach(([contactWxid, contactInfo]: [string, any]) => {
          if (!isContactInfoExpired(contactInfo)) {
            contacts.value[accountWxid][contactWxid] = contactInfo
          }
        })
        
        console.log(`加载账号 ${accountWxid} 的联系人缓存，共 ${Object.keys(contacts.value[accountWxid]).length} 个联系人`)
      }
    } catch (error) {
      console.error('加载联系人缓存失败:', error)
    }
  }

  // 保存联系人缓存到本地存储
  const saveContactCache = (accountWxid: string) => {
    try {
      const cacheKey = `${CONTACT_CACHE_KEY}_${accountWxid}`
      const contactsToSave = contacts.value[accountWxid] || {}
      localStorage.setItem(cacheKey, JSON.stringify(contactsToSave))
    } catch (error) {
      console.error('保存联系人缓存失败:', error)
    }
  }

  // 更新单个联系人信息
  const updateContactInfo = async (accountWxid: string, contactWxid: string, forceRefresh = false): Promise<ContactInfo | null> => {
    // 检查是否已有缓存且未过期
    const cached = getContactInfo.value(accountWxid, contactWxid)
    if (cached && !isContactInfoExpired(cached) && !forceRefresh) {
      return cached
    }

    // 防止重复请求
    const updateKey = `${accountWxid}_${contactWxid}`
    if (isUpdating.value[updateKey]) {
      return cached
    }

    isUpdating.value[updateKey] = true

    try {
      console.log(`🔄 更新联系人信息: contactWxid=${contactWxid}, accountWxid=${accountWxid}, forceRefresh=${forceRefresh}`)

      // 判断是否为群聊
      const isGroup = contactWxid.includes('@chatroom')

      const apiParams = {
        Wxid: accountWxid,
        Towxids: contactWxid,
        ChatRoom: isGroup ? contactWxid : '',
        force_refresh: forceRefresh,
      }
      console.log('📡 调用API参数:', apiParams)

      const result = await friendApi.getFriendDetail(apiParams)
      console.log('📡 API返回结果:', { Success: result.Success, hasData: !!result.Data })

      if (result.Success && result.Data) {
        const contactData = result.Data

        let contactInfo: ContactInfo

        if (isGroup) {
          // 群聊信息
          contactInfo = {
            wxid: contactWxid,
            nickname: contactData.NickName?.string || contactWxid,
            alias: contactData.Alias || '',
            avatar: contactData.SmallHeadImgUrl || contactData.BigHeadImgUrl || '',
            remark: contactData.Remark?.string || '',
            isGroup: true,
            lastUpdated: Date.now(),
            groupName: contactData.NickName?.string || contactWxid,
            memberCount: contactData.MemberCount || 0,
          }
        } else {
          // 个人联系人信息
          contactInfo = {
            wxid: contactWxid,
            nickname: contactData.NickName?.string || contactWxid,
            alias: contactData.Alias || '',
            avatar: contactData.SmallHeadImgUrl || contactData.BigHeadImgUrl || '',
            remark: contactData.Remark?.string || '',
            isGroup: false,
            lastUpdated: Date.now(),
            signature: contactData.Signature || '',
            sex: contactData.Sex || 0,
            region: `${contactData.Country || ''} ${contactData.City || ''}`.trim() || '',
          }
        }

        // 更新缓存
        if (!contacts.value[accountWxid]) {
          contacts.value[accountWxid] = {}
        }
        contacts.value[accountWxid][contactWxid] = contactInfo

        // 保存到本地存储
        saveContactCache(accountWxid)

        console.log(`✅ 联系人信息已更新:`, {
          wxid: contactInfo.wxid,
          nickname: contactInfo.nickname,
          avatar: contactInfo.avatar,
          remark: contactInfo.remark,
          isGroup: contactInfo.isGroup
        })
        return contactInfo
      } else {
        console.warn('⚠️ API调用失败或无数据:', { Success: result.Success, Data: result.Data })
      }
    } catch (error) {
      console.error('更新联系人信息失败:', error)
    } finally {
      delete isUpdating.value[updateKey]
    }

    return cached
  }

  // 批量更新联系人信息
  const batchUpdateContacts = async (accountWxid: string, contactWxids: string[], forceRefresh = false) => {
    // 检查是否需要批量更新
    const now = Date.now()
    const lastUpdate = lastBatchUpdate.value[accountWxid] || 0
    
    if (!forceRefresh && now - lastUpdate < CONTACT_CACHE_DURATION) {
      console.log('批量更新间隔太短，跳过')
      return
    }

    console.log(`开始批量更新 ${contactWxids.length} 个联系人信息`)
    
    const updatePromises = contactWxids.map(contactWxid => 
      updateContactInfo(accountWxid, contactWxid, forceRefresh)
    )

    try {
      await Promise.allSettled(updatePromises)
      lastBatchUpdate.value[accountWxid] = now
      console.log('批量更新联系人信息完成')
    } catch (error) {
      console.error('批量更新联系人信息失败:', error)
    }
  }

  // 获取联系人显示名称
  const getDisplayName = (accountWxid: string, contactWxid: string): string => {
    const contactInfo = getContactInfo.value(accountWxid, contactWxid)
    if (!contactInfo) {
      return contactWxid
    }

    if (contactInfo.isGroup) {
      return contactInfo.groupName || contactInfo.nickname || contactWxid
    } else {
      return contactInfo.remark || contactInfo.nickname || contactInfo.alias || contactWxid
    }
  }

  // 获取联系人头像
  const getContactAvatar = (accountWxid: string, contactWxid: string): string => {
    const contactInfo = getContactInfo.value(accountWxid, contactWxid)
    return contactInfo?.avatar || ''
  }

  // 清除账号的联系人缓存
  const clearContactCache = (accountWxid: string) => {
    if (contacts.value[accountWxid]) {
      delete contacts.value[accountWxid]
    }
    
    try {
      const cacheKey = `${CONTACT_CACHE_KEY}_${accountWxid}`
      localStorage.removeItem(cacheKey)
    } catch (error) {
      console.error('清除联系人缓存失败:', error)
    }
  }

  // 清理过期的联系人缓存
  const cleanExpiredCache = () => {
    Object.keys(contacts.value).forEach(accountWxid => {
      const accountContacts = contacts.value[accountWxid]
      Object.keys(accountContacts).forEach(contactWxid => {
        if (isContactInfoExpired(accountContacts[contactWxid])) {
          delete accountContacts[contactWxid]
        }
      })
      
      // 保存清理后的缓存
      saveContactCache(accountWxid)
    })
  }

  return {
    // 状态
    contacts,
    isUpdating,

    // 计算属性
    getContactInfo,

    // 方法
    loadContactCache,
    saveContactCache,
    updateContactInfo,
    batchUpdateContacts,
    getDisplayName,
    getContactAvatar,
    clearContactCache,
    cleanExpiredCache,
  }
})
