// 文件缓存管理器
import { ElMessage } from 'element-plus'

export interface CachedFileInfo {
  fileName: string
  fileSize: number
  fileHash?: string  // 文件哈希值，用于匹配
  originalContent: string  // 原始XML内容
  attachId: string
  cdnUrl?: string
  aesKey?: string
  appId?: string
  cacheTime: number  // 缓存时间
  lastUsed: number   // 最后使用时间
}

class FileCacheManager {
  private cache = new Map<string, CachedFileInfo>()
  private readonly CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000 // 7天过期
  private readonly MAX_CACHE_SIZE = 500 // 最大缓存数量
  private readonly STORAGE_KEY = 'wechat_file_cache' // localStorage键名
  private currentWxid: string = '' // 当前微信账号

  // 设置当前微信账号
  setCurrentWxid(wxid: string): void {
    console.log('设置当前微信账号:', { from: this.currentWxid, to: wxid })

    if (this.currentWxid !== wxid) {
      console.log('切换微信账号，重新加载缓存:', { from: this.currentWxid, to: wxid })
      this.currentWxid = wxid
      this.loadCacheFromStorage()
    } else if (this.currentWxid === wxid && this.cache.size === 0) {
      console.log('相同账号但缓存为空，尝试重新加载:', { wxid })
      this.loadCacheFromStorage()
    }
  }

  // 生成文件的缓存键
  private generateCacheKey(fileName: string, fileSize: number): string {
    return `${fileName}_${fileSize}`
  }

  // 生成存储键（包含微信账号）
  private generateStorageKey(): string {
    return `${this.STORAGE_KEY}_${this.currentWxid}`
  }

  // 计算文件哈希值（简单实现）
  private async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // 从localStorage加载缓存
  private loadCacheFromStorage(): void {
    if (!this.currentWxid) {
      console.warn('未设置当前微信账号，无法加载缓存')
      return
    }

    try {
      const storageKey = this.generateStorageKey()
      console.log('尝试从localStorage加载缓存:', { storageKey, wxid: this.currentWxid })

      const cacheData = localStorage.getItem(storageKey)
      console.log('localStorage原始数据:', {
        hasData: !!cacheData,
        dataLength: cacheData?.length || 0,
        dataPreview: cacheData?.substring(0, 100) + '...'
      })

      if (cacheData) {
        const parsedData = JSON.parse(cacheData)
        this.cache = new Map(parsedData)

        console.log('从localStorage加载缓存成功:', {
          wxid: this.currentWxid,
          cacheSize: this.cache.size,
          storageKey,
          cacheKeys: Array.from(this.cache.keys())
        })

        // 加载后清理过期缓存
        this.cleanExpiredCache()
      } else {
        console.log('localStorage中没有找到缓存数据:', { storageKey })
        this.cache.clear()
      }
    } catch (error) {
      console.error('从localStorage加载缓存失败:', error)
      this.cache.clear()
    }
  }

  // 保存缓存到localStorage
  private saveCacheToStorage(): void {
    if (!this.currentWxid) {
      console.warn('未设置当前微信账号，无法保存缓存')
      return
    }

    try {
      const storageKey = this.generateStorageKey()
      const cacheData = Array.from(this.cache.entries())
      localStorage.setItem(storageKey, JSON.stringify(cacheData))

      console.log('缓存已保存到localStorage:', {
        wxid: this.currentWxid,
        cacheSize: this.cache.size,
        storageKey
      })
    } catch (error) {
      console.error('保存缓存到localStorage失败:', error)
    }
  }

  // 添加文件到缓存
  addFileToCache(fileInfo: Omit<CachedFileInfo, 'cacheTime' | 'lastUsed'>): void {
    const cacheKey = this.generateCacheKey(fileInfo.fileName, fileInfo.fileSize)
    const cachedFile: CachedFileInfo = {
      ...fileInfo,
      cacheTime: Date.now(),
      lastUsed: Date.now()
    }

    this.cache.set(cacheKey, cachedFile)

    console.log('文件已添加到缓存:', {
      fileName: fileInfo.fileName,
      fileSize: fileInfo.fileSize,
      cacheKey,
      cacheSize: this.cache.size,
      wxid: this.currentWxid
    })

    // 清理过期缓存并保存到localStorage
    this.cleanExpiredCache()
    this.saveCacheToStorage()
  }

  // 根据文件查找缓存
  async findCachedFile(file: File): Promise<CachedFileInfo | null> {
    const cacheKey = this.generateCacheKey(file.name, file.size)
    const cachedFile = this.cache.get(cacheKey)

    if (!cachedFile) {
      console.log('未找到文件缓存:', { fileName: file.name, fileSize: file.size })
      return null
    }

    // 检查是否过期
    if (Date.now() - cachedFile.cacheTime > this.CACHE_EXPIRE_TIME) {
      console.log('文件缓存已过期:', { fileName: file.name, fileSize: file.size })
      this.cache.delete(cacheKey)
      return null
    }

    // 可选：验证文件哈希值（更精确的匹配）
    if (cachedFile.fileHash) {
      try {
        const fileHash = await this.calculateFileHash(file)
        if (fileHash !== cachedFile.fileHash) {
          console.log('文件哈希值不匹配，可能是不同文件:', {
            fileName: file.name,
            cachedHash: cachedFile.fileHash,
            fileHash
          })
          return null
        }
      } catch (error) {
        console.warn('计算文件哈希值失败:', error)
      }
    }

    // 更新最后使用时间
    cachedFile.lastUsed = Date.now()
    this.cache.set(cacheKey, cachedFile)

    console.log('找到匹配的文件缓存:', {
      fileName: file.name,
      fileSize: file.size,
      attachId: cachedFile.attachId,
      wxid: this.currentWxid
    })

    // 保存更新后的缓存
    this.saveCacheToStorage()

    return cachedFile
  }

  // 清理过期缓存
  private cleanExpiredCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    let deletedOldCount = 0

    for (const [key, fileInfo] of this.cache.entries()) {
      if (now - fileInfo.cacheTime > this.CACHE_EXPIRE_TIME) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key)
    })

    // 如果缓存数量超过限制，删除最久未使用的
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)

      const toDelete = sortedEntries.slice(0, this.cache.size - this.MAX_CACHE_SIZE)
      toDelete.forEach(([key]) => {
        this.cache.delete(key)
      })

      deletedOldCount = toDelete.length
      console.log(`清理了 ${deletedOldCount} 个旧缓存项`)
    }

    if (expiredKeys.length > 0 || deletedOldCount > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期缓存项，${deletedOldCount} 个旧缓存项`)
      // 清理后保存到localStorage
      this.saveCacheToStorage()
    }
  }

  // 获取缓存统计信息
  getCacheStats(): { size: number; files: Array<{ fileName: string; fileSize: number; cacheTime: number }> } {
    return {
      size: this.cache.size,
      files: Array.from(this.cache.values()).map(file => ({
        fileName: file.fileName,
        fileSize: file.fileSize,
        cacheTime: file.cacheTime
      }))
    }
  }

  // 清空所有缓存
  clearCache(): void {
    this.cache.clear()
    console.log('文件缓存已清空')

    // 清空localStorage中的缓存
    if (this.currentWxid) {
      try {
        const storageKey = this.generateStorageKey()
        localStorage.removeItem(storageKey)
        console.log('localStorage中的缓存已清空:', { storageKey })
      } catch (error) {
        console.error('清空localStorage缓存失败:', error)
      }
    }
  }

  // 删除特定文件的缓存
  removeCachedFile(fileName: string, fileSize: number): boolean {
    const cacheKey = this.generateCacheKey(fileName, fileSize)
    const deleted = this.cache.delete(cacheKey)

    if (deleted) {
      console.log('已删除文件缓存:', { fileName, fileSize, wxid: this.currentWxid })
      // 保存更新后的缓存
      this.saveCacheToStorage()
    }

    return deleted
  }
}

// 创建全局实例
export const fileCacheManager = new FileCacheManager()

// 调试工具：检查localStorage中的所有缓存
export function debugLocalStorageCache() {
  console.log('=== localStorage 缓存调试信息 ===')

  const allKeys = Object.keys(localStorage)
  const cacheKeys = allKeys.filter(key => key.startsWith('wechat_file_cache_'))

  console.log('所有localStorage键:', allKeys)
  console.log('文件缓存相关键:', cacheKeys)

  cacheKeys.forEach(key => {
    try {
      const data = localStorage.getItem(key)
      if (data) {
        const parsed = JSON.parse(data)
        console.log(`缓存 ${key}:`, {
          dataLength: data.length,
          entriesCount: parsed.length,
          entries: parsed.map(([cacheKey, fileInfo]: [string, any]) => ({
            cacheKey,
            fileName: fileInfo.fileName,
            fileSize: fileInfo.fileSize,
            cacheTime: new Date(fileInfo.cacheTime).toLocaleString()
          }))
        })
      }
    } catch (error) {
      console.error(`解析缓存 ${key} 失败:`, error)
    }
  })

  console.log('当前fileCacheManager状态:', {
    currentWxid: fileCacheManager['currentWxid'],
    cacheSize: fileCacheManager['cache'].size,
    cacheEntries: Array.from(fileCacheManager['cache'].entries())
  })

  console.log('=== 调试信息结束 ===')
}

// 在全局暴露调试函数
if (typeof window !== 'undefined') {
  (window as any).debugFileCache = debugLocalStorageCache
}

// 格式化文件大小显示
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
