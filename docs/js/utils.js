// 工具函数模块 - 负责通用工具函数、配置管理和UI辅助功能
export class Utils {
  constructor(app) {
    this.app = app;
  }

  showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // 配置相关方法
  showConfigModal() {
    document.getElementById('config-modal').classList.add('show');
  }

  hideConfigModal() {
    document.getElementById('config-modal').classList.remove('show');
  }

  loadConfig() {
    const saved = localStorage.getItem('api-docs-config');
    if (saved) {
      const savedConfig = JSON.parse(saved);
      // 如果保存的baseUrl是相对路径，转换为完整URL
      if (savedConfig.baseUrl && !savedConfig.baseUrl.startsWith('http')) {
        savedConfig.baseUrl = `${window.location.protocol}//${window.location.host}${savedConfig.baseUrl}`;
      }
      this.app.config = { ...this.app.config, ...savedConfig };
    }

    // 确保baseUrl始终是完整URL
    if (!this.app.config.baseUrl.startsWith('http')) {
      this.app.config.baseUrl = `${window.location.protocol}//${window.location.host}${this.app.config.baseUrl}`;
    }

    document.getElementById('default-wxid').value = this.app.config.defaultWxid;
    document.getElementById('base-url').value = this.app.config.baseUrl;
    document.getElementById('timeout').value = this.app.config.timeout;

    // 加载调试模式设置
    const debugMode = localStorage.getItem('wechat_debug_mode') === 'true';
    const debugToggle = document.getElementById('debug-mode-toggle');
    if (debugToggle) {
      debugToggle.checked = debugMode;
    }

    // 更新账号管理器的调试模式
    if (this.app.accountManager) {
      this.app.accountManager.debugMode = debugMode;
    }
  }

  saveConfig() {
    this.app.config.defaultWxid = document.getElementById('default-wxid').value.trim();
    this.app.config.baseUrl = document.getElementById('base-url').value.trim();
    this.app.config.timeout = parseInt(document.getElementById('timeout').value);

    // 保存调试模式设置
    const debugToggle = document.getElementById('debug-mode-toggle');
    if (debugToggle) {
      const debugMode = debugToggle.checked;
      localStorage.setItem('wechat_debug_mode', debugMode.toString());

      // 立即更新账号管理器的调试模式
      if (this.app.accountManager) {
        this.app.accountManager.debugMode = debugMode;
        console.log(`调试模式已${debugMode ? '开启' : '关闭'}`);
      }
    }

    localStorage.setItem('api-docs-config', JSON.stringify(this.app.config));
    this.hideConfigModal();
    this.showToast('配置已保存', 'success');
  }

  // 配置数据加载已迁移到 ConfigManager

  // ==================== 动画和过渡效果 ====================

  // 淡入淡出过渡效果
  fadeOut(element, callback) {
    element.classList.add('fade-out');
    setTimeout(() => {
      if (callback) callback();
      element.classList.remove('fade-out');
    }, 300);
  }

  fadeIn(element) {
    element.classList.add('fade-in');
    setTimeout(() => {
      element.classList.remove('fade-in');
    }, 300);
  }

  // 平滑替换内容
  smoothReplaceContent(container, newContent, delay = 300) {
    this.fadeOut(container, () => {
      container.innerHTML = newContent;
      this.fadeIn(container);
    });
  }

  // 显示加载旋转器
  showLoadingSpinner(container, text = '加载中...') {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">${text}</div>
      </div>
    `;
  }

  // ==================== 分类图标映射 ====================

  getCategoryIcon(category) {
    const iconMap = {
      'Login': 'fa-sign-in-alt',
      'Friend': 'fa-users',
      'Group': 'fa-users-cog',
      'Msg': 'fa-comments',
      'User': 'fa-user-cog',
      'Contact': 'fa-address-book',
      'FriendCircle': 'fa-globe',
      'Wxapp': 'fa-th-large',
      'OfficialAccounts': 'fa-newspaper',
      'QWContact': 'fa-building',
      'SayHello': 'fa-hand-wave',
      '未分类': 'fa-question-circle'
    };
    return iconMap[category] || 'fa-cog';
  }

  // 字符串工具函数
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // 时间格式化
  formatTime(timestamp) {
    if (!timestamp) return '未知';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return '格式错误';
    }
  }

  // URL验证
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // 深拷贝对象
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 节流函数
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // 生成随机ID
  generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 文件大小格式化
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 数字格式化（添加千分位分隔符）
  formatNumber(num) {
    if (typeof num !== 'number') return num;
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // 获取查询参数
  getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // 设置查询参数
  setQueryParam(name, value) {
    const url = new URL(window.location);
    url.searchParams.set(name, value);
    window.history.pushState({}, '', url);
  }

  // 移除查询参数
  removeQueryParam(name) {
    const url = new URL(window.location);
    url.searchParams.delete(name);
    window.history.pushState({}, '', url);
  }

  // 复制到剪贴板
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('已复制到剪贴板', 'success');
      return true;
    } catch (error) {
      console.error('复制失败:', error);
      this.showToast('复制失败', 'error');
      return false;
    }
  }

  // 下载文件
  downloadFile(content, filename, contentType = 'text/plain') {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // 检查是否为移动设备
  isMobile() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // 获取设备信息
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenWidth: screen.width,
      screenHeight: screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    };
  }

  // 本地存储封装
  storage = {
    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('存储失败:', error);
        return false;
      }
    },
    
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.error('读取存储失败:', error);
        return defaultValue;
      }
    },
    
    remove: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('删除存储失败:', error);
        return false;
      }
    },
    
    clear: () => {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.error('清空存储失败:', error);
        return false;
      }
    }
  };
}
