/**
 * 加载状态管理模块
 * 提供全局的加载状态显示和管理功能
 */

class LoadingManager {
    constructor() {
        this.activeLoadings = new Map();
        this.init();
    }

    /**
     * 初始化加载管理器
     */
    init() {
        this.createGlobalStyles();
    }

    /**
     * 创建全局样式
     */
    createGlobalStyles() {
        if (document.getElementById('loading-styles')) return;

        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            /* 加载遮罩层 */
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                border-radius: inherit;
            }

            /* 加载动画容器 */
            .loading-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                color: white;
            }

            /* 旋转加载动画 */
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid var(--primary-color, #007bff);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* 脉冲加载动画 */
            .loading-pulse {
                width: 40px;
                height: 40px;
                background: var(--primary-color, #007bff);
                border-radius: 50%;
                animation: pulse 1.5s ease-in-out infinite;
            }

            @keyframes pulse {
                0% {
                    transform: scale(0);
                    opacity: 1;
                }
                100% {
                    transform: scale(1);
                    opacity: 0;
                }
            }

            /* 进度条样式 */
            .loading-progress {
                width: 200px;
                height: 4px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 2px;
                overflow: hidden;
            }

            .loading-progress-bar {
                height: 100%;
                background: var(--primary-color, #007bff);
                transition: width 0.3s ease;
                border-radius: 2px;
            }

            /* 加载文字 */
            .loading-text {
                font-size: 14px;
                font-weight: 500;
                text-align: center;
            }

            /* 百分比显示 */
            .loading-percentage {
                font-size: 12px;
                opacity: 0.8;
            }

            /* 全局加载遮罩 */
            .global-loading {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* 迷你加载器 */
            .mini-loading {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid rgba(0, 0, 0, 0.1);
                border-top: 2px solid var(--primary-color, #007bff);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            /* 按钮加载状态 */
            .button-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }

            .button-loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 16px;
                height: 16px;
                margin: -8px 0 0 -8px;
                border: 2px solid transparent;
                border-top: 2px solid currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }


        `;
        document.head.appendChild(style);
    }

    /**
     * 显示加载状态
     * @param {HTMLElement|string} target - 目标元素或选择器
     * @param {Object} options - 配置选项
     */
    showLoading(target, options = {}) {
        const element = typeof target === 'string' 
            ? document.querySelector(target) 
            : target;

        if (!element) {
            console.warn('Loading target not found:', target);
            return null;
        }

        // 配置选项
        const config = {
            message: options.message || '加载中...',
            type: options.type || 'spinner', // spinner, pulse, progress
            showProgress: options.showProgress || false,
            global: options.global || false,
            ...options
        };

        // 创建加载元素
        const loadingId = this.generateId();
        const loadingElement = this.createLoadingElement(config, loadingId);

        // 添加到目标元素
        if (config.global) {
            document.body.appendChild(loadingElement);
        } else {
            // 确保目标元素有相对定位
            const position = window.getComputedStyle(element).position;
            if (position === 'static') {
                element.style.position = 'relative';
            }
            element.appendChild(loadingElement);
        }

        // 记录活动加载
        this.activeLoadings.set(loadingId, {
            element: loadingElement,
            target: element,
            config: config
        });

        return loadingId;
    }

    /**
     * 隐藏加载状态
     * @param {string} loadingId - 加载ID
     */
    hideLoading(loadingId) {
        const loading = this.activeLoadings.get(loadingId);
        if (!loading) return;

        const { element, target, config } = loading;

        // 移除加载元素
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }

        // 清理记录
        this.activeLoadings.delete(loadingId);

        // 恢复目标元素的样式
        if (!config.global && target.style.position === 'relative') {
            const computedPosition = window.getComputedStyle(target).position;
            if (computedPosition === 'relative') {
                target.style.position = '';
            }
        }
    }

    /**
     * 设置加载进度
     * @param {string} loadingId - 加载ID
     * @param {number} percentage - 进度百分比 (0-100)
     */
    setProgress(loadingId, percentage) {
        const loading = this.activeLoadings.get(loadingId);
        if (!loading) return;

        const { element } = loading;
        const progressBar = element.querySelector('.loading-progress-bar');
        const percentageText = element.querySelector('.loading-percentage');

        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }

        if (percentageText) {
            percentageText.textContent = `${Math.round(percentage)}%`;
        }
    }

    /**
     * 更新加载消息
     * @param {string} loadingId - 加载ID
     * @param {string} message - 新消息
     */
    updateMessage(loadingId, message) {
        const loading = this.activeLoadings.get(loadingId);
        if (!loading) return;

        const { element } = loading;
        const messageEl = element.querySelector('.loading-text');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    /**
     * 隐藏所有加载状态
     */
    hideAll() {
        const loadingIds = Array.from(this.activeLoadings.keys());
        loadingIds.forEach(id => this.hideLoading(id));
    }

    /**
     * 显示按钮加载状态
     * @param {HTMLElement} button - 按钮元素
     * @param {string} originalText - 原始文本
     */
    showButtonLoading(button, originalText = '') {
        if (!button || button.classList.contains('button-loading')) return;

        button.classList.add('button-loading');
        button.dataset.originalText = originalText || button.textContent;
        button.textContent = '';

        return button;
    }

    /**
     * 隐藏按钮加载状态
     * @param {HTMLElement} button - 按钮元素
     */
    hideButtonLoading(button) {
        if (!button || !button.classList.contains('button-loading')) return;

        button.classList.remove('button-loading');
        const originalText = button.dataset.originalText;
        if (originalText) {
            button.textContent = originalText;
            delete button.dataset.originalText;
        }
    }

    /**
     * 创建加载元素
     * @param {Object} config - 配置对象
     * @param {string} loadingId - 加载ID
     * @returns {HTMLElement}
     */
    createLoadingElement(config, loadingId) {
        const wrapper = document.createElement('div');
        wrapper.className = config.global ? 'global-loading' : 'loading-overlay';
        wrapper.dataset.loadingId = loadingId;

        let content = '';

        switch (config.type) {
            case 'spinner':
                content = `
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">${config.message}</div>
                    </div>
                `;
                break;

            case 'pulse':
                content = `
                    <div class="loading-container">
                        <div class="loading-pulse"></div>
                        <div class="loading-text">${config.message}</div>
                    </div>
                `;
                break;

            case 'progress':
                content = `
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">${config.message}</div>
                        ${config.showProgress ? `
                            <div class="loading-progress">
                                <div class="loading-progress-bar" style="width: 0%"></div>
                            </div>
                            <div class="loading-percentage">0%</div>
                        ` : ''}
                    </div>
                `;
                break;

            default:
                content = `
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">${config.message}</div>
                    </div>
                `;
        }

        wrapper.innerHTML = content;
        return wrapper;
    }

    /**
     * 生成唯一ID
     * @returns {string}
     */
    generateId() {
        return 'loading-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 显示全局加载
     * @param {Object} options - 配置选项
     * @returns {string} 加载ID
     */
    showGlobalLoading(options = {}) {
        return this.showLoading('body', { ...options, global: true });
    }

    /**
     * 显示视频加载
     * @param {HTMLElement} videoContainer - 视频容器
     * @param {string} message - 加载消息
     * @returns {string} 加载ID
     */
    showVideoLoading(videoContainer, message = '视频加载中...') {
        return this.showLoading(videoContainer, {
            message,
            type: 'spinner'
        });
    }

    /**
     * 显示聊天加载
     * @param {HTMLElement} chatContainer - 聊天容器
     * @returns {string} 加载ID
     */
    showChatLoading(chatContainer) {
        return this.showLoading(chatContainer, {
            message: '加载聊天记录...',
            type: 'spinner'
        });
    }
}

// 创建全局实例
window.loadingManager = new LoadingManager();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingManager;
}