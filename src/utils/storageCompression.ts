/**
 * localStorage数据压缩和分页存储工具
 * 解决大数据量存储问题和容量限制
 */

// 数据压缩接口
interface CompressedData {
  compressed: boolean
  data: string
  originalSize: number
  compressedSize: number
  timestamp: number
}

// 分页存储配置
const STORAGE_CONFIG = {
  MAX_CHUNK_SIZE: 1024 * 1024, // 1MB per chunk
  MAX_TOTAL_SIZE: 4 * 1024 * 1024, // 4MB total limit per account
  COMPRESSION_THRESHOLD: 50 * 1024, // 50KB threshold for compression
  MAX_CHUNKS_PER_ACCOUNT: 10, // 最多10个分片
}

/**
 * 简单的字符串压缩算法（LZ77变体）
 * 适用于JSON数据的重复模式压缩
 */
class SimpleCompressor {
  /**
   * 压缩字符串数据
   */
  static compress(data: string): string {
    if (data.length < STORAGE_CONFIG.COMPRESSION_THRESHOLD) {
      return data // 小数据不压缩
    }

    try {
      // 使用简单的重复字符串替换压缩
      const patterns = this.findCommonPatterns(data)
      let compressed = data
      
      // 替换常见模式
      patterns.forEach((pattern, index) => {
        const placeholder = `__PATTERN_${index}__`
        compressed = compressed.split(pattern).join(placeholder)
      })

      // 如果压缩效果不明显，返回原数据
      if (compressed.length >= data.length * 0.9) {
        return data
      }

      // 存储模式映射
      const compressionMap = {
        patterns: patterns,
        data: compressed
      }

      return JSON.stringify(compressionMap)
    } catch (error) {
      console.warn('数据压缩失败，使用原始数据:', error)
      return data
    }
  }

  /**
   * 解压缩字符串数据
   */
  static decompress(compressedData: string): string {
    try {
      // 尝试解析为压缩格式
      const compressionMap = JSON.parse(compressedData)
      
      if (compressionMap.patterns && compressionMap.data) {
        let decompressed = compressionMap.data
        
        // 恢复原始模式
        compressionMap.patterns.forEach((pattern: string, index: number) => {
          const placeholder = `__PATTERN_${index}__`
          decompressed = decompressed.split(placeholder).join(pattern)
        })
        
        return decompressed
      }
      
      // 如果不是压缩格式，返回原数据
      return compressedData
    } catch (error) {
      // 解析失败，可能是未压缩的数据
      return compressedData
    }
  }

  /**
   * 查找常见的重复模式
   */
  private static findCommonPatterns(data: string): string[] {
    const patterns: Map<string, number> = new Map()
    const minPatternLength = 10
    const maxPatternLength = 100
    
    // 查找重复的子字符串
    for (let len = minPatternLength; len <= maxPatternLength; len++) {
      for (let i = 0; i <= data.length - len; i++) {
        const pattern = data.substring(i, i + len)
        
        // 跳过包含特殊字符的模式
        if (pattern.includes('__PATTERN_')) continue
        
        const count = (data.match(new RegExp(this.escapeRegExp(pattern), 'g')) || []).length
        
        if (count >= 3) { // 至少出现3次才考虑压缩
          patterns.set(pattern, count * len) // 权重 = 出现次数 * 长度
        }
      }
    }
    
    // 按权重排序，选择前10个模式
    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern]) => pattern)
  }

  /**
   * 转义正则表达式特殊字符
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

/**
 * 分页存储管理器
 */
export class ChunkedStorage {
  /**
   * 分页保存数据到localStorage
   */
  static saveChunked(key: string, data: any): boolean {
    try {
      const serializedData = JSON.stringify(data)
      const originalSize = serializedData.length
      
      console.log(`开始分页存储: ${key}, 原始大小: ${Math.round(originalSize / 1024)}KB`)

      // 检查是否需要压缩
      let processedData = serializedData
      let compressed = false
      
      if (originalSize > STORAGE_CONFIG.COMPRESSION_THRESHOLD) {
        const compressedData = SimpleCompressor.compress(serializedData)
        if (compressedData.length < originalSize * 0.8) {
          processedData = compressedData
          compressed = true
          console.log(`数据压缩完成: ${Math.round(originalSize / 1024)}KB -> ${Math.round(compressedData.length / 1024)}KB`)
        }
      }

      // 检查总大小限制
      if (processedData.length > STORAGE_CONFIG.MAX_TOTAL_SIZE) {
        console.warn(`数据过大，无法存储: ${Math.round(processedData.length / 1024 / 1024)}MB`)
        return false
      }

      // 分页存储
      const chunks = this.splitIntoChunks(processedData)
      const metadata = {
        totalChunks: chunks.length,
        originalSize,
        compressed,
        timestamp: Date.now(),
        version: '1.0'
      }

      // 先清理旧的分片
      this.clearChunks(key)

      // 保存元数据
      localStorage.setItem(`${key}_meta`, JSON.stringify(metadata))

      // 保存各个分片
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${key}_chunk_${i}`
        localStorage.setItem(chunkKey, chunks[i])
      }

      console.log(`分页存储完成: ${chunks.length} 个分片`)
      return true

    } catch (error) {
      console.error(`分页存储失败:`, error)
      return false
    }
  }

  /**
   * 从localStorage加载分页数据
   */
  static loadChunked(key: string): any | null {
    try {
      // 加载元数据
      const metadataStr = localStorage.getItem(`${key}_meta`)
      if (!metadataStr) {
        return null
      }

      const metadata = JSON.parse(metadataStr)
      console.log(`开始加载分页数据: ${key}, ${metadata.totalChunks} 个分片`)

      // 加载所有分片
      const chunks: string[] = []
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `${key}_chunk_${i}`
        const chunk = localStorage.getItem(chunkKey)
        
        if (chunk === null) {
          console.error(`分片 ${i} 丢失: ${chunkKey}`)
          return null
        }
        
        chunks.push(chunk)
      }

      // 重组数据
      let reconstructedData = chunks.join('')

      // 解压缩（如果需要）
      if (metadata.compressed) {
        reconstructedData = SimpleCompressor.decompress(reconstructedData)
        console.log(`数据解压缩完成`)
      }

      // 解析JSON
      const data = JSON.parse(reconstructedData)
      console.log(`分页数据加载完成: ${Math.round(reconstructedData.length / 1024)}KB`)
      
      return data

    } catch (error) {
      console.error(`分页数据加载失败:`, error)
      return null
    }
  }

  /**
   * 删除分页数据
   */
  static removeChunked(key: string): void {
    try {
      // 获取元数据
      const metadataStr = localStorage.getItem(`${key}_meta`)
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr)
        
        // 删除所有分片
        for (let i = 0; i < metadata.totalChunks; i++) {
          localStorage.removeItem(`${key}_chunk_${i}`)
        }
      }

      // 删除元数据
      localStorage.removeItem(`${key}_meta`)
      
      console.log(`已删除分页数据: ${key}`)
    } catch (error) {
      console.error(`删除分页数据失败:`, error)
    }
  }

  /**
   * 将数据分割成块
   */
  private static splitIntoChunks(data: string): string[] {
    const chunks: string[] = []
    const chunkSize = STORAGE_CONFIG.MAX_CHUNK_SIZE
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.substring(i, i + chunkSize))
    }
    
    return chunks
  }

  /**
   * 清理旧的分片数据
   */
  private static clearChunks(key: string): void {
    try {
      // 获取现有元数据
      const metadataStr = localStorage.getItem(`${key}_meta`)
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr)
        
        // 删除旧分片
        for (let i = 0; i < metadata.totalChunks; i++) {
          localStorage.removeItem(`${key}_chunk_${i}`)
        }
      }
    } catch (error) {
      console.warn('清理旧分片时出错:', error)
    }
  }

  /**
   * 获取存储使用情况统计
   */
  static getStorageStats(): { used: number; available: number; total: number } {
    let used = 0
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value) {
          used += key.length + value.length
        }
      }
    }
    
    // localStorage通常限制为5-10MB，这里假设5MB
    const total = 5 * 1024 * 1024
    const available = total - used
    
    return { used, available, total }
  }
}
