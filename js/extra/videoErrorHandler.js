/**
 * 视频错误处理模块
 * 提供专业的视频播放错误处理和恢复机制
 */

class VideoErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.recoveryStrategies = new Map();
        this.maxRetries = 3;
        this.retryDelays = [1000, 3000, 5000];
        this.init();
    }

    init() {
        this.setupGlobalErrorHandlers();
        this.registerRecoveryStrategies();
    }

    /**
     * 设置全局错误处理器
     */
    setupGlobalErrorHandlers() {
        // 监听媒体错误
        if (window.videoPlayer) {
            window.videoPlayer.addEventListener('error', (e) => {
                this.handleVideoError(e);
            });

            window.videoPlayer.addEventListener('stalled', (e) => {
                this.handleStalledEvent(e);
            });

            window.videoPlayer.addEventListener('waiting', (e) => {
                this.handleWaitingEvent(e);
            });
        }
    }

    /**
     * 注册错误恢复策略
     */
    registerRecoveryStrategies() {
        this.recoveryStrategies.set('NETWORK_ERROR', {
            priority: 1,
            handler: this.handleNetworkError.bind(this)
        });

        this.recoveryStrategies.set('MEDIA_ERROR', {
            priority: 2,
            handler: this.handleMediaError.bind(this)
        });

        this.recoveryStrategies.set('SRC_NOT_SUPPORTED', {
            priority: 3,
            handler: this.handleSrcNotSupported.bind(this)
        });

        this.recoveryStrategies.set('DECODE_ERROR', {
            priority: 4,
            handler: this.handleDecodeError.bind(this)
        });
    }

    /**
     * 处理视频错误
     * @param {Event} event - 错误事件
     */
    handleVideoError(event) {
        const video = event.target;
        const error = video.error;
        
        if (!error) return;

        const errorInfo = {
            code: error.code,
            message: this.getErrorMessage(error.code),
            type: this.getErrorType(error.code),
            timestamp: new Date().toISOString(),
            url: video.src
        };

        console.error('视频播放错误:', errorInfo);

        // 记录错误
        this.recordError(errorInfo);

        // 显示用户友好的错误提示
        this.showUserError(errorInfo);

        // 尝试自动恢复
        this.attemptRecovery(errorInfo);
    }

    /**
     * 处理卡顿事件
     * @param {Event} event - 卡顿事件
     */
    handleStalledEvent(event) {
        const video = event.target;
        
        // 检查网络状态
        if (!navigator.onLine) {
            this.showUserError({
                type: 'NETWORK_OFFLINE',
                message: '网络连接已断开，请检查网络设置'
            });
            return;
        }

        // 如果卡顿超过5秒，显示提示
        const stallTimer = setTimeout(() => {
            this.showUserError({
                type: 'BUFFER_STALL',
                message: '视频缓冲中，请稍候...'
            });
        }, 5000);

        video.addEventListener('canplay', () => {
            clearTimeout(stallTimer);
        }, { once: true });
    }

    /**
     * 处理等待事件
     * @param {Event} event - 等待事件
     */
    handleWaitingEvent(event) {
        // 等待事件通常是正常的缓冲行为，可以显示轻微的提示
        console.log('视频缓冲中...');
    }

    /**
     * 获取错误消息
     * @param {number} code - 错误代码
     * @returns {string} 错误消息
     */
    getErrorMessage(code) {
        const messages = {
            1: '用户中止了视频加载',
            2: '网络错误，请检查网络连接',
            3: '视频解码错误，格式可能不受支持',
            4: '视频格式不受支持或文件已损坏'
        };
        return messages[code] || '未知视频错误';
    }

    /**
     * 获取错误类型
     * @param {number} code - 错误代码
     * @returns {string} 错误类型
     */
    getErrorType(code) {
        const types = {
            1: 'ABORT_ERROR',
            2: 'NETWORK_ERROR',
            3: 'DECODE_ERROR',
            4: 'SRC_NOT_SUPPORTED'
        };
        return types[code] || 'UNKNOWN_ERROR';
    }

    /**
     * 记录错误信息
     * @param {Object} errorInfo - 错误信息
     */
    recordError(errorInfo) {
        const key = `${errorInfo.type}_${errorInfo.url}`;
        if (!this.errorCounts.has(key)) {
            this.errorCounts.set(key, 0);
        }
        this.errorCounts.set(key, this.errorCounts.get(key) + 1);
    }

    /**
     * 显示用户友好的错误提示
     * @param {Object} errorInfo - 错误信息
     */
    showUserError(errorInfo) {
        // 使用统一通知系统显示错误
        if (window.notificationSystem) {
            window.notificationSystem.error(`视频播放错误: ${errorInfo.message}`, 5000);
        } else if (window.errorHandler) {
            // 兼容旧版错误处理模块
            window.errorHandler.showError(errorInfo.message, {
                type: 'error',
                duration: 5000,
                action: {
                    text: '重试',
                    callback: () => this.retryVideo()
                }
            });
        } else {
            // 降级方案：显示在页面元素中
            const errorDiv = document.getElementById('video-error-message');
            if (errorDiv) {
                errorDiv.textContent = errorInfo.message;
                errorDiv.style.display = 'block';
                errorDiv.className = 'error-message error';
                setTimeout(() => errorDiv.style.display = 'none', 5000);
            } else {
                // 最终降级：alert
                alert(`视频播放错误: ${errorInfo.message}`);
            }
        }
    }

    /**
     * 尝试自动恢复
     * @param {Object} errorInfo - 错误信息
     */
    attemptRecovery(errorInfo) {
        const key = `${errorInfo.type}_${errorInfo.url}`;
        const retryCount = this.errorCounts.get(key) || 0;

        if (retryCount >= this.maxRetries) {
            this.showUserError({
                type: 'MAX_RETRIES_EXCEEDED',
                message: '已尝试多次恢复，请检查视频链接或稍后重试'
            });
            return;
        }

        const strategy = this.recoveryStrategies.get(errorInfo.type);
        if (strategy) {
            setTimeout(() => {
                strategy.handler(errorInfo);
            }, this.retryDelays[retryCount] || 5000);
        }
    }

    /**
     * 处理网络错误
     * @param {Object} errorInfo - 错误信息
     */
    handleNetworkError(errorInfo) {
        console.log('尝试网络错误恢复...');
        
        // 检查网络状态
        if (!navigator.onLine) {
            this.showUserError({
                type: 'NETWORK_OFFLINE',
                message: '网络连接已断开，请检查网络设置'
            });
            return;
        }

        // 尝试重新加载视频
        const video = window.videoPlayer;
        if (video && video.src) {
            // 添加时间戳避免缓存
            const url = new URL(video.src);
            url.searchParams.set('_retry', Date.now());
            video.src = url.toString();
            video.load();
        }
    }

    /**
     * 处理媒体错误
     * @param {Object} errorInfo - 错误信息
     */
    handleMediaError(errorInfo) {
        console.log('尝试媒体错误恢复...');
        
        const video = window.videoPlayer;
        if (video) {
            // 尝试降低质量或重新加载
            video.currentTime = 0;
            video.load();
        }
    }

    /**
     * 处理源不支持错误
     * @param {Object} errorInfo - 错误信息
     */
    handleSrcNotSupported(errorInfo) {
        console.log('处理源不支持错误...');
        
        this.showUserError({
            type: 'FORMAT_NOT_SUPPORTED',
            message: '视频格式不受支持，请尝试其他格式（如MP4、WebM）'
        });
    }

    /**
     * 处理解码错误
     * @param {Object} errorInfo - 错误信息
     */
    handleDecodeError(errorInfo) {
        console.log('处理解码错误...');
        
        this.showUserError({
            type: 'DECODE_FAILED',
            message: '视频解码失败，文件可能已损坏'
        });
    }

    /**
     * 重试视频播放
     */
    retryVideo() {
        const video = window.videoPlayer;
        if (video && video.src) {
            video.load();
            video.play().catch(err => {
                console.error('重试播放失败:', err);
            });
        }
    }

    /**
     * 获取错误统计
     * @returns {Object} 错误统计信息
     */
    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
            errorTypes: Object.fromEntries(this.errorCounts),
            recentErrors: Array.from(this.errorCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
        };
    }

    /**
     * 清理错误记录
     */
    clearErrors() {
        this.errorCounts.clear();
    }

    /**
     * 检查视频播放状态
     * @returns {Object} 播放状态信息
     */
    checkPlaybackStatus() {
        const video = window.videoPlayer;
        if (!video) return null;

        return {
            readyState: video.readyState,
            networkState: video.networkState,
            buffered: video.buffered.length > 0 ? {
                start: video.buffered.start(0),
                end: video.buffered.end(0)
            } : null,
            duration: video.duration,
            currentTime: video.currentTime,
            paused: video.paused,
            error: video.error
        };
    }
}

// 创建全局实例
window.videoErrorHandler = new VideoErrorHandler();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoErrorHandler;
}