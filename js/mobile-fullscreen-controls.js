/**
 * 移动端全屏模式控制模块
 * 实现类似HTML5视频控制条的智能隐藏功能
 * 仅在移动端全屏模式下生效，不影响PC端
 */
(function() {
    'use strict';
    
    // 配置常量
    const CONFIG = {
        FADE_DURATION: 300,        // 淡入淡出动画时间（毫秒）
        IDLE_TIMEOUT: 3000,        // 无操作后自动隐藏时间（毫秒）
        MOUSE_THRESHOLD: 5,        // 鼠标移动阈值（像素）
        TOUCH_THRESHOLD: 10        // 触摸移动阈值（像素）
    };
    
    // 状态管理
    const state = {
        isMobile: false,           // 是否为移动端
        isFullscreen: false,       // 是否为全屏模式
        controlsVisible: true,     // 控制按钮是否可见
        lastTouchTime: 0,          // 最后触摸时间
        lastTouchX: 0,             // 最后触摸X坐标
        lastTouchY: 0,             // 最后触摸Y坐标
        idleTimer: null,           // 空闲计时器
        isVideoPlaying: false      // 视频是否正在播放
    };
    
    // DOM元素
    const elements = {
        body: document.body,
        videoContainer: document.querySelector('.video-container'),
        videoPlayer: document.getElementById('videoPlayer'),
        // 移动端全屏模式下的四个目标按钮
        exitButton: null,          // 退出按钮（旋转箭头）
        userCount: null,           // 在线人数显示
        roomName: null,            // 房间名称显示
        chatBubble: null,          // 聊天气泡按钮
        // 全屏模式检测
        pageFullscreen: null,
        rotateFullscreen: null
    };
    
    /**
     * 检测是否为移动端设备
     */
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768 ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }
    
    /**
     * 检测是否为全屏模式
     */
    function checkFullscreenStatus() {
        const isPageFullscreen = elements.body.classList.contains('page-fullscreen') ||
                                elements.body.classList.contains('rotate-fullscreen-active');
        const isVideoFullscreen = !!(document.fullscreenElement ||
                                   document.webkitFullscreenElement ||
                                   document.mozFullScreenElement ||
                                   document.msFullscreenElement);
        
        return isPageFullscreen || isVideoFullscreen;
    }
    
    /**
     * 初始化DOM元素
     */
    function initElements() {
        // 获取移动端全屏模式下的四个目标按钮
        elements.exitButton = document.getElementById('rotateFullscreenExitBtn');
        elements.userCount = document.querySelector('.video-user-count');
        elements.roomName = document.querySelector('.video-user-count .video-room-name');
        elements.chatBubble = document.querySelector('.video-chat-button-right');
        
        // 仅在全屏模式下创建退出按钮
        if (state.isFullscreen && !elements.exitButton) {
            createExitButton();
        }
    }
    
    /**
     * 创建退出按钮（如果不存在）
     */
    function createExitButton() {
        // 检查是否已经存在
        if (document.getElementById('rotateFullscreenExitBtn')) {
            elements.exitButton = document.getElementById('rotateFullscreenExitBtn');
            return;
        }
        
        // 创建退出按钮
        const exitBtn = document.createElement('button');
        exitBtn.id = 'rotateFullscreenExitBtn';
        exitBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
        exitBtn.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 10001 !important;
            background: transparent !important;
            color: white !important;
            border: none !important;
            width: 40px !important;
            height: 40px !important;
            font-size: 18px !important;
            cursor: pointer !important;
            filter: brightness(50%) !important;
            transform: rotate(-90deg) !important;
            opacity: 1 !important;
            transition: opacity ${CONFIG.FADE_DURATION}ms ease-in-out !important;
            display: block !important;
        `;
        
        // 添加到页面
        document.body.appendChild(exitBtn);
        elements.exitButton = exitBtn;
        
        // 绑定点击事件
        exitBtn.addEventListener('click', function() {
            // 触发全屏退出
            const fullscreenButton = document.getElementById('fullscreenButton');
            if (fullscreenButton) {
                fullscreenButton.click();
            }
        });
    }
    
    /**
     * 显示控制按钮
     */
    function showControls() {
        if (!state.controlsVisible) {
            state.controlsVisible = true;
            
            // 显示所有控制按钮
            if (elements.exitButton) {
                elements.exitButton.style.opacity = '1';
                elements.exitButton.style.pointerEvents = 'auto';
            }
            if (elements.userCount) {
                elements.userCount.style.opacity = '1';
                elements.userCount.style.pointerEvents = 'auto';
            }
            if (elements.chatBubble) {
                elements.chatBubble.style.opacity = '1';
                elements.chatBubble.style.pointerEvents = 'auto';
            }
            
            console.log('移动端全屏控制：显示控制按钮');
        }
    }
    
    /**
     * 隐藏控制按钮
     */
    function hideControls() {
        if (state.controlsVisible && state.isVideoPlaying) {
            state.controlsVisible = false;
            
            // 隐藏所有控制按钮
            if (elements.exitButton) {
                elements.exitButton.style.opacity = '0';
                elements.exitButton.style.pointerEvents = 'none';
            }
            if (elements.userCount) {
                elements.userCount.style.opacity = '0';
                elements.userCount.style.pointerEvents = 'none';
            }
            if (elements.chatBubble) {
                elements.chatBubble.style.opacity = '0';
                elements.chatBubble.style.pointerEvents = 'none';
            }
            
            console.log('移动端全屏控制：隐藏控制按钮');
        }
    }
    
    /**
     * 重置空闲计时器
     */
    function resetIdleTimer() {
        // 清除之前的计时器
        if (state.idleTimer) {
            clearTimeout(state.idleTimer);
        }
        
        // 显示控制按钮
        showControls();
        
        // 设置新的计时器
        state.idleTimer = setTimeout(() => {
            hideControls();
        }, CONFIG.IDLE_TIMEOUT);
    }
    
    /**
     * 处理触摸开始事件
     */
    function handleTouchStart(event) {
        if (!state.isFullscreen || !state.isMobile) return;
        
        const touch = event.touches[0];
        state.lastTouchX = touch.clientX;
        state.lastTouchY = touch.clientY;
        state.lastTouchTime = Date.now();
        
        // 重置空闲计时器
        resetIdleTimer();
    }
    
    /**
     * 处理触摸移动事件
     */
    function handleTouchMove(event) {
        if (!state.isFullscreen || !state.isMobile) return;
        
        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - state.lastTouchX);
        const deltaY = Math.abs(touch.clientY - state.lastTouchY);
        
        // 如果移动距离超过阈值，重置计时器
        if (deltaX > CONFIG.TOUCH_THRESHOLD || deltaY > CONFIG.TOUCH_THRESHOLD) {
            state.lastTouchX = touch.clientX;
            state.lastTouchY = touch.clientY;
            resetIdleTimer();
        }
    }
    
    /**
     * 处理视频播放状态变化
     */
    function handleVideoPlay() {
        state.isVideoPlaying = true;
        if (state.isFullscreen && state.isMobile) {
            resetIdleTimer();
        }
    }
    
    /**
     * 处理视频暂停状态变化
     */
    function handleVideoPause() {
        state.isVideoPlaying = false;
        showControls(); // 暂停时显示控制按钮
    }
    
    /**
     * 处理全屏状态变化
     */
    function handleFullscreenChange() {
        const wasFullscreen = state.isFullscreen;
        state.isFullscreen = checkFullscreenStatus();
        
        if (state.isMobile) {
            if (state.isFullscreen && !wasFullscreen) {
                // 进入全屏模式
                console.log('移动端全屏控制：进入全屏模式');
                initElements();
                showControls();
                resetIdleTimer();
            } else if (!state.isFullscreen && wasFullscreen) {
                // 退出全屏模式
                console.log('移动端全屏控制：退出全屏模式');
                showControls(); // 退出时显示所有按钮
                if (state.idleTimer) {
                    clearTimeout(state.idleTimer);
                    state.idleTimer = null;
                }
            }
        }
    }
    
    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        // 触摸事件
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        
        // 全屏状态变化事件
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        // 监听页面全屏类名变化
        const observer = new MutationObserver(handleFullscreenChange);
        observer.observe(elements.body, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // 视频播放状态事件
        if (elements.videoPlayer) {
            elements.videoPlayer.addEventListener('play', handleVideoPlay);
            elements.videoPlayer.addEventListener('pause', handleVideoPause);
            elements.videoPlayer.addEventListener('ended', handleVideoPause);
        }
        
        // 监听全屏按钮点击事件
        const fullscreenButton = document.getElementById('fullscreenButton');
        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', () => {
                setTimeout(handleFullscreenChange, 100);
            });
        }
        
        // 监听浏览器全屏按钮点击事件
        const fullscreenWithChatButton = document.getElementById('fullscreenWithChatButton');
        if (fullscreenWithChatButton) {
            fullscreenWithChatButton.addEventListener('click', () => {
                setTimeout(handleFullscreenChange, 100);
            });
        }
    }
    
    /**
     * 初始化函数
     */
    function init() {
        // 检测是否为移动端
        state.isMobile = isMobileDevice();
        
        if (!state.isMobile) {
            console.log('移动端全屏控制：检测到PC端设备，跳过初始化');
            return;
        }
        
        console.log('移动端全屏控制：初始化开始');
        
        // 初始化DOM元素
        initElements();
        
        // 检测初始全屏状态
        state.isFullscreen = checkFullscreenStatus();
        
        // 如果初始就是全屏模式，显示控制按钮
        if (state.isFullscreen) {
            showControls();
            resetIdleTimer();
        }
        
        // 绑定事件
        bindEvents();
        
        console.log('移动端全屏控制：初始化完成');
    }
    
    /**
     * 公共API
     */
    window.MobileFullscreenControls = {
        showControls: showControls,
        hideControls: hideControls,
        getState: function() {
            return {
                isMobile: state.isMobile,
                isFullscreen: state.isFullscreen,
                controlsVisible: state.controlsVisible,
                isVideoPlaying: state.isVideoPlaying
            };
        },
        reset: function() {
            showControls();
            if (state.idleTimer) {
                clearTimeout(state.idleTimer);
                state.idleTimer = null;
            }
            if (state.isFullscreen && state.isMobile) {
                resetIdleTimer();
            }
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();