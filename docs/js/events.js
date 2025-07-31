// 事件处理模块 - 负责所有事件监听器和用户交互处理
export class EventHandler {
  constructor(app) {
    this.app = app;
  }

  setupEventListeners() {
    this.setupNavigationEvents();
    this.setupConfigEvents();
    this.setupSearchEvents();
    this.setupFilterEvents();
    this.setupViewEvents();
    this.setupModalEvents();
    this.setupSidebarEvents();
    this.setupKeyboardEvents();
    this.setupAccountEvents();
    this.setupSystemEvents();
    this.setupWindowEvents();
  }

  setupNavigationEvents() {
    // 导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.getAttribute('href').substring(1);
        this.app.switchSection(target);
      });
    });

    // 移动端导航切换
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.getAttribute('data-section');
        this.app.switchSection(target);
        // 移动端点击导航后关闭侧边栏
        this.closeSidebar();
      });
    });
  }

  setupConfigEvents() {
    // 配置面板
    document.getElementById('config-btn').addEventListener('click', () => {
      this.app.showConfigModal();
    });

    document.getElementById('close-config').addEventListener('click', () => {
      this.app.hideConfigModal();
    });

    document.getElementById('save-config').addEventListener('click', () => {
      this.app.saveConfig();
    });
  }

  setupSearchEvents() {
    // 搜索功能
    document.getElementById('global-search').addEventListener('input', (e) => {
      this.app.searchAPIs(e.target.value);
    });
  }

  setupFilterEvents() {
    // 过滤器
    document.getElementById('method-filter').addEventListener('change', () => {
      this.app.filterAPIs();
    });

    document.getElementById('category-filter').addEventListener('change', () => {
      this.app.filterAPIs();
    });
  }

  setupViewEvents() {
    // 视图切换
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.closest('.view-btn').dataset.view;
        this.app.switchView(view);
      });
    });
  }

  setupModalEvents() {
    // 模态框关闭
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('config-modal')) {
        this.app.hideConfigModal();
      }
      if (e.target.classList.contains('api-modal')) {
        // 根据具体的模态框ID来决定关闭哪个模态框
        const modalId = e.target.id;
        if (modalId === 'add-account-modal') {
          this.app.accountManager.closeAddAccountModal();
        } else if (modalId === 'account-detail-modal') {
          this.app.accountManager.closeAccountDetailModal();
        } else {
          // 默认的API测试模态框
          this.app.apiTester.hideAPIModal();
        }
      }
      // 退出登录确认模态框背景点击关闭
      if (e.target.classList.contains('modal-overlay') && e.target.id === 'logout-modal') {
        console.log('Logout modal overlay clicked, closing modal');
        this.app.accountManager.closeLogoutModal();
      }
    });

    // API模态框关闭按钮
    const closeApiModalBtn = document.getElementById('close-api-modal');
    if (closeApiModalBtn) {
      closeApiModalBtn.addEventListener('click', () => {
        this.app.apiTester.hideAPIModal();
      });
    }

    // 账号详情模态框关闭按钮
    const closeAccountDetailBtn = document.getElementById('close-account-detail-modal');
    if (closeAccountDetailBtn) {
      closeAccountDetailBtn.addEventListener('click', () => {
        this.app.accountManager.closeAccountDetailModal();
      });
    }
  }

  setupSidebarEvents() {
    // 侧边栏折叠功能
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      this.toggleSidebar();
    });

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        this.closeSidebar();
      });
    }
  }

  setupKeyboardEvents() {
    // ESC键关闭模态框和侧边栏
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // 检查当前打开的模态框并只关闭对应的模态框
        const addAccountModal = document.getElementById('add-account-modal');
        const accountDetailModal = document.getElementById('account-detail-modal');
        const apiModal = document.getElementById('api-modal');
        const configModal = document.getElementById('config-modal');

        if (addAccountModal && addAccountModal.style.display === 'flex') {
          this.app.accountManager.closeAddAccountModal();
        } else if (accountDetailModal && accountDetailModal.style.display === 'flex') {
          this.app.accountManager.closeAccountDetailModal();
        } else if (apiModal && apiModal.style.display === 'flex') {
          this.app.apiTester.hideAPIModal();
        } else if (configModal && configModal.style.display === 'flex') {
          this.app.hideConfigModal();
        } else {
          this.closeSidebar();
        }
      }
    });
  }

  setupAccountEvents() {
    // 概览页面账号刷新
    const refreshAccountsBtn = document.getElementById('refresh-accounts-overview');
    if (refreshAccountsBtn) {
      refreshAccountsBtn.addEventListener('click', (e) => {
        // 添加现代化点击视觉反馈
        this.addModernButtonClickFeedback(e.target);
        this.app.refreshAccounts();
      });
    }

    // 添加账号按钮
    const addAccountBtn = document.getElementById('add-account-btn');
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', () => {
        this.app.showAddAccountModal();
      });
    }

    // 添加账号模态框关闭按钮
    const closeAddAccountModalBtn = document.getElementById('close-add-account-modal');
    if (closeAddAccountModalBtn) {
      closeAddAccountModalBtn.addEventListener('click', () => {
        this.app.closeAddAccountModal();
      });
    }

    // 登录方式切换标签
    document.querySelectorAll('.method-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const method = tab.getAttribute('data-method');
        this.app.switchLoginMethod(method);
      });
    });

    // 使用事件委托处理二维码操作
    document.addEventListener('click', (e) => {
      // 检查是否点击了获取二维码的元素（包括骨架屏和其子元素）
      const getQRBtn = e.target.closest('#get-qrcode-btn');
      if (getQRBtn && !getQRBtn.hasAttribute('disabled')) {
        e.preventDefault();
        this.app.getQRCode();
      } else if (e.target.id === 'refresh-qrcode-btn') {
        e.preventDefault();
        this.app.refreshQRCode();
      }
    });

    // 密码登录表单提交
    const passwordLoginForm = document.getElementById('password-login-form');
    if (passwordLoginForm) {
      passwordLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.app.passwordLogin();
      });
    }

    // 退出登录确认按钮
    const confirmLogoutBtn = document.getElementById('confirm-logout-btn');
    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener('click', () => {
        this.app.accountManager.executeLogout();
      });
    }

    // 退出登录模态框关闭按钮
    const logoutModalCloseBtn = document.getElementById('logout-modal-close-btn');
    if (logoutModalCloseBtn) {
      logoutModalCloseBtn.addEventListener('click', () => {
        this.app.accountManager.closeLogoutModal();
      });
    }

    // 退出登录取消按钮
    const cancelLogoutBtn = document.getElementById('cancel-logout-btn');
    if (cancelLogoutBtn) {
      cancelLogoutBtn.addEventListener('click', () => {
        this.app.accountManager.closeLogoutModal();
      });
    }

    // 使用事件委托处理动态生成的删除按钮
    document.addEventListener('click', (e) => {
      // 处理删除账号按钮
      if (e.target.closest('.delete-btn')) {
        e.stopPropagation();
        const deleteBtn = e.target.closest('.delete-btn');

        // 从data属性获取账号信息
        const wxid = deleteBtn.dataset.wxid;
        const nickname = deleteBtn.dataset.nickname;

        if (wxid && nickname) {
          // 确保apiApp已经初始化
          if (window.apiApp && window.apiApp.confirmDeleteAccount) {
            window.apiApp.confirmDeleteAccount(wxid, nickname);
          } else {
            console.error('apiApp not initialized or confirmDeleteAccount method not found');
            // 延迟重试
            setTimeout(() => {
              if (window.apiApp && window.apiApp.confirmDeleteAccount) {
                window.apiApp.confirmDeleteAccount(wxid, nickname);
              } else {
                console.error('apiApp still not available after retry');
              }
            }, 100);
          }
        } else {
          console.error('Missing wxid or nickname data attributes');
        }
      }

      // 处理账号详情点击
      if (e.target.closest('[data-action="show-detail"]')) {
        const detailElement = e.target.closest('[data-action="show-detail"]');
        const wxid = detailElement.dataset.wxid;

        if (wxid && window.apiApp && window.apiApp.showAccountDetail) {
          window.apiApp.showAccountDetail(wxid);
        }
      }
    });
  }

  setupSystemEvents() {
    // 系统信息刷新
    const refreshSystemInfoBtn = document.getElementById('refresh-system-info');
    if (refreshSystemInfoBtn) {
      refreshSystemInfoBtn.addEventListener('click', () => {
        this.app.refreshSystemInfo();
      });
    }
  }

  setupWindowEvents() {
    // 窗口大小变化时调整侧边栏和模态框
    window.addEventListener('resize', () => {
      this.handleResize();

      // 如果添加账号模态框是打开的，调整其大小
      const addAccountModal = document.getElementById('add-account-modal');
      if (addAccountModal && addAccountModal.style.display === 'flex') {
        this.app.accountManager.adjustModalSize();
      }
    });
  }

  // 侧边栏控制方法
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const toggleIcon = toggleBtn.querySelector('i');

    this.app.sidebarCollapsed = !this.app.sidebarCollapsed;

    if (window.innerWidth <= 768) {
      // 移动端：显示/隐藏侧边栏
      if (this.app.sidebarCollapsed) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      } else {
        sidebar.classList.add('open');
        overlay.classList.add('show');
      }
    } else {
      // 桌面端：折叠/展开侧边栏
      if (this.app.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        toggleIcon.className = 'fas fa-chevron-right';
      } else {
        sidebar.classList.remove('collapsed');
        toggleIcon.className = 'fas fa-chevron-left';
      }
    }

    // 调整内容区域
    this.app.uiRenderer.adjustContentArea();
  }

  closeSidebar() {
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');

      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      this.app.sidebarCollapsed = true;
    }
  }

  handleResize() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (window.innerWidth > 768) {
      // 桌面端
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      if (this.app.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
      }
    } else {
      // 移动端
      sidebar.classList.remove('collapsed');
      if (!this.app.sidebarCollapsed) {
        sidebar.classList.add('open');
        overlay.classList.add('show');
      }
    }

    this.app.uiRenderer.adjustContentArea();
  }

  /**
   * 添加按钮点击视觉反馈
   * @param {HTMLElement} button - 被点击的按钮元素
   */
  addButtonClickFeedback(button) {
    if (!button) return;

    // 添加点击效果类
    button.classList.add('btn-clicked');

    // 创建涟漪效果
    this.createRippleEffect(button);

    // 100ms后移除点击效果
    setTimeout(() => {
      button.classList.remove('btn-clicked');
    }, 100);
  }

  /**
   * 添加现代化按钮点击视觉反馈
   * @param {HTMLElement} button - 被点击的按钮元素
   */
  addModernButtonClickFeedback(button) {
    if (!button) return;

    // 添加现代化点击效果
    button.classList.add('btn-clicked');

    // 创建更优雅的涟漪效果
    this.createModernRippleEffect(button);

    // 150ms后移除点击效果
    setTimeout(() => {
      button.classList.remove('btn-clicked');
    }, 150);
  }

  /**
   * 创建涟漪效果
   * @param {HTMLElement} button - 按钮元素
   */
  createRippleEffect(button) {
    // 检查是否已经有涟漪效果正在进行
    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) {
      existingRipple.remove();
    }

    // 创建涟漪元素
    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    // 获取按钮尺寸和位置
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    // 设置涟漪样式
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: scale(0);
      animation: ripple-animation 0.6s ease-out;
      pointer-events: none;
      width: ${size}px;
      height: ${size}px;
      left: 50%;
      top: 50%;
      margin-left: -${size / 2}px;
      margin-top: -${size / 2}px;
    `;

    // 确保按钮有相对定位
    const originalPosition = button.style.position;
    if (!originalPosition || originalPosition === 'static') {
      button.style.position = 'relative';
    }

    // 添加涟漪到按钮
    button.appendChild(ripple);

    // 600ms后移除涟漪
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.remove();
      }
      // 恢复原始定位
      if (!originalPosition) {
        button.style.position = '';
      }
    }, 600);
  }

  /**
   * 创建现代化涟漪效果
   * @param {HTMLElement} button - 按钮元素
   */
  createModernRippleEffect(button) {
    // 检查是否已经有涟漪效果正在进行
    const existingRipple = button.querySelector('.modern-ripple');
    if (existingRipple) {
      existingRipple.remove();
    }

    // 创建现代化涟漪元素
    const ripple = document.createElement('span');
    ripple.className = 'modern-ripple';

    // 获取按钮尺寸
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;

    // 设置现代化涟漪样式
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(64, 150, 255, 0.3) 0%, rgba(64, 150, 255, 0.1) 50%, transparent 100%);
      transform: scale(0);
      animation: ripple-animation 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
      width: ${size}px;
      height: ${size}px;
      left: 50%;
      top: 50%;
      margin-left: -${size / 2}px;
      margin-top: -${size / 2}px;
      z-index: 1;
    `;

    // 确保按钮有相对定位和溢出隐藏
    const originalPosition = button.style.position;
    const originalOverflow = button.style.overflow;
    if (!originalPosition || originalPosition === 'static') {
      button.style.position = 'relative';
    }
    button.style.overflow = 'hidden';

    // 添加涟漪到按钮
    button.appendChild(ripple);

    // 500ms后移除涟漪
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.remove();
      }
      // 恢复原始样式
      if (!originalPosition) {
        button.style.position = '';
      }
      if (!originalOverflow) {
        button.style.overflow = '';
      }
    }, 500);
  }
}
