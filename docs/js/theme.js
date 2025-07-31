// 主题管理模块 - ThemeManager 类
// 负责主题切换、本地存储和DOM操作

export class ThemeManager {
  constructor() {
    // 主题配置
    this.themes = {
      light: 'light',
      dark: 'dark'
    };

    // DOM 元素
    this.themeToggleBtn = null;
    this.documentElement = document.documentElement;

    // 事件监听器
    this.systemThemeListener = null;

    // 强制应用用户选择的主题，优先级：存储的主题 > 默认亮色主题
    this.currentTheme = this.getStoredTheme() || this.themes.light;

    // 立即应用主题，防止闪烁
    this.applyThemeImmediate(this.currentTheme);

    // 初始化
    this.init();
  }

  /**
   * 初始化主题管理器
   */
  init() {
    // 应用初始主题
    this.applyTheme(this.currentTheme, false);
    
    // 绑定事件监听器
    this.bindEvents();
    
    // 监听系统主题变化
    this.watchSystemTheme();
    
    console.log(`[ThemeManager] 初始化完成，当前主题: ${this.currentTheme}`);
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 等待DOM加载完成后绑定按钮事件
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.bindToggleButton();
      });
    } else {
      this.bindToggleButton();
    }
  }

  /**
   * 绑定主题切换按钮事件
   */
  bindToggleButton() {
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');

    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // 点击事件也使用按钮位置作为动画起点
        this.toggleTheme();
      });

      // 添加键盘支持
      this.themeToggleBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // 键盘事件也使用按钮位置作为动画起点
          this.toggleTheme();
        }
      });

      console.log('[ThemeManager] 主题切换按钮事件绑定完成（圆形扩散动画版本）');
    } else {
      console.warn('[ThemeManager] 未找到主题切换按钮');
    }
  }

  /**
   * 切换主题（圆形扩散动画版本）
   */
  toggleTheme() {
    const newTheme = this.currentTheme === this.themes.light
      ? this.themes.dark
      : this.themes.light;

    // 获取按钮位置作为动画起点
    const buttonPosition = this.getButtonPosition();

    this.setThemeWithCircleAnimation(newTheme, buttonPosition.x, buttonPosition.y);
  }

  /**
   * 设置主题
   * @param {string} theme - 主题名称 ('light' 或 'dark')
   * @param {boolean} animate - 是否显示切换动画
   */
  setTheme(theme, animate = true) {
    if (!this.themes[theme]) {
      console.error(`[ThemeManager] 无效的主题: ${theme}`);
      return;
    }

    const oldTheme = this.currentTheme;
    this.currentTheme = theme;

    // 应用主题
    this.applyTheme(theme, animate);

    // 保存到本地存储
    this.storeTheme(theme);

    // 触发主题变化事件
    this.dispatchThemeChangeEvent(oldTheme, theme);

    console.log(`[ThemeManager] 主题已切换: ${oldTheme} -> ${theme}`);
  }

  /**
   * 获取主题切换按钮的位置
   * @returns {Object} 按钮的中心位置坐标
   */
  getButtonPosition() {
    if (this.themeToggleBtn) {
      const rect = this.themeToggleBtn.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }

    // 如果按钮不存在，使用屏幕中心作为备用
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
  }

  /**
   * 使用圆形扩散动画设置主题
   * @param {string} theme - 主题名称
   * @param {number} buttonX - 按钮X坐标
   * @param {number} buttonY - 按钮Y坐标
   */
  setThemeWithCircleAnimation(theme, buttonX, buttonY) {
    if (!this.themes[theme]) {
      console.error(`[ThemeManager] 无效的主题: ${theme}`);
      return;
    }

    const oldTheme = this.currentTheme;
    this.currentTheme = theme;

    // 开始圆形扩散动画切换
    this.startCircleThemeTransition(theme, buttonX, buttonY, oldTheme);

    console.log(`[ThemeManager] 开始圆形扩散主题切换: ${oldTheme} -> ${theme}`);
  }

  /**
   * 立即应用主题（无动画，防止闪烁）
   * @param {string} theme - 主题名称
   */
  applyThemeImmediate(theme) {
    // 立即设置data-theme属性，无动画
    if (theme === this.themes.dark) {
      this.documentElement.setAttribute('data-theme', 'dark');
    } else {
      this.documentElement.removeAttribute('data-theme');
    }

    console.log(`[ThemeManager] 立即应用主题: ${theme}`);
  }

  /**
   * 开始圆形扩散主题切换动画
   * @param {string} newTheme - 新主题
   * @param {number} buttonX - 按钮X坐标
   * @param {number} buttonY - 按钮Y坐标
   * @param {string} oldTheme - 旧主题
   */
  startCircleThemeTransition(newTheme, buttonX, buttonY, oldTheme) {
    // 检查用户是否偏好减少动画
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // 如果用户偏好减少动画，直接切换主题
      this.applyThemeImmediate(newTheme);
      this.storeTheme(newTheme);
      this.dispatchThemeChangeEvent(oldTheme, newTheme);
      console.log(`[ThemeManager] 快速主题切换（减少动画）: ${oldTheme} -> ${newTheme}`);
      return;
    }

    // 设置CSS变量用于动画定位（使用按钮位置）
    const buttonXPercent = (buttonX / window.innerWidth) * 100;
    const buttonYPercent = (buttonY / window.innerHeight) * 100;

    document.documentElement.style.setProperty('--mouse-x', `${buttonXPercent}%`);
    document.documentElement.style.setProperty('--mouse-y', `${buttonYPercent}%`);

    // 创建主题切换遮罩层
    this.createThemeTransitionMask(newTheme);



    // 在动画进行到50%时切换主题
    setTimeout(() => {
      this.applyThemeImmediate(newTheme);
      this.storeTheme(newTheme);
    }, 500); // 1秒动画的中点

    // 动画完成后清理
    setTimeout(() => {
      this.cleanupCircleAnimation();
      this.dispatchThemeChangeEvent(oldTheme, newTheme);

      console.log(`[ThemeManager] 主题切换完成: ${oldTheme} -> ${newTheme}`);
    }, 1000);
  }

  /**
   * 创建主题切换遮罩层
   * @param {string} newTheme - 新主题
   */
  createThemeTransitionMask(newTheme) {
    // 创建遮罩容器
    const maskContainer = document.createElement('div');
    maskContainer.className = 'theme-transition-mask-container';
    maskContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 1000;
      pointer-events: none;
    `;

    // 创建新主题遮罩层（从鼠标位置扩散）
    const newThemeMask = document.createElement('div');
    newThemeMask.className = 'theme-transition-new-mask';

    // 根据新主题设置遮罩颜色
    const newThemeColors = this.getThemeColors(newTheme);
    newThemeMask.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: ${newThemeColors.background};
      color: ${newThemeColors.text};
      clip-path: circle(0% at var(--mouse-x, 50%) var(--mouse-y, 50%));
      animation: themeTransitionSweep 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    `;

    maskContainer.appendChild(newThemeMask);
    document.body.appendChild(maskContainer);

    // 1秒后移除遮罩
    setTimeout(() => {
      if (maskContainer.parentNode) {
        maskContainer.remove();
      }
    }, 1000);
  }

  /**
   * 获取主题颜色
   * @param {string} theme - 主题名称
   * @returns {Object} 主题颜色对象
   */
  getThemeColors(theme) {
    if (theme === this.themes.dark) {
      return {
        background: '#1f1f1f',
        text: '#ffffff',
        border: '#434343'
      };
    } else {
      return {
        background: '#ffffff',
        text: '#262626',
        border: '#d9d9d9'
      };
    }
  }



  /**
   * 清理主题切换动画相关的类和样式
   */
  cleanupCircleAnimation() {
    // 移除页面过渡类
    document.body.classList.remove('page-theme-transitioning');

    // 清理CSS变量
    document.documentElement.style.removeProperty('--mouse-x');
    document.documentElement.style.removeProperty('--mouse-y');

    // 移除任何残留的遮罩容器
    const maskContainers = document.querySelectorAll('.theme-transition-mask-container');
    maskContainers.forEach(container => container.remove());
  }

  /**
   * 应用主题到DOM
   * @param {string} theme - 主题名称
   * @param {boolean} animate - 是否显示切换动画
   */
  applyTheme(theme, animate = true) {
    // 添加页面过渡动画
    if (animate) {
      document.body.classList.add('theme-transitioning');
      setTimeout(() => {
        document.body.classList.remove('theme-transitioning');
      }, 300);
    }



    // 设置data-theme属性
    if (theme === this.themes.dark) {
      this.documentElement.setAttribute('data-theme', 'dark');
    } else {
      this.documentElement.removeAttribute('data-theme');
    }

    // 更新按钮的aria-label
    this.updateButtonLabel(theme);
  }

  /**
   * 更新按钮的无障碍标签
   * @param {string} theme - 当前主题
   */
  updateButtonLabel(theme) {
    if (this.themeToggleBtn) {
      const label = theme === this.themes.dark
        ? '切换到明亮主题'
        : '切换到暗黑主题';

      this.themeToggleBtn.setAttribute('aria-label', label);
      this.themeToggleBtn.setAttribute('title', label);
    }
  }



  /**
   * 获取存储的主题
   * @returns {string|null} 存储的主题名称
   */
  getStoredTheme() {
    try {
      return localStorage.getItem('theme');
    } catch (error) {
      console.warn('[ThemeManager] 无法访问localStorage:', error);
      return null;
    }
  }

  /**
   * 存储主题到本地存储
   * @param {string} theme - 主题名称
   */
  storeTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.warn('[ThemeManager] 无法保存主题到localStorage:', error);
    }
  }

  /**
   * 获取系统主题偏好
   * @returns {string} 系统主题 ('light' 或 'dark')
   */
  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return this.themes.dark;
    }
    return this.themes.light;
  }

  /**
   * 监听系统主题变化（已禁用自动跟随）
   */
  watchSystemTheme() {
    // 注释掉系统主题自动跟随功能，确保用户选择的主题优先
    // 用户可以通过主题切换按钮手动选择主题
    console.log('[ThemeManager] 系统主题自动跟随已禁用，用户主题选择优先');

    /*
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      this.systemThemeListener = (e) => {
        // 只有在用户没有手动设置主题时才跟随系统主题
        if (!this.getStoredTheme()) {
          const systemTheme = e.matches ? this.themes.dark : this.themes.light;
          this.setTheme(systemTheme, true);
        }
      };

      mediaQuery.addEventListener('change', this.systemThemeListener);
    }
    */
  }

  /**
   * 触发主题变化事件
   * @param {string} oldTheme - 旧主题
   * @param {string} newTheme - 新主题
   */
  dispatchThemeChangeEvent(oldTheme, newTheme) {
    const event = new CustomEvent('themechange', {
      detail: {
        oldTheme,
        newTheme,
        timestamp: Date.now()
      }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * 获取当前主题
   * @returns {string} 当前主题名称
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * 检查是否为暗色主题
   * @returns {boolean} 是否为暗色主题
   */
  isDarkTheme() {
    return this.currentTheme === this.themes.dark;
  }

  /**
   * 获取主题统计信息
   * @returns {Object} 主题统计信息
   */
  getThemeStats() {
    return {
      currentTheme: this.currentTheme,
      hasStoredTheme: !!this.getStoredTheme(),
      systemTheme: this.getSystemTheme(),
      supportsSystemTheme: !!(window.matchMedia),
      buttonFound: !!this.themeToggleBtn,
      timestamp: Date.now()
    };
  }

  /**
   * 重置主题设置
   */
  resetTheme() {
    try {
      localStorage.removeItem('theme');
      // 重置为亮色主题，而不是系统主题
      this.setTheme(this.themes.light, true);
      console.log('[ThemeManager] 主题设置已重置为亮色主题');
    } catch (error) {
      console.error('[ThemeManager] 重置主题失败:', error);
    }
  }

  /**
   * 销毁主题管理器
   */
  destroy() {
    // 移除事件监听器
    if (this.themeToggleBtn) {
      this.themeToggleBtn.removeEventListener('click', this.toggleTheme);
    }

    if (this.systemThemeListener && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.removeEventListener('change', this.systemThemeListener);
    }

    console.log('[ThemeManager] 已销毁');
  }
}

// 创建全局主题管理器实例
export const themeManager = new ThemeManager();

// 将主题管理器添加到全局对象，便于调试
if (typeof window !== 'undefined') {
  window.themeManager = themeManager;
}
