// 配置管理模块
export class ConfigManager {
  constructor(app) {
    this.app = app;
    // 跟踪已修改的配置项
    this.modifiedConfigs = new Set();
    // 存储原始配置数据
    this.originalConfigData = {};
    // 演示模式状态
    this.demoMode = false;
    // 演示模式监听器
    this.demoModeListeners = [];
  }

  // ==================== 配置变更跟踪 ====================

  // 存储原始配置数据
  storeOriginalConfigData(processedFiles) {
    this.originalConfigData = {};
    processedFiles.forEach(file => {
      this.originalConfigData[file.fileName] = {};
      file.items.forEach(item => {
        this.originalConfigData[file.fileName][item.key] = item.value;
      });
    });
    console.log('原始配置数据已存储:', this.originalConfigData);
  }

  // 添加变更监听器
  addChangeListeners() {
    document.querySelectorAll('.config-input').forEach(input => {
      const fileName = input.closest('.config-file-card').dataset.fileName;
      const key = input.dataset.key;
      const configKey = `${fileName}.${key}`;

      // 监听输入变化
      input.addEventListener('input', () => {
        this.markConfigAsModified(fileName, key);
      });

      input.addEventListener('change', () => {
        this.markConfigAsModified(fileName, key);
      });
    });
  }

  // 标记配置为已修改
  markConfigAsModified(fileName, key) {
    const configKey = `${fileName}.${key}`;
    const input = document.querySelector(`[data-file="${fileName}"] [data-key="${key}"]`);

    if (input) {
      let currentValue;
      if (input.type === 'checkbox') {
        currentValue = input.checked;
      } else if (input.type === 'number') {
        currentValue = parseFloat(input.value) || 0;
      } else {
        currentValue = input.value;
      }

      const originalValue = this.originalConfigData[fileName] && this.originalConfigData[fileName][key];

      // 比较当前值与原始值
      if (currentValue !== originalValue) {
        this.modifiedConfigs.add(configKey);
        // 添加视觉标识
        const configItem = input.closest('.config-item');
        if (configItem) {
          configItem.classList.add('config-modified');
        }
      } else {
        this.modifiedConfigs.delete(configKey);
        // 移除视觉标识
        const configItem = input.closest('.config-item');
        if (configItem) {
          configItem.classList.remove('config-modified');
        }
      }

      console.log(`配置 ${configKey} 修改状态:`, this.modifiedConfigs.has(configKey));
      console.log('当前已修改的配置:', Array.from(this.modifiedConfigs));

      // 更新保存全部按钮状态
      this.updateSaveAllButtonState();
    }
  }

  // 更新保存全部按钮状态
  updateSaveAllButtonState() {
    const saveAllBtn = document.getElementById('save-all-config');
    if (saveAllBtn) {
      if (this.modifiedConfigs.size > 0) {
        saveAllBtn.classList.add('has-changes');
        saveAllBtn.innerHTML = `<i class="fas fa-save"></i> 保存全部 (${this.modifiedConfigs.size})`;
        saveAllBtn.title = `有 ${this.modifiedConfigs.size} 项配置需要保存`;
      } else {
        saveAllBtn.classList.remove('has-changes');
        saveAllBtn.innerHTML = '<i class="fas fa-save"></i> 保存全部';
        saveAllBtn.title = '保存所有已修改的配置';
      }
    }
  }

  // 获取已修改的配置数据
  getModifiedConfigData() {
    const modifiedData = {};

    this.modifiedConfigs.forEach(configKey => {
      const [fileName, key] = configKey.split('.');
      const input = document.querySelector(`[data-file="${fileName}"] [data-key="${key}"]`);

      if (input) {
        if (!modifiedData[fileName]) {
          modifiedData[fileName] = {};
        }

        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
        } else if (input.type === 'number') {
          value = parseFloat(input.value) || 0;
        } else {
          value = input.value;
        }

        modifiedData[fileName][key] = value;
      }
    });

    return modifiedData;
  }

  // ==================== 配置数据加载 ====================



  async loadConfigData() {
    try {
      const configContent = document.getElementById('config-content');

      // 显示加载状态
      configContent.innerHTML = `
        <div class="config-loading">
          <i class="fas fa-spinner fa-spin fa-2x"></i>
          <p>正在加载配置...</p>
        </div>
      `;

      // 调用真实的API接口，添加API密钥参数
      const response = await fetch('/api/Config/GetConfigs?api_key=api_kedaya');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        this.renderConfigFiles(result.data);
      } else {
        throw new Error(result.message || '获取配置失败');
      }

    } catch (error) {
      console.error('加载配置失败:', error);
      document.getElementById('config-content').innerHTML = `
        <div class="config-error">
          <i class="fas fa-exclamation-triangle fa-3x"></i>
          <h3>加载配置失败</h3>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="window.apiApp.configManager.loadConfigData()">重试</button>
        </div>
      `;
    }
  }

  renderConfigFiles(configFiles) {
    const configContent = document.getElementById('config-content');

    if (!configFiles || configFiles.length === 0) {
      configContent.innerHTML = `
        <div class="config-empty">
          <i class="fas fa-folder-open fa-3x"></i>
          <h3>没有找到配置文件</h3>
          <p>请检查conf目录是否存在配置文件</p>
        </div>
      `;
      return;
    }

    // 处理API返回的数据格式，转换为前端需要的格式
    const processedFiles = configFiles.map(file => {
      return {
        fileName: file.Name || file.name,
        name: file.Name || file.name,
        description: file.Description || file.description || '配置文件',
        items: (file.Items || file.items || []).map(item => {
          const key = item.Key || item.key;
          return {
            key: key,
            category: item.Category || item.category || '基础配置',
            label: (item.Key || item.key).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: item.Description || item.description || '无描述',
            type: item.Type || item.type || 'string',
            value: item.Value || item.value || '',
            sensitive: item.Sensitive || item.sensitive || false,
            required: item.Required || item.required || false,
            // 为demo_mode配置项添加特殊优先级
            priority: key === 'demo_mode' ? 1 : 999
          };
        })
      };
    });

    const configHTML = processedFiles.map(file => this.renderConfigFile(file)).join('');

    configContent.innerHTML = `
      <div class="config-files">
        ${configHTML}
      </div>
    `;

    // 存储原始配置数据
    this.storeOriginalConfigData(processedFiles);

    // 添加事件监听器
    this.setupConfigEventListeners();

    // 添加配置验证和变更监听
    setTimeout(() => {
      this.addConfigValidation();
      this.addChangeListeners();
      // 初始化演示模式
      this.initializeDemoMode();
    }, 100);
  }

  renderConfigFile(configFile) {
    // 按类别分组配置项
    const categorizedItems = this.categorizeConfigItems(configFile.items);

    return `
      <div class="config-file-card" data-file-name="${configFile.fileName}">
        <div class="config-file-header">
          <div class="config-file-info">
            <h3 class="config-file-name">
              <i class="fas fa-file-alt"></i>
              ${configFile.name}
            </h3>
            <p class="config-file-description">${configFile.description}</p>
          </div>
          <div class="config-file-actions">
            <button class="btn btn-sm btn-outline" onclick="window.apiApp.configManager.toggleConfigFile('${configFile.fileName}')" id="toggle-btn-${configFile.fileName}">
              <i class="fas fa-chevron-down" id="toggle-icon-${configFile.fileName}"></i>
              展开/收起
            </button>
          </div>
        </div>
        <div class="config-file-content" id="config-file-${configFile.fileName}" style="display: block;">
          ${Object.entries(categorizedItems).map(([category, items]) =>
            this.renderConfigCategory(category, items, configFile.name)
          ).join('')}
        </div>
      </div>
    `;
  }

  categorizeConfigItems(items) {
    const categorized = {};

    // 先按优先级排序，演示站配置项优先
    const sortedItems = items.sort((a, b) => {
      const aPriority = a.priority || 999;
      const bPriority = b.priority || 999;

      // 演示站配置项始终排在最前面
      if (a.key === 'demo_mode') return -1;
      if (b.key === 'demo_mode') return 1;

      return aPriority - bPriority;
    });

    sortedItems.forEach(item => {
      const category = item.category || '其他配置';
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(item);
    });

    return categorized;
  }

  renderConfigCategory(category, items, fileName) {
    return `
      <div class="config-category">
        <div class="config-category-header">
          <h4 class="config-category-title">
            <i class="fas fa-folder"></i>
            ${category}
          </h4>
          <span class="config-category-count">${items.length} 项</span>
        </div>
        <div class="config-category-items">
          ${items.map(item => this.renderConfigItem(item, fileName)).join('')}
        </div>
      </div>
    `;
  }

  renderConfigItem(item, fileName) {
    const inputType = this.getInputType(item.type);
    const sensitiveIcon = item.sensitive ? '<i class="fas fa-lock config-sensitive-icon"></i>' : '';

    // 检查是否为演示站配置项
    const isDemoModeConfig = item.key === 'demo_mode';
    const demoModeIcon = isDemoModeConfig ? '<i class="fas fa-eye config-demo-icon"></i>' : '';
    const demoModeClass = isDemoModeConfig ? 'config-item-demo-mode' : '';

    // 处理不同类型的输入
    let inputHTML;
    if (item.type === 'boolean') {
      const changeHandler = isDemoModeConfig ?
        `onchange="window.apiApp.configManager.handleDemoModeChange(this)"` : '';

      // 正确处理布尔值，支持字符串形式的布尔值
      const isChecked = item.value === true || item.value === 'true' || item.value === '1';

      inputHTML = `
        <input
          type="checkbox"
          class="config-input"
          data-key="${item.key}"
          data-type="${item.type}"
          ${isChecked ? 'checked' : ''}
          ${changeHandler}
        >
      `;
    } else {
      inputHTML = `
        <input
          type="${inputType}"
          class="config-input"
          data-key="${item.key}"
          data-type="${item.type}"
          value="${item.value || ''}"
          placeholder="${item.placeholder || ''}"
          ${item.required ? 'required' : ''}
        >
      `;
    }

    return `
      <div class="config-item ${demoModeClass}" data-key="${item.key}" data-file="${fileName}">
        <div class="config-item-header">
          <div class="config-item-info">
            <label class="config-item-label">
              ${demoModeIcon}
              ${sensitiveIcon}
              ${item.label || item.key}
              ${isDemoModeConfig ? '<span class="config-demo-badge">系统控制</span>' : ''}
            </label>
            <p class="config-item-description">${item.description}</p>
          </div>
          <div class="config-item-type">
            <span class="config-type-badge config-type-${item.type}">${item.type}</span>
          </div>
        </div>
        <div class="config-item-input">
          ${inputHTML}
          <button class="btn btn-sm btn-primary config-save-btn"
                  onclick="window.apiApp.configManager.saveConfigItem('${fileName}', '${item.key}', this)">
            <i class="fas fa-save"></i>
            保存
          </button>
        </div>
      </div>
    `;
  }

  getInputType(type) {
    const typeMap = {
      'string': 'text',
      'number': 'number',
      'boolean': 'checkbox',
      'password': 'password',
      'email': 'email',
      'url': 'url'
    };
    return typeMap[type] || 'text';
  }

  formatInputValue(value, type) {
    if (type === 'boolean') {
      return value ? 'checked' : '';
    }
    return value || '';
  }

  // ==================== 配置项操作 ====================

  toggleConfigFile(fileName) {
    const content = document.getElementById(`config-file-${fileName}`);
    const icon = document.getElementById(`toggle-icon-${fileName}`);
    const isVisible = content.style.display !== 'none';

    if (isVisible) {
      content.style.display = 'none';
      icon.className = 'fas fa-chevron-right';
    } else {
      content.style.display = 'block';
      icon.className = 'fas fa-chevron-down';
    }
  }

  async saveConfigItem(fileName, key, buttonElement) {
    try {
      // 检查演示模式 - 除了demo_mode配置项本身，其他配置项在演示模式下不能保存
      if (this.demoMode && key !== 'demo_mode') {
        this.app.showToast('演示模式下配置项为只读，无法保存', 'warning');
        return;
      }

      const input = buttonElement.previousElementSibling;
      let value = input.value;
      const type = input.dataset.type;

      // 处理布尔类型
      if (input.type === 'checkbox') {
        value = input.checked ? 'true' : 'false';
      }

      // 验证配置值
      const validation = this.validateConfigValue(key, value, type);
      if (!validation.valid) {
        this.app.showToast(validation.message, 'error');
        input.focus();
        return;
      }

      // 显示保存状态
      const originalHTML = buttonElement.innerHTML;
      buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
      buttonElement.disabled = true;

      // 调用真实的API接口保存配置，添加API密钥参数
      const response = await fetch('/api/Config/UpdateConfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `file=${encodeURIComponent(fileName)}&key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}&api_key=api_kedaya`
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.app.showToast(`配置项 ${key} 保存成功`, 'success');

        // 同时保存到本地存储作为备份
        this.saveConfigToLocalStorage(fileName, key, value);

        // 更新原始配置数据
        if (!this.originalConfigData[fileName]) {
          this.originalConfigData[fileName] = {};
        }
        this.originalConfigData[fileName][key] = value;

        // 从已修改列表中移除
        const configKey = `${fileName}.${key}`;
        this.modifiedConfigs.delete(configKey);

        // 移除视觉标识
        const configItem = input.closest('.config-item');
        if (configItem) {
          configItem.classList.remove('config-modified');
        }

        // 更新保存全部按钮状态
        this.updateSaveAllButtonState();

        // 恢复按钮状态
        buttonElement.innerHTML = '<i class="fas fa-check"></i> 已保存';
        setTimeout(() => {
          buttonElement.innerHTML = originalHTML;
          buttonElement.disabled = false;
        }, 2000);
      } else {
        throw new Error(result.message || '保存失败');
      }

    } catch (error) {
      console.error('保存配置失败:', error);
      this.app.showToast(`保存失败: ${error.message}`, 'error');

      // 恢复按钮状态
      buttonElement.innerHTML = '<i class="fas fa-save"></i> 保存';
      buttonElement.disabled = false;
    }
  }

  async saveAllConfigs() {
    try {
      // 检查演示模式
      if (this.demoMode) {
        this.app.showToast('演示模式下配置项为只读，无法批量保存', 'warning');
        return;
      }

      // 检查是否有已修改的配置
      if (this.modifiedConfigs.size === 0) {
        this.app.showToast('没有需要保存的配置更改', 'info');
        return;
      }

      this.app.showToast(`正在保存 ${this.modifiedConfigs.size} 项已修改的配置...`, 'info');

      // 获取已修改的配置项
      const configData = this.getModifiedConfigData();

      if (!configData || Object.keys(configData).length === 0) {
        throw new Error('没有找到可保存的配置数据');
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // 逐个保存配置项
      for (const fileName of Object.keys(configData)) {
        for (const key of Object.keys(configData[fileName])) {
          try {
            const value = configData[fileName][key];

            const response = await fetch('/api/Config/UpdateConfig', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: `file=${encodeURIComponent(fileName)}&key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}&api_key=api_kedaya`
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
              successCount++;
              // 同时保存到本地存储
              this.saveConfigToLocalStorage(fileName, key, value);
              // 更新原始配置数据
              if (!this.originalConfigData[fileName]) {
                this.originalConfigData[fileName] = {};
              }
              this.originalConfigData[fileName][key] = value;
              // 从已修改列表中移除
              const configKey = `${fileName}.${key}`;
              this.modifiedConfigs.delete(configKey);
              // 移除视觉标识
              const configItem = document.querySelector(`[data-file="${fileName}"] [data-key="${key}"]`).closest('.config-item');
              if (configItem) {
                configItem.classList.remove('config-modified');
              }
            } else {
              throw new Error(result.message || '保存失败');
            }
          } catch (error) {
            errorCount++;
            errors.push(`${fileName}.${key}: ${error.message}`);
            console.error(`保存配置失败 ${fileName}.${key}:`, error);
          }
        }
      }

      // 显示结果
      if (errorCount === 0) {
        this.app.showToast(`所有配置保存成功！共保存 ${successCount} 项配置`, 'success');
      } else if (successCount > 0) {
        this.app.showToast(`部分配置保存成功：${successCount} 项成功，${errorCount} 项失败`, 'warning');
        console.warn('保存失败的配置:', errors);
      } else {
        throw new Error(`所有配置保存失败：${errors.join(', ')}`);
      }

    } catch (error) {
      console.error('批量保存配置失败:', error);
      this.app.showToast(`批量保存失败: ${error.message}`, 'error');
    }
  }

  saveConfigToLocalStorage(fileName, key, value) {
    try {
      // 获取现有的配置数据
      const existingConfigs = localStorage.getItem('wechat_configs');
      let configs = existingConfigs ? JSON.parse(existingConfigs) : {};

      // 确保文件结构存在
      if (!configs[fileName]) {
        configs[fileName] = {};
      }

      // 保存配置值
      configs[fileName][key] = value;

      // 保存到localStorage
      localStorage.setItem('wechat_configs', JSON.stringify(configs));

      console.log(`配置已保存: ${fileName}.${key} = ${value}`);
    } catch (error) {
      console.error('保存配置到本地存储失败:', error);
      throw new Error('保存配置失败');
    }
  }

  loadConfigFromLocalStorage() {
    try {
      const configs = localStorage.getItem('wechat_configs');
      return configs ? JSON.parse(configs) : {};
    } catch (error) {
      console.error('从本地存储加载配置失败:', error);
      return {};
    }
  }

  // ==================== 配置搜索功能 ====================

  searchConfigs(searchTerm) {
    const configItems = document.querySelectorAll('.config-item');
    const configCategories = document.querySelectorAll('.config-category');
    const configFiles = document.querySelectorAll('.config-file-card');
    
    if (!searchTerm.trim()) {
      this.clearSearch();
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    let visibleItems = [];
    let totalItems = configItems.length;

    // 搜索配置项
    configItems.forEach(item => {
      const label = item.querySelector('.config-item-label').textContent.toLowerCase();
      const description = item.querySelector('.config-item-description').textContent.toLowerCase();
      const key = item.getAttribute('data-key').toLowerCase();
      
      const isMatch = label.includes(searchLower) || 
                     description.includes(searchLower) || 
                     key.includes(searchLower);
      
      if (isMatch) {
        item.style.display = 'block';
        item.classList.add('search-highlight');
        visibleItems.push(item);
      } else {
        item.style.display = 'none';
        item.classList.remove('search-highlight');
      }
    });

    // 显示/隐藏类别
    configCategories.forEach(category => {
      const visibleItemsInCategory = category.querySelectorAll('.config-item[style*="block"]');
      if (visibleItemsInCategory.length > 0) {
        category.style.display = 'block';
      } else {
        category.style.display = 'none';
      }
    });

    // 显示/隐藏文件
    configFiles.forEach(file => {
      const visibleCategoriesInFile = file.querySelectorAll('.config-category[style*="block"]');
      if (visibleCategoriesInFile.length > 0) {
        file.style.display = 'block';
        // 自动展开文件
        const content = file.querySelector('.config-file-content');
        const icon = file.querySelector('[id^="toggle-icon-"]');
        if (content && icon) {
          content.style.display = 'block';
          if (icon) icon.className = 'fas fa-chevron-down';
        }
      } else {
        file.style.display = 'none';
      }
    });

    // 显示搜索统计
    this.showSearchStats(searchTerm, visibleItems.length, totalItems);
  }

  showSearchStats(searchTerm, visibleCount, totalCount) {
    const configContent = document.getElementById('config-content');
    let statsElement = document.getElementById('search-stats');
    
    if (!statsElement) {
      statsElement = document.createElement('div');
      statsElement.id = 'search-stats';
      statsElement.className = 'search-stats';
      configContent.insertBefore(statsElement, configContent.firstChild);
    }

    if (visibleCount > 0) {
      statsElement.innerHTML = `
        <div class="search-stats-content">
          <i class="fas fa-search"></i>
          <span>搜索 "${searchTerm}" 找到 ${visibleCount} / ${totalCount} 个配置项</span>
          <button class="btn btn-sm btn-outline" onclick="window.apiApp.configManager.clearSearch()">
            <i class="fas fa-times"></i> 清除搜索
          </button>
        </div>
      `;
    } else {
      statsElement.innerHTML = `
        <div class="search-stats-content no-results">
          <i class="fas fa-search"></i>
          <span>搜索 "${searchTerm}" 没有找到匹配的配置项</span>
          <button class="btn btn-sm btn-outline" onclick="window.apiApp.configManager.clearSearch()">
            <i class="fas fa-times"></i> 清除搜索
          </button>
        </div>
      `;
    }
  }

  clearSearch() {
    // 清除搜索输入
    const searchInput = document.getElementById('config-search-input');
    if (searchInput) {
      searchInput.value = '';
    }

    // 显示所有项目
    document.querySelectorAll('.config-item, .config-category, .config-file-card').forEach(element => {
      element.style.display = 'block';
      element.classList.remove('search-highlight');
    });

    // 移除搜索统计
    const statsElement = document.getElementById('search-stats');
    if (statsElement) {
      statsElement.remove();
    }
  }

  // ==================== 配置备份和恢复 ====================

  getCurrentConfigData() {
    // 从当前页面获取配置数据
    const configData = {};

    // 遍历所有配置文件卡片
    const configCards = document.querySelectorAll('.config-file-card');
    console.log('找到配置文件卡片数量:', configCards.length);

    configCards.forEach(card => {
      const fileName = card.dataset.fileName;
      console.log('处理配置文件:', fileName);
      if (!fileName) {
        console.warn('配置文件卡片缺少fileName属性:', card);
        return;
      }

      configData[fileName] = {};

      // 获取该文件下的所有配置项
      const configItems = card.querySelectorAll('.config-item');
      console.log(`文件 ${fileName} 中找到配置项数量:`, configItems.length);

      configItems.forEach(item => {
        const key = item.dataset.key;
        const input = item.querySelector('.config-input');

        if (key && input) {
          let value;

          if (input.type === 'checkbox') {
            value = input.checked;
          } else if (input.type === 'number') {
            value = parseFloat(input.value) || 0;
          } else {
            value = input.value;
          }

          configData[fileName][key] = value;
          console.log(`保存配置: ${fileName}.${key} = ${value}`);
        }
      });
    });

    console.log('最终配置数据:', configData);
    return configData;
  }

  async backupConfigs() {
    try {
      this.app.showToast('正在备份配置...', 'info');

      // 从API获取最新的配置数据，添加API密钥参数
      const response = await fetch('/api/Config/GetConfigs?api_key=api_kedaya');

      if (!response.ok) {
        throw new Error(`获取配置失败: HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || '获取配置数据失败');
      }

      // 将API返回的数据转换为备份格式
      const configData = {};
      result.data.forEach(file => {
        const fileName = file.name;
        configData[fileName] = {};

        (file.items || []).forEach(item => {
          const key = item.key;
          const value = item.value;
          configData[fileName][key] = value;
        });
      });

      if (!configData || Object.keys(configData).length === 0) {
        throw new Error('没有可备份的配置数据');
      }

      // 创建备份数据结构
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        configs: configData,
        metadata: {
          totalFiles: Object.keys(configData).length,
          backupSource: 'Web Interface',
          description: '配置文件备份'
        }
      };

      // 创建下载链接
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `config-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.app.showToast('配置备份成功', 'success');
    } catch (error) {
      console.error('备份配置失败:', error);
      this.app.showToast(`备份失败: ${error.message}`, 'error');
    }
  }

  setupConfigEventListeners() {
    // 配置搜索
    const configSearch = document.getElementById('config-search');
    if (configSearch) {
      configSearch.addEventListener('input', (e) => {
        this.searchConfigs(e.target.value);
      });
    }

    // 刷新配置按钮
    const refreshBtn = document.getElementById('refresh-config');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        // 添加现代化点击反馈
        this.addModernButtonClickFeedback(e.target);
        this.loadConfigData();
      });
    }

    // 备份配置按钮
    const backupBtn = document.getElementById('backup-config');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        this.backupConfigs();
      });
    }

    // 批量保存配置按钮
    const saveAllBtn = document.getElementById('save-all-config');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => {
        this.saveAllConfigs();
      });
    }

    // 展开全部按钮
    const expandAllBtn = document.getElementById('expand-all-config');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        this.expandAllConfigFiles();
      });
    }

    // 收起全部按钮
    const collapseAllBtn = document.getElementById('collapse-all-config');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        this.collapseAllConfigFiles();
      });
    }
  }

  addConfigValidation() {
    // 绑定输入验证事件
    document.querySelectorAll('.config-input').forEach(input => {
      input.addEventListener('blur', (e) => {
        const validation = this.validateConfigInput(e.target);
        if (!validation.valid) {
          e.target.classList.add('invalid');
          this.app.showToast(validation.message, 'error');
        } else {
          e.target.classList.remove('invalid');
        }
      });
    });
  }

  validateConfigValue(key, value, type) {
    switch (type) {
      case 'int':
        const intValue = parseInt(value);
        if (isNaN(intValue)) {
          return { valid: false, message: '请输入有效的整数' };
        }
        if (key.includes('port') && (intValue < 1 || intValue > 65535)) {
          return { valid: false, message: '端口号必须在1-65535之间' };
        }
        break;

      case 'bool':
        if (!['true', 'false'].includes(value.toLowerCase())) {
          return { valid: false, message: '布尔值只能是true或false' };
        }
        break;

      case 'string':
        if (key.includes('url') && value && !this.isValidUrl(value)) {
          return { valid: false, message: '请输入有效的URL地址' };
        }
        if (key.includes('path') && value && value.includes('..')) {
          return { valid: false, message: '路径不能包含".."' };
        }
        break;
    }

    return { valid: true };
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  validateConfigInput(input) {
    const type = input.getAttribute('data-type');
    const value = input.value;
    const key = input.getAttribute('data-key');

    return this.validateConfigValue(key, value, type);
  }

  // ==================== 配置文件展开/收起功能 ====================

  expandAllConfigFiles() {
    const configFiles = document.querySelectorAll('.config-file-content');
    const icons = document.querySelectorAll('[id^="toggle-icon-"]');

    configFiles.forEach(content => {
      content.style.display = 'block';
    });

    icons.forEach(icon => {
      icon.className = 'fas fa-chevron-down';
    });

    this.app.showToast('已展开所有配置文件', 'info');
  }

  collapseAllConfigFiles() {
    const configFiles = document.querySelectorAll('.config-file-content');
    const icons = document.querySelectorAll('[id^="toggle-icon-"]');

    configFiles.forEach(content => {
      content.style.display = 'none';
    });

    icons.forEach(icon => {
      icon.className = 'fas fa-chevron-right';
    });

    this.app.showToast('已收起所有配置文件', 'info');
  }

  // ==================== 演示模式管理 ====================

  /**
   * 检查演示模式状态
   * @returns {boolean} 是否为演示模式
   */
  checkDemoMode() {
    // 优先从原始配置数据中获取演示模式状态
    if (this.originalConfigData && this.originalConfigData['app.conf']) {
      const demoModeValue = this.originalConfigData['app.conf']['demo_mode'];
      if (demoModeValue !== undefined) {
        // 处理字符串类型的布尔值
        this.demoMode = demoModeValue === 'true' || demoModeValue === true;
        console.log(`[ConfigManager] 从配置数据读取演示模式状态: ${this.demoMode} (原始值: ${demoModeValue})`);
        return this.demoMode;
      }
    }

    // 备选方案：从页面上的复选框读取状态
    const demoModeInput = document.querySelector('[data-key="demo_mode"]');
    if (demoModeInput && demoModeInput.type === 'checkbox') {
      this.demoMode = demoModeInput.checked;
      console.log(`[ConfigManager] 从复选框读取演示模式状态: ${this.demoMode}`);
      return this.demoMode;
    }

    // 最后备选：从localStorage获取
    const storedDemoMode = localStorage.getItem('config_demo_mode');
    if (storedDemoMode !== null) {
      this.demoMode = storedDemoMode === 'true';
      console.log(`[ConfigManager] 从localStorage读取演示模式状态: ${this.demoMode}`);
      return this.demoMode;
    }

    console.log(`[ConfigManager] 演示模式状态: ${this.demoMode} (默认值)`);
    return this.demoMode;
  }

  /**
   * 设置演示模式状态
   * @param {boolean} enabled - 是否启用演示模式
   */
  setDemoMode(enabled) {
    const oldMode = this.demoMode;
    this.demoMode = enabled;

    // 保存到localStorage
    localStorage.setItem('config_demo_mode', enabled.toString());

    // 更新UI状态
    this.updateDemoModeUI();

    // 触发状态变化事件
    this.notifyDemoModeChange(oldMode, enabled);

    console.log(`[ConfigManager] 演示模式已${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 更新演示模式的UI状态
   */
  updateDemoModeUI() {
    const configInputs = document.querySelectorAll('.config-input');
    const saveButtons = document.querySelectorAll('.config-save-btn, #save-all-config');
    const demoModeInput = document.querySelector('[data-key="demo_mode"]');

    if (this.demoMode) {
      // 启用演示模式 - 禁用所有输入框和保存按钮
      configInputs.forEach(input => {
        if (input !== demoModeInput) {
          input.disabled = true;
          input.classList.add('demo-mode-readonly');
        }
      });

      saveButtons.forEach(button => {
        if (!button.closest('.config-item')?.querySelector('[data-key="demo_mode"]')) {
          button.disabled = true;
          button.classList.add('demo-mode-disabled');
        }
      });

      // 显示演示模式提示
      this.showDemoModeNotice();

    } else {
      // 禁用演示模式 - 恢复正常状态
      configInputs.forEach(input => {
        input.disabled = false;
        input.classList.remove('demo-mode-readonly');
      });

      saveButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('demo-mode-disabled');
      });

      // 隐藏演示模式提示
      this.hideDemoModeNotice();
    }
  }

  /**
   * 显示演示模式提示
   */
  showDemoModeNotice() {
    // 移除已存在的提示
    this.hideDemoModeNotice();

    const notice = document.createElement('div');
    notice.id = 'demo-mode-notice';
    notice.className = 'demo-mode-notice';
    notice.innerHTML = `
      <div class="demo-mode-notice-content">
        <i class="fas fa-eye demo-mode-icon"></i>
        <div class="demo-mode-text">
          <div class="demo-mode-title">当前为演示模式，所有配置项均为只读</div>
          <div class="demo-mode-subtitle">如需禁用演示模式，请联系系统管理员提供管理员密钥</div>
        </div>
        <i class="fas fa-times demo-mode-close" onclick="this.parentElement.parentElement.style.display='none'"></i>
      </div>
    `;

    // 插入到配置内容区域的顶部
    const configContent = document.getElementById('config-content');
    if (configContent) {
      configContent.insertBefore(notice, configContent.firstChild);
    }
  }

  /**
   * 隐藏演示模式提示
   */
  hideDemoModeNotice() {
    const existingNotice = document.getElementById('demo-mode-notice');
    if (existingNotice) {
      existingNotice.remove();
    }
  }

  /**
   * 添加演示模式状态变化监听器
   * @param {Function} listener - 监听器函数
   */
  addDemoModeListener(listener) {
    this.demoModeListeners.push(listener);
  }

  /**
   * 移除演示模式状态变化监听器
   * @param {Function} listener - 监听器函数
   */
  removeDemoModeListener(listener) {
    const index = this.demoModeListeners.indexOf(listener);
    if (index > -1) {
      this.demoModeListeners.splice(index, 1);
    }
  }

  /**
   * 通知演示模式状态变化
   * @param {boolean} oldMode - 旧的演示模式状态
   * @param {boolean} newMode - 新的演示模式状态
   */
  notifyDemoModeChange(oldMode, newMode) {
    this.demoModeListeners.forEach(listener => {
      try {
        listener(newMode, oldMode);
      } catch (error) {
        console.error('[ConfigManager] 演示模式监听器执行失败:', error);
      }
    });

    // 触发自定义事件
    const event = new CustomEvent('demomodechange', {
      detail: { oldMode, newMode, timestamp: Date.now() }
    });
    document.dispatchEvent(event);
  }

  /**
   * 获取当前演示模式状态
   * @returns {boolean} 是否为演示模式
   */
  isDemoMode() {
    return this.demoMode;
  }

  /**
   * 处理演示模式配置项的变化
   * @param {HTMLElement} checkbox - 演示模式复选框元素
   */
  handleDemoModeChange(checkbox) {
    const enabled = checkbox.checked;

    // 先保存演示模式配置项本身
    this.saveConfigItem('app.json', 'demo_mode', checkbox.nextElementSibling)
      .then(() => {
        // 保存成功后更新演示模式状态
        this.setDemoMode(enabled);

        // 显示状态变化提示
        const message = enabled ?
          '演示模式已启用，所有配置项现在为只读状态' :
          '演示模式已禁用，配置项现在可以正常编辑';
        this.app.showToast(message, enabled ? 'warning' : 'success');
      })
      .catch(error => {
        console.error('保存演示模式配置失败:', error);
        // 如果保存失败，恢复复选框状态
        checkbox.checked = !enabled;
        this.app.showToast('演示模式配置保存失败: ' + error.message, 'error');
      });
  }

  /**
   * 初始化演示模式状态
   * 在配置数据加载完成后调用
   */
  initializeDemoMode() {
    console.log('[ConfigManager] 开始初始化演示模式...');
    console.log('[ConfigManager] 原始配置数据:', this.originalConfigData);

    // 检查当前演示模式状态
    this.checkDemoMode();

    console.log(`[ConfigManager] 演示模式初始化完成，当前状态: ${this.demoMode}`);

    // 更新UI状态
    this.updateDemoModeUI();

    // 如果演示模式已启用，显示提示信息
    if (this.demoMode) {
      console.log('[ConfigManager] 演示模式已启用，显示提示信息');
      setTimeout(() => {
        this.showDemoModeNotice();
      }, 500);
    }

    // 添加演示模式变化监听器
    this.addDemoModeListener((newMode, oldMode) => {
      console.log(`[ConfigManager] 演示模式状态变化: ${oldMode} -> ${newMode}`);
    });

    // 添加安全监听器，防止绕过限制
    this.setupSecurityListeners();
  }

  /**
   * 设置安全监听器，防止用户绕过演示模式限制
   */
  setupSecurityListeners() {
    // 监听所有输入框的变化，在演示模式下阻止修改
    document.addEventListener('input', (e) => {
      if (this.demoMode && e.target.classList.contains('config-input') && e.target.dataset.key !== 'demo_mode') {
        e.preventDefault();
        e.target.value = e.target.defaultValue || '';
        this.app.showToast('演示模式下配置项为只读', 'warning');
      }
    });

    // 监听键盘事件，防止直接输入
    document.addEventListener('keydown', (e) => {
      if (this.demoMode && e.target.classList.contains('config-input') && e.target.dataset.key !== 'demo_mode') {
        // 允许导航键，但阻止输入键
        const allowedKeys = ['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.app.showToast('演示模式下配置项为只读', 'warning');
        }
      }
    });

    // 监听粘贴事件
    document.addEventListener('paste', (e) => {
      if (this.demoMode && e.target.classList.contains('config-input') && e.target.dataset.key !== 'demo_mode') {
        e.preventDefault();
        this.app.showToast('演示模式下配置项为只读', 'warning');
      }
    });

    // 监听拖拽事件
    document.addEventListener('drop', (e) => {
      if (this.demoMode && e.target.classList.contains('config-input') && e.target.dataset.key !== 'demo_mode') {
        e.preventDefault();
        this.app.showToast('演示模式下配置项为只读', 'warning');
      }
    });

    // 定期检查演示模式状态，防止被恶意修改
    setInterval(() => {
      this.validateDemoModeIntegrity();
    }, 5000);
  }

  /**
   * 验证演示模式的完整性
   */
  validateDemoModeIntegrity() {
    const demoModeInput = document.querySelector('[data-key="demo_mode"]');
    if (demoModeInput && demoModeInput.type === 'checkbox') {
      const currentState = demoModeInput.checked;

      // 如果状态不一致，重新同步
      if (currentState !== this.demoMode) {
        console.warn('[ConfigManager] 检测到演示模式状态不一致，正在同步...');
        this.demoMode = currentState;
        this.updateDemoModeUI();
      }
    }

    // 检查是否有被恶意启用的输入框
    if (this.demoMode) {
      const inputs = document.querySelectorAll('.config-input');
      inputs.forEach(input => {
        if (input.dataset.key !== 'demo_mode' && !input.disabled) {
          console.warn('[ConfigManager] 检测到未被禁用的输入框，正在修复...');
          input.disabled = true;
          input.classList.add('demo-mode-readonly');
        }
      });

      // 检查保存按钮
      const saveButtons = document.querySelectorAll('.config-save-btn, #save-all-config');
      saveButtons.forEach(button => {
        if (!button.closest('.config-item')?.querySelector('[data-key="demo_mode"]') && !button.disabled) {
          console.warn('[ConfigManager] 检测到未被禁用的保存按钮，正在修复...');
          button.disabled = true;
          button.classList.add('demo-mode-disabled');
        }
      });
    }
  }

  /**
   * 添加现代化按钮点击视觉反馈
   * @param {HTMLElement} button - 被点击的按钮元素
   */
  addModernButtonClickFeedback(button) {
    if (!button) return;

    // 添加现代化点击效果
    button.classList.add('btn-clicked');

    // 创建现代化涟漪效果
    this.createModernRippleEffect(button);

    // 150ms后移除点击效果
    setTimeout(() => {
      button.classList.remove('btn-clicked');
    }, 150);
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
