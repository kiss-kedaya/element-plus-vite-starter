// 预置文件缓存工具
import type { CachedFileInfo } from './fileCache'

// 预置的文件缓存数据
export const PRESET_FILE_CACHE: Array<[string, CachedFileInfo]> = [
  [
    "工作介绍.pptx_140967",
    {
      "fileName": "工作介绍.pptx",
      "fileSize": 140967,
      "originalContent": "<?xml version=\"1.0\"?>\n<msg>\n\t<appmsg appid=\"wx6618f1cfc6c132f8\" sdkver=\"0\">\n\t\t<title>工作介绍.pptx</title>\n\t\t<des />\n\t\t<action />\n\t\t<type>6</type>\n\t\t<showtype>0</showtype>\n\t\t<soundtype>0</soundtype>\n\t\t<mediatagname />\n\t\t<messageext />\n\t\t<messageaction />\n\t\t<content />\n\t\t<contentattr>0</contentattr>\n\t\t<url />\n\t\t<lowurl />\n\t\t<dataurl />\n\t\t<lowdataurl />\n\t\t<songalbumurl />\n\t\t<songlyric />\n\t\t<template_id />\n\t\t<appattach>\n\t\t\t<totallen>140967</totallen>\n\t\t\t<attachid>@cdn_3057020100044b30490201000204bf693cc002032dcfbe0204914cf8240204688ecc76042430336535653236632d396666302d346430622d393463622d3239653937663635336164380204051400050201000405004c50ba00_3effa7f808753e85c64ea67361266300_1</attachid>\n\t\t\t<emoticonmd5 />\n\t\t\t<fileext>pptx</fileext>\n\t\t\t<cdnattachurl>3057020100044b30490201000204bf693cc002032dcfbe0204914cf8240204688ecc76042430336535653236632d396666302d346430622d393463622d3239653937663635336164380204051400050201000405004c50ba00</cdnattachurl>\n\t\t\t<aeskey>3effa7f808753e85c64ea67361266300</aeskey>\n\t\t\t<encryver>0</encryver>\n\t\t\t<overwrite_newmsgid>5370956075794921189</overwrite_newmsgid>\n\t\t\t<fileuploadtoken>v1_3mIkrPJZ4XGN3arMrDN0uEuw3pTjDh9JHxkBZ8a82Jnsuv/xx1I4h59b3pvn3wkHTq1UlsePg13Cb7xDE30i++7YEWgtl7M3fmX9Gm8hXQS9DBssPm4WJy3sACm1e1/Tix/esryzHRjXcDRu7EKtKNqHm8vVmS0NfnkYSGt0+l+hGL4MNWGayg+9GNsdGVVYHcVFqsFp2g==</fileuploadtoken>\n\t\t</appattach>\n\t\t<extinfo />\n\t\t<sourceusername />\n\t\t<sourcedisplayname />\n\t\t<thumburl />\n\t\t<md5>d4d5e996e167efa2b986708ccc814fc4</md5>\n\t\t<statextstr />\n\t</appmsg>\n\t<fromusername></fromusername>\n\t<scene>0</scene>\n\t<appinfo>\n\t\t<version>7</version>\n\t\t<appname>微信电脑版</appname>\n\t</appinfo>\n\t<commenturl></commenturl>\n</msg>",
      "attachId": "@cdn_3057020100044b30490201000204bf693cc002032dcfbe0204914cf8240204688ecc76042430336535653236632d396666302d346430622d393463622d3239653937663635336164380204051400050201000405004c50ba00_3effa7f808753e85c64ea67361266300_1",
      "cdnUrl": "3057020100044b30490201000204bf693cc002032dcfbe0204914cf8240204688ecc76042430336535653236632d396666302d346430622d393463622d3239653937663635336164380204051400050201000405004c50ba00",
      "aesKey": "3effa7f808753e85c64ea67361266300",
      "appId": "wx6618f1cfc6c132f8",
      "cacheTime": 1754202909524,
      "lastUsed": 1754202950839
    }
  ]
]

/**
 * 初始化预置文件缓存
 * 在应用启动时调用，将预置的文件缓存数据写入localStorage
 */
export function initPresetFileCache(): void {
  try {
    const STORAGE_KEY = 'wechat_file_cache'
    
    // 检查是否已经有缓存数据
    const existingCache = localStorage.getItem(STORAGE_KEY)
    let cacheMap = new Map<string, CachedFileInfo>()
    
    // 如果已有缓存，先加载现有数据
    if (existingCache) {
      try {
        const parsedData = JSON.parse(existingCache)
        cacheMap = new Map(parsedData)
        console.log('加载现有文件缓存:', { size: cacheMap.size })
      } catch (error) {
        console.warn('解析现有缓存失败，将重新创建:', error)
      }
    }
    
    // 添加预置缓存数据
    let addedCount = 0
    let updatedCount = 0
    
    PRESET_FILE_CACHE.forEach(([key, fileInfo]) => {
      const existingFile = cacheMap.get(key)
      
      if (existingFile) {
        // 如果文件已存在，更新时间戳但保留原有的lastUsed时间
        const updatedFile: CachedFileInfo = {
          ...fileInfo,
          cacheTime: Date.now(),
          lastUsed: existingFile.lastUsed || Date.now()
        }
        cacheMap.set(key, updatedFile)
        updatedCount++
        console.log('更新预置文件缓存:', { fileName: fileInfo.fileName })
      } else {
        // 新增文件缓存
        const newFile: CachedFileInfo = {
          ...fileInfo,
          cacheTime: Date.now(),
          lastUsed: Date.now()
        }
        cacheMap.set(key, newFile)
        addedCount++
        console.log('添加预置文件缓存:', { fileName: fileInfo.fileName })
      }
    })
    
    // 保存到localStorage
    const cacheData = Array.from(cacheMap.entries())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData))
    
    console.log('预置文件缓存初始化完成:', {
      totalFiles: cacheMap.size,
      addedCount,
      updatedCount,
      presetFiles: PRESET_FILE_CACHE.length
    })
    
  } catch (error) {
    console.error('初始化预置文件缓存失败:', error)
  }
}

/**
 * 添加新的预置文件缓存
 * @param fileName 文件名
 * @param fileSize 文件大小
 * @param fileInfo 文件缓存信息
 */
export function addPresetFileCache(fileName: string, fileSize: number, fileInfo: Omit<CachedFileInfo, 'cacheTime' | 'lastUsed'>): void {
  try {
    const STORAGE_KEY = 'wechat_file_cache'
    const cacheKey = `${fileName}_${fileSize}`
    
    // 加载现有缓存
    let cacheMap = new Map<string, CachedFileInfo>()
    const existingCache = localStorage.getItem(STORAGE_KEY)
    
    if (existingCache) {
      try {
        const parsedData = JSON.parse(existingCache)
        cacheMap = new Map(parsedData)
      } catch (error) {
        console.warn('解析现有缓存失败:', error)
      }
    }
    
    // 添加新的文件缓存
    const newFile: CachedFileInfo = {
      ...fileInfo,
      cacheTime: Date.now(),
      lastUsed: Date.now()
    }
    
    cacheMap.set(cacheKey, newFile)
    
    // 保存到localStorage
    const cacheData = Array.from(cacheMap.entries())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData))
    
    console.log('添加预置文件缓存成功:', {
      fileName,
      fileSize,
      cacheKey,
      totalFiles: cacheMap.size
    })
    
  } catch (error) {
    console.error('添加预置文件缓存失败:', error)
  }
}

/**
 * 获取所有预置文件缓存的信息
 */
export function getPresetFileCacheInfo(): Array<{ fileName: string; fileSize: number; attachId: string }> {
  return PRESET_FILE_CACHE.map(([key, fileInfo]) => ({
    fileName: fileInfo.fileName,
    fileSize: fileInfo.fileSize,
    attachId: fileInfo.attachId
  }))
}

/**
 * 检查预置文件缓存是否已初始化
 */
export function isPresetFileCacheInitialized(): boolean {
  try {
    const STORAGE_KEY = 'wechat_file_cache'
    const existingCache = localStorage.getItem(STORAGE_KEY)

    if (!existingCache) {
      return false
    }

    const parsedData = JSON.parse(existingCache)
    const cacheMap = new Map(parsedData)

    // 检查是否包含所有预置文件
    return PRESET_FILE_CACHE.every(([key]) => cacheMap.has(key))
  } catch (error) {
    console.error('检查预置文件缓存状态失败:', error)
    return false
  }
}

/**
 * 调试函数：检查缓存状态
 */
export function debugFileCache(): void {
  try {
    const STORAGE_KEY = 'wechat_file_cache'
    const cacheData = localStorage.getItem(STORAGE_KEY)

    console.log('=== 文件缓存调试信息 ===')
    console.log('存储键:', STORAGE_KEY)
    console.log('localStorage数据存在:', !!cacheData)

    if (cacheData) {
      const parsedData = JSON.parse(cacheData)
      const cacheMap = new Map(parsedData)

      console.log('缓存大小:', cacheMap.size)
      console.log('缓存键列表:', Array.from(cacheMap.keys()))
      console.log('预置文件数量:', PRESET_FILE_CACHE.length)
      console.log('预置文件键列表:', PRESET_FILE_CACHE.map(([key]) => key))

      // 检查每个预置文件是否存在
      PRESET_FILE_CACHE.forEach(([key, fileInfo]) => {
        const exists = cacheMap.has(key)
        console.log(`预置文件 "${fileInfo.fileName}" (${key}):`, exists ? '✓ 已缓存' : '✗ 未缓存')
      })

      console.log('初始化状态:', isPresetFileCacheInitialized())
    } else {
      console.log('localStorage中没有缓存数据')
    }

    console.log('=== 调试信息结束 ===')
  } catch (error) {
    console.error('调试缓存失败:', error)
  }
}

// 将调试函数挂载到全局对象，方便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).debugFileCache = debugFileCache
}
