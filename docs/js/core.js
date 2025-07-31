// 核心应用模块 - APIDocsApp 主类
// 负责应用的初始化、模块协调和核心状态管理

// 导入所有模块
import { DataProcessor } from './data.js';
import { UIRenderer } from './ui.js';
import { EventHandler } from './events.js';
import { APITester } from './api-test.js';
import { AccountManager } from './account.js';
import { ConfigManager } from './config.js';
import { Utils } from './utils.js';
import { checkApiKey, initAuth } from './auth.js';
import { themeManager } from './theme.js';

export class APIDocsApp {
  constructor() {
    // 核心数据
    this.apiData = null;
    this.filteredAPIs = [];
    this.currentView = 'list';
    this.sidebarCollapsed = false;
    this.accountsData = [];
    
    // 配置信息
    this.config = {
      defaultWxid: '',
      baseUrl: `${window.location.protocol}//${window.location.host}/api`,
      timeout: 10000
    };

    // 分类中文翻译映射
    this.categoryTranslations = {
      'Login': '登录管理',
      'Friend': '好友管理',
      'Group': '群组管理',
      'Msg': '消息管理',
      'User': '用户管理',
      'Tools': '工具功能',
      'TenPay': '支付功能',
      'Favor': '收藏管理',
      'Label': '标签管理',
      'Finder': '发现功能',
      'FriendCircle': '朋友圈',
      'Wxapp': '小程序',
      'OfficialAccounts': '公众号',
      'QWContact': '企业联系人',
      'SayHello': '打招呼',
      '未分类': '其他功能'
    };

    // 初始化模块
    this.initModules();
    
    // 启动应用
    this.init();
  }

  initModules() {
    // 初始化各个功能模块
    this.dataProcessor = new DataProcessor(this);
    this.uiRenderer = new UIRenderer(this);
    this.eventHandler = new EventHandler(this);
    this.apiTester = new APITester(this);
    this.accountManager = new AccountManager(this);
    this.configManager = new ConfigManager(this);
    this.utils = new Utils(this);

    // 主题管理器已经在导入时自动初始化
    this.themeManager = themeManager;
  }

  async init() {
    try {
      // 首先检查API密钥验证状态并初始化认证模块
      const hasValidKey = checkApiKey();
      if (hasValidKey) {
        // 如果有有效密钥，初始化认证模块（包括添加登出按钮）
        initAuth();
      }

      this.utils.showLoading(true);
      await this.dataProcessor.loadAPIData();
      this.eventHandler.setupEventListeners();
      this.uiRenderer.renderCategories();
      this.uiRenderer.renderAPIs();
      this.uiRenderer.updateStats();
      this.utils.loadConfig();
      this.uiRenderer.adjustContentArea(); // 初始化时调整内容区域
      this.utils.showLoading(false);

      // 立即显示骨架屏，然后加载数据
      this.uiRenderer.initializeSkeletonScreens();

      // 延迟加载数据以展示骨架屏效果
      setTimeout(async () => {
        await this.accountManager.loadAccountsOverview();
        await this.accountManager.loadSystemInfo();
      }, 100); // 减少延迟，让骨架屏立即显示

    } catch (error) {
      console.error('初始化失败:', error);
      this.utils.showToast('初始化失败，请刷新页面重试', 'error');
      this.utils.showLoading(false);
    }
  }

  // 导航和视图切换方法
  switchSection(sectionId) {
    // 更新桌面端导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const desktopNavItem = document.querySelector(`[href="#${sectionId}"]`);
    if (desktopNavItem) {
      desktopNavItem.classList.add('active');
    }

    // 更新移动端导航状态
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const mobileNavItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (mobileNavItem) {
      mobileNavItem.classList.add('active');
    }

    // 切换内容区域
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`${sectionId}-section`).classList.add('active');

    // 如果切换到配置页面，加载配置数据
    if (sectionId === 'config') {
      this.configManager.loadConfigData();
    }
  }

  switchView(view) {
    this.currentView = view;

    // 更新按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');

    // 重新渲染
    this.uiRenderer.renderAPIs();
  }

  // 分类选择方法
  selectCategory(category) {
    // 更新侧边栏状态
    document.querySelectorAll('.category-item').forEach(item => {
      item.classList.remove('active');
    });
    const categoryElement = document.querySelector(`[data-category="${category}"]`);
    if (categoryElement) {
      categoryElement.classList.add('active');
    }

    // 更新过滤器
    document.getElementById('category-filter').value = category;

    // 切换到API页面并过滤
    this.switchSection('apis');
    this.dataProcessor.filterAPIs();
  }

  // 搜索和过滤功能
  searchAPIs(query) {
    this.dataProcessor.searchAPIs(query);
  }

  filterAPIs() {
    this.dataProcessor.filterAPIs();
  }

  // API相关方法
  showAPIDetails(apiId) {
    this.apiTester.showAPIDetails(apiId);
  }

  testAPI(apiId) {
    this.apiTester.testAPI(apiId);
  }

  copyAPIInfo(apiId) {
    this.apiTester.copyAPIInfo(apiId);
  }

  executeAPI(apiId) {
    this.apiTester.executeAPI(apiId);
  }

  generateCode(apiId) {
    this.apiTester.generateCode(apiId);
  }

  generateCodeForLanguage(apiId, language) {
    this.apiTester.generateCodeForLanguage(apiId, language);
  }

  copyCurlCommand() {
    this.apiTester.copyCurlCommand();
  }

  copyFullURL(apiId) {
    this.apiTester.copyFullURL(apiId);
  }

  copyResponseResult() {
    this.apiTester.copyResponseResult();
  }

  copyResponseHeaders() {
    this.apiTester.copyResponseHeaders();
  }

  // 账号管理方法
  showAccountDetail(wxid) {
    this.accountManager.showAccountDetail(wxid);
  }

  reconnectAccount(wxid, type) {
    this.accountManager.reconnectAccount(wxid, type);
  }

  refreshAccounts() {
    this.accountManager.refreshAccounts();
  }

  refreshSystemInfo() {
    this.accountManager.refreshSystemInfo();
  }



  confirmDeleteAccount(wxid, nickname) {
    this.accountManager.confirmDeleteAccount(wxid, nickname);
  }

  // 配置管理方法
  showConfigModal() {
    this.utils.showConfigModal();
  }

  hideConfigModal() {
    this.utils.hideConfigModal();
  }

  saveConfig() {
    this.utils.saveConfig();
  }

  loadConfig() {
    this.utils.loadConfig();
  }

  // 工具方法
  showToast(message, type = 'info') {
    this.utils.showToast(message, type);
  }

  showLoading(show) {
    this.utils.showLoading(show);
  }

  // 获取分类相关方法
  getCategories() {
    return this.dataProcessor.getCategories();
  }

  getCategoryIcon(category) {
    return this.dataProcessor.getCategoryIcon(category);
  }

  translateCategory(category) {
    return this.categoryTranslations[category] || category;
  }

  // ==================== 账号管理便捷方法 ====================

  // 刷新账号列表的便捷方法
  async refreshAccounts() {
    await this.accountManager.refreshAccounts();
  }

  // 显示账号详情的便捷方法
  showAccountDetail(wxid) {
    this.accountManager.showAccountDetail(wxid);
  }

  // 关闭账号详情模态框的便捷方法
  closeAccountDetailModal() {
    this.accountManager.closeAccountDetailModal();
  }

  // ==================== 添加账号功能的便捷方法 ====================

  // 显示添加账号模态框
  showAddAccountModal() {
    this.accountManager.showAddAccountModal();
  }

  // 关闭添加账号模态框
  closeAddAccountModal() {
    this.accountManager.closeAddAccountModal();
  }

  // 切换登录方式
  switchLoginMethod(method) {
    this.accountManager.switchLoginMethod(method);
  }

  // 获取二维码
  getQRCode() {
    this.accountManager.getQRCode();
  }

  // 刷新二维码
  refreshQRCode() {
    this.accountManager.refreshQRCode();
  }

  // 密码登录
  passwordLogin() {
    this.accountManager.passwordLogin();
  }

  // ==================== 删除账号功能的便捷方法 ====================

  // 确认删除账号
  confirmDeleteAccount(wxid, nickname) {
    this.accountManager.confirmDeleteAccount(wxid, nickname);
  }

  // 显示删除账号模态框
  showDeleteAccountModal() {
    this.accountManager.showDeleteAccountModal();
  }

  // 关闭删除账号模态框
  closeDeleteAccountModal() {
    this.accountManager.closeDeleteAccountModal();
  }

  // 执行删除账号
  executeDeleteAccount() {
    this.accountManager.executeDeleteAccount();
  }

  // ==================== 重连功能的便捷方法 ====================

  // 重新连接账号
  reconnectAccount(wxid, type) {
    this.accountManager.reconnectAccount(wxid, type);
  }

  // ==================== 配置管理便捷方法 ====================

  // 加载配置数据
  loadConfigData() {
    this.configManager.loadConfigData();
  }

  // 保存配置项
  saveConfigItem(fileName, key, buttonElement) {
    this.configManager.saveConfigItem(fileName, key, buttonElement);
  }

  // 切换配置文件展开/收起
  toggleConfigFile(fileName) {
    this.configManager.toggleConfigFile(fileName);
  }

  // 搜索配置
  searchConfigs(searchTerm) {
    this.configManager.searchConfigs(searchTerm);
  }

  // 清除搜索
  clearSearch() {
    this.configManager.clearSearch();
  }

  // 备份配置
  backupConfigs() {
    this.configManager.backupConfigs();
  }

  // ==================== 工具方法便捷调用 ====================

  // 获取分类图标
  getCategoryIcon(category) {
    return this.utils.getCategoryIcon(category);
  }

  // 动画效果
  fadeOut(element, callback) {
    this.utils.fadeOut(element, callback);
  }

  fadeIn(element) {
    this.utils.fadeIn(element);
  }

  // 平滑替换内容
  smoothReplaceContent(container, newContent, delay) {
    this.utils.smoothReplaceContent(container, newContent, delay);
  }

  // 显示加载旋转器
  showLoadingSpinner(container, text) {
    this.utils.showLoadingSpinner(container, text);
  }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
  window.apiApp = new APIDocsApp();
  window.app = window.apiApp; // 保持向后兼容性
});
