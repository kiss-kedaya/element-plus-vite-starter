// UI渲染模块 - 负责界面渲染、模板生成和视觉效果
export class UIRenderer {
  constructor(app) {
    this.app = app;
  }

  renderCategories() {
    const categories = this.app.dataProcessor.getCategories();
    const categoryList = document.getElementById('category-list');
    const categoryFilter = document.getElementById('category-filter');

    // 渲染侧边栏分类
    categoryList.innerHTML = categories.map(category => {
      const displayName = this.app.translateCategory(category.name);
      return `
        <div class="category-item" data-category="${category.name}">
          <div class="category-name">
            <i class="fas ${this.app.dataProcessor.getCategoryIcon(category.name)}"></i>
            <span class="category-text">${displayName}</span>
          </div>
          <div class="category-count">${category.count}</div>
        </div>
      `;
    }).join('');

    // 渲染过滤器选项
    categoryFilter.innerHTML = '<option value="">所有分类</option>' +
      categories.map(category => {
        const displayName = this.app.translateCategory(category.name);
        return `<option value="${category.name}">${displayName} (${category.count})</option>`;
      }).join('');

    // 添加分类点击事件
    categoryList.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const category = e.currentTarget.dataset.category;
        this.app.selectCategory(category);
      });
    });
  }

  renderAPIs() {
    const apisContent = document.getElementById('apis-content');
    apisContent.className = `apis-content ${this.app.currentView}-view`;

    if (this.app.filteredAPIs.length === 0) {
      apisContent.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search fa-3x"></i>
          <h3>没有找到匹配的接口</h3>
          <p>请尝试调整搜索条件或过滤器</p>
        </div>
      `;
      return;
    }

    apisContent.innerHTML = this.app.filteredAPIs.map(api => this.renderAPICard(api)).join('');

    // 添加API卡片点击事件
    apisContent.querySelectorAll('.api-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const apiId = e.currentTarget.dataset.apiId;
        this.app.showAPIDetails(apiId);
      });
    });
  }

  renderAPICard(api) {
    const hasWxidParam = api.parameters.some(param =>
      param.name === 'wxid' || (param.description && param.description.includes('wxid'))
    );

    return `
      <div class="api-card" data-api-id="${api.id}">
        <div class="api-card-header">
          <span class="method-badge ${api.method.toLowerCase()}">${api.method}</span>
          <span class="api-path">${api.path}</span>
        </div>
        <div class="api-card-body">
          <div class="api-title">${api.summary}</div>
          <div class="api-description">${api.description}</div>
        </div>
        <div class="api-card-footer">
          <div class="api-tags">
            ${api.tags.map(tag => `<span class="api-tag">${tag}</span>`).join('')}
            ${hasWxidParam ? '<span class="api-tag" style="background: rgba(24, 144, 255, 0.1); color: var(--primary-color);">需要wxid</span>' : ''}
          </div>
          <div class="api-actions">
            <button class="action-btn" onclick="event.stopPropagation(); window.apiApp.testAPI('${api.id}')">
              <i class="fas fa-play"></i> 测试
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); window.apiApp.copyAPIInfo('${api.id}')">
              <i class="fas fa-copy"></i> 复制
            </button>
          </div>
        </div>
      </div>
    `;
  }

  updateStats() {
    const categories = this.app.dataProcessor.getCategories();
    const loginAPIs = this.app.filteredAPIs.filter(api => api.tags.includes('Login')).length;
    const messageAPIs = this.app.filteredAPIs.filter(api =>
      api.tags.includes('Msg') || api.tags.includes('FriendCircle')
    ).length;

    document.getElementById('total-apis').textContent = this.app.filteredAPIs.length;
    document.getElementById('total-categories').textContent = categories.length;
    document.getElementById('login-apis').textContent = loginAPIs;
    document.getElementById('message-apis').textContent = messageAPIs;
  }

  // 侧边栏控制方法
  adjustContentArea() {
    const contentArea = document.querySelector('.content-area');

    if (window.innerWidth > 768) {
      if (this.app.sidebarCollapsed) {
        contentArea.style.marginLeft = 'var(--sidebar-collapsed-width)';
        contentArea.style.width = 'calc(100vw - var(--sidebar-collapsed-width))';
      } else {
        contentArea.style.marginLeft = 'var(--sidebar-width)';
        contentArea.style.width = 'calc(100vw - var(--sidebar-width))';
      }
    } else {
      contentArea.style.marginLeft = '0';
      contentArea.style.width = '100vw';
    }
  }

  // 骨架屏和加载动画
  initializeSkeletonScreens() {
    // 立即显示系统信息骨架屏
    const systemInfoGrid = document.querySelector('.system-info-grid');
    if (systemInfoGrid) {
      this.showSystemInfoSkeleton(systemInfoGrid);
    }

    // 立即显示账号概览骨架屏
    const accountsOverview = document.querySelector('.accounts-overview');
    if (accountsOverview) {
      this.showAccountsSkeleton(accountsOverview);
    }

    // 初始化二维码骨架屏
    const qrcodeDisplay = document.getElementById('qrcode-display');
    if (qrcodeDisplay) {
      this.showQRCodeSkeleton(qrcodeDisplay);
    }
  }

  showQRCodeSkeleton(container) {
    const skeletonHTML = `
      <div class="qrcode-skeleton qrcode-skeleton-clickable" id="get-qrcode-btn">
        <div class="qrcode-skeleton-placeholder">
          <div class="skeleton-qr-icon">
            <i class="fas fa-qrcode"></i>
          </div>
          <div class="skeleton-qr-text">点击获取二维码</div>
        </div>
      </div>
    `;
    container.innerHTML = skeletonHTML;
  }

  showAccountsSkeleton(container, useTransition = false) {
    const skeletonHTML = `
      <div class="account-card-skeleton fade-in" style="animation-delay: 0ms;">
        <div class="skeleton-header">
          <div class="skeleton skeleton-avatar"></div>
          <div class="skeleton-info">
            <div class="skeleton skeleton-name"></div>
            <div class="skeleton skeleton-wxid"></div>
          </div>
          <div class="skeleton skeleton-status"></div>
        </div>
        <div class="skeleton-body">
          <div class="skeleton-detail">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
          </div>
          <div class="skeleton-detail">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
          </div>
          <div class="skeleton-detail">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
          </div>
          <div class="skeleton-detail">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
          </div>
        </div>
      </div>
    `;

    if (useTransition) {
      // 使用平滑过渡替换内容（用于刷新时）
      this.smoothReplaceContent(container, skeletonHTML);
    } else {
      // 直接替换内容（用于初始化时）
      container.innerHTML = skeletonHTML;
    }
  }

  showSystemInfoSkeleton(container, useTransition = false) {
    const skeletonHTML = `
      <div class="system-info-card skeleton-card fade-in">
        <div class="info-icon skeleton-icon">
          <div class="skeleton skeleton-icon-placeholder"></div>
        </div>
        <div class="info-content">
          <div class="info-label skeleton skeleton-title"></div>
          <div class="info-value skeleton skeleton-value"></div>
        </div>
      </div>
      <div class="system-info-card skeleton-card fade-in">
        <div class="info-icon skeleton-icon">
          <div class="skeleton skeleton-icon-placeholder"></div>
        </div>
        <div class="info-content">
          <div class="info-label skeleton skeleton-title"></div>
          <div class="info-value skeleton skeleton-value"></div>
        </div>
      </div>
      <div class="system-info-card skeleton-card fade-in">
        <div class="info-icon skeleton-icon">
          <div class="skeleton skeleton-icon-placeholder"></div>
        </div>
        <div class="info-content">
          <div class="info-label skeleton skeleton-title"></div>
          <div class="info-value skeleton skeleton-value"></div>
        </div>
      </div>
      <div class="system-info-card skeleton-card fade-in">
        <div class="info-icon skeleton-icon">
          <div class="skeleton skeleton-icon-placeholder"></div>
        </div>
        <div class="info-content">
          <div class="info-label skeleton skeleton-title"></div>
          <div class="info-value skeleton skeleton-value"></div>
        </div>
      </div>
      <div class="system-info-card skeleton-card fade-in">
        <div class="info-icon skeleton-icon">
          <div class="skeleton skeleton-icon-placeholder"></div>
        </div>
        <div class="info-content">
          <div class="info-label skeleton skeleton-title"></div>
          <div class="info-value skeleton skeleton-value"></div>
        </div>
      </div>
      <div class="system-info-card skeleton-card fade-in">
        <div class="info-icon skeleton-icon">
          <div class="skeleton skeleton-icon-placeholder"></div>
        </div>
        <div class="info-content">
          <div class="info-label skeleton skeleton-title"></div>
          <div class="info-value skeleton skeleton-value"></div>
        </div>
      </div>
    `;

    if (useTransition) {
      // 使用平滑过渡替换内容（用于刷新时）
      this.smoothReplaceContent(container, skeletonHTML);
    } else {
      // 直接替换内容（用于初始化时）
      container.innerHTML = skeletonHTML;
    }
  }

  showLoadingSpinner(container, text = '加载中...') {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">${text}</div>
      </div>
    `;
  }

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
}
