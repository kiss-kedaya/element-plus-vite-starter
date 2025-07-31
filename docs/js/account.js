// 账号管理模块 - 负责账号相关的所有功能
export class AccountManager {
  constructor(app) {
    this.app = app;
    this.qrcodeCheckTimer = null;
    this.pendingDeleteAccount = null;

    // 调试模式控制 - 可以通过URL参数或localStorage控制
    this.debugMode = this.getDebugMode();

    // 日志防重复机制
    this.lastLogTime = {};
    this.logCooldown = 1000; // 1秒内相同日志不重复输出

    // 运行时间更新定时器
    this.uptimeTimer = null;

    // 页面卸载时清理定时器
    window.addEventListener('beforeunload', () => {
      this.stopDynamicUptimeUpdate();
    });
  }

  // 获取调试模式状态
  getDebugMode() {
    // 检查URL参数
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      return true;
    }

    // 检查localStorage
    if (localStorage.getItem('wechat_debug_mode') === 'true') {
      return true;
    }

    // 检查开发环境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }

    return false;
  }

  // 智能日志输出方法
  log(level, message, data = null, category = 'general') {
    const now = Date.now();
    const logKey = `${level}_${category}_${message}`;

    // 防重复日志
    if (this.lastLogTime[logKey] && (now - this.lastLogTime[logKey]) < this.logCooldown) {
      return;
    }
    this.lastLogTime[logKey] = now;

    // 根据级别和模式决定是否输出
    switch (level) {
      case 'error':
        console.error(`[账号管理] ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[账号管理] ${message}`, data || '');
        break;
      case 'info':
        if (this.debugMode) {
          console.info(`[账号管理] ${message}`, data || '');
        }
        break;
      case 'debug':
        if (this.debugMode) {
          console.log(`[调试] ${message}`, data || '');
        }
        break;
      default:
        if (this.debugMode) {
          console.log(`[账号管理] ${message}`, data || '');
        }
    }
  }

  // 动态切换调试模式
  setDebugMode(enabled) {
    this.debugMode = enabled;
    localStorage.setItem('wechat_debug_mode', enabled.toString());
    this.log('info', `调试模式已${enabled ? '开启' : '关闭'}`, null, 'system');
  }

  // 清理重复日志记录
  clearLogHistory() {
    this.lastLogTime = {};
    this.log('debug', '日志历史已清理', null, 'system');
  }

  // 系统信息相关方法
  async loadSystemInfo() {
    try {
      // 获取基本系统信息
      const systemInfo = await this.getSystemInfo();

      // 延迟显示真实数据以展示骨架屏效果
      setTimeout(() => {
        this.updateSystemInfoDisplay(systemInfo);
        // 启动动态运行时间更新
        this.startDynamicUptimeUpdate(systemInfo.startTime);
      }, 1200); // 确保骨架屏有足够的显示时间

    } catch (error) {
      console.error('加载系统信息失败:', error);
      setTimeout(() => {
        this.updateSystemInfoDisplay({
          arch: '获取失败',
          port: '获取失败',
          mode: '获取失败',
          memory: '获取失败',
          redis: '获取失败',
          uptime: '获取失败'
        });
      }, 1200);
    }
  }

  async getSystemInfo() {
    try {
      // 从真实API获取系统信息
      const response = await fetch('/api/system/info', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();

        // 检查API响应格式
        if (result.Success && result.Data) {
          const data = result.Data;
          return {
            arch: data.architecture || 'Unknown',
            port: data.port || window.location.port || '8059',
            mode: data.environment || 'Unknown',
            memory: data.memoryUsage || 'Unknown',
            redis: data.redisMemory || 'Unknown',
            uptime: data.uptime || 'Unknown',
            startTime: data.startTimeMs || (data.startTime ? new Date(data.startTime).getTime() : Date.now())
          };
        } else {
          throw new Error('API返回格式错误');
        }
      } else {
        throw new Error(`API响应失败: ${response.status}`);
      }
    } catch (error) {
      console.error('获取系统信息失败:', error);
      // 如果API调用失败，返回错误信息而不是模拟数据
      return {
        arch: '获取失败',
        port: '获取失败',
        mode: '获取失败',
        memory: '获取失败',
        redis: '获取失败',
        uptime: '获取失败'
      };
    }
  }

  updateSystemInfoDisplay(info) {
    const systemInfoGrid = document.querySelector('.system-info-grid');
    if (!systemInfoGrid) return;

    // 重新创建系统信息卡片的HTML结构
    const systemInfoHTML = `
      <div class="system-info-card fade-in">
        <div class="info-icon">
          <i class="fas fa-server"></i>
        </div>
        <div class="info-content">
          <div class="info-label">系统架构</div>
          <div class="info-value" id="system-arch">${info.arch || '未知'}</div>
        </div>
      </div>
      <div class="system-info-card fade-in">
        <div class="info-icon">
          <i class="fas fa-network-wired"></i>
        </div>
        <div class="info-content">
          <div class="info-label">运行端口</div>
          <div class="info-value" id="system-port">${info.port || '未知'}</div>
        </div>
      </div>
      <div class="system-info-card fade-in">
        <div class="info-icon">
          <i class="fas fa-cogs"></i>
        </div>
        <div class="info-content">
          <div class="info-label">运行模式</div>
          <div class="info-value" id="system-mode">${info.mode || '未知'}</div>
        </div>
      </div>
      <div class="system-info-card fade-in">
        <div class="info-icon">
          <i class="fas fa-memory"></i>
        </div>
        <div class="info-content">
          <div class="info-label">系统内存</div>
          <div class="info-value" id="system-memory">${info.memory || '未知'}</div>
        </div>
      </div>
      <div class="system-info-card fade-in">
        <div class="info-icon">
          <i class="fas fa-database"></i>
        </div>
        <div class="info-content">
          <div class="info-label">Redis内存</div>
          <div class="info-value" id="redis-memory">${info.redis || '未知'}</div>
        </div>
      </div>
      <div class="system-info-card fade-in">
        <div class="info-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="info-content">
          <div class="info-label">运行时间</div>
          <div class="info-value" id="system-uptime">${info.uptime || '未知'}</div>
        </div>
      </div>
    `;

    // 使用平滑替换内容
    this.app.uiRenderer.smoothReplaceContent(systemInfoGrid, systemInfoHTML);
  }

  // 刷新系统信息（带过渡效果）
  async refreshSystemInfo() {
    const systemInfoGrid = document.querySelector('.system-info-grid');
    if (systemInfoGrid) {
      // 显示骨架屏（使用过渡效果）
      this.app.uiRenderer.showSystemInfoSkeleton(systemInfoGrid, true);
    }

    // 加载数据
    await this.loadSystemInfo();
  }

  // 启动动态运行时间更新
  startDynamicUptimeUpdate(startTime) {
    // 清除之前的定时器
    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer);
    }

    // 如果没有有效的启动时间，尝试从服务器获取
    if (!startTime || isNaN(startTime)) {
      this.getServerStartTime().then(serverStartTime => {
        if (serverStartTime) {
          this.startDynamicUptimeUpdate(serverStartTime);
        }
      });
      return;
    }

    // 更新运行时间显示
    const updateUptime = () => {
      const uptimeElement = document.getElementById('system-uptime');
      if (uptimeElement) {
        const currentTime = Date.now();
        const uptimeMs = currentTime - startTime;
        const formattedUptime = this.formatDynamicUptime(uptimeMs);
        uptimeElement.textContent = formattedUptime;

        // 添加动态更新的视觉提示
        uptimeElement.classList.add('updating');
        setTimeout(() => {
          uptimeElement.classList.remove('updating');
        }, 200);
      }
    };

    // 立即更新一次
    updateUptime();

    // 每秒更新一次
    this.uptimeTimer = setInterval(updateUptime, 1000);
  }

  // 停止动态运行时间更新
  stopDynamicUptimeUpdate() {
    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer);
      this.uptimeTimer = null;
    }
  }

  // 格式化动态运行时间
  formatDynamicUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  // 获取服务器启动时间
  async getServerStartTime() {
    try {
      const response = await fetch('/api/system/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.Success && result.Data && result.Data.start_time) {
          return new Date(result.Data.start_time).getTime();
        }
      }
    } catch (error) {
      console.warn('获取服务器启动时间失败:', error);
    }

    // 如果无法获取服务器启动时间，使用当前时间作为估算
    return Date.now();
  }

  // 概览页面账号数据加载
  async loadAccountsOverview() {
    try {
      // 获取账号数据，添加API密钥参数
      const response = await fetch('/api/Login/GetLoggedAccounts?api_key=api_kedaya', {
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // 处理响应数据 - 注意API返回的是大写的Data字段
      if (result && result.Data && Array.isArray(result.Data)) {
        this.app.accountsData = result.Data;
      } else if (result && result.data && Array.isArray(result.data)) {
        this.app.accountsData = result.data;
      } else if (Array.isArray(result)) {
        this.app.accountsData = result;
      } else {
        this.app.accountsData = [];
      }

      // 延迟渲染以显示骨架屏效果
      setTimeout(() => {
        // 渲染账号列表
        this.renderAccountsOverview();

        // 更新统计数据
        this.app.uiRenderer.updateStats();
      }, 1000); // 增加延迟时间以更好地展示骨架屏

    } catch (error) {
      console.error('加载账号数据失败:', error);

      // 延迟显示错误状态，保持与正常流程一致的时间
      setTimeout(() => {
        this.showAccountsError(error);
      }, 1000);

      this.app.accountsData = [];
      this.app.uiRenderer.updateStats();

      // 重新抛出错误，让调用者能够处理
      throw error;
    }
  }

  renderAccountsOverview() {
    const accountsOverview = document.getElementById('accounts-overview');

    if (!accountsOverview) {
      console.error('找不到accounts-overview元素！');
      return;
    }

    if (this.app.accountsData.length === 0) {
      this.showAccountsEmpty(accountsOverview);
      return;
    }

    // 显示账号列表容器
    accountsOverview.style.display = '';

    // 移除空状态和错误状态元素（如果存在）
    const accountsSection = accountsOverview.closest('.accounts-section');
    if (accountsSection) {
      const emptyElement = accountsSection.querySelector('.accounts-empty-state');
      if (emptyElement) {
        emptyElement.remove();
      }
      const errorElement = accountsSection.querySelector('.accounts-error-state');
      if (errorElement) {
        errorElement.remove();
      }
    }

    // 生成账号卡片HTML并应用淡入效果
    const accountsHTML = this.app.accountsData.map((account, index) =>
      this.renderAccountCard(account, index)
    ).join('');

    this.app.uiRenderer.smoothReplaceContent(accountsOverview, accountsHTML);

    // 更新统计信息
    this.app.uiRenderer.updateStats();
  }

  // 显示账号空状态
  showAccountsEmpty(container) {
    // 隐藏账号列表容器
    container.style.display = 'none';

    // 在账号区域显示空状态
    const accountsSection = container.closest('.accounts-section');
    if (accountsSection) {
      // 检查是否已存在空状态元素
      let emptyElement = accountsSection.querySelector('.accounts-empty-state');
      if (!emptyElement) {
        emptyElement = document.createElement('div');
        emptyElement.className = 'accounts-empty-state';
        emptyElement.style.cssText = 'color: var(--text-tertiary); text-align: center; padding: 40px; margin-top: 20px;';
        emptyElement.textContent = '暂无已登录账号';
        accountsSection.appendChild(emptyElement);
      }
    }
  }

  // 显示账号加载错误状态
  showAccountsError(error) {
    const accountsOverview = document.getElementById('accounts-overview');
    if (!accountsOverview) return;

    // 隐藏账号列表容器
    accountsOverview.style.display = 'none';

    // 在账号区域显示错误状态
    const accountsSection = accountsOverview.closest('.accounts-section');
    if (accountsSection) {
      // 检查是否已存在错误状态元素
      let errorElement = accountsSection.querySelector('.accounts-error-state');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'accounts-error-state';
        errorElement.style.cssText = 'color: var(--text-tertiary); text-align: center; padding: 40px; margin-top: 20px;';
        accountsSection.appendChild(errorElement);
      }
      errorElement.textContent = `加载失败: ${error.message}`;
    }
  }

  // 刷新账号列表（简化版本，与其他刷新按钮保持一致）
  async refreshAccounts() {
    const accountsOverview = document.getElementById('accounts-overview');

    try {
      if (accountsOverview) {
        // 显示骨架屏（使用过渡效果）
        this.app.uiRenderer.showAccountsSkeleton(accountsOverview, true);
      }

      // 加载数据
      await this.loadAccountsOverview();

    } catch (error) {
      console.error('刷新账号列表失败:', error);
      this.app.showToast('刷新账号列表失败: ' + error.message, 'error');
    }
  }



  renderAccountCard(account, index = 0) {
    // 兼容不同的字段名格式
    const nickname = account.nickname || account.Nickname || account.wxid || account.Wxid || '未知用户';
    const wxid = account.wxid || account.Wxid || 'unknown';
    const headUrl = account.headUrl || account.HeadUrl || account.avatar || account.Avatar;
    const status = this.getAccountStatus(account);
    const mobile = account.mobile || account.Mobile || '未绑定';
    const deviceType = this.getDeviceTypeName(account.deviceType || account.device_type || account.DeviceType || account.deviceName);
    const deviceId = account.deviceId || account.device_id || account.DeviceId || '未知';
    const deviceName = account.deviceName || account.device_name || account.DeviceName || '未知';
    const lastLogin = account.last_login_time || account.lastLoginTime || account.loginTime || account.LoginTime;
    const formattedLastLogin = lastLogin ?
      new Date(lastLogin).toLocaleString() : '未知';

    // 生成头像HTML
    const avatarHtml = this.generateAvatarHtml(headUrl, nickname);

    // 计算动画延迟
    const animationDelay = index * 100; // 每个卡片延迟100ms

    return `
      <div class="account-card fade-in" data-wxid="${wxid}" style="animation-delay: ${animationDelay}ms;">
        <div class="account-card-header">
          ${avatarHtml}
          <div class="account-info" data-wxid="${wxid}" data-action="show-detail">
            <div class="account-nickname">${nickname}</div>
            <div class="account-wxid" data-full-wxid="${wxid}" title="${wxid}">${wxid}</div>
          </div>
          <div class="account-status ${status.class}">
            <div class="status-dot"></div>
            ${status.text}
          </div>
          <div class="account-actions">
            <button class="account-action-btn delete-btn"
                    onclick="event.stopPropagation(); window.apiApp.accountManager.confirmDeleteAccount('${wxid}', '${nickname}')"
                    title="删除账号">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
        <div class="account-card-body" data-wxid="${wxid}" data-action="show-detail">
          <!-- 重要信息行：需要完整显示 -->
          <div class="account-detail-row important">
            <div class="account-detail horizontal">
              <div class="account-detail-label">设备ID</div>
              <div class="account-detail-value important" title="${deviceId}">${deviceId}</div>
            </div>
          </div>

          <!-- 基本信息行 -->
          <div class="account-detail-row">
            <div class="account-detail horizontal">
              <div class="account-detail-label">手机号</div>
              <div class="account-detail-value">${mobile}</div>
            </div>
            <div class="account-detail horizontal">
              <div class="account-detail-label">设备类型</div>
              <div class="account-detail-value">${deviceType}</div>
            </div>
          </div>

          <!-- 设备和时间信息行 -->
          <div class="account-detail-row">
            <div class="account-detail horizontal">
              <div class="account-detail-label">设备名称</div>
              <div class="account-detail-value long-text" title="${deviceName}">${deviceName}</div>
            </div>
            <div class="account-detail horizontal">
              <div class="account-detail-label">最后登录</div>
              <div class="account-detail-value long-text" title="${formattedLastLogin}">${formattedLastLogin}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getAccountStatus(account) {
    // 根据账号数据判断状态，兼容不同字段名
    const status = account.status || account.Status;
    const isOnline = account.is_online || account.isOnline || account.IsOnline;
    const loginStatus = account.loginStatus || account.LoginStatus;

    // 明确的在线状态
    if (status === 'online' || isOnline === true || loginStatus === 'online') {
      return { class: 'status-online', text: '在线' };
    }
    // 明确的离线状态
    else if (status === 'offline' || isOnline === false || loginStatus === 'offline') {
      return { class: 'status-offline', text: '离线' };
    }
    // 其他可能的状态值
    else if (status === 'away' || loginStatus === 'away') {
      return { class: 'status-away', text: '离开' };
    }
    else if (status === 'busy' || loginStatus === 'busy') {
      return { class: 'status-busy', text: '忙碌' };
    }
    // 如果没有状态信息或状态未知，根据是否有最近活动判断
    else {
      // 检查最后登录时间，如果超过一定时间可能是离线
      const lastLogin = account.last_login_time || account.lastLoginTime || account.loginTime || account.LoginTime;
      if (lastLogin) {
        const lastLoginTime = new Date(lastLogin);
        const now = new Date();
        const timeDiff = now - lastLoginTime;
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // 如果超过24小时没有活动，认为可能离线
        if (hoursDiff > 24) {
          return { class: 'status-offline', text: '可能离线' };
        }
      }

      // 默认状态：未知
      return { class: 'status-unknown', text: '状态未知' };
    }
  }

  getDeviceTypeName(deviceType) {
    const deviceTypeMap = {
      'ipad': 'iPad',
      'iphone': 'iPhone',
      'android': 'Android',
      'windows': 'Windows',
      'mac': 'Mac',
      'web': 'Web版'
    };

    if (!deviceType) return '未知设备';

    const lowerType = deviceType.toLowerCase();
    return deviceTypeMap[lowerType] || deviceType;
  }

  // 生成头像HTML
  generateAvatarHtml(headUrl, nickname) {
    const fallbackLetter = nickname ? nickname.charAt(0).toUpperCase() : '?';

    if (headUrl && headUrl.trim() !== '') {
      // 如果有头像URL，使用真实头像
      return `
        <div class="account-avatar">
          <img src="${headUrl}"
               alt="${nickname}"
               onload="this.nextElementSibling.style.display='none';"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
               style="position: relative; z-index: 2;">
          <div class="avatar-fallback" style="display: none;">
            ${fallbackLetter}
          </div>
        </div>
      `;
    } else {
      // 如果没有头像URL，使用字母头像
      return `
        <div class="account-avatar">
          <div class="avatar-fallback">
            ${fallbackLetter}
          </div>
        </div>
      `;
    }
  }

  // 账号详情模态框相关
  showAccountDetail(wxid) {
    const account = this.app.accountsData.find(acc => acc.wxid === wxid || acc.Wxid === wxid);
    if (!account) {
      this.app.showToast('找不到账号信息', 'error');
      return;
    }

    // 显示模态框
    const modal = document.getElementById('account-detail-modal');
    const content = document.getElementById('account-detail-content');

    // 生成账号详情内容
    content.innerHTML = this.generateAccountDetailHTML(account);

    // 显示模态框
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // 复用已加载的头像，避免重复请求
    this.reuseLoadedAvatar(wxid);
  }

  closeAccountDetailModal() {
    const modal = document.getElementById('account-detail-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  // 复用已加载的头像，避免重复请求
  reuseLoadedAvatar(wxid) {
    // 查找模态框中的大头像容器
    const largeAvatarContainer = document.querySelector('.account-avatar-large[data-wxid]');
    if (!largeAvatarContainer) return;

    // 查找账号列表中对应的已加载头像
    const existingAvatar = document.querySelector(`[data-wxid="${wxid}"] .account-avatar img`);

    if (existingAvatar && existingAvatar.complete && existingAvatar.naturalWidth > 0) {
      // 找到已加载的头像，复制它
      const nickname = largeAvatarContainer.getAttribute('data-nickname');

      // 创建新的img元素，使用相同的src（浏览器会从缓存获取）
      const newImg = document.createElement('img');
      newImg.src = existingAvatar.src;
      newImg.alt = nickname;
      newImg.style.display = 'block';

      // 隐藏fallback头像
      const fallback = largeAvatarContainer.querySelector('.avatar-fallback');
      if (fallback) {
        fallback.style.display = 'none';
      }

      // 插入新的img元素
      largeAvatarContainer.insertBefore(newImg, fallback);

    } else {
      // 如果没有找到已加载的头像，使用原始URL
      const headUrl = largeAvatarContainer.getAttribute('data-head-url');
      const nickname = largeAvatarContainer.getAttribute('data-nickname');

      if (headUrl) {
        const newImg = document.createElement('img');
        newImg.src = headUrl;
        newImg.alt = nickname;

        newImg.onload = function() {
          const fallback = largeAvatarContainer.querySelector('.avatar-fallback');
          if (fallback) {
            fallback.style.display = 'none';
          }
          this.style.display = 'block';
          this.style.position = 'relative';
          this.style.zIndex = '2';
        };

        newImg.onerror = function() {
          this.style.display = 'none';
          const fallback = largeAvatarContainer.querySelector('.avatar-fallback');
          if (fallback) {
            fallback.style.display = 'flex';
          }
        };

        const fallback = largeAvatarContainer.querySelector('.avatar-fallback');
        largeAvatarContainer.insertBefore(newImg, fallback);

        console.log(`⚠️ 头像未在列表中找到，需要重新加载: ${wxid}`);
      }
    }
  }

  generateAccountDetailHTML(account) {
    const nickname = account.nickname || account.Nickname || account.wxid || account.Wxid || '未知用户';
    const wxid = account.wxid || account.Wxid || 'unknown';
    const headUrl = account.headUrl || account.HeadUrl || account.avatar || account.Avatar;
    const status = this.getAccountStatus(account);
    const mobile = account.mobile || account.Mobile || '未绑定';
    const email = account.email || account.Email || '未绑定';
    const deviceType = this.getDeviceTypeName(account.deviceType || account.device_type || account.DeviceType || account.deviceName);
    const deviceId = account.deviceId || account.device_id || account.DeviceId || '未知';
    const deviceName = account.deviceName || account.device_name || account.DeviceName || '未知';
    const alias = account.alias || account.Alias || '无';
    const lastLogin = account.last_login_time || account.lastLoginTime || account.loginTime || account.LoginTime;
    const formattedLastLogin = lastLogin ? new Date(lastLogin).toLocaleString() : '未知';

    // 生成大头像HTML - 传入wxid以便复用已加载的头像
    const largeAvatarHtml = this.generateLargeAvatarHtml(headUrl, nickname, wxid);

    return `
      <div class="account-basic-info">
        ${largeAvatarHtml}
        <h3>${nickname}</h3>
        <p>${wxid}</p>
        <div class="account-status-badge ${this.getStatusBadgeClass(status.class)}">
          <div class="status-dot"></div>
          ${status.text}
        </div>
        ${status.class === 'status-offline' ? this.generateReconnectButtons(wxid) : ''}

        <!-- 账号操作按钮 -->
        <div class="account-detail-actions">
          ${status.class === 'status-online' ? `
            <button class="btn btn-warning logout-btn" onclick="window.apiApp.accountManager.confirmLogout('${wxid}', '${nickname}')" title="退出登录">
              <i class="fas fa-sign-out-alt"></i>
              退出登录
            </button>
          ` : ''}
          <button class="btn btn-danger delete-btn" onclick="window.apiApp.accountManager.confirmDeleteAccount('${wxid}', '${nickname}')" title="删除账号">
            <i class="fas fa-trash-alt"></i>
            删除账号
          </button>
        </div>
      </div>

      <div class="account-detail-grid">
        <div class="account-detail-card">
          <h4><i class="fas fa-user"></i> 基本信息</h4>
          <div class="account-detail-item">
            <span class="account-detail-label">昵称</span>
            <span class="account-detail-value">${nickname}</span>
          </div>
          <div class="account-detail-item">
            <span class="account-detail-label">微信ID</span>
            <span class="account-detail-value">${wxid}</span>
          </div>
          <div class="account-detail-item">
            <span class="account-detail-label">别名</span>
            <span class="account-detail-value">${alias}</span>
          </div>
        </div>

        <div class="account-detail-card">
          <h4><i class="fas fa-phone"></i> 联系方式</h4>
          <div class="account-detail-item">
            <span class="account-detail-label">手机号</span>
            <span class="account-detail-value">${mobile}</span>
          </div>
          <div class="account-detail-item">
            <span class="account-detail-label">邮箱</span>
            <span class="account-detail-value">${email}</span>
          </div>
        </div>

        <div class="account-detail-card">
          <h4><i class="fas fa-mobile-alt"></i> 设备信息</h4>
          <div class="account-detail-item">
            <span class="account-detail-label">设备类型</span>
            <span class="account-detail-value">${deviceType}</span>
          </div>
          <div class="account-detail-item">
            <span class="account-detail-label">设备ID</span>
            <span class="account-detail-value important">${deviceId}</span>
          </div>
          <div class="account-detail-item">
            <span class="account-detail-label">设备名称</span>
            <span class="account-detail-value">${deviceName}</span>
          </div>
        </div>

        <div class="account-detail-card">
          <h4><i class="fas fa-clock"></i> 状态信息</h4>
          <div class="account-detail-item">
            <span class="account-detail-label">当前状态</span>
            <span class="account-detail-value">${status.text}</span>
          </div>
          <div class="account-detail-item">
            <span class="account-detail-label">最后登录</span>
            <span class="account-detail-value">${formattedLastLogin}</span>
          </div>
        </div>
      </div>
    `;
  }

  // 生成大头像HTML（用于详情模态框）- 复用已加载的头像
  generateLargeAvatarHtml(headUrl, nickname, wxid) {
    const fallbackLetter = nickname ? nickname.charAt(0).toUpperCase() : '?';

    if (headUrl && headUrl.trim() !== '') {
      // 创建容器，稍后通过JavaScript复制已加载的头像
      return `
        <div class="account-avatar-large" data-wxid="${wxid}" data-head-url="${headUrl}" data-nickname="${nickname}">
          <div class="avatar-fallback" style="display: flex;">
            ${fallbackLetter}
          </div>
        </div>
      `;
    } else {
      // 如果没有头像URL，使用字母头像
      return `
        <div class="account-avatar-large">
          <div class="avatar-fallback">
            ${fallbackLetter}
          </div>
        </div>
      `;
    }
  }

  // 获取状态徽章的CSS类名
  getStatusBadgeClass(statusClass) {
    switch (statusClass) {
      case 'status-online':
        return 'online';
      case 'status-offline':
        return 'offline';
      case 'status-away':
        return 'away';
      case 'status-busy':
        return 'busy';
      case 'status-unknown':
        return 'unknown';
      default:
        return 'unknown';
    }
  }

  // 生成重新连接按钮
  generateReconnectButtons(wxid) {
    return `
      <div class="reconnect-buttons">
        <div class="reconnect-row">
          <button class="btn btn-primary reconnect-btn" onclick="window.apiApp.reconnectAccount('${wxid}', 'auto')">
            <i class="fas fa-sync-alt"></i>
            自动重连
          </button>
          <button class="btn btn-secondary reconnect-btn" onclick="window.apiApp.reconnectAccount('${wxid}', 'awaken')">
            <i class="fas fa-power-off"></i>
            唤醒登录
          </button>
        </div>
        <div class="reconnect-row">
          <button class="btn btn-success reconnect-btn" onclick="window.apiApp.reconnectAccount('${wxid}', 'heartbeat')">
            <i class="fas fa-heartbeat"></i>
            开启心跳
          </button>
          <button class="btn btn-info reconnect-btn" onclick="window.apiApp.reconnectAccount('${wxid}', 'init')">
            <i class="fas fa-cog"></i>
            重新初始化
          </button>
        </div>
      </div>
    `;
  }

  // 重新连接账号
  async reconnectAccount(wxid, type) {
    if (!wxid || wxid.trim() === '') {
      this.app.showToast('账号ID不能为空', 'error');
      return;
    }

    let apiUrl = '';
    let buttonText = '';

    switch (type) {
      case 'auto':
        apiUrl = '/Login/LoginTwiceAutoAuth';
        buttonText = '自动重连';
        break;
      case 'awaken':
        apiUrl = '/Login/LoginAwaken';
        buttonText = '唤醒登录';
        break;
      case 'heartbeat':
        apiUrl = '/Login/AutoHeartBeat';  // 修正：开启自动心跳, 自动二次登录（linux 长连接，win 短链接）
        buttonText = '开启心跳';
        break;
      case 'init':
        apiUrl = '/Login/Newinit';  // 修正：初始化
        buttonText = '重新初始化';
        break;
      default:
        this.app.showToast('未知的重连类型', 'error');
        return;
    }

    try {
      this.app.showToast(`正在执行${buttonText}...`, 'info');

      // 构建带参数的URL
      const urlWithParams = `/api${apiUrl}?wxid=${encodeURIComponent(wxid)}`;

      const response = await fetch(urlWithParams, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (result.Success) {
        this.app.showToast(`${buttonText}成功！`, 'success');
        // 延迟刷新账号列表，给服务器一些时间处理
        setTimeout(() => {
          this.loadAccountsOverview();
        }, 2000);
      } else {
        this.app.showToast(`${buttonText}失败: ${result.Message}`, 'error');
      }
    } catch (error) {
      console.error(`${buttonText}失败:`, error);
      this.app.showToast(`${buttonText}失败: ${error.message}`, 'error');
    }
  }

  // 退出登录功能
  confirmLogout(wxid, nickname) {
    this.log('info', `准备退出登录: ${nickname} (${wxid})`, null, 'logout');

    // 存储要退出登录的账号信息
    this.pendingLogoutAccount = { wxid, nickname };

    // 查找目标账号
    const accountsData = this.app.accountsData || [];
    if (accountsData.length === 0) {
      this.log('warn', '账号数据为空，无法获取头像信息', null, 'logout');
    }

    const targetAccount = accountsData.find(acc =>
      (acc.wxid && acc.wxid === wxid) ||
      (acc.Wxid && acc.Wxid === wxid)
    );

    if (!targetAccount) {
      this.log('warn', `未找到账号 ${wxid} 的详细信息`, null, 'logout');
    } else {
      this.log('debug', '找到目标账号', {
        wxid: targetAccount.wxid || targetAccount.Wxid,
        nickname: targetAccount.nickname || targetAccount.Nickname,
        hasAvatar: !!(targetAccount.headUrl || targetAccount.HeadUrl || targetAccount.avatar || targetAccount.Avatar)
      }, 'logout');
    }

    // 更新模态框中的账号信息
    const nameElement = document.getElementById('logout-account-name');
    const wxidElement = document.getElementById('logout-account-wxid');
    const avatarElement = document.getElementById('logout-account-avatar');

    if (nameElement) {
      nameElement.textContent = nickname;
    } else {
      this.log('error', '退出登录确认模态框中的账号名称元素未找到');
      return;
    }

    if (wxidElement) {
      wxidElement.textContent = wxid;
    } else {
      this.log('error', '退出登录确认模态框中的微信号元素未找到');
      return;
    }

    // 设置头像
    if (avatarElement) {
      try {
        this.setLogoutModalAvatar(avatarElement, wxid, nickname);
      } catch (error) {
        this.log('error', '设置退出登录模态框头像失败', error.message);
        // 如果设置头像失败，至少显示默认头像
        this.setDefaultLogoutAvatar(avatarElement, nickname);
      }
    } else {
      this.log('error', '退出登录确认模态框中的头像元素未找到');
      return;
    }

    // 显示退出登录确认模态框
    this.showLogoutModal();
  }

  setLogoutModalAvatar(avatarElement, wxid, nickname) {
    this.log('debug', `设置退出登录模态框头像: ${nickname}`, null, 'avatar');

    // 清空现有内容
    avatarElement.innerHTML = '';

    // 尝试从当前账号数据中获取头像
    const accountsData = this.app.accountsData || [];
    const account = accountsData.find(acc =>
      (acc.wxid && acc.wxid === wxid) ||
      (acc.Wxid && acc.Wxid === wxid)
    );

    if (account) {
      // 检查所有可能的头像字段（根据备份文件的实现）
      const headUrl = account.headUrl || account.HeadUrl || account.avatar || account.Avatar ||
                     account.headImg || account.HeadImg || account.head_img;

      this.log('debug', '头像字段检查', {
        hasHeadUrl: !!account.headUrl,
        hasHeadUrlCap: !!account.HeadUrl,
        hasAvatar: !!account.avatar,
        hasAvatarCap: !!account.Avatar,
        finalUrl: headUrl ? '有头像URL' : '无头像URL'
      }, 'avatar');

      if (headUrl && headUrl.trim() !== '') {
        this.log('info', `加载用户头像: ${nickname}`, null, 'avatar');

        // 如果有头像URL，创建img元素
        const img = document.createElement('img');
        img.src = headUrl;
        img.alt = nickname;
        img.className = 'avatar-img';

        // 头像加载成功
        img.onload = () => {
          this.log('debug', `头像加载成功: ${nickname}`, null, 'avatar');
        };

        // 头像加载失败时显示默认头像
        img.onerror = () => {
          this.log('warn', `头像加载失败，使用默认头像: ${nickname}`, null, 'avatar');
          this.setDefaultLogoutAvatar(avatarElement, nickname);
        };

        avatarElement.appendChild(img);
        return;
      }
    }

    // 没有头像时显示默认头像
    this.log('info', `使用默认头像: ${nickname}`, null, 'avatar');
    this.setDefaultLogoutAvatar(avatarElement, nickname);
  }

  setDefaultLogoutAvatar(avatarElement, nickname) {
    // 使用昵称首字符作为默认头像，处理特殊字符
    let firstChar = '?';
    if (nickname && nickname.length > 0) {
      // 移除emoji和特殊字符，获取第一个有效字符
      const cleanName = nickname.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      firstChar = cleanName.length > 0 ? cleanName.charAt(0).toUpperCase() : nickname.charAt(0);
    }

    // 创建文字头像
    const textAvatar = document.createElement('div');
    textAvatar.className = 'avatar-text';
    textAvatar.textContent = firstChar;

    // 使用主题色彩，提供一些变化
    const themeColors = [
      'var(--primary-color)',     // 主色调
      'var(--success-color)',     // 成功色
      'var(--warning-color)',     // 警告色
      '#722ed1',                  // 紫色
      '#13c2c2',                  // 青色
      '#eb2f96',                  // 粉色
      '#fa541c',                  // 橙色
      '#2f54eb'                   // 深蓝色
    ];
    const colorIndex = firstChar.charCodeAt(0) % themeColors.length;
    avatarElement.style.background = themeColors[colorIndex];

    avatarElement.appendChild(textAvatar);
  }

  setDefaultDeleteAvatar(avatarElement, nickname) {
    // 使用昵称首字符作为默认头像，处理特殊字符
    let firstChar = '?';
    if (nickname && nickname.length > 0) {
      // 移除emoji和特殊字符，获取第一个有效字符
      const cleanName = nickname.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      firstChar = cleanName.length > 0 ? cleanName.charAt(0).toUpperCase() : nickname.charAt(0);
    }

    // 创建文字头像
    const textAvatar = document.createElement('div');
    textAvatar.className = 'avatar-text';
    textAvatar.textContent = firstChar;

    // 根据首字符生成颜色 - 使用CSS变量
    const colors = [
      'var(--primary-color)', 'var(--success-color)', 'var(--warning-color)', 'var(--error-color)', '#722ed1',
      '#13c2c2', '#eb2f96', '#fa541c', '#a0d911', '#2f54eb'
    ];
    const colorIndex = firstChar.charCodeAt(0) % colors.length;
    avatarElement.style.background = colors[colorIndex];

    avatarElement.appendChild(textAvatar);
  }

  showLogoutModal() {
    const modal = document.getElementById('logout-modal');

    if (!modal) {
      this.log('error', '退出登录确认模态框元素未找到');
      return;
    }

    // 设置模态框显示
    modal.style.display = 'flex';
    modal.classList.add('fade-in');
    document.body.style.overflow = 'hidden';

    // 移除动画类
    setTimeout(() => {
      modal.classList.remove('fade-in');
    }, 300);
  }

  closeLogoutModal() {
    const modal = document.getElementById('logout-modal');

    if (!modal) {
      this.log('error', '退出登录确认模态框元素未找到');
      return;
    }

    // 检查模态框是否已经在关闭过程中
    if (modal.classList.contains('fade-out') || modal.style.display === 'none') {
      this.log('debug', '模态框已在关闭中，跳过重复操作', null, 'modal');
      return;
    }

    this.log('debug', '开始关闭退出登录确认模态框', null, 'modal');

    // 移除可能存在的fade-in类
    modal.classList.remove('fade-in');

    // 添加fade-out动画
    modal.classList.add('fade-out');

    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('fade-out');
      document.body.style.overflow = 'auto';

      // 清理待退出登录账号信息
      this.pendingLogoutAccount = null;
      this.log('debug', '退出登录确认模态框已关闭', null, 'modal');
    }, 300);
  }

  executeLogout() {
    if (this.pendingLogoutAccount) {
      const { wxid, nickname } = this.pendingLogoutAccount;
      this.closeLogoutModal();
      this.logoutAccount(wxid, nickname);
    }
  }

  async logoutAccount(wxid, nickname) {
    try {
      this.app.showToast(`正在退出登录 ${nickname}...`, 'info');

      // 调用退出登录API
      const response = await fetch(`/api/Login/LogOut?wxid=${encodeURIComponent(wxid)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (result.Success) {
        this.app.showToast(`账号 ${nickname} 已退出登录！`, 'success');

        // 关闭账号详情模态框
        this.closeAccountDetailModal();

        // 延迟刷新账号列表，给服务器一些时间处理
        setTimeout(() => {
          this.loadAccountsOverview();
        }, 1500);
      } else {
        this.app.showToast(`退出登录失败: ${result.Message}`, 'error');
      }
    } catch (error) {
      this.log('error', '退出登录失败', error.message);
      this.app.showToast(`退出登录失败: ${error.message}`, 'error');
    }
  }

  // ==================== 删除账号功能 ====================

  confirmDeleteAccount(wxid, nickname) {
    // 显示删除确认模态框
    this.showDeleteConfirmModal(wxid, nickname);
  }

  showDeleteConfirmModal(wxid, nickname) {
    // 创建删除确认模态框HTML
    const modalHTML = `
      <div class="api-modal" id="delete-confirm-modal" style="display: flex;">
        <div class="api-modal-content delete-confirm-content">
          <div class="api-modal-header">
            <h3>确认删除账号</h3>
            <button class="close-btn" onclick="window.apiApp.accountManager.closeDeleteConfirmModal()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="api-modal-body">
            <div class="delete-warning">
              <div class="warning-icon">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <div class="warning-content">
                <h4>⚠️ 危险操作</h4>
                <p>您即将删除账号 <strong>${nickname}</strong> (${wxid})</p>
                <p>此操作将：</p>
                <ul>
                  <li>停止该账号的心跳连接</li>
                  <li>删除Redis中的所有登录数据</li>
                  <li>清理心跳日志和缓存</li>
                  <li><strong>此操作不可撤销！</strong></li>
                </ul>
              </div>
            </div>

            <div class="delete-options">
              <div class="option-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="logout-before-delete" checked>
                  <span class="checkmark"></span>
                  删除前先退出登录（推荐）
                </label>
                <small class="option-description">向微信服务器发送退出登录请求，然后删除本地数据</small>
              </div>
            </div>

            <div class="delete-actions">
              <button class="btn btn-secondary" onclick="window.apiApp.accountManager.closeDeleteConfirmModal()">
                <i class="fas fa-times"></i>
                取消
              </button>
              <button class="btn btn-danger" onclick="window.apiApp.accountManager.executeDeleteAccount('${wxid}', '${nickname}')">
                <i class="fas fa-trash-alt"></i>
                确认删除
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 移除可能存在的旧模态框
    const existingModal = document.getElementById('delete-confirm-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';

    // 添加动画效果
    const modal = document.getElementById('delete-confirm-modal');
    modal.classList.add('fade-in');

    // 移除动画类
    setTimeout(() => {
      modal.classList.remove('fade-in');
    }, 300);
  }

  closeDeleteConfirmModal() {
    const modal = document.getElementById('delete-confirm-modal');
    if (!modal) return;

    // 添加fade-out动画
    modal.classList.add('fade-out');

    setTimeout(() => {
      modal.remove();
      document.body.style.overflow = 'auto';
    }, 300);
  }

  async executeDeleteAccount(wxid, nickname) {
    try {
      // 获取删除选项
      const logoutFirst = document.getElementById('logout-before-delete')?.checked || false;

      this.app.showToast(`正在删除账号 ${nickname}...`, 'info');

      // 调用删除账号API，使用固定的API密钥（与其他接口保持一致）
      const response = await fetch(`/api/Login/DeleteAccount?wxid=${encodeURIComponent(wxid)}&logout=${logoutFirst}&api_key=api_kedaya`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // 检查HTTP状态码
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText.includes('<!DOCTYPE') ? ' (服务器返回了HTML页面，可能是路由配置问题)' : ''}`);
      }

      // 检查响应内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`服务器返回了非JSON响应: ${contentType || 'unknown'}. 响应内容: ${responseText.substring(0, 200)}...`);
      }

      const result = await response.json();

      if (result.Success) {
        this.app.showToast(`账号 ${nickname} 删除成功！`, 'success');

        // 关闭删除确认模态框
        this.closeDeleteConfirmModal();

        // 关闭账号详情模态框
        this.closeAccountDetailModal();

        // 延迟刷新账号列表
        setTimeout(() => {
          this.loadAccountsOverview();
        }, 1000);
      } else {
        this.app.showToast(`删除账号失败: ${result.Message}`, 'error');
      }
    } catch (error) {
      this.log('error', '删除账号失败', error.message);
      this.app.showToast(`删除账号失败: ${error.message}`, 'error');
    }
  }

  // ==================== 添加账号功能 ====================

  showAddAccountModal() {
    const modal = document.getElementById('add-account-modal');
    if (!modal) {
      console.error('添加账号模态框未找到');
      return;
    }

    // 使用更安全的方式处理body滚动
    this.lockBodyScroll();

    modal.style.display = 'flex';
    modal.classList.add('fade-in');

    // 初始化模态框
    this.initAddAccountModal();

    // 确保模态框内容适应屏幕大小
    this.adjustModalSize();

    // 确保模态框内容滚动到顶部
    setTimeout(() => {
      const modalBody = modal.querySelector('.api-modal-body');
      if (modalBody) {
        modalBody.scrollTop = 0;
      }
    }, 50);

    // 移除动画类
    setTimeout(() => {
      modal.classList.remove('fade-in');
    }, 300);
  }

  // 锁定body滚动，防止页面抖动
  lockBodyScroll() {
    // 保存当前滚动位置
    this.originalScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // 计算滚动条宽度
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // 设置body样式
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.originalScrollTop}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // 如果有滚动条，添加padding防止抖动
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  // 解锁body滚动
  unlockBodyScroll() {
    // 恢复body样式
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // 恢复滚动位置
    if (this.originalScrollTop) {
      window.scrollTo(0, this.originalScrollTop);
      this.originalScrollTop = 0;
    }
  }

  initAddAccountModal() {
    // 设置默认登录方式为扫码登录
    this.switchLoginMethod('qrcode');

    // 重置表单
    this.resetLoginForm();

    // 设置事件监听器
    this.setupAddAccountEventListeners();
  }

  resetLoginForm() {
    // 重置二维码状态 - 显示可点击的骨架屏
    const qrcodeDisplay = document.getElementById('qrcode-display');
    if (qrcodeDisplay) {
      qrcodeDisplay.innerHTML = `
        <div class="qrcode-skeleton qrcode-skeleton-clickable" id="get-qrcode-btn">
          <div class="qrcode-skeleton-placeholder">
            <div class="skeleton-qr-icon">
              <i class="fas fa-qrcode"></i>
            </div>
            <div class="skeleton-qr-text">点击获取二维码</div>
          </div>
        </div>
      `;
    }

    const statusElement = document.getElementById('qrcode-status');
    if (statusElement) {
      statusElement.textContent = '等待获取二维码';
      statusElement.className = 'qrcode-status';
    }

    // 重置按钮状态
    const getBtn = document.getElementById('get-qrcode-btn');
    const refreshBtn = document.getElementById('refresh-qrcode-btn');
    const actionsDiv = document.querySelector('.qrcode-actions');
    if (getBtn) {
      getBtn.removeAttribute('disabled');
    }
    if (refreshBtn && actionsDiv) {
      actionsDiv.style.display = 'none';
    }

    // 重置密码表单
    const passwordForm = document.getElementById('password-login-form');
    if (passwordForm) {
      passwordForm.reset();
    }

    // 自动填充设备ID和设备名称的默认值
    this.fillDefaultDeviceInfo();

    // 停止二维码状态检查
    if (this.qrcodeCheckTimer) {
      clearInterval(this.qrcodeCheckTimer);
      this.qrcodeCheckTimer = null;
    }
  }

  setupAddAccountEventListeners() {
    // 事件监听器已在events.js中设置，这里只做模态框特定的初始化
    // 避免重复绑定事件监听器

    // 设备ID输入验证
    const deviceIdInput = document.getElementById('device-id-input');
    if (deviceIdInput) {
      // 移除之前的事件监听器（如果存在）
      deviceIdInput.removeEventListener('blur', this.handleDeviceIdValidation);
      deviceIdInput.removeEventListener('input', this.handleDeviceIdInput);

      // 添加新的事件监听器
      this.handleDeviceIdValidation = (e) => {
        const validation = this.validateDeviceId(e.target.value);
        if (!validation.valid && e.target.value.trim()) {
          this.showInputValidationError('device-id-input', validation.message);
        } else {
          this.clearInputValidationError('device-id-input');
        }
      };

      this.handleDeviceIdInput = (e) => {
        // 实时清除错误提示
        if (e.target.value.trim()) {
          this.clearInputValidationError('device-id-input');
        }
      };

      deviceIdInput.addEventListener('blur', this.handleDeviceIdValidation);
      deviceIdInput.addEventListener('input', this.handleDeviceIdInput);
    }

    // 设备名称输入验证
    const deviceNameInput = document.getElementById('device-name-input');
    if (deviceNameInput) {
      // 移除之前的事件监听器（如果存在）
      deviceNameInput.removeEventListener('blur', this.handleDeviceNameValidation);
      deviceNameInput.removeEventListener('input', this.handleDeviceNameInput);

      // 添加新的事件监听器
      this.handleDeviceNameValidation = (e) => {
        const validation = this.validateDeviceName(e.target.value);
        if (!validation.valid && e.target.value.trim()) {
          this.showInputValidationError('device-name-input', validation.message);
        } else {
          this.clearInputValidationError('device-name-input');
        }
      };

      this.handleDeviceNameInput = (e) => {
        // 实时清除错误提示
        if (e.target.value.trim()) {
          this.clearInputValidationError('device-name-input');
        }
      };

      deviceNameInput.addEventListener('blur', this.handleDeviceNameValidation);
      deviceNameInput.addEventListener('input', this.handleDeviceNameInput);
    }

    // 重新生成设备ID按钮
    const regenerateDeviceIdBtn = document.getElementById('regenerate-device-id-btn');
    if (regenerateDeviceIdBtn) {
      regenerateDeviceIdBtn.removeEventListener('click', this.handleRegenerateDeviceId);
      this.handleRegenerateDeviceId = () => {
        const deviceIdInput = document.getElementById('device-id-input');
        if (deviceIdInput) {
          deviceIdInput.value = this.generateRandomDeviceId();
          this.clearInputValidationError('device-id-input');
          // 添加一个简单的动画效果
          deviceIdInput.style.backgroundColor = 'var(--success-light)';
          setTimeout(() => {
            deviceIdInput.style.backgroundColor = '';
          }, 300);
        }
      };
      regenerateDeviceIdBtn.addEventListener('click', this.handleRegenerateDeviceId);
    }

    // 重新生成设备名称按钮
    const regenerateDeviceNameBtn = document.getElementById('regenerate-device-name-btn');
    if (regenerateDeviceNameBtn) {
      regenerateDeviceNameBtn.removeEventListener('click', this.handleRegenerateDeviceName);
      this.handleRegenerateDeviceName = () => {
        const deviceNameInput = document.getElementById('device-name-input');
        if (deviceNameInput) {
          deviceNameInput.value = this.generateRandomDeviceName();
          this.clearInputValidationError('device-name-input');
          // 添加一个简单的动画效果
          deviceNameInput.style.backgroundColor = 'var(--success-light)';
          setTimeout(() => {
            deviceNameInput.style.backgroundColor = '';
          }, 300);
        }
      };
      regenerateDeviceNameBtn.addEventListener('click', this.handleRegenerateDeviceName);
    }

    // 批量重新生成设备信息按钮
    const regenerateAllBtn = document.getElementById('regenerate-all-device-info-btn');
    if (regenerateAllBtn) {
      regenerateAllBtn.removeEventListener('click', this.handleRegenerateAllDeviceInfo);
      this.handleRegenerateAllDeviceInfo = () => {
        const deviceIdInput = document.getElementById('device-id-input');
        const deviceNameInput = document.getElementById('device-name-input');

        if (deviceIdInput) {
          deviceIdInput.value = this.generateRandomDeviceId();
          this.clearInputValidationError('device-id-input');
          // 添加动画效果
          deviceIdInput.style.backgroundColor = 'var(--success-light)';
          setTimeout(() => {
            deviceIdInput.style.backgroundColor = '';
          }, 300);
        }

        if (deviceNameInput) {
          deviceNameInput.value = this.generateRandomDeviceName();
          this.clearInputValidationError('device-name-input');
          // 添加动画效果
          deviceNameInput.style.backgroundColor = 'var(--success-light)';
          setTimeout(() => {
            deviceNameInput.style.backgroundColor = '';
          }, 300);
        }

        this.app.showToast('设备信息已重新生成', 'success');
      };
      regenerateAllBtn.addEventListener('click', this.handleRegenerateAllDeviceInfo);
    }
  }

  closeAddAccountModal() {
    const modal = document.getElementById('add-account-modal');
    if (!modal || modal.style.display === 'none') {
      return; // 避免重复关闭
    }

    modal.classList.add('fade-out');

    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('fade-out');

      // 使用新的解锁函数恢复body滚动
      this.unlockBodyScroll();

      // 清理状态
      this.cleanupAddAccountModal();
    }, 300);
  }

  cleanupAddAccountModal() {
    // 清理定时器
    if (this.qrcodeCheckTimer) {
      clearInterval(this.qrcodeCheckTimer);
      this.qrcodeCheckTimer = null;
    }

    // 移除事件监听器（通过重新设置innerHTML来清理）
    // 这里可以根据需要进行更精细的清理
  }

  // 调整模态框大小以适应屏幕
  adjustModalSize() {
    const modal = document.getElementById('add-account-modal');
    const modalContent = modal?.querySelector('.add-account-modal-content');

    if (!modalContent) return;

    // 获取视口高度
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 小屏幕优化
    if (viewportHeight < 600 || viewportWidth < 500) {
      modalContent.style.maxHeight = '98vh';
      modalContent.style.width = '98%';

      // 调整内边距
      const modalBody = modalContent.querySelector('.api-modal-body');
      if (modalBody) {
        modalBody.style.padding = '12px';
      }

      // 调整二维码大小
      const qrcodeDisplay = modalContent.querySelector('.qrcode-display');
      if (qrcodeDisplay) {
        qrcodeDisplay.style.width = '200px';
        qrcodeDisplay.style.height = '200px';
      }
    } else {
      // 恢复默认样式
      modalContent.style.maxHeight = '';
      modalContent.style.width = '';

      const modalBody = modalContent.querySelector('.api-modal-body');
      if (modalBody) {
        modalBody.style.padding = '';
      }

      const qrcodeDisplay = modalContent.querySelector('.qrcode-display');
      if (qrcodeDisplay) {
        qrcodeDisplay.style.width = '';
        qrcodeDisplay.style.height = '';
      }
    }
  }

  refreshQRCode() {
    // 重置状态并重新获取二维码
    this.resetLoginForm();
    this.getQRCode();
  }

  updateQRCodeStatus(message, type = '') {
    const statusElement = document.getElementById('qrcode-status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `qrcode-status ${type}`;
    }
  }

  switchLoginMethod(method) {
    // 添加空值检查，确保DOM元素存在
    const methodTabs = document.querySelectorAll('.method-tab');
    if (methodTabs.length === 0) {
      console.warn('Method tabs not found, DOM may not be ready');
      return;
    }

    // 更新标签状态
    methodTabs.forEach(tab => {
      tab.classList.remove('active');
    });

    const activeTab = document.querySelector(`[data-method="${method}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    // 切换内容显示 - 使用原始文件中的方式
    const qrcodeContent = document.getElementById('qrcode-login-content');
    const passwordContent = document.getElementById('password-login-content');

    if (qrcodeContent && passwordContent) {
      qrcodeContent.style.display = method === 'qrcode' ? 'block' : 'none';
      passwordContent.style.display = method === 'password' ? 'block' : 'none';
    }

    // 如果切换到二维码登录，显示骨架屏等待用户点击
    if (method === 'qrcode') {
      this.resetLoginForm(); // 显示骨架屏状态
    }

    // 确保设备信息已填充（对两种登录方式都适用）
    this.fillDefaultDeviceInfo();
  }



  async getQRCode() {
    const deviceVersion = document.getElementById('device-version-select')?.value || 'ipad';

    // 获取自定义设备信息，如果没有则使用默认值
    let deviceId = document.getElementById('device-id-input')?.value?.trim();
    let deviceName = document.getElementById('device-name-input')?.value?.trim();

    // 如果输入框为空，生成默认值
    if (!deviceId) {
      deviceId = this.generateRandomDeviceId();
      const deviceIdInput = document.getElementById('device-id-input');
      if (deviceIdInput) {
        deviceIdInput.value = deviceId;
      }
    }

    if (!deviceName) {
      deviceName = this.generateRandomDeviceName();
      const deviceNameInput = document.getElementById('device-name-input');
      if (deviceNameInput) {
        deviceNameInput.value = deviceName;
      }
    }

    // 验证设备信息
    const deviceIdValidation = this.validateDeviceId(deviceId);
    if (!deviceIdValidation.valid) {
      this.app.showToast(`设备ID格式错误: ${deviceIdValidation.message}`, 'error');
      return;
    }

    const deviceNameValidation = this.validateDeviceName(deviceName);
    if (!deviceNameValidation.valid) {
      this.app.showToast(`设备名称格式错误: ${deviceNameValidation.message}`, 'error');
      return;
    }

    try {
      // 显示加载状态
      this.showQRCodeLoading();

      // 构建请求参数 - 根据GetQRReq结构
      const requestData = {
        DeviceName: deviceName,
        DeviceID: deviceId,
        Proxy: {} // 空的代理对象
      };

      // 根据设备版本选择对应的API
      const apiEndpoint = this.getQRCodeApiEndpoint(deviceVersion);

      const response = await fetch(`/api${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 检查响应是否为JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`服务器返回了非JSON响应: ${text.substring(0, 100)}...`);
      }

      const result = await response.json();

      if (result.Success && result.Data) {
        // 显示二维码
        this.displayQRCode(result.Data);

        // 开始检测二维码状态 - 使用正确的uuid字段
        const uuid = result.Data.uuid || result.Data.Uuid;
        if (uuid) {
          this.startQRCodeCheck(uuid);
          this.app.showToast('二维码获取成功，请使用微信扫码登录', 'success');
        } else {
          throw new Error('二维码数据中缺少UUID');
        }
      } else {
        throw new Error(result.Message || '获取二维码失败');
      }

    } catch (error) {
      console.error('获取二维码失败:', error);
      this.app.showToast(`获取二维码失败: ${error.message}`, 'error');
      this.hideQRCodeLoading();
    }
  }

  showQRCodeLoading() {
    const qrcodeDisplay = document.getElementById('qrcode-display');
    if (qrcodeDisplay) {
      this.app.utils.showLoadingSpinner(qrcodeDisplay, '正在获取二维码...');
    }

    const statusElement = document.getElementById('qrcode-status');
    if (statusElement) {
      statusElement.textContent = '正在获取二维码...';
      statusElement.className = 'qrcode-status';
    }

    // 禁用获取按钮/骨架屏
    const getBtn = document.getElementById('get-qrcode-btn');
    if (getBtn) {
      getBtn.setAttribute('disabled', 'true');
    }
  }

  hideQRCodeLoading() {
    // 显示错误状态的可点击骨架屏
    const qrcodeDisplay = document.getElementById('qrcode-display');
    if (qrcodeDisplay) {
      qrcodeDisplay.innerHTML = `
        <div class="qrcode-skeleton qrcode-skeleton-clickable qrcode-skeleton-error" id="get-qrcode-btn">
          <div class="qrcode-skeleton-placeholder">
            <div class="skeleton-qr-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="skeleton-qr-text">点击重试获取二维码</div>
          </div>
        </div>
      `;
    }

    // 更新状态文字
    const statusElement = document.getElementById('qrcode-status');
    if (statusElement) {
      statusElement.textContent = '获取二维码失败，请重试';
      statusElement.className = 'qrcode-status error';
    }
  }

  displayQRCode(qrcodeData) {
    const qrcodeDisplay = document.getElementById('qrcode-display');

    // 根据API响应结构，二维码可能在不同字段中
    let qrcodeUrl = null;

    if (qrcodeData.QrBase64) {
      qrcodeUrl = qrcodeData.QrBase64;
    } else if (qrcodeData.QrUrl) {
      qrcodeUrl = qrcodeData.QrUrl;
    } else if (qrcodeData.qrUrl) {
      qrcodeUrl = qrcodeData.qrUrl;
    } else if (qrcodeData.qrcode) {
      qrcodeUrl = qrcodeData.qrcode;
    } else {
      // 如果没有找到二维码URL，尝试查看完整的数据结构
      console.log('二维码数据结构:', qrcodeData);
      throw new Error('二维码数据格式错误，未找到二维码图片');
    }

    if (qrcodeDisplay) {
      qrcodeDisplay.innerHTML = `
        <div class="qrcode-display-container">
          <div class="qrcode-image-wrapper">
            <img src="${qrcodeUrl}" alt="登录二维码" class="qrcode-image" />
          </div>
          <div class="qrcode-tips">
            <i class="fas fa-mobile-alt"></i>
            <p>请使用微信扫描二维码登录</p>
          </div>
        </div>
      `;
    }

    const statusElement = document.getElementById('qrcode-status');
    if (statusElement) {
      statusElement.innerHTML = '请使用微信扫描二维码登录 <span class="qrcode-action-link" id="refresh-qrcode-btn"><i class="fas fa-sync-alt"></i> 刷新二维码</span>';
      statusElement.className = 'qrcode-status';
    }
  }

  refreshQRCode() {
    this.getQRCode();
  }

  startQRCodeCheck(uuid) {
    // 清除之前的检查间隔
    if (this.qrcodeCheckTimer) {
      clearInterval(this.qrcodeCheckTimer);
    }

    // 每2秒检查一次二维码状态
    this.qrcodeCheckTimer = setInterval(async () => {
      try {
        await this.checkQRCodeStatus(uuid);
      } catch (error) {
        console.error('检测二维码状态失败:', error);
      }
    }, 2000);

    // 设置5分钟超时
    setTimeout(() => {
      if (this.qrcodeCheckTimer) {
        clearInterval(this.qrcodeCheckTimer);
        this.showQRCodeExpired();
      }
    }, 300000); // 5分钟
  }

  async checkQRCodeStatus(uuid) {
    try {
      const response = await fetch(`/api/Login/LoginCheckQR`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `uuid=${encodeURIComponent(uuid)}`
      });

      const result = await response.json();

      if (result.Success && result.Message === "登录成功") {
        // 登录成功
        clearInterval(this.qrcodeCheckTimer);
        this.qrcodeCheckTimer = null;

        this.updateQRCodeStatus('登录成功！正在初始化...', 'success');
        this.app.showToast('扫码登录成功！', 'success');

        // 执行二次登录
        if (result.Data && result.Data.wxid) {
          await this.performSecondAuth(result.Data.wxid);
        }

        // 关闭模态框并刷新账号列表
        setTimeout(() => {
          this.closeAddAccountModal();
          this.loadAccountsOverview();
        }, 2000);

      } else if (result.Success && result.Data) {
        // API调用成功，根据Data中的状态判断
        const data = result.Data;

        if (data.expiredTime <= 0) {
          // 二维码已过期
          clearInterval(this.qrcodeCheckTimer);
          this.qrcodeCheckTimer = null;
          this.updateQRCodeStatus('二维码已过期，请刷新二维码', 'error');
          this.showQRCodeExpired();

        } else if (data.status === 0) {
          // 等待扫码
          this.updateQRCodeStatus(`等待扫码... (${data.expiredTime}秒后过期)`, 'warning');

        } else if (data.status === 1) {
          // 已扫码，显示用户信息，等待确认
          this.showUserScannedInfo(data);
          this.updateQRCodeStatus(`${data.nickName || '用户'}已扫码，请在手机上确认登录 (${data.expiredTime}秒后过期)`, 'warning');

        } else if (data.status === 4) {
          // 用户取消登录
          clearInterval(this.qrcodeCheckTimer);
          this.qrcodeCheckTimer = null;
          // 不在状态栏显示取消信息，而是通过遮罩层显示
          this.showQRCodeCancelled(data);

        } else {
          // 其他状态
          this.updateQRCodeStatus(`状态: ${data.status} (${data.expiredTime}秒后过期)`, 'warning');
        }

      } else {
        // API调用失败
        console.error('二维码检测失败:', result);
        this.updateQRCodeStatus(`检测失败: ${result.Message || '未知错误'}`, 'error');
      }
    } catch (error) {
      console.error('检测二维码状态失败:', error);
      this.updateQRCodeStatus('网络错误，检测失败', 'error');
    }
  }

  async performSecondAuth(wxid) {
    try {
      const response = await fetch(`/api/Login/LoginTwiceAutoAuth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `wxid=${encodeURIComponent(wxid)}`
      });

      const result = await response.json();

      if (result.Success) {
        this.app.showToast('账号初始化成功！', 'success');
      } else {
        this.app.showToast(`账号初始化失败: ${result.Message}`, 'warning');
      }

    } catch (error) {
      console.error('二次认证失败:', error);
      this.app.showToast('账号初始化失败，请手动重连', 'warning');
    }
  }

  showUserScannedInfo(data) {
    const qrcodeDisplay = document.getElementById('qrcode-display');

    // 如果有用户头像和昵称，显示用户信息覆盖层
    if (data.headImgUrl && data.nickName) {
      // 移除之前的用户信息覆盖层
      const existingOverlay = qrcodeDisplay.querySelector('.user-scanned-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // 创建用户信息覆盖层
      const userOverlay = document.createElement('div');
      userOverlay.className = 'user-scanned-overlay';
      userOverlay.innerHTML = `
        <div class="user-info">
          <img src="${data.headImgUrl}"
               alt="用户头像"
               class="user-avatar"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="avatar-fallback" style="display: none; width: 80px; height: 80px; border-radius: 50%; background: var(--primary-color); color: white; align-items: center; justify-content: center; font-size: 24px; font-weight: 600;">
            ${data.nickName ? data.nickName.charAt(0).toUpperCase() : '?'}
          </div>
          <div class="user-details">
            <div class="user-nickname">${data.nickName}</div>
            <div class="scan-status">已扫码，请确认登录</div>
          </div>
        </div>
        <div class="confirm-hint">
          <i class="fas fa-mobile-alt"></i>
          请在手机上确认登录
        </div>
      `;

      qrcodeDisplay.appendChild(userOverlay);
    }
  }

  showQRCodeScanned(data) {
    const qrcodeDisplay = document.getElementById('qrcode-display');

    // 如果有用户头像和昵称，显示用户信息覆盖层
    if (data.headImgUrl && data.nickName) {
      // 移除之前的用户信息覆盖层
      const existingOverlay = qrcodeDisplay.querySelector('.user-scanned-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // 创建用户信息覆盖层
      const userOverlay = document.createElement('div');
      userOverlay.className = 'user-scanned-overlay';
      userOverlay.innerHTML = `
        <div class="user-info">
          <img src="${data.headImgUrl}" alt="用户头像" class="user-avatar" />
          <div class="user-details">
            <div class="user-nickname">${data.nickName}</div>
            <div class="scan-status">已扫码，请确认登录</div>
          </div>
        </div>
        <div class="confirm-hint">
          <i class="fas fa-mobile-alt"></i>
          请在手机上确认登录
        </div>
      `;

      qrcodeDisplay.appendChild(userOverlay);
    }
  }

  showQRCodeConfirmed(data) {
    const qrcodeDisplay = document.getElementById('qrcode-display');

    // 移除之前的覆盖层
    const existingOverlay = qrcodeDisplay.querySelector('.user-scanned-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // 创建登录成功覆盖层
    const successOverlay = document.createElement('div');
    successOverlay.className = 'qrcode-success-overlay';
    successOverlay.innerHTML = `
      <div class="success-info">
        <i class="fas fa-check-circle"></i>
        <div class="success-message">登录成功</div>
        ${data.nickName ? `<div class="success-user">欢迎 ${data.nickName}</div>` : ''}
      </div>
      <div class="success-hint">
        正在跳转...
      </div>
    `;

    qrcodeDisplay.appendChild(successOverlay);
    this.app.showToast('登录成功！', 'success');
  }

  showQRCodeCancelled(data) {
    const qrcodeDisplay = document.getElementById('qrcode-display');

    // 移除之前的覆盖层
    const existingOverlay = qrcodeDisplay.querySelector('.user-scanned-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // 创建取消登录覆盖层
    const cancelOverlay = document.createElement('div');
    cancelOverlay.className = 'qrcode-cancelled-overlay';
    cancelOverlay.innerHTML = `
      <div class="cancel-info">
        <i class="fas fa-times-circle"></i>
        <div class="cancel-message">用户取消登录</div>
        ${data.nickName ? `<div class="cancel-user">${data.nickName} 取消了登录</div>` : ''}
      </div>
      <button class="btn btn-primary" onclick="window.apiApp.accountManager.refreshQRCode()">
        <i class="fas fa-sync-alt"></i>
        重新获取二维码
      </button>
    `;

    qrcodeDisplay.appendChild(cancelOverlay);
  }

  showQRCodeExpired() {
    const qrcodeDisplay = document.getElementById('qrcode-display');

    qrcodeDisplay.innerHTML = `
      <div class="qrcode-expired">
        <i class="fas fa-clock fa-2x"></i>
        <p>二维码已过期</p>
        <button class="btn btn-primary" onclick="window.apiApp.accountManager.refreshQRCode()">
          <i class="fas fa-sync-alt"></i>
          重新获取二维码
        </button>
      </div>
    `;
  }

  async passwordLogin() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const deviceId = document.getElementById('device-id-input').value.trim();
    const deviceName = document.getElementById('device-name-input').value.trim();
    const proxy = document.getElementById('proxy-input').value.trim();
    const deviceVersion = document.getElementById('device-version-select').value;

    // 清除之前的验证错误
    this.clearInputValidationError('username-input');
    this.clearInputValidationError('password-input');
    this.clearInputValidationError('device-id-input');
    this.clearInputValidationError('device-name-input');

    // 基本验证
    if (!username || !password) {
      this.app.showToast('请输入用户名和密码', 'error');
      return;
    }

    // 验证设备ID
    const deviceIdValidation = this.validateDeviceId(deviceId);
    if (!deviceIdValidation.valid) {
      this.showInputValidationError('device-id-input', deviceIdValidation.message);
      this.app.showToast('设备ID格式错误', 'error');
      return;
    }

    // 验证设备名称
    const deviceNameValidation = this.validateDeviceName(deviceName);
    if (!deviceNameValidation.valid) {
      this.showInputValidationError('device-name-input', deviceNameValidation.message);
      this.app.showToast('设备名称格式错误', 'error');
      return;
    }

    try {
      // 显示加载状态
      const submitBtn = document.querySelector('#password-login-form button[type="submit"]');
      if (!submitBtn) {
        this.app.showToast('找不到提交按钮', 'error');
        return;
      }

      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
      submitBtn.disabled = true;

      // 根据设备版本构建不同的请求参数
      let requestData;
      const apiEndpoint = this.getPasswordLoginApiEndpoint(deviceVersion);

      if (apiEndpoint.includes('A16Data')) {
        // A16LoginParam 结构
        requestData = {
          UserName: username,
          Password: password,
          A16: deviceId, // 使用自定义设备ID
          DeviceName: deviceName,
          Proxy: proxy ? this.parseProxy(proxy) : {}
        };
      } else {
        // Data62LoginReq 结构
        requestData = {
          UserName: username,
          Password: password,
          Data62: deviceId, // 使用自定义设备ID
          DeviceName: deviceName,
          Proxy: proxy ? this.parseProxy(proxy) : {}
        };
      }

      const response = await fetch(`/api${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (result.Success) {
        this.app.showToast('登录成功！', 'success');

        // 如果需要二次验证
        if (result.Data && typeof result.Data === 'object' && result.Data.QrUrl) {
          this.app.showToast('需要短信验证，请查看二维码', 'warning');
          // 这里可以处理短信验证的逻辑
        }

        // 关闭模态框并刷新账号列表
        setTimeout(() => {
          this.closeAddAccountModal();
          this.loadAccountsOverview();
        }, 1500);

      } else {
        throw new Error(result.Message || '登录失败');
      }

    } catch (error) {
      console.error('密码登录失败:', error);
      this.app.showToast(`登录失败: ${error.message}`, 'error');
    } finally {
      // 恢复按钮状态
      const submitBtn = document.querySelector('#password-login-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
        submitBtn.disabled = false;
      }
    }
  }

  getPasswordLoginApiEndpoint(deviceVersion) {
    // 大部分设备版本使用Data62登录
    const apiMap = {
      'android': '/Login/A16Data',
      'androidpad': '/Login/A16Data',
      'androidpadx': '/Login/A16Data'
    };

    return apiMap[deviceVersion] || '/Login/Data62Login';
  }

  getDeviceNameByVersion(deviceVersion) {
    const deviceNameMap = {
      'ipad': 'iPad Pro 13(M4)',
      'ipadx': 'iPad Pro 13(M4)',
      'android': 'HUAWEI Mate XT',
      'androidpad': 'HUAWEI MatePad Pro',
      'androidpadx': 'HUAWEI MatePad Pro',
      'windows': 'DESKTOP-P0QLAW8',
      'windowsuwp': 'DESKTOP-P0QLAW8',
      'windowsunified': 'DESKTOP-P0QLAW8',
      'mac': 'MacBook Pro',
      'car': 'Xiaomi-M2012K11AC'
    };

    return deviceNameMap[deviceVersion] || 'Default Device';
  }

  generateA16() {
    // 生成A16参数 - 这是一个简化版本，实际可能需要更复杂的逻辑
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 15);
    return timestamp + random;
  }

  // ==================== 设备信息生成功能 ====================

  /**
   * 生成随机设备ID
   * 格式类似：49a1b2c3d4e5f6789012345678901234
   */
  generateRandomDeviceId() {
    // 生成15位随机字符串
    const randomStr = this.generateRandomString(15);
    // 使用简单的哈希算法模拟MD5
    const hash = this.simpleHash(randomStr);
    // 添加前缀"49"并截取到32位
    return "49" + hash.substring(2, 32);
  }

  /**
   * 生成随机设备名称
   * 格式：设备_YYYYMMDD_HHMMSS 或 Device_随机数字
   */
  generateRandomDeviceName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    const randomNum = Math.floor(Math.random() * 9999) + 1000;

    // 随机选择一种格式
    const formats = [
      `设备_${year}${month}${day}_${hour}${minute}${second}`,
      `Device_${randomNum}`,
      `微信设备_${randomNum}`,
      `WX_Device_${year}${month}${day}`,
      `用户设备_${hour}${minute}${second}`
    ];

    return formats[Math.floor(Math.random() * formats.length)];
  }

  /**
   * 生成随机字符串
   */
  generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 简单哈希函数（模拟MD5）
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(16).padStart(32, '0');

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }

    // 转换为16进制并补齐到32位
    const hexHash = Math.abs(hash).toString(16);
    return (hexHash + this.generateRandomString(32 - hexHash.length)).substring(0, 32);
  }

  /**
   * 填充默认设备信息
   */
  fillDefaultDeviceInfo() {
    const deviceIdInput = document.getElementById('device-id-input');
    const deviceNameInput = document.getElementById('device-name-input');

    if (deviceIdInput && !deviceIdInput.value.trim()) {
      deviceIdInput.value = this.generateRandomDeviceId();
    }

    if (deviceNameInput && !deviceNameInput.value.trim()) {
      deviceNameInput.value = this.generateRandomDeviceName();
    }
  }

  /**
   * 验证设备ID格式
   */
  validateDeviceId(deviceId) {
    if (!deviceId || deviceId.trim().length === 0) {
      return { valid: false, message: '设备ID不能为空' };
    }

    const trimmedId = deviceId.trim();

    // 检查长度（16-32位）
    if (trimmedId.length < 16 || trimmedId.length > 32) {
      return { valid: false, message: '设备ID长度应在16-32位之间' };
    }

    // 移除字符限制，允许任何字符
    return { valid: true, message: '' };
  }

  /**
   * 验证设备名称格式
   */
  validateDeviceName(deviceName) {
    if (!deviceName || deviceName.trim().length === 0) {
      return { valid: false, message: '设备名称不能为空' };
    }

    const trimmedName = deviceName.trim();

    // 检查长度（1-50位）
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      return { valid: false, message: '设备名称长度应在1-50位之间' };
    }

    // 检查特殊字符（不允许某些特殊字符）
    const invalidChars = /[<>:"\/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmedName)) {
      return { valid: false, message: '设备名称包含无效字符' };
    }

    return { valid: true, message: '' };
  }

  /**
   * 显示输入验证错误
   */
  showInputValidationError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // 移除之前的错误提示
    const existingError = input.parentNode.querySelector('.validation-error');
    if (existingError) {
      existingError.remove();
    }

    // 添加错误样式
    input.classList.add('is-invalid');

    // 创建错误提示元素
    const errorElement = document.createElement('div');
    errorElement.className = 'validation-error text-danger mt-1';
    errorElement.style.fontSize = '0.875rem';
    errorElement.textContent = message;

    // 插入错误提示
    input.parentNode.appendChild(errorElement);
  }

  /**
   * 清除输入验证错误
   */
  clearInputValidationError(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // 移除错误样式
    input.classList.remove('is-invalid');

    // 移除错误提示
    const existingError = input.parentNode.querySelector('.validation-error');
    if (existingError) {
      existingError.remove();
    }
  }

  parseProxy(proxyString) {
    // 解析代理字符串为ProxyInfo对象
    if (!proxyString || proxyString.trim() === '') {
      return {};
    }

    try {
      // 假设格式为 host:port
      const parts = proxyString.split(':');
      if (parts.length === 2) {
        return {
          Host: parts[0].trim(),
          Port: parseInt(parts[1].trim()),
          Type: "socks5" // 默认类型
        };
      }
    } catch (error) {
      console.warn('代理格式解析失败:', error);
    }

    return {};
  }

  getQRCodeApiEndpoint(deviceVersion) {
    const apiMap = {
      'ipad': '/Login/LoginGetQR',
      'ipadx': '/Login/LoginGetQRx',
      'android': '/Login/LoginGetQRPad', // Android Pad
      'androidpad': '/Login/LoginGetQRPad',
      'androidpadx': '/Login/LoginGetQRPadx',
      'windows': '/Login/LoginGetQRWin',
      'windowsuwp': '/Login/LoginGetQRWinUwp',
      'windowsunified': '/Login/LoginGetQRWinUnified',
      'mac': '/Login/LoginGetQRMac',
      'car': '/Login/LoginGetQRCar'
    };

    return apiMap[deviceVersion] || '/Login/LoginGetQR';
  }





  // 生成重新连接按钮
  generateReconnectButtons(wxid) {
    return `
      <div class="reconnect-buttons">
        <div class="reconnect-row">
          <button class="btn btn-primary reconnect-btn" onclick="window.apiApp.accountManager.reconnectAccount('${wxid}', 'auto')">
            <i class="fas fa-sync-alt"></i>
            自动重连
          </button>
          <button class="btn btn-secondary reconnect-btn" onclick="window.apiApp.accountManager.reconnectAccount('${wxid}', 'awaken')">
            <i class="fas fa-power-off"></i>
            唤醒登录
          </button>
        </div>
        <div class="reconnect-row">
          <button class="btn btn-success reconnect-btn" onclick="window.apiApp.accountManager.reconnectAccount('${wxid}', 'heartbeat')">
            <i class="fas fa-heartbeat"></i>
            开启心跳
          </button>
          <button class="btn btn-info reconnect-btn" onclick="window.apiApp.accountManager.reconnectAccount('${wxid}', 'init')">
            <i class="fas fa-cog"></i>
            重新初始化
          </button>
        </div>
      </div>
    `;
  }
}
