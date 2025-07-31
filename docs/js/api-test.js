// API测试模块 - 负责API测试、请求发送和响应处理
export class APITester {
  constructor(app) {
    this.app = app;
  }

  // API详情和测试功能
  showAPIDetails(apiId) {
    const api = this.app.filteredAPIs.find(a => a.id === apiId);
    if (!api) return;

    const modal = document.getElementById('api-modal');
    const title = document.getElementById('api-modal-title');
    const body = document.getElementById('api-modal-body');

    title.textContent = `${api.method} ${api.path}`;
    body.innerHTML = this.renderAPIDetails(api);

    // 显示模态框
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // 添加事件监听
    this.setupAPIModalEvents(api);
  }

  renderAPIDetails(api) {
    const parameters = api.parameters || [];
    const queryParams = parameters.filter(p => p.in === 'query');
    const bodyParams = parameters.filter(p => p.in === 'body');

    return `
      <div class="api-details">
        <div class="api-section">
          <h4>基本信息</h4>
          <div class="api-info-grid">
            <div class="info-item">
              <label>请求方法:</label>
              <span class="method-badge ${api.method.toLowerCase()}">${api.method}</span>
            </div>
            <div class="info-item">
              <label>请求路径:</label>
              <div class="url-container">
                <code class="full-url" onclick="window.apiApp.copyFullURL('${api.id}')" title="点击复制完整URL">${this.app.config.baseUrl}${api.path}</code>
                <i class="fas fa-copy copy-icon"></i>
              </div>
            </div>
            <div class="info-item">
              <label>接口描述:</label>
              <span>${api.description}</span>
            </div>
            <div class="info-item">
              <label>分类标签:</label>
              <div class="api-tags">
                ${api.tags.map(tag => `<span class="api-tag">${tag}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>

        ${queryParams.length > 0 ? `
          <div class="api-section">
            <h4>查询参数</h4>
            <div class="params-table">
              ${queryParams.map(param => `
                <div class="param-row">
                  <div class="param-info">
                    <div class="param-name">
                      ${param.name}
                      ${param.required ? '<span class="required">*</span>' : ''}
                    </div>
                    <div class="param-type">${param.type || 'string'}</div>
                    <div class="param-desc">${param.description || '无描述'}</div>
                  </div>
                  <div class="param-input">
                    <input type="text"
                           id="param-${param.name}"
                           placeholder="${param.description || param.name}"
                           ${param.name === 'wxid' && this.app.config.defaultWxid ? `value="${this.app.config.defaultWxid}"` : ''}>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${bodyParams.length > 0 ? `
          <div class="api-section">
            <h4>请求体参数</h4>
            <div class="body-param-section">
              ${bodyParams.map(param => `
                <div class="body-param">
                  <label>${param.name} ${param.required ? '<span class="required">*</span>' : ''}</label>
                  <textarea id="body-${param.name}"
                           placeholder="${param.description || '请输入JSON格式的参数'}"
                           rows="6">${this.app.dataProcessor.getBodyParamExample(param)}</textarea>
                  <small>${param.description || '无描述'}</small>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="api-section">
          <h4>测试接口</h4>
          <div class="test-section">
            <div class="test-actions">
              <button class="btn btn-primary" onclick="window.apiApp.executeAPI('${api.id}')">
                <i class="fas fa-play"></i>
                发送请求
              </button>
              <button class="btn" onclick="window.apiApp.generateCode('${api.id}')">
                <i class="fas fa-code"></i>
                生成代码
              </button>
            </div>
          </div>
        </div>

        <div class="api-section">
          <h4>响应结果</h4>
          <div class="response-section">
            <div class="response-tabs">
              <button class="response-tab active" data-tab="result">响应结果</button>
              <button class="response-tab" data-tab="headers">响应头</button>
              <button class="response-tab" data-tab="curl">cURL命令</button>
            </div>
            <div class="response-content">
              <div class="response-panel active" id="result-panel">
                <div class="response-container">
                  <pre id="response-result">点击"发送请求"按钮测试接口</pre>
                  <button class="copy-response-btn" onclick="window.apiApp.copyResponseResult()" title="复制响应结果">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              <div class="response-panel" id="headers-panel">
                <div class="response-container">
                  <pre id="response-headers">暂无响应头信息</pre>
                  <button class="copy-response-btn" onclick="window.apiApp.copyResponseHeaders()" title="复制响应头">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              <div class="response-panel" id="curl-panel">
                <div class="response-container">
                  <pre id="curl-command">暂无cURL命令</pre>
                  <button class="copy-response-btn" onclick="window.apiApp.copyCurlCommand()" title="复制cURL命令">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupAPIModalEvents(api) {
    // 响应标签切换
    document.querySelectorAll('.response-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;

        // 更新标签状态
        document.querySelectorAll('.response-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        // 切换面板
        document.querySelectorAll('.response-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${tabName}-panel`).classList.add('active');
      });
    });

    // 参数输入变化时更新URL
    const queryParams = (api.parameters || []).filter(p => p.in === 'query');
    queryParams.forEach(param => {
      const input = document.getElementById(`param-${param.name}`);
      if (input) {
        input.addEventListener('input', () => {
          this.updateFullURL(api);
        });
      }
    });

    // 初始化URL
    this.updateFullURL(api);
  }

  updateFullURL(api) {
    const queryParams = (api.parameters || []).filter(p => p.in === 'query');
    const params = new URLSearchParams();

    queryParams.forEach(param => {
      const input = document.getElementById(`param-${param.name}`);
      if (input && input.value.trim()) {
        params.append(param.name, input.value.trim());
      }
    });

    const queryString = params.toString();
    const fullURL = `${this.app.config.baseUrl}${api.path}${queryString ? '?' + queryString : ''}`;

    const urlDisplay = document.getElementById('full-url');
    if (urlDisplay) {
      urlDisplay.textContent = fullURL;
    }
  }

  hideAPIModal() {
    const modal = document.getElementById('api-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  // 工具方法
  testAPI(apiId) {
    this.showAPIDetails(apiId);
  }

  copyAPIInfo(apiId) {
    const api = this.app.filteredAPIs.find(a => a.id === apiId);
    if (!api) return;

    // 生成完整的cURL命令
    const curlCommand = this.generateCompleteCurlCommand(api);

    navigator.clipboard.writeText(curlCommand).then(() => {
      this.app.showToast('cURL命令已复制到剪贴板', 'success');
    }).catch(() => {
      this.app.showToast('复制失败', 'error');
    });
  }

  generateCompleteCurlCommand(api) {
    const baseUrl = `${this.app.config.baseUrl}${api.path}`;
    let curlCommand = `curl -X ${api.method}`;

    // 处理查询参数
    const queryParams = (api.parameters || []).filter(p => p.in === 'query');
    const queryString = new URLSearchParams();

    queryParams.forEach(param => {
      if (param.name === 'wxid' && this.app.config.defaultWxid) {
        queryString.append(param.name, this.app.config.defaultWxid);
      } else {
        // 为其他参数提供示例值
        const exampleValue = this.app.dataProcessor.getExampleValue(param);
        if (exampleValue) {
          queryString.append(param.name, exampleValue);
        }
      }
    });

    const fullUrl = queryString.toString() ?
      `${baseUrl}?${queryString.toString()}` : baseUrl;

    curlCommand += ` '${fullUrl}'`;

    // 添加请求头
    if (api.method !== 'GET') {
      curlCommand += ` \\\n  -H 'Content-Type: application/json'`;
    }

    // 处理请求体参数
    const bodyParams = (api.parameters || []).filter(p => p.in === 'body');
    if (bodyParams.length > 0 && api.method !== 'GET') {
      const bodyParam = bodyParams[0];
      const bodyData = this.app.dataProcessor.generateBodyExample(bodyParam);
      if (bodyData) {
        curlCommand += ` \\\n  -d '${JSON.stringify(bodyData, null, 2)}'`;
      }
    }

    return curlCommand;
  }

  copyFullURL(apiId) {
    const api = this.app.filteredAPIs.find(a => a.id === apiId);
    if (!api) return;

    const fullURL = `${this.app.config.baseUrl}${api.path}`;
    navigator.clipboard.writeText(fullURL).then(() => {
      this.app.showToast('完整URL已复制到剪贴板', 'success');
    }).catch(() => {
      this.app.showToast('复制失败', 'error');
    });
  }

  generateCode(apiId) {
    const api = this.app.filteredAPIs.find(a => a.id === apiId);
    if (!api) return;

    // 显示语言选择模态框
    this.showLanguageSelectionModal(api);
  }

  showLanguageSelectionModal(api) {
    const modalHtml = `
      <div class="language-modal-overlay" onclick="this.remove()">
        <div class="language-modal" onclick="event.stopPropagation()">
          <div class="language-modal-header">
            <h3>选择代码语言</h3>
            <button class="close-btn" onclick="this.closest('.language-modal-overlay').remove()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="language-modal-body">
            <div class="language-options">
              <button class="language-option" onclick="window.apiApp.generateCodeForLanguage('${api.id}', 'python'); this.closest('.language-modal-overlay').remove();">
                <i class="fab fa-python"></i>
                <span>Python</span>
              </button>
              <button class="language-option" onclick="window.apiApp.generateCodeForLanguage('${api.id}', 'elang'); this.closest('.language-modal-overlay').remove();">
                <i class="fas fa-code"></i>
                <span>易语言</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  generateCodeForLanguage(apiId, language) {
    const api = this.app.filteredAPIs.find(a => a.id === apiId);
    if (!api) return;

    let code, languageName;

    if (language === 'python') {
      code = this.generatePythonCode(api);
      languageName = 'Python';
    } else if (language === 'elang') {
      code = this.generateELangCode(api);
      languageName = '易语言';
    }

    this.showCodeModal(code, languageName);
  }

  generatePythonCode(api) {
    const baseUrl = `${this.app.config.baseUrl}${api.path}`;
    let code = `import requests\nimport json\n\n`;

    // 处理查询参数
    const queryParams = (api.parameters || []).filter(p => p.in === 'query');
    const bodyParams = (api.parameters || []).filter(p => p.in === 'body');

    // 构建URL
    code += `# API接口: ${api.description}\n`;
    code += `url = "${baseUrl}"\n\n`;

    // 处理查询参数 - 获取用户实际输入的值
    if (queryParams.length > 0) {
      code += `# 查询参数\n`;
      code += `params = {\n`;
      queryParams.forEach(param => {
        // 尝试获取用户输入的值
        const input = document.getElementById(`param-${param.name}`);
        let actualValue;
        if (input && input.value.trim()) {
          actualValue = input.value.trim();
        } else if (param.name === 'wxid' && this.app.config.defaultWxid) {
          actualValue = this.app.config.defaultWxid;
        } else {
          actualValue = this.app.dataProcessor.getExampleValue(param);
        }

        const quotedValue = typeof actualValue === 'string' ? `"${actualValue}"` : actualValue;
        code += `    "${param.name}": ${quotedValue},  # ${param.description || ''}\n`;
      });
      code += `}\n\n`;
    }

    // 处理请求头
    code += `# 请求头\n`;
    code += `headers = {\n`;
    if (api.method !== 'GET') {
      code += `    "Content-Type": "application/json",\n`;
    }
    code += `}\n\n`;

    // 处理请求体 - 获取用户实际输入的值
    if (bodyParams.length > 0 && api.method !== 'GET') {
      const bodyParam = bodyParams[0];
      const bodyInput = document.getElementById(`body-${bodyParam.name}`);
      let bodyData;

      if (bodyInput && bodyInput.value.trim()) {
        try {
          // 尝试解析用户输入的JSON
          bodyData = JSON.parse(bodyInput.value.trim());
        } catch (e) {
          // 如果解析失败，使用默认示例
          bodyData = this.app.dataProcessor.generateBodyExample(bodyParam);
        }
      } else {
        // 如果没有用户输入，使用默认示例
        bodyData = this.app.dataProcessor.generateBodyExample(bodyParam);
      }

      if (bodyData) {
        code += `# 请求体数据\n`;
        code += `data = ${JSON.stringify(bodyData, null, 4)}\n\n`;
      }
    }

    // 生成请求代码
    code += `# 发送请求\n`;
    if (api.method === 'GET') {
      if (queryParams.length > 0) {
        code += `response = requests.get(url, params=params, headers=headers)\n`;
      } else {
        code += `response = requests.get(url, headers=headers)\n`;
      }
    } else {
      const method = api.method.toLowerCase();
      if (bodyParams.length > 0) {
        if (queryParams.length > 0) {
          code += `response = requests.${method}(url, params=params, json=data, headers=headers)\n`;
        } else {
          code += `response = requests.${method}(url, json=data, headers=headers)\n`;
        }
      } else {
        if (queryParams.length > 0) {
          code += `response = requests.${method}(url, params=params, headers=headers)\n`;
        } else {
          code += `response = requests.${method}(url, headers=headers)\n`;
        }
      }
    }

    code += `\n# 处理响应\n`;
    code += `if response.status_code == 200:\n`;
    code += `    result = response.json()\n`;
    code += `    print("请求成功:")\n`;
    code += `    print(json.dumps(result, indent=2, ensure_ascii=False))\n`;
    code += `else:\n`;
    code += `    print(f"请求失败: {response.status_code}")\n`;
    code += `    print(response.text)\n`;

    return code;
  }

  generateELangCode(api) {
    const baseUrl = `${this.app.config.baseUrl}${api.path}`;
    let code = `.版本 2\n\n`;

    // 处理查询参数和请求体参数
    const queryParams = (api.parameters || []).filter(p => p.in === 'query');
    const bodyParams = (api.parameters || []).filter(p => p.in === 'body');

    code += `.子程序 功能_网页访问, 文本型, , \n`;
    code += `.局部变量  局_网址, 文本型\n`;
    code += `.局部变量  局_方式, 整数型\n`;
    code += `.局部变量  局_提交数据, 文本型\n`;
    code += `.局部变量  ADD_协议头, 类_POST数据类\n`;
    code += `.局部变量  局_提交协议头, 文本型\n`;
    code += `.局部变量  局_结果, 字节集\n`;
    code += `.局部变量  局_返回, 文本型\n`;

    code += `' ${baseUrl}\n`;
    code += `局_网址 = "${baseUrl}"\n`;

    // 设置请求方式
    if (api.method === 'GET') {
      code += `局_方式 = 0\n`;
    } else {
      code += `局_方式 = 1\n`;
    }

    // 生成JSON数据 - 获取用户实际输入的值
    if (bodyParams.length > 0 && api.method !== 'GET') {
      const bodyParam = bodyParams[0];
      const bodyInput = document.getElementById(`body-${bodyParam.name}`);
      let bodyText = '';

      if (bodyInput && bodyInput.value.trim()) {
        bodyText = bodyInput.value.trim();
      } else {
        // 如果没有用户输入，使用默认示例
        const bodyData = this.app.dataProcessor.generateBodyExample(bodyParam);
        bodyText = JSON.stringify(bodyData);
      }

      if (bodyText) {
        // 使用简单的字符串替换方式转换为易语言代码
        // 参考转易代码逻辑：替换冒号后空格、多余空格、换行符，然后处理引号
        let processedText = bodyText;
        processedText = processedText.replace(/: /g, ':');  // 替换 ": " 为 ":"
        processedText = processedText.replace(/  /g, '');   // 替换多余空格
        processedText = processedText.replace(/\n/g, '');   // 替换换行符

        code += `' ${processedText}\n`;
        processedText = processedText.replace(/"/g, '" + #引号 + "'); // 替换引号
        code += `局_提交数据 = "${processedText}"\n`;
      }
    } else {
      code += `局_提交数据 = ""\n`;
    }

    // 添加请求头
    code += `ADD_协议头.添加 ("Content-Type","application/json"）\n\n`;
    code += `局_提交协议头 = ADD_协议头.获取协议头数据 ()\n\n`;

    // 发送请求
    code += `局_结果 = 网页_访问_对象 (局_网址, 局_方式, 局_提交数据, , , 局_提交协议头, , , , , , , , , , , )\n`;
    code += `局_返回 = 到文本(编码_编码转换对象(局_结果))\n`;
    code += `返回(局_返回)\n`;

    return code;
  }

  showCodeModal(code, language) {
    // 创建模态框HTML
    const modalHtml = `
      <div class="code-modal-overlay" onclick="this.remove()">
        <div class="code-modal" onclick="event.stopPropagation()">
          <div class="code-modal-header">
            <h3>${language}代码</h3>
            <div class="code-modal-actions">
              <button class="btn btn-primary" onclick="navigator.clipboard.writeText(this.closest('.code-modal').querySelector('pre').textContent).then(() => window.apiApp.showToast('代码已复制到剪贴板', 'success'))">
                <i class="fas fa-copy"></i>
                复制代码
              </button>
              <button class="btn" onclick="this.closest('.code-modal-overlay').remove()">
                <i class="fas fa-times"></i>
                关闭
              </button>
            </div>
          </div>
          <div class="code-modal-body">
            <pre><code class="language-python">${this.escapeHtml(code)}</code></pre>
          </div>
        </div>
      </div>
    `;

    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 复制cURL命令
  copyCurlCommand() {
    const curlElement = document.getElementById('curl-command');
    const copyBtn = document.querySelector('#curl-panel .copy-response-btn');

    if (curlElement && curlElement.textContent.trim() !== '暂无cURL命令') {
      navigator.clipboard.writeText(curlElement.textContent).then(() => {
        this.app.showToast('cURL命令已复制到剪贴板', 'success');

        // 添加成功动画效果
        if (copyBtn) {
          copyBtn.classList.add('success');
          setTimeout(() => {
            copyBtn.classList.remove('success');
          }, 600);
        }
      }).catch(() => {
        this.app.showToast('复制失败', 'error');
      });
    } else {
      this.app.showToast('请先发送请求以生成cURL命令', 'warning');
    }
  }

  async executeAPI(apiId) {
    const api = this.app.filteredAPIs.find(a => a.id === apiId);
    if (!api) return;

    try {
      this.app.showToast('正在发送请求...', 'info');

      // 构建基础URL
      let url = `${this.app.config.baseUrl}${api.path}`;
      const options = {
        method: api.method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.app.config.timeout
      };

      // 处理查询参数
      const queryParams = (api.parameters || []).filter(p => p.in === 'query');
      if (queryParams.length > 0) {
        const urlParams = new URLSearchParams();

        queryParams.forEach(param => {
          const input = document.getElementById(`param-${param.name}`);
          console.log(`查找参数输入框: param-${param.name}`, input);
          if (input && input.value.trim()) {
            console.log(`添加查询参数: ${param.name} = ${input.value.trim()}`);
            urlParams.append(param.name, input.value.trim());
          }
        });

        if (urlParams.toString()) {
          url += `?${urlParams.toString()}`;
          console.log(`最终URL: ${url}`);
        }
      }

      // 处理路径参数
      const pathParams = (api.parameters || []).filter(p => p.in === 'path');
      pathParams.forEach(param => {
        const input = document.getElementById(`param-${param.name}`);
        if (input && input.value.trim()) {
          url = url.replace(`{${param.name}}`, encodeURIComponent(input.value.trim()));
        }
      });

      // 处理请求体参数
      const bodyParams = (api.parameters || []).filter(p => p.in === 'body');
      if (bodyParams.length > 0 && api.method !== 'GET') {
        const bodyParam = bodyParams[0];
        const bodyInput = document.getElementById(`body-${bodyParam.name}`);
        if (bodyInput && bodyInput.value.trim()) {
          try {
            options.body = JSON.stringify(JSON.parse(bodyInput.value));
          } catch (e) {
            this.app.showToast('请求体JSON格式错误', 'error');
            return;
          }
        }
      }

      // 处理header参数
      const headerParams = (api.parameters || []).filter(p => p.in === 'header');
      headerParams.forEach(param => {
        const input = document.getElementById(`param-${param.name}`);
        if (input && input.value.trim()) {
          options.headers[param.name] = input.value.trim();
        }
      });

      const response = await fetch(url, options);
      const responseText = await response.text();

      // 显示响应结果
      document.getElementById('response-result').textContent = responseText;

      // 显示响应头
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      document.getElementById('response-headers').textContent = JSON.stringify(headers, null, 2);

      // 生成cURL命令
      const curlCommand = this.generateCurlCommand(url, options);
      document.getElementById('curl-command').textContent = curlCommand;

      if (response.ok) {
        this.app.showToast('请求成功', 'success');
      } else {
        this.app.showToast(`请求失败: ${response.status} ${response.statusText}`, 'error');
      }

    } catch (error) {
      console.error('API请求失败:', error);
      document.getElementById('response-result').textContent = `请求失败: ${error.message}`;
      this.app.showToast('请求失败', 'error');
    }
  }

  generateCurlCommand(url, options) {
    let curl = `curl -X ${options.method} '${url}'`;

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        curl += ` \\\n  -H '${key}: ${value}'`;
      });
    }

    if (options.body) {
      curl += ` \\\n  -d '${options.body}'`;
    }

    return curl;
  }

  // 复制响应结果
  copyResponseResult() {
    const responseElement = document.getElementById('response-result');
    const copyBtn = document.querySelector('#result-panel .copy-response-btn');

    if (responseElement && responseElement.textContent.trim() !== '点击"发送请求"按钮测试接口') {
      navigator.clipboard.writeText(responseElement.textContent).then(() => {
        this.app.showToast('响应结果已复制到剪贴板', 'success');

        // 添加成功动画效果
        if (copyBtn) {
          copyBtn.classList.add('success');
          setTimeout(() => {
            copyBtn.classList.remove('success');
          }, 600);
        }
      }).catch(() => {
        this.app.showToast('复制失败', 'error');
      });
    } else {
      this.app.showToast('请先发送请求以获取响应结果', 'warning');
    }
  }

  // 复制响应头
  copyResponseHeaders() {
    const headersElement = document.getElementById('response-headers');
    const copyBtn = document.querySelector('#headers-panel .copy-response-btn');

    if (headersElement && headersElement.textContent.trim() !== '暂无响应头信息') {
      navigator.clipboard.writeText(headersElement.textContent).then(() => {
        this.app.showToast('响应头已复制到剪贴板', 'success');

        // 添加成功动画效果
        if (copyBtn) {
          copyBtn.classList.add('success');
          setTimeout(() => {
            copyBtn.classList.remove('success');
          }, 600);
        }
      }).catch(() => {
        this.app.showToast('复制失败', 'error');
      });
    } else {
      this.app.showToast('请先发送请求以获取响应头信息', 'warning');
    }
  }
}
