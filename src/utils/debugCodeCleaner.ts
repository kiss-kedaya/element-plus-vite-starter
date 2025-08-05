/**
 * 调试代码清理工具
 * 批量清理项目中的console.log等调试代码
 */

import { log } from './logger'

// 调试代码模式
const DEBUG_PATTERNS = [
  // console相关
  /console\.(log|debug|info|warn|error)\s*\([^)]*\)\s*;?/g,
  // 单行注释的console
  /\/\/\s*console\.(log|debug|info|warn|error)\s*\([^)]*\)\s*;?/g,
  // 多行注释的console
  /\/\*[\s\S]*?console\.(log|debug|info|warn|error)[\s\S]*?\*\//g,
  // debugger语句
  /debugger\s*;?/g,
  // alert语句
  /alert\s*\([^)]*\)\s*;?/g,
]

// 需要保留的调试代码模式（生产环境需要的错误日志等）
const PRESERVE_PATTERNS = [
  // 错误处理中的console.error
  /catch\s*\([^)]*\)\s*\{[\s\S]*?console\.error[\s\S]*?\}/g,
  // 明确标记为生产环境的日志
  /\/\*\s*PRODUCTION\s*\*\/[\s\S]*?console\./g,
]

// 文件扩展名白名单
const ALLOWED_EXTENSIONS = ['.ts', '.js', '.vue']

// 需要跳过的目录
const SKIP_DIRECTORIES = ['node_modules', 'dist', 'build', '.git']

interface CleanupResult {
  file: string
  originalLines: number
  cleanedLines: number
  removedCount: number
  patterns: string[]
}

interface CleanupSummary {
  totalFiles: number
  processedFiles: number
  totalRemovedLines: number
  totalRemovedStatements: number
  results: CleanupResult[]
  errors: Array<{ file: string; error: string }>
}

/**
 * 调试代码清理器
 */
export class DebugCodeCleaner {
  private results: CleanupResult[] = []
  private errors: Array<{ file: string; error: string }> = []

  /**
   * 清理单个文件中的调试代码
   */
  cleanFile(filePath: string, content: string): { cleaned: string; result: CleanupResult } {
    log.debug('开始清理文件', { filePath }, 'DebugCodeCleaner')

    const originalLines = content.split('\n').length
    let cleanedContent = content
    let removedCount = 0
    const foundPatterns: string[] = []

    // 首先检查是否有需要保留的模式
    const preserveMatches: string[] = []
    PRESERVE_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        preserveMatches.push(...matches)
      }
    })

    // 应用清理模式
    DEBUG_PATTERNS.forEach((pattern, index) => {
      const matches = cleanedContent.match(pattern)
      if (matches) {
        matches.forEach(match => {
          // 检查是否在保留列表中
          const shouldPreserve = preserveMatches.some(preserve =>
            preserve.includes(match.trim())
          )

          if (!shouldPreserve) {
            cleanedContent = cleanedContent.replace(match, '')
            removedCount++
            foundPatterns.push(`Pattern ${index + 1}: ${pattern.source}`)
          }
        })
      }
    })

    // 清理多余的空行
    cleanedContent = this.cleanupEmptyLines(cleanedContent)

    const cleanedLines = cleanedContent.split('\n').length
    const result: CleanupResult = {
      file: filePath,
      originalLines,
      cleanedLines,
      removedCount,
      patterns: [...new Set(foundPatterns)]
    }

    this.results.push(result)

    log.debug('文件清理完成', {
      filePath,
      originalLines,
      cleanedLines,
      removedCount
    }, 'DebugCodeCleaner')

    return { cleaned: cleanedContent, result }
  }

  /**
   * 清理多余的空行
   */
  private cleanupEmptyLines(content: string): string {
    // 将连续的空行替换为单个空行
    return content
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/^\s*\n/, '') // 移除开头的空行
      .replace(/\n\s*$/, '\n') // 确保文件以单个换行符结尾
  }

  /**
   * 检查文件是否应该被处理
   */
  shouldProcessFile(filePath: string): boolean {
    // 检查文件扩展名
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
      filePath.toLowerCase().endsWith(ext)
    )

    if (!hasValidExtension) return false

    // 检查是否在跳过的目录中
    const isInSkipDirectory = SKIP_DIRECTORIES.some(dir =>
      filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`)
    )

    return !isInSkipDirectory
  }

  /**
   * 生成清理报告
   */
  generateReport(): CleanupSummary {
    const totalFiles = this.results.length
    const processedFiles = this.results.filter(r => r.removedCount > 0).length
    const totalRemovedLines = this.results.reduce((sum, r) =>
      sum + (r.originalLines - r.cleanedLines), 0
    )
    const totalRemovedStatements = this.results.reduce((sum, r) =>
      sum + r.removedCount, 0
    )

    return {
      totalFiles,
      processedFiles,
      totalRemovedLines,
      totalRemovedStatements,
      results: this.results,
      errors: this.errors
    }
  }

  /**
   * 重置清理器状态
   */
  reset(): void {
    this.results = []
    this.errors = []
  }

  /**
   * 添加错误记录
   */
  addError(file: string, error: string): void {
    this.errors.push({ file, error })
    log.error('文件处理错误', { file, error }, 'DebugCodeCleaner')
  }

  /**
   * 预览清理效果（不实际修改文件）
   */
  previewCleanup(content: string): {
    preview: string
    removedLines: string[]
    statistics: {
      originalLines: number
      cleanedLines: number
      removedCount: number
    }
  } {
    const originalLines = content.split('\n')
    const { cleaned } = this.cleanFile('preview', content)
    const cleanedLines = cleaned.split('\n')

    // 找出被移除的行
    const removedLines: string[] = []
    let cleanedIndex = 0

    originalLines.forEach(originalLine => {
      if (cleanedIndex < cleanedLines.length &&
          originalLine.trim() === cleanedLines[cleanedIndex].trim()) {
        cleanedIndex++
      } else {
        // 检查是否是调试代码
        const isDebugCode = DEBUG_PATTERNS.some(pattern =>
          pattern.test(originalLine)
        )
        if (isDebugCode) {
          removedLines.push(originalLine.trim())
        }
      }
    })

    return {
      preview: cleaned,
      removedLines,
      statistics: {
        originalLines: originalLines.length,
        cleanedLines: cleanedLines.length,
        removedCount: removedLines.length
      }
    }
  }
}

/**
 * 便捷的清理函数
 */
export function cleanDebugCode(content: string): string {
  const cleaner = new DebugCodeCleaner()
  const { cleaned } = cleaner.cleanFile('inline', content)
  return cleaned
}

/**
 * 生成清理脚本
 */
export function generateCleanupScript(): string {
  return `
#!/bin/bash
# 自动生成的调试代码清理脚本

echo "开始清理调试代码..."

# 查找所有TypeScript和Vue文件
find src -name "*.ts" -o -name "*.js" -o -name "*.vue" | while read file; do
  echo "处理文件: $file"

  # 备份原文件
  cp "$file" "$file.backup"

  # 使用sed清理console.log
  sed -i '/console\\.log/d' "$file"
  sed -i '/console\\.debug/d' "$file"
  sed -i '/debugger/d' "$file"

  echo "已处理: $file"
done

echo "调试代码清理完成！"
echo "原文件已备份为 .backup 文件"
`
}

// 创建全局实例
export const debugCodeCleaner = new DebugCodeCleaner()