/**
 * 磨砂玻璃效果工具函数
 * Glassmorphism Utility Functions
 */

// 磨砂玻璃样式配置
export interface GlassmorphismConfig {
  background?: string
  backdropFilter?: string
  border?: string
  borderRadius?: string
  boxShadow?: string
  opacity?: number
}

// 预设的磨砂玻璃样式
export const glassmorphismPresets = {
  // 标准磨砂玻璃
  standard: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  },
  
  // 增强磨砂玻璃
  enhanced: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
  },
  
  // 轻量磨砂玻璃
  light: {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
  },
  
  // 深度磨砂玻璃
  deep: {
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '20px',
    boxShadow: '0 16px 64px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08), inset 0 2px 0 rgba(255, 255, 255, 0.6)',
  },
  
  // 卡片样式
  card: {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: '12px',
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
  },
  
  // 按钮样式
  button: {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  },
  
  // 输入框样式
  input: {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  }
} as const

// 生成磨砂玻璃CSS样式
export function generateGlassmorphismCSS(config: GlassmorphismConfig): string {
  const styles: string[] = []
  
  if (config.background) {
    styles.push(`background: ${config.background}`)
  }
  
  if (config.backdropFilter) {
    styles.push(`backdrop-filter: ${config.backdropFilter}`)
    styles.push(`-webkit-backdrop-filter: ${config.backdropFilter}`)
  }
  
  if (config.border) {
    styles.push(`border: ${config.border}`)
  }
  
  if (config.borderRadius) {
    styles.push(`border-radius: ${config.borderRadius}`)
  }
  
  if (config.boxShadow) {
    styles.push(`box-shadow: ${config.boxShadow}`)
  }
  
  if (config.opacity !== undefined) {
    styles.push(`opacity: ${config.opacity}`)
  }
  
  return styles.join('; ')
}

// 应用磨砂玻璃样式到元素
export function applyGlassmorphism(
  element: HTMLElement, 
  preset: keyof typeof glassmorphismPresets | GlassmorphismConfig
): void {
  const config = typeof preset === 'string' ? glassmorphismPresets[preset] : preset
  const cssText = generateGlassmorphismCSS(config)
  
  // 保存原有样式
  const originalStyle = element.style.cssText
  
  // 应用新样式
  element.style.cssText = originalStyle + '; ' + cssText
  
  // 添加过渡效果
  if (!element.style.transition) {
    element.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
  }
}

// 移除磨砂玻璃样式
export function removeGlassmorphism(element: HTMLElement): void {
  const stylesToRemove = [
    'background',
    'backdrop-filter',
    '-webkit-backdrop-filter',
    'border',
    'border-radius',
    'box-shadow',
    'opacity'
  ]
  
  stylesToRemove.forEach(property => {
    element.style.removeProperty(property)
  })
}

// 创建磨砂玻璃悬浮效果
export function addGlassHoverEffect(element: HTMLElement): void {
  const originalTransform = element.style.transform
  const originalBoxShadow = element.style.boxShadow
  
  element.addEventListener('mouseenter', () => {
    element.style.transform = `${originalTransform} translateY(-2px)`.trim()
    element.style.boxShadow = '0 12px 48px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)'
  })
  
  element.addEventListener('mouseleave', () => {
    element.style.transform = originalTransform
    element.style.boxShadow = originalBoxShadow
  })
}

// 检查浏览器是否支持backdrop-filter
export function supportsBackdropFilter(): boolean {
  return CSS.supports('backdrop-filter', 'blur(1px)') || 
         CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
}

// 获取适合当前浏览器的磨砂玻璃配置
export function getCompatibleGlassConfig(preset: keyof typeof glassmorphismPresets): GlassmorphismConfig {
  const config = { ...glassmorphismPresets[preset] }
  
  // 如果不支持backdrop-filter，使用回退样式
  if (!supportsBackdropFilter()) {
    config.background = 'rgba(255, 255, 255, 0.98)'
    delete config.backdropFilter
  }
  
  return config
}

// Vue 3 组合式函数：使用磨砂玻璃效果
export function useGlassmorphism(preset: keyof typeof glassmorphismPresets = 'standard') {
  const isSupported = supportsBackdropFilter()
  const config = getCompatibleGlassConfig(preset)
  
  return {
    isSupported,
    config,
    cssText: generateGlassmorphismCSS(config),
    apply: (element: HTMLElement) => applyGlassmorphism(element, config),
    remove: (element: HTMLElement) => removeGlassmorphism(element),
    addHoverEffect: (element: HTMLElement) => addGlassHoverEffect(element)
  }
}

// 磨砂玻璃CSS类名生成器
export function generateGlassClassName(preset: keyof typeof glassmorphismPresets): string {
  return `glass-${preset}`
}

// 动态注入磨砂玻璃CSS类
export function injectGlassStyles(): void {
  if (typeof document === 'undefined') return
  
  const styleId = 'glassmorphism-dynamic-styles'
  
  // 避免重复注入
  if (document.getElementById(styleId)) return
  
  const style = document.createElement('style')
  style.id = styleId
  
  let css = ''
  
  // 为每个预设生成CSS类
  Object.entries(glassmorphismPresets).forEach(([name, config]) => {
    const className = generateGlassClassName(name as keyof typeof glassmorphismPresets)
    const cssText = generateGlassmorphismCSS(config)
    
    css += `
      .${className} {
        ${cssText};
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .${className}:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08);
      }
    `
  })
  
  style.textContent = css
  document.head.appendChild(style)
}

// 自动初始化
if (typeof window !== 'undefined') {
  // 页面加载完成后注入样式
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectGlassStyles)
  } else {
    injectGlassStyles()
  }
}
