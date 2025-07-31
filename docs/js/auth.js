/**
 * API文档密钥验证模块
 * 处理API密钥的验证、存储和管理
 */

// 检查API密钥是否有效
export function checkApiKey() {
    const apiKey = getCookie('api_key');
    if (!apiKey) {
        console.debug('API密钥未设置');
        return false;
    }

    console.debug('API密钥已设置: ' + maskKey(apiKey));
    return true;
}

// 遮蔽密钥用于日志记录
function maskKey(key) {
    if (!key || key.length <= 8) {
        return '****';
    }
    return key.substring(0, 2) + '****' + key.substring(key.length - 2);
}

// 获取Cookie值
export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// 设置Cookie
export function setCookie(name, value, days) {
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${value}${expires}; path=/; SameSite=Lax`;
}

// 删除Cookie
export function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// 验证API密钥
export async function verifyApiKey(apiKey, rememberMe = false) {
    try {
        const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey,
                remember_me: rememberMe
            })
        });
        
        const data = await response.json();
        return {
            success: data.success,
            message: data.message || (data.success ? '验证成功' : '验证失败'),
            data: data.data
        };
    } catch (error) {
        console.error('验证请求失败:', error);
        return {
            success: false,
            message: '网络错误，请重试',
            data: null
        };
    }
}

// 登出（清除API密钥）
export function logout() {
    deleteCookie('api_key');
    window.location.href = '/api/auth';
}

// 添加登出按钮到页面
export function addLogoutButton() {
    // 检查是否已经有API密钥
    if (!checkApiKey()) {
        return;
    }

    // 检查是否已经存在登出按钮
    if (document.querySelector('.logout-btn')) {
        return;
    }

    // 创建登出按钮容器
    const logoutContainer = document.createElement('div');
    logoutContainer.className = 'logout-container';
    logoutContainer.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.9);
        padding: 6px 10px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(5px);
        transition: all 0.3s ease;
    `;

    // 创建用户图标
    const userIcon = document.createElement('span');
    userIcon.innerHTML = '🔐';
    userIcon.style.cssText = `
        font-size: 16px;
    `;

    // 创建登出按钮
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = '退出登录';
    logoutBtn.className = 'logout-btn';
    logoutBtn.style.cssText = `
        padding: 4px 8px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
    `;

    // 添加悬停效果
    logoutBtn.addEventListener('mouseover', () => {
        logoutBtn.style.background = '#d32f2f';
        logoutBtn.style.transform = 'translateY(-1px)';
    });

    logoutBtn.addEventListener('mouseout', () => {
        logoutBtn.style.background = '#f44336';
        logoutBtn.style.transform = 'translateY(0)';
    });

    // 添加点击事件
    logoutBtn.addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
            logout();
        }
    });

    // 组装并添加到页面
    logoutContainer.appendChild(userIcon);
    logoutContainer.appendChild(logoutBtn);
    document.body.appendChild(logoutContainer);
}

// 初始化认证模块
export function initAuth() {
    // 避免重复初始化
    if (window.authModuleInitialized) {
        return;
    }

    // 添加登出按钮
    addLogoutButton();

    // 标记已初始化
    window.authModuleInitialized = true;
}
