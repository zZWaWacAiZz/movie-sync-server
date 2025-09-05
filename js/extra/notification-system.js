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
            /* 通知系统容器 */
            .notification-container {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                pointer-events: none;
            }

            /* 基础通知样式 */
            .notification {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 16px 20px;
                margin-bottom: 10px;
                min-width: 300px;
                max-width: 500px;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideIn 0.3s ease-out;
                pointer-events: auto;
                position: relative;
                overflow: hidden;
            }

            /* 通知类型样式 */
            .notification.success {
                border-left: 4px solid #52c41a;
                background: #f6ffed;
            }

            .notification.error {
                border-left: 4px solid #ff4d4f;
                background: #fff2f0;
            }

            .notification.warning {
                border-left: 4px solid #faad14;
                background: #fffbe6;
            }

            .notification.info {
                border-left: 4px solid #1890ff;
                background: #e6f7ff;
            }

            /* 深色模式适配 */
            body.dark-theme .notification {
                background: #2a2a2a;
                color: #e0e0e0;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            body.dark-theme .notification.success {
                background: #162312;
                border-left-color: #49aa19;
            }

            body.dark-theme .notification.error {
                background: #2a1215;
                border-left-color: #ff7875;
            }

            body.dark-theme .notification.warning {
                background: #2b2111;
                border-left-color: #ffc53d;
            }

            body.dark-theme .notification.info {
                background: #111d2c;
                border-left-color: #40a9ff;
            }

            /* 图标样式 */
            .notification-icon {
                font-size: 20px;
                flex-shrink: 0;
            }

            .notification.success .notification-icon::before {
                content: "✓";
                color: #52c41a;
            }

            .notification.error .notification-icon::before {
                content: "✕";
                color: #ff4d4f;
            }

            .notification.warning .notification-icon::before {
                content: "⚠";
                color: #faad14;
            }

            .notification.info .notification-icon::before {
                content: "ℹ";
                color: #1890ff;
            }

            /* 内容样式 */
            .notification-content {
                flex: 1;
            }

            .notification-title {
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 16px;
            }

            .notification-message {
                font-size: 14px;
                opacity: 0.85;
                line-height: 1.4;
            }

            /* 关闭按钮 */
            .notification-close {
                position: absolute;
                top: 8px;
                right: 12px;
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                opacity: 0.5;
                transition: opacity 0.2s;
                color: inherit;
            }

            .notification-close:hover {
                opacity: 1;
            }

            /* 动画效果 */
            @keyframes slideIn {
                from {
                    transform: translateX(-50%) translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(-50%) translateY(-20px);
                    opacity: 0;
                }
            }

            .notification.removing {
                animation: slideOut 0.3s ease-out forwards;
            }

            /* 底部Toast样式（兼容旧版本） */
            .bottom-toast {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 12px 24px;
                border-radius: 24px;
                font-size: 14px;
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .bottom-toast.show {
                opacity: 1;
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
        }, 300);
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