// 数据处理模块 - 负责API数据加载、处理和API数据转换
export class DataProcessor {
  constructor(app) {
    this.app = app;
  }

  async loadAPIData() {
    try {
      const response = await fetch('./swagger.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      this.app.apiData = await response.json();
      this.processAPIData();
    } catch (error) {
      console.error('加载API数据失败:', error);
      throw error;
    }
  }

  processAPIData() {
    if (!this.app.apiData || !this.app.apiData.paths) {
      throw new Error('无效的API数据格式');
    }

    // 清空现有数据，避免重复
    this.app.filteredAPIs = [];
    const paths = this.app.apiData.paths;

    Object.keys(paths).forEach(path => {
      Object.keys(paths[path]).forEach(method => {
        const apiInfo = paths[path][method];
        const api = {
          id: `${method.toUpperCase()}_${path.replace(/\//g, '_').replace(/-/g, '_')}`,
          method: method.toUpperCase(),
          path: path,
          summary: apiInfo.summary || '无描述',
          description: apiInfo.description || apiInfo.summary || '无描述',
          tags: apiInfo.tags || ['未分类'],
          parameters: apiInfo.parameters || [],
          responses: apiInfo.responses || {},
          operationId: apiInfo.operationId,
          consumes: apiInfo.consumes,
          produces: apiInfo.produces
        };
        this.app.filteredAPIs.push(api);
      });
    });

    console.log(`处理了 ${this.app.filteredAPIs.length} 个API接口`);
  }

  getCategories() {
    const categoryMap = new Map();

    this.app.filteredAPIs.forEach(api => {
      api.tags.forEach(tag => {
        if (categoryMap.has(tag)) {
          categoryMap.set(tag, categoryMap.get(tag) + 1);
        } else {
          categoryMap.set(tag, 1);
        }
      });
    });

    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  getCategoryIcon(category) {
    const iconMap = {
      'Login': 'fa-sign-in-alt',
      'Friend': 'fa-users',
      'Group': 'fa-user-friends',
      'Msg': 'fa-comments',
      'User': 'fa-user',
      'Tools': 'fa-tools',
      'TenPay': 'fa-credit-card',
      'Favor': 'fa-heart',
      'Label': 'fa-tags',
      'Finder': 'fa-search',
      'FriendCircle': 'fa-circle-notch',
      'Wxapp': 'fa-mobile-alt',
      'OfficialAccounts': 'fa-newspaper',
      'QWContact': 'fa-address-book',
      'SayHello': 'fa-handshake'
    };
    return iconMap[category] || 'fa-folder';
  }

  // 搜索和过滤功能
  searchAPIs(query) {
    // 重新处理数据以获取完整的API列表
    this.processAPIData();

    if (!query.trim()) {
      this.app.uiRenderer.renderAPIs();
      return;
    }

    const searchTerm = query.toLowerCase();
    this.app.filteredAPIs = this.app.filteredAPIs.filter(api =>
      api.path.toLowerCase().includes(searchTerm) ||
      api.summary.toLowerCase().includes(searchTerm) ||
      api.description.toLowerCase().includes(searchTerm) ||
      api.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );

    this.app.uiRenderer.renderAPIs();
  }



  filterAPIs() {
    const methodFilter = document.getElementById('method-filter').value;
    const categoryFilter = document.getElementById('category-filter').value;
    const searchQuery = document.getElementById('global-search').value;

    // 重新处理数据以获取完整的API列表
    this.processAPIData();

    // 应用搜索过滤
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase();
      this.app.filteredAPIs = this.app.filteredAPIs.filter(api =>
        api.path.toLowerCase().includes(searchTerm) ||
        api.summary.toLowerCase().includes(searchTerm) ||
        api.description.toLowerCase().includes(searchTerm) ||
        api.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // 应用方法过滤
    if (methodFilter) {
      this.app.filteredAPIs = this.app.filteredAPIs.filter(api =>
        api.method === methodFilter
      );
    }

    // 应用分类过滤
    if (categoryFilter) {
      this.app.filteredAPIs = this.app.filteredAPIs.filter(api =>
        api.tags.includes(categoryFilter)
      );
    }

    this.app.uiRenderer.renderAPIs();
  }

  // 获取请求体参数示例
  getBodyParamExample(param) {
    if (param.schema && param.schema.$ref) {
      const refName = param.schema.$ref.replace('#/definitions/', '');
      const definition = this.app.apiData.definitions[refName];
      if (definition && definition.properties) {
        const example = {};
        Object.keys(definition.properties).forEach(key => {
          const prop = definition.properties[key];
          if (prop.type === 'string') {
            example[key] = key === 'Wxid' && this.app.config.defaultWxid ? this.app.config.defaultWxid : '';
          } else if (prop.type === 'integer') {
            example[key] = 0;
          } else if (prop.type === 'boolean') {
            example[key] = false;
          } else {
            example[key] = '';
          }
        });
        return JSON.stringify(example, null, 2);
      }
    }
    return '{\n  \n}';
  }

  // 生成示例值
  getExampleValue(param) {
    // 根据参数类型和名称生成示例值
    if (param.name === 'wxid') {
      return this.app.config.defaultWxid || 'your_wxid_here';
    }

    // 根据参数名称生成更智能的示例值
    const paramName = param.name.toLowerCase();

    if (paramName.includes('mobile') || paramName.includes('phone')) {
      return '13800138000';
    }
    if (paramName.includes('email')) {
      return 'example@example.com';
    }
    if (paramName.includes('url')) {
      return 'https://example.com';
    }
    if (paramName.includes('code')) {
      return '123456';
    }
    if (paramName.includes('token')) {
      return 'example_token_here';
    }
    if (paramName.includes('key')) {
      return 'example_key_here';
    }

    switch (param.type) {
      case 'string':
        return param.name.includes('id') ? 'example_id' : 'example_value';
      case 'integer':
        return '1';
      case 'boolean':
        return 'true';
      default:
        return 'example_value';
    }
  }

  // 生成请求体示例
  generateBodyExample(bodyParam) {
    if (!bodyParam.schema || !bodyParam.schema.$ref) {
      return { "example": "data" };
    }

    const refName = bodyParam.schema.$ref.replace('#/definitions/', '');
    const definition = this.app.apiData.definitions[refName];

    if (!definition || !definition.properties) {
      return { "example": "data" };
    }

    const example = {};
    Object.keys(definition.properties).forEach(key => {
      const prop = definition.properties[key];
      const keyLower = key.toLowerCase();

      if (key === 'Wxid' && this.app.config.defaultWxid) {
        example[key] = this.app.config.defaultWxid;
      } else {
        // 根据字段名生成更智能的示例值
        if (keyLower.includes('mobile') || keyLower.includes('phone')) {
          example[key] = '13800138000';
        } else if (keyLower.includes('email')) {
          example[key] = 'example@example.com';
        } else if (keyLower.includes('url')) {
          example[key] = 'https://example.com';
        } else if (keyLower.includes('code')) {
          example[key] = '123456';
        } else if (keyLower.includes('token')) {
          example[key] = 'example_token_here';
        } else if (keyLower.includes('key')) {
          example[key] = 'example_key_here';
        } else if (keyLower.includes('name')) {
          example[key] = 'example_name';
        } else if (keyLower.includes('content') || keyLower.includes('message')) {
          example[key] = 'example_content';
        } else {
          switch (prop.type) {
            case 'string':
              example[key] = keyLower.includes('id') ? 'example_id' : 'example_value';
              break;
            case 'integer':
              example[key] = 1;
              break;
            case 'boolean':
              example[key] = true;
              break;
            case 'array':
              example[key] = [];
              break;
            case 'object':
              example[key] = {};
              break;
            default:
              example[key] = 'example_value';
          }
        }
      }
    });

    return example;
  }
}
