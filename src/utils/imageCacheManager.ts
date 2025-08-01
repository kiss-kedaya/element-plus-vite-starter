/**
 * 图片缓存管理工具
 * 用于管理微信图片的本地缓存
 */

const CACHE_PREFIX = 'wechat_image_cache_'
const CACHE_EXPIRY_DAYS = 7

export interface CacheInfo {
  totalCount: number
  totalSize: number
  expiredCount: number
}

/**
 * 获取缓存信息
 */
export function getCacheInfo(): CacheInfo {
  let totalCount = 0
  let totalSize = 0
  let expiredCount = 0
  const now = Date.now()

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        totalCount++
        const value = localStorage.getItem(key)
        if (value) {
          totalSize += value.length
          try {
            const cacheData = JSON.parse(value)
            if (now - cacheData.timestamp >= CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
              expiredCount++
            }
          } catch (e) {
            expiredCount++
          }
        }
      }
    }
  } catch (error) {
    console.warn('获取缓存信息失败:', error)
  }

  return {
    totalCount,
    totalSize,
    expiredCount
  }
}

/**
 * 清理过期缓存
 */
export function cleanExpiredCache(): number {
  let cleanedCount = 0
  const now = Date.now()
  const keysToRemove: string[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const cacheData = JSON.parse(cached)
            if (now - cacheData.timestamp >= CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
              keysToRemove.push(key)
            }
          }
        } catch (e) {
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      cleanedCount++
    })

    console.log('清理了', cleanedCount, '个过期的图片缓存')
  } catch (error) {
    console.warn('清理过期缓存失败:', error)
  }

  return cleanedCount
}

/**
 * 清理所有图片缓存
 */
export function clearAllImageCache(): number {
  let clearedCount = 0
  const keysToRemove: string[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      clearedCount++
    })

    console.log('清理了', clearedCount, '个图片缓存')
  } catch (error) {
    console.warn('清理所有缓存失败:', error)
  }

  return clearedCount
}

/**
 * 格式化缓存大小
 */
export function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 检查localStorage可用空间
 */
export function checkStorageSpace(): { used: number; available: number; total: number } {
  let used = 0
  let total = 5 * 1024 * 1024 // 假设localStorage总容量为5MB

  try {
    // 计算已使用空间
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value) {
          used += key.length + value.length
        }
      }
    }

    // 尝试写入测试数据来估算可用空间
    const testKey = '__storage_test__'
    const testData = 'x'.repeat(1024) // 1KB测试数据
    let testSize = 0
    
    try {
      while (testSize < 10 * 1024 * 1024) { // 最多测试10MB
        localStorage.setItem(testKey + testSize, testData)
        testSize += 1024
      }
    } catch (e) {
      // 清理测试数据
      for (let i = 0; i < testSize; i += 1024) {
        localStorage.removeItem(testKey + i)
      }
    }

    total = used + testSize
  } catch (error) {
    console.warn('检查存储空间失败:', error)
  }

  return {
    used,
    available: total - used,
    total
  }
}
