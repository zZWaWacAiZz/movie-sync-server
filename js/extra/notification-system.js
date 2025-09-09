// 统一通知提示系统
// 替换现有的 alert、showBottomToast、showToast 等分散提示

class NotificationSystem {
    constructor() {
        this.initStyles();
        this.setupContainer();
    }

    // 初始化样式
    initStyles() {
        if (document.getElementById('notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            /* 通知系统容器 - 固定在正中间 */
            .notification-container {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            /* 基础通知样式 - 缩小尺寸，黑色系 */
            .notification {
                background: rgba(28, 28, 28, 0.95);
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                padding: 12px 16px;
                margin-bottom: 8px;
                min-width: 280px;
                max-width: 400px;
                display: flex;
                align-items: center;
                gap: 12px;
                pointer-events: auto;
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #e5e5e5;
            }

            /* 通知类型样式 - 黑色系主题 */
            .notification.success {
                border-left: 3px solid #22c55e;
                background: rgba(34, 197, 94, 0.1);
            }

            .notification.error {
                border-left: 3px solid #ef4444;
                background: rgba(239, 68, 68, 0.1);
            }

            .notification.warning {
                border-left: 3px solid #f59e0b;
                background: rgba(245, 158, 11, 0.1);
            }

            .notification.info {
                border-left: 3px solid #6b7280;
                background: rgba(107, 114, 128, 0.1);
            }

            /* 深色模式适配 - 保持黑色系 */
            body.dark-theme .notification {
                background: rgba(18, 18, 18, 0.98);
                color: #f3f4f6;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(12px);
            }

            body.dark-theme .notification.success {
                background: rgba(34, 197, 94, 0.08);
                border-left-color: #22c55e;
            }

            body.dark-theme .notification.error {
                background: rgba(239, 68, 68, 0.08);
                border-left-color: #ef4444;
            }

            body.dark-theme .notification.warning {
                background: rgba(245, 158, 11, 0.08);
                border-left-color: #f59e0b;
            }

            body.dark-theme .notification.info {
                background: rgba(107, 114, 128, 0.08);
                border-left-color: #6b7280;
            }

            /* 图标样式 - 缩小尺寸 */
            .notification-icon {
                font-size: 16px;
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                font-weight: 600;
                position: relative;
            }

            .notification.success .notification-icon::before {
                content: "✓";
                color: #22c55e;
            }

            .notification.error .notification-icon::before {
                content: "✕";
                color: #ef4444;
            }

            .notification.warning .notification-icon::before {
                content: "⚠";
                color: #f59e0b;
            }

            .notification.info .notification-icon::before {
                content: "ℹ";
                color: #9ca3af;
            }

            /* 内容样式 - 缩小文字 */
            .notification-content {
                flex: 1;
                min-width: 0;
            }

            .notification-title {
                font-weight: 500;
                margin-bottom: 1px;
                font-size: 13px;
                line-height: 1.2;
            }

            .notification-message {
                font-size: 12px;
                opacity: 0.85;
                line-height: 1.3;
                word-wrap: break-word;
            }

            /* 关闭按钮 - 黑色系 */
            .notification-close {
                position: absolute;
                top: 8px;
                right: 12px;
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                color: #6b7280;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .notification-close:hover {
                color: #e5e5e5;
                background: rgba(255, 255, 255, 0.1);
            }

            /* 动画效果 - 直接在中间出现，无位移 */
            @keyframes notificationSlideIn {
                from {
                    transform: scale(0.8);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            @keyframes notificationSlideOut {
                from {
                    transform: scale(1);
                    opacity: 1;
                }
                to {
                    transform: scale(0.8);
                    opacity: 0;
                }
            }

            .notification {
                animation: notificationSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .notification.removing {
                animation: notificationSlideOut 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }

            /* 底部Toast样式 - 缩小黑色系 */
            .notification.toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                top: auto;
                transform: translateX(-50%);
                background: rgba(28, 28, 28, 0.95);
                color: #e5e5e5;
                padding: 10px 20px;
                border-radius: 20px;
                min-width: auto;
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(12px);
                font-size: 13px;
            }

            body.dark-theme .notification.toast {
                background: rgba(18, 18, 18, 0.98);
                color: #e5e5e5;
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.5);
            }

            .notification.toast.removing {
                animation: toastSlideOut 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }

            @keyframes toastSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes toastSlideOut {
                from {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateY(20px) scale(0.8);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 设置容器
    setupContainer() {
        if (document.getElementById('notification-container')) return;

        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    // 显示通知
    show(message, type = 'info', duration = 3000) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = `
            <div class="notification-icon"></div>
            <div class="notification-content">
                <div class="notification-title">${this.getTitle(type)}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(notification);

        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }

        return notification;
    }

    // 快速方法
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }

    // 移除通知
    remove(notification) {
        if (!notification || !notification.parentElement) return;
        
        notification.classList.add('removing');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, 250); // 匹配新的动画时长
    }

    // 清除所有通知
    clear() {
        const container = document.getElementById('notification-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    // 获取标题
    getTitle(type) {
        const titles = {
            success: '成功',
            error: '错误',
            warning: '警告',
            info: '提示'
        };
        return titles[type] || '提示';
    }

    // 兼容旧方法
    showBottomToast(message) {
        this.info(message, 2000);
    }

    showToast(message) {
        this.success(message, 3000);
    }

    // 替换alert
    alert(message, type = 'error') {
        this.show(message, type, 0); // 0表示不自动消失
    }
}

// 创建全局实例
window.notificationSystem = new NotificationSystem();

// 向后兼容的函数
window.showBottomToast = (message) => window.notificationSystem.showBottomToast(message);
window.showToast = (message) => window.notificationSystem.showToast(message);

// 完全替换alert（可选）
// window.alert = (message) => window.notificationSystem.alert(message);