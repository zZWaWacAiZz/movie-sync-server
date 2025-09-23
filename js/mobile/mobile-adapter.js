/**
 * 移动端检测和初始化模块
 * 负责检测移动设备并应用相应的样式和功能适配
 */

(function() {
    'use strict';
    
    /**
     * 检测是否为移动设备
     * @returns {boolean} 是否为移动设备
     */
    function isMobileDevice() {
        // 检测用户代理字符串
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = [
            'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry',
            'iemobile', 'opera mini', 'mobile', 'tablet'
        ];
        
        // 检测屏幕宽度
        const screenWidth = window.innerWidth || document.documentElement.clientWidth;
        
        // 检测触摸支持
        const hasTouchSupport = 'ontouchstart' in window || 
                               navigator.maxTouchPoints > 0 || 
                               navigator.msMaxTouchPoints > 0;
        
        // 综合判断
        const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
        const isSmallScreen = screenWidth <= 768;
        
        return isMobileUA || isSmallScreen || (hasTouchSupport && isSmallScreen);
    }
    
    /**
     * 检测是否为iOS设备
     * @returns {boolean} 是否为iOS设备
     */
    function isIOSDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent);
    }
    
    /**
     * 检测是否为Android设备
     * @returns {boolean} 是否为Android设备
     */
    function isAndroidDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /android/.test(userAgent);
    }
    
    /**
     * 应用移动端样式
     */
    function applyMobileStyles() {
        // 添加移动端标识类
        document.documentElement.classList.add('mobile-device');
        
        // 根据设备类型添加特定类
        if (isIOSDevice()) {
            document.documentElement.classList.add('ios-device');
        } else if (isAndroidDevice()) {
            document.documentElement.classList.add('android-device');
        }
        
        // 设置viewport meta标签
        setViewportMeta();
        
        // 应用触摸优化
        applyTouchOptimizations();
        
        // 确保预加载页面在移动端正确显示
        ensurePreloaderVisibility();
        
        console.log('移动端样式已应用');
    }
    
    /**
     * 确保预加载页面在移动端正确显示
     */
    function ensurePreloaderVisibility() {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            // 确保预加载页面在移动端有最高z-index
            preloader.style.zIndex = '99999';
            preloader.style.position = 'fixed';
            preloader.style.top = '0';
            preloader.style.left = '0';
            preloader.style.width = '100%';
            preloader.style.height = '100%';
            preloader.style.background = 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)';
            preloader.style.display = 'flex';
            preloader.style.opacity = '1';
            preloader.style.visibility = 'visible';
            
            console.log('预加载页面移动端可见性已确保');
        }
    }
    
    /**
     * 设置viewport meta标签
     */
    function setViewportMeta() {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            document.head.appendChild(viewportMeta);
        }
        
        // 设置适合移动端的viewport
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }
    
    /**
     * 应用触摸优化
     */
    function applyTouchOptimizations() {
        // 为触摸设备添加事件监听器
        document.addEventListener('touchstart', function() {}, { passive: true });
        
        // 优化输入框的触摸体验
        const inputs = document.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(input => {
            input.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                this.focus();
            }, { passive: true });
        });
        
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(event) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    }
    
    /**
     * 优化移动端滚动
     */
    function optimizeMobileScroll() {
        const scrollableElements = [
            '.chat-messages',
            '.custom-dropdown-options',
            '.modal-content'
        ];
        
        scrollableElements.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.webkitOverflowScrolling = 'touch';
                element.style.scrollBehavior = 'smooth';
            });
        });
    }
    
    /**
     * 处理键盘弹出时的布局调整
     */
    function handleKeyboardAdjustment() {
        if (!isMobileDevice()) return;
        
        const originalHeight = window.innerHeight;
        let isKeyboardVisible = false;
        
        window.addEventListener('resize', function() {
            const currentHeight = window.innerHeight;
            const heightDiff = originalHeight - currentHeight;
            
            // 检测键盘是否弹出（高度差大于100像素）
            if (heightDiff > 100) {
                isKeyboardVisible = true;
                document.body.classList.add('keyboard-visible');
                
                // 调整聊天区域高度
                const chatSection = document.querySelector('.chat-section');
                if (chatSection) {
                    chatSection.style.height = `calc(65vh - ${heightDiff}px)`;
                }
            } else {
                isKeyboardVisible = false;
                document.body.classList.remove('keyboard-visible');
                
                // 恢复聊天区域高度
                const chatSection = document.querySelector('.chat-section');
                if (chatSection) {
                    chatSection.style.height = '65vh';
                }
            }
        });
    }
    
    /**
     * 处理横竖屏切换
     */
    function handleOrientationChange() {
        window.addEventListener('orientationchange', function() {
            // 延迟执行，等待旋转完成
            setTimeout(function() {
                // 重新计算布局
                const videoSection = document.querySelector('.video-section');
                const chatSection = document.querySelector('.chat-section');
                
                if (window.orientation === 90 || window.orientation === -90) {
                    // 横屏模式
                    if (videoSection) videoSection.style.height = '40vh';
                    if (chatSection) chatSection.style.height = '60vh';
                } else {
                    // 竖屏模式
                    if (videoSection) videoSection.style.height = '35vh';
                    if (chatSection) chatSection.style.height = '65vh';
                }
                
                console.log('屏幕方向已改变，重新调整布局');
            }, 300);
        });
    }
    
    /**
     * 初始化移动端功能
     */
    function initializeMobileFeatures() {
        if (!isMobileDevice()) {
            console.log('非移动设备，跳过移动端初始化');
            return;
        }
        
        console.log('检测到移动设备，开始初始化移动端功能');
        
        // 应用移动端样式
        applyMobileStyles();
        
        // 优化滚动
        optimizeMobileScroll();
        
        // 处理键盘调整
        handleKeyboardAdjustment();
        
        // 处理方向变化
        handleOrientationChange();
        
        // 添加移动端特定的触摸事件
        addMobileTouchEvents();
        
        // 优化按钮触摸反馈
        optimizeButtonTouchFeedback();
        
        // 初始化功能一按钮事件
        initializeMobileFeature1();
        
        // 优化A按钮弹窗定位
        optimizeMobileAButtonPopup();
        
        console.log('移动端功能初始化完成');
    }
    
    /**
     * 添加移动端触摸事件
     */
    function addMobileTouchEvents() {
        // 为聊天消息添加长按菜单（如果需要）
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
            let longPressTimer;
            let isLongPress = false;
            
            chatMessages.addEventListener('touchstart', function(e) {
                longPressTimer = setTimeout(function() {
                    isLongPress = true;
                    // 可以在这里添加长按菜单逻辑
                }, 500);
            }, { passive: true });
            
            chatMessages.addEventListener('touchend', function(e) {
                clearTimeout(longPressTimer);
                if (isLongPress) {
                    e.preventDefault();
                    isLongPress = false;
                }
            }, { passive: false });
            
            chatMessages.addEventListener('touchmove', function() {
                clearTimeout(longPressTimer);
            }, { passive: true });
        }
    }
    
    /**
     * 优化按钮触摸反馈
     */
    function optimizeButtonTouchFeedback() {
        const buttons = document.querySelectorAll('button, .control-button, .chat-tool-button');
        
        buttons.forEach(button => {
            // 添加触摸反馈效果
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.95)';
                this.style.transition = 'transform 0.1s ease';
            }, { passive: true });
            
            button.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
            }, { passive: true });
            
            button.addEventListener('touchcancel', function() {
                this.style.transform = 'scale(1)';
            }, { passive: true });
        });
    }
    
    /**
     * 获取设备信息
     * @returns {Object} 设备信息对象
     */
    function getDeviceInfo() {
        return {
            isMobile: isMobileDevice(),
            isIOS: isIOSDevice(),
            isAndroid: isAndroidDevice(),
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            orientation: window.orientation || 0,
            userAgent: navigator.userAgent
        };
    }
    
    /**
     * 显示移动端功能一弹窗
     */
    function showMobileFeature1Modal() {
        if (!isMobileDevice()) return;
        
        // 创建弹窗HTML
        const modalHTML = `
            <div id="mobileFeature1Modal" class="mobile-feature1-modal">
                <div class="mobile-feature1-content">
                    <div class="mobile-feature1-header">
                        <h3 class="mobile-feature1-title">视频链接管理</h3>
                        <div class="mobile-feature1-header-buttons">
                            <button class="mobile-feature1-local-header-btn" onclick="MobileAdapter.handleMobileLocalVideo()">
                                <i class="fas fa-film"></i>
                                本地视频
                            </button>
                            <button class="mobile-feature1-close" onclick="MobileAdapter.hideMobileFeature1Modal()">×</button>
                        </div>
                    </div>
                    <div class="mobile-feature1-body">
                        <div class="mobile-feature1-input-group">
                            <label class="mobile-feature1-label" for="mobileVideoUrlInput">视频网址</label>
                            <input type="text" id="mobileVideoUrlInput" class="mobile-feature1-input" placeholder="请输入网络视频链接">
                        </div>
                    </div>
                    <div class="mobile-feature1-buttons">
                        <button class="mobile-feature1-button mobile-feature1-load-btn" onclick="MobileAdapter.handleMobileLoadVideo()">
                            <i class="fas fa-download"></i>
                            加载
                        </button>
                        <button class="mobile-feature1-button mobile-feature1-share-btn" onclick="MobileAdapter.handleMobileShareVideo()">
                            <i class="fas fa-share-alt"></i>
                            共享
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 如果弹窗已存在，先移除
        const existingModal = document.getElementById('mobileFeature1Modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 添加弹窗到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 显示弹窗
        const modal = document.getElementById('mobileFeature1Modal');
        if (modal) {
            // 移除隐藏类
            modal.classList.remove('hidden');
            
            // 设置输入框的值（如果已有视频URL）
            const existingVideoUrlInput = document.getElementById('videoUrlInput');
            const mobileVideoUrlInput = document.getElementById('mobileVideoUrlInput');
            if (existingVideoUrlInput && mobileVideoUrlInput) {
                mobileVideoUrlInput.value = existingVideoUrlInput.value;
            }
            
            // 聚焦到输入框
            setTimeout(() => {
                if (mobileVideoUrlInput) {
                    mobileVideoUrlInput.focus();
                    mobileVideoUrlInput.select();
                }
            }, 100);
            
            // 添加点击背景关闭功能
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hideMobileFeature1Modal();
                }
            });
            
            // 添加键盘事件监听
            document.addEventListener('keydown', handleModalKeydown);
            
            console.log('移动端功能一弹窗已显示');
        }
    }
    
    /**
     * 隐藏移动端功能一弹窗
     */
    function hideMobileFeature1Modal() {
        const modal = document.getElementById('mobileFeature1Modal');
        if (modal) {
            // 添加隐藏动画
            modal.style.opacity = '0';
            modal.style.transform = 'scale(0.9)';
            
            setTimeout(() => {
                modal.remove();
                // 移除键盘事件监听
                document.removeEventListener('keydown', handleModalKeydown);
            }, 200);
            
            console.log('移动端功能一弹窗已隐藏');
        }
    }
    
    /**
     * 处理弹窗键盘事件
     */
    function handleModalKeydown(e) {
        if (e.key === 'Escape') {
            hideMobileFeature1Modal();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Enter 或 Cmd+Enter 触发加载
            handleMobileLoadVideo();
        }
    }
    
    /**
     * 处理移动端加载视频
     */
    function handleMobileLoadVideo() {
        const mobileVideoUrlInput = document.getElementById('mobileVideoUrlInput');
        const existingVideoUrlInput = document.getElementById('videoUrlInput');
        const loadUrlButton = document.getElementById('loadUrlButton');
        
        if (mobileVideoUrlInput && existingVideoUrlInput) {
            const videoUrl = mobileVideoUrlInput.value.trim();
            
            if (!videoUrl) {
                showBottomToast('请输入视频链接');
                return;
            }
            
            // 同步到PC端输入框
            existingVideoUrlInput.value = videoUrl;
            
            // 触发PC端的加载按钮点击事件
            if (loadUrlButton) {
                loadUrlButton.click();
            }
            
            // 关闭弹窗
            hideMobileFeature1Modal();
            
            showBottomToast('视频加载中...');
        }
    }
    
    /**
     * 处理移动端共享视频
     */
    function handleMobileShareVideo() {
        const mobileVideoUrlInput = document.getElementById('mobileVideoUrlInput');
        const existingVideoUrlInput = document.getElementById('videoUrlInput');
        const shareButton = document.getElementById('shareButton');
        
        if (mobileVideoUrlInput && existingVideoUrlInput) {
            const videoUrl = mobileVideoUrlInput.value.trim() || existingVideoUrlInput.value.trim();
            
            if (!videoUrl) {
                showBottomToast('没有可共享的视频链接');
                return;
            }
            
            // 同步到PC端输入框
            existingVideoUrlInput.value = videoUrl;
            
            // 触发PC端的共享按钮点击事件
            if (shareButton) {
                shareButton.click();
            }
            
            // 关闭弹窗
            hideMobileFeature1Modal();
        }
    }
    
    /**
     * 初始化移动端功能一按钮事件
     */
    function initializeMobileFeature1() {
        if (!isMobileDevice()) return;
        
        // 为功能一按钮添加点击事件
        const feature1Button = document.querySelector('[data-feature="1"]');
        if (feature1Button) {
            // 移除原有的点击事件（如果有）
            feature1Button.replaceWith(feature1Button.cloneNode(true));
            
            // 获取新的按钮引用
            const newFeature1Button = document.querySelector('[data-feature="1"]');
            if (newFeature1Button) {
                newFeature1Button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('移动端视频选择按钮被点击');
                    showMobileFeature1Modal();
                    
                    // 关闭功能菜单
                    if (typeof hideFeatureMenu === 'function') {
                        hideFeatureMenu();
                    }
                });
                
                console.log('移动端视频选择按钮事件已绑定');
            }
        }
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMobileFeatures);
    } else {
        // 如果页面已经加载完成，立即初始化
        initializeMobileFeatures();
    }
    
    // 页面可见性变化时重新检查
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && isMobileDevice()) {
            setTimeout(initializeMobileFeatures, 100);
        }
    });
    
    /**
     * 处理移动端本地视频选择 - 完全复制PC端功能
     */
    function handleMobileLocalVideo() {
        // 创建隐藏的文件输入元素（如果不存在）
        let mobileVideoInput = document.getElementById('mobileLocalVideoInput');
        if (!mobileVideoInput) {
            mobileVideoInput = document.createElement('input');
            mobileVideoInput.type = 'file';
            mobileVideoInput.id = 'mobileLocalVideoInput';
            mobileVideoInput.accept = 'video/*';
            mobileVideoInput.style.display = 'none';
            document.body.appendChild(mobileVideoInput);
            
            // 添加文件选择事件监听
            mobileVideoInput.addEventListener('change', handleMobileLocalVideoSelection);
        }
        
        // 触发文件选择对话框
        mobileVideoInput.click();
    }
    
    /**
     * 处理移动端本地视频文件选择 - 完全复制PC端handleLocalVideoSelection功能
     */
    function handleMobileLocalVideoSelection(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // 添加调试日志，开始跟踪视频切换过程
        console.log('移动端开始处理本地视频选择:', file.name);
        
        // 验证文件类型
        if (!file.type.startsWith('video/')) {
            if (typeof window.errorHandler !== 'undefined' && window.errorHandler.showError) {
                window.errorHandler.showError('请选择有效的视频文件');
            } else {
                showBottomToast('请选择有效的视频文件');
            }
            return;
        }
        
        // 获取PC端的所有必要元素
        const videoPlayer = document.getElementById('videoPlayer');
        const videoUrlInput = document.getElementById('videoUrlInput');
        const loadUrlButton = document.getElementById('loadUrlButton');
        
        if (!videoPlayer || !videoUrlInput || !loadUrlButton) {
            showBottomToast('视频播放器未准备好');
            return;
        }
        
        // 显示加载状态
        if (typeof addStatusMessage === 'function') {
            addStatusMessage('正在加载本地视频...');
        } else {
            showBottomToast('正在加载本地视频...');
        }
        
        // 关闭移动端弹窗
        hideMobileFeature1Modal();
        
        // 重置关键变量（从PC端复制）
        if (typeof isLoading !== 'undefined') {
            isLoading = false;
        }
        
        // 移除之前可能存在的错误监听器
        videoPlayer.onerror = null;
        
        // 清理HLS实例（如果存在）
        if (typeof window.hls !== 'undefined' && window.hls) {
            window.hls.destroy();
            window.hls = null;
            console.log('移动端已销毁HLS实例，准备加载本地视频');
        }
        if (typeof window.hlsLoadTimeout !== 'undefined' && window.hlsLoadTimeout) {
            clearTimeout(window.hlsLoadTimeout);
            window.hlsLoadTimeout = null;
            console.log('移动端已清除HLS加载超时计时器');
        }
        
        // 释放之前创建的本地视频对象URL（如果存在全局变量）
        if (typeof window.previousLocalVideoUrl !== 'undefined' && window.previousLocalVideoUrl) {
            URL.revokeObjectURL(window.previousLocalVideoUrl);
            window.previousLocalVideoUrl = null;
            console.log('移动端已释放之前的本地视频URL，防止资源混淆');
        }
        
        // 完全重置视频播放器状态 - 增强版
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        videoPlayer.src = '';
        videoPlayer.load(); // 先执行一次空加载，彻底清除当前状态
        console.log('移动端已完全重置视频播放器状态，准备加载新视频');
        
        // 保存当前视频的唯一标识，添加LOCAL_前缀以区分本地和网络视频
        const currentVideoId = 'LOCAL_' + file.name;
        if (typeof window.currentVideoId !== 'undefined') {
            window.currentVideoId = currentVideoId;
        }
        
        // 添加延迟，确保浏览器有足够时间释放旧资源
        setTimeout(() => {
            // 创建新的本地视频URL
            const videoURL = URL.createObjectURL(file);
            if (typeof window.previousLocalVideoUrl !== 'undefined') {
                window.previousLocalVideoUrl = videoURL;
            }
            
            // 加载视频
            videoPlayer.src = videoURL;
            videoPlayer.load();
            
            // 添加错误恢复机制
            videoPlayer.onerror = function(error) {
                console.error('移动端视频加载错误:', error);
                if (typeof addStatusMessage === 'function') {
                    addStatusMessage('视频加载失败，正在尝试恢复...');
                } else {
                    showBottomToast('视频加载失败，正在尝试恢复...');
                }
                
                // 尝试恢复策略：重新创建URL并加载
                setTimeout(() => {
                    // 再次释放并重新创建URL
                    if (typeof window.previousLocalVideoUrl !== 'undefined' && window.previousLocalVideoUrl) {
                        URL.revokeObjectURL(window.previousLocalVideoUrl);
                    }
                    const recoveryURL = URL.createObjectURL(file);
                    if (typeof window.previousLocalVideoUrl !== 'undefined') {
                        window.previousLocalVideoUrl = recoveryURL;
                    }
                    
                    videoPlayer.src = recoveryURL;
                    videoPlayer.load();
                    console.log(`移动端尝试恢复视频加载: ${file.name}`);
                }, 300);
            };
            
            // 监听视频加载完成事件
            videoPlayer.onloadeddata = function() {
                console.log(`移动端本地视频 ${file.name} 数据加载完成`);
                
                // 在视频加载完成后发送更新事件
                setTimeout(() => {
                    // 发送视频资源更新事件到服务器（如果socket存在）
                    if (typeof socket !== 'undefined' && socket && typeof currentRoom !== 'undefined' && currentRoom) {
                        socket.emit('video_resource_update', {
                            room: currentRoom,
                            videoName: currentVideoId
                        });
                    }
                }, 500);
            };
            
            // 添加日志以便调试
            console.log(`移动端已加载本地视频 ${file.name}，URL: ${videoURL}`);
        }, 200); // 200毫秒延迟，给浏览器更多时间释放资源
        
        // 添加状态消息
        if (typeof addStatusMessage === 'function') {
            addStatusMessage(`正在加载本地视频: ${file.name}...`);
        } else {
            showBottomToast(`正在加载本地视频: ${file.name}...`);
        }
        
        // 通知房间内其他用户当前使用的视频资源（如果socket存在）
        if (typeof socket !== 'undefined' && socket && typeof currentRoom !== 'undefined' && currentRoom) {
            socket.emit('video_resource_update', {
                room: currentRoom,
                videoName: currentVideoId
            });
            
            // 请求同步当前房间的视频进度
            setTimeout(() => {
                if (currentRoom && (typeof isLoading === 'undefined' || !isLoading)) {
                    console.log(`移动端发送视频状态请求到房间 ${currentRoom}`);
                    socket.emit('video_state_request', {
                        room: currentRoom
                    });
                    if (typeof addStatusMessage === 'function') {
                        addStatusMessage('正在同步视频进度...');
                    } else {
                        showBottomToast('正在同步视频进度...');
                    }
                }
            }, 1000);
        }
        
        // 清空文件输入，允许重复选择同一文件
        e.target.value = '';
    }
    
    /**
     * 移动端A按钮弹窗定位优化
     * 确保弹窗在移动端不会超出屏幕边界
     * 优化策略：居中右移30px + 边界检测，避免左侧遮挡
     */
    function optimizeMobileAButtonPopup() {
        // 监听A按钮点击事件
        document.addEventListener('click', function(e) {
            const aButton = e.target.closest('#aButton, .a-button, #fullscreenAButton');
            if (!aButton) return;
            
            // 阻止事件冒泡，避免与PC端逻辑冲突
            e.preventDefault();
            e.stopPropagation();
            
            // 延迟执行，确保弹窗已创建
            setTimeout(function() {
                const popup = document.querySelector('.a-button-popup, #aButtonPopup, #fullscreenAButtonPopup');
                if (!popup) return;
                
                // 检测是否为全屏模式
                const isFullscreen = popup.id === 'fullscreenAButtonPopup' || document.body.classList.contains('page-fullscreen');
                
                // 获取按钮位置
                const buttonRect = aButton.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                if (isFullscreen) {
                    // 全屏模式优化：居中显示，减小尺寸
                    const popupWidth = 260; // 全屏模式使用较小宽度
                    const popupHeight = Math.min(300, viewportHeight * 0.5); // 限制高度为视口一半
                    const margin = 20; // 边距
                    
                    // 计算理想位置：水平居中，垂直方向在按钮上方
                    let idealLeft = (viewportWidth - popupWidth) / 2;
                    let idealTop = buttonRect.top - popupHeight - margin;
                    
                    // 如果上方空间不足，显示在按钮下方
                    if (idealTop < margin) {
                        idealTop = buttonRect.bottom + margin;
                    }
                    
                    // 确保不超出边界
                    if (idealLeft < margin) idealLeft = margin;
                    if (idealLeft + popupWidth > viewportWidth - margin) {
                        idealLeft = viewportWidth - popupWidth - margin;
                    }
                    
                    // 应用全屏模式样式
                    popup.style.position = 'fixed';
                    popup.style.top = idealTop + 'px';
                    popup.style.left = idealLeft + 'px';
                    popup.style.bottom = 'auto';
                    popup.style.right = 'auto';
                    popup.style.transform = 'none';
                    popup.style.margin = '0';
                    popup.style.width = popupWidth + 'px';
                    popup.style.maxHeight = popupHeight + 'px';
                    
                    console.log('移动端全屏模式A按钮弹窗定位优化:', {
                        buttonRect: buttonRect,
                        idealTop: idealTop,
                        idealLeft: idealLeft,
                        viewport: { width: viewportWidth, height: viewportHeight },
                        strategy: '全屏模式居中显示',
                        isFullscreen: isFullscreen
                    });
                } else {
                    // 普通模式：使用原有的居中右移策略
                    const popupWidth = 280; // 普通模式弹窗宽度
                    const popupHeight = 320; // 普通模式弹窗高度
                    const margin = 15; // 边距
                    
                    // 计算理想位置（按钮上方）
                    let idealTop = buttonRect.top - popupHeight - margin;
                    // 移动端优化：在居中基础上向右移动30px，避免左边被遮挡
                    let idealLeft = buttonRect.left + buttonRect.width / 2 - popupWidth / 2 + 30;
                    
                    // 边界检测
                    if (idealTop < margin) {
                        idealTop = buttonRect.bottom + margin;
                    }
                    
                    // 确保不超出左右边界
                    if (idealLeft < margin) {
                        idealLeft = margin;
                    } else if (idealLeft + popupWidth > viewportWidth - margin) {
                        idealLeft = viewportWidth - popupWidth - margin;
                    }
                    
                    // 确保不超出底部边界
                    if (idealTop + popupHeight > viewportHeight - margin) {
                        idealTop = viewportHeight - popupHeight - margin;
                    }
                    
                    // 应用计算后的位置
                    popup.style.position = 'fixed';
                    popup.style.top = idealTop + 'px';
                    popup.style.left = idealLeft + 'px';
                    popup.style.bottom = 'auto';
                    popup.style.right = 'auto';
                    popup.style.transform = 'none';
                    popup.style.margin = '0';
                    
                    console.log('移动端普通模式A按钮弹窗定位优化:', {
                        buttonRect: buttonRect,
                        idealTop: idealTop,
                        idealLeft: idealLeft,
                        viewport: { width: viewportWidth, height: viewportHeight },
                        strategy: '居中右移30px + 边界检测',
                        isFullscreen: isFullscreen
                    });
                }
                
                // 确保弹窗可见
                popup.style.display = 'block';
                popup.style.visibility = 'visible';
                popup.style.zIndex = '2147483647';
            }, 50);
        });
        
        // 监听弹窗显示事件（如果存在）
        document.addEventListener('abutton-popup-show', function() {
            optimizeMobileAButtonPopup();
        });
    }
    
    /**
     * 暴露全局接口
     */
    window.MobileAdapter = {
        isMobileDevice: isMobileDevice,
        isIOSDevice: isIOSDevice,
        isAndroidDevice: isAndroidDevice,
        getDeviceInfo: getDeviceInfo,
        initialize: initializeMobileFeatures,
        showMobileFeature1Modal: showMobileFeature1Modal,
        hideMobileFeature1Modal: hideMobileFeature1Modal,
        handleMobileLoadVideo: handleMobileLoadVideo,
        handleMobileShareVideo: handleMobileShareVideo,
        handleMobileLocalVideo: handleMobileLocalVideo,
        optimizeMobileAButtonPopup: optimizeMobileAButtonPopup
    };

})();