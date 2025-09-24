/**
 * 智能UI控制模块 - 模仿原生HTML5视频控制条行为
 * 功能：
 * 1. PC模式下，鼠标移入视频区域显示控制按钮，移出隐藏
 * 2. 全屏模式下，鼠标移动显示控制按钮，5秒无操作后自动隐藏
 */

(function() {
    'use strict';
    
    // 配置常量
    const CONFIG = {
        FADE_IN_DURATION: 300,    // 淡入动画时间(ms)
        FADE_OUT_DURATION: 300,   // 淡出动画时间(ms)
        IDLE_TIMEOUT: 1500,       // 全屏模式下空闲超时时间(ms) - 改为1.5秒
        MOUSE_MOVE_THRESHOLD: 5   // 鼠标移动阈值(px)
    };
    
    // 状态管理
    let state = {
        isFullscreen: false,
        isPageFullscreen: false,
        isMouseInVideo: false,
        isControlsVisible: true,
        lastMouseMoveTime: 0,
        lastMousePosition: { x: 0, y: 0 },
        idleTimer: null,
        fadeOutTimer: null
    };
    
    // DOM元素引用
    let elements = {};
    
    /**
     * 初始化DOM元素引用
     */
    function initElements() {
        elements = {
            videoContainer: document.getElementById('videoContainer'),
            videoPlayer: document.getElementById('videoPlayer'),
            videoUserCount: document.querySelector('.video-user-count'),
            videoChatButton: document.querySelector('.video-chat-button-right'),
            fullscreenButton: document.getElementById('fullscreenButton'),
            fullscreenWithChatButton: document.getElementById('fullscreenWithChatButton'),
            body: document.body
        };
        
        // 检查必要元素是否存在
        if (!elements.videoContainer || !elements.videoPlayer) {
            console.warn('智能UI控制：必要的DOM元素未找到');
            return false;
        }
        
        return true;
    }
    
    /**
     * 检查是否处于全屏模式
     */
    function checkFullscreenStatus() {
        state.isFullscreen = !!(document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement ||
                             document.msFullscreenElement);
        
        state.isPageFullscreen = elements.body.classList.contains('page-fullscreen') ||
                                elements.body.classList.contains('rotate-fullscreen-active');
        
        return state.isFullscreen || state.isPageFullscreen;
    }
    
    /**
     * 显示控制按钮
     */
    function showControls() {
        if (state.isControlsVisible) return;
        
        clearTimeout(state.fadeOutTimer);
        
        const controls = [elements.videoUserCount, elements.videoChatButton];
        
        controls.forEach(control => {
            if (control) {
                control.style.transition = `opacity ${CONFIG.FADE_IN_DURATION}ms ease-in-out`;
                control.style.opacity = '1';
                control.style.visibility = 'visible';
                control.style.pointerEvents = 'auto';
            }
        });
        
        state.isControlsVisible = true;
    }
    
    /**
     * 隐藏控制按钮
     */
    function hideControls() {
        if (!state.isControlsVisible) return;
        
        clearTimeout(state.fadeOutTimer);
        
        const controls = [elements.videoUserCount, elements.videoChatButton];
        
        controls.forEach(control => {
            if (control) {
                control.style.transition = `opacity ${CONFIG.FADE_OUT_DURATION}ms ease-in-out`;
                control.style.opacity = '0';
                control.style.pointerEvents = 'none';
            }
        });
        
        // 延迟设置visibility，确保淡出动画完成
        state.fadeOutTimer = setTimeout(() => {
            controls.forEach(control => {
                if (control && control.style.opacity === '0') {
                    control.style.visibility = 'hidden';
                }
            });
        }, CONFIG.FADE_OUT_DURATION);
        
        state.isControlsVisible = false;
    }
    
    /**
     * 重置控制按钮状态（用于初始化）
     */
    function resetControls() {
        const controls = [elements.videoUserCount, elements.videoChatButton];
        
        controls.forEach(control => {
            if (control) {
                control.style.transition = '';
                control.style.opacity = '1';
                control.style.visibility = 'visible';
                control.style.pointerEvents = 'auto';
            }
        });
        
        state.isControlsVisible = true;
    }
    
    /**
     * 处理鼠标移动事件（全屏模式）
     */
    function handleMouseMove(event) {
        const currentTime = Date.now();
        const currentPosition = { x: event.clientX, y: event.clientY };
        
        // 计算鼠标移动距离
        const deltaX = Math.abs(currentPosition.x - state.lastMousePosition.x);
        const deltaY = Math.abs(currentPosition.y - state.lastMousePosition.y);
        const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 只有当鼠标移动超过阈值时才认为是有效移动
        if (moveDistance > CONFIG.MOUSE_MOVE_THRESHOLD) {
            state.lastMouseMoveTime = currentTime;
            state.lastMousePosition = currentPosition;
            
            // 显示控制按钮
            showControls();
            
            // 重置空闲计时器
            resetIdleTimer();
        }
    }
    
    /**
     * 处理鼠标进入视频区域事件（PC模式）
     */
    function handleMouseEnter() {
        state.isMouseInVideo = true;
        showControls();
        
        // 如果是全屏模式，重置空闲计时器
        if (checkFullscreenStatus()) {
            resetIdleTimer();
        }
    }
    
    /**
     * 处理鼠标离开视频区域事件（PC模式）
     */
    function handleMouseLeave() {
        state.isMouseInVideo = false;
        
        // 只有在非全屏模式下才立即隐藏控制按钮
        if (!checkFullscreenStatus()) {
            hideControls();
        }
    }
    
    /**
     * 重置空闲计时器（全屏模式）
     */
    function resetIdleTimer() {
        clearTimeout(state.idleTimer);
        
        state.idleTimer = setTimeout(() => {
            // 检查是否仍然在全屏模式且鼠标没有移动
            if (checkFullscreenStatus() && 
                Date.now() - state.lastMouseMoveTime >= CONFIG.IDLE_TIMEOUT) {
                hideControls();
            }
        }, CONFIG.IDLE_TIMEOUT);
    }
    
    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        // 鼠标事件
        elements.videoContainer.addEventListener('mouseenter', handleMouseEnter);
        elements.videoContainer.addEventListener('mouseleave', handleMouseLeave);
        elements.videoContainer.addEventListener('mousemove', handleMouseMove);
        
        // 全屏状态变化事件
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        // 监听页面全屏模式的变化（通过类名）
        const observer = new MutationObserver(() => {
            handleFullscreenChange();
        });
        
        observer.observe(elements.body, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // 监听全屏按钮点击事件（用于初始化状态）
        if (elements.fullscreenButton) {
            elements.fullscreenButton.addEventListener('click', () => {
                setTimeout(handleFullscreenChange, 100);
            });
        }
        
        if (elements.fullscreenWithChatButton) {
            elements.fullscreenWithChatButton.addEventListener('click', () => {
                setTimeout(handleFullscreenChange, 100);
            });
        }
        
        // 视频播放事件
        elements.videoPlayer.addEventListener('play', () => {
            console.log('智能UI控制：视频开始播放');
            // 播放时重置状态
            if (checkFullscreenStatus()) {
                resetIdleTimer();
            }
        });
        
        elements.videoPlayer.addEventListener('pause', () => {
            console.log('智能UI控制：视频暂停');
            // 暂停时保持当前状态
        });
    }
    
    /**
     * 处理全屏状态变化事件
     */
    function handleFullscreenChange() {
        const wasFullscreen = state.isFullscreen || state.isPageFullscreen;
        const isNowFullscreen = checkFullscreenStatus();
        
        if (wasFullscreen !== isNowFullscreen) {
            // 清空计时器
            clearTimeout(state.idleTimer);
            clearTimeout(state.fadeOutTimer);
            
            if (isNowFullscreen) {
                // 进入全屏模式
                console.log('智能UI控制：进入全屏模式');
                
                // 如果鼠标在视频区域内，显示控制按钮并开始空闲计时
                if (state.isMouseInVideo) {
                    showControls();
                    resetIdleTimer();
                } else {
                    // 否则延迟显示控制按钮
                    setTimeout(() => {
                        showControls();
                        resetIdleTimer();
                    }, 100);
                }
            } else {
                // 退出全屏模式
                console.log('智能UI控制：退出全屏模式');
                
                // 如果鼠标在视频区域内，显示控制按钮
                if (state.isMouseInVideo) {
                    showControls();
                } else {
                    hideControls();
                }
            }
        }
    }
    
    /**
 * 检测是否为移动端设备
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768 || // 小屏幕设备
           ('ontouchstart' in window) || // 支持触摸事件
           (navigator.maxTouchPoints > 0); // 支持多点触控
}

/**
 * 初始化模块
 */
function init() {
    console.log('智能UI控制：初始化开始');
    
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        return;
    }
    
    // 检测是否为移动端设备，如果是则跳过初始化
    if (isMobileDevice()) {
        console.log('智能UI控制：检测到移动端设备，跳过初始化');
        return;
    }
    
    // 初始化DOM元素
    if (!initElements()) {
        console.error('智能UI控制：初始化失败 - 必要的DOM元素未找到');
        return;
    }
    
    // 重置控制按钮状态
    resetControls();
    
    // 检查初始状态
    checkFullscreenStatus();
    
    // 绑定事件
    bindEvents();
    
    console.log('智能UI控制：初始化完成');
    console.log('智能UI控制：当前模式 -', checkFullscreenStatus() ? '全屏模式' : '普通模式');
}
    
    /**
     * 公共API
     */
    window.SmartUIControls = {
        /**
         * 手动显示控制按钮
         */
        showControls: function() {
            showControls();
            if (checkFullscreenStatus()) {
                resetIdleTimer();
            }
        },
        
        /**
         * 手动隐藏控制按钮
         */
        hideControls: function() {
            hideControls();
        },
        
        /**
         * 重置状态（用于调试）
         */
        reset: function() {
            resetControls();
            clearTimeout(state.idleTimer);
            clearTimeout(state.fadeOutTimer);
        },
        
        /**
         * 获取当前状态（用于调试）
         */
        getState: function() {
            return {
                isFullscreen: state.isFullscreen,
                isPageFullscreen: state.isPageFullscreen,
                isMouseInVideo: state.isMouseInVideo,
                isControlsVisible: state.isControlsVisible
            };
        }
    };
    
    // 自动初始化
    init();
    
})();
