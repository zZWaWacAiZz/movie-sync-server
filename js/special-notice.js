// 特别提醒弹窗控制
(function() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSpecialNotice);
    } else {
        initSpecialNotice();
    }

    function initSpecialNotice() {
        const specialNoticeModal = document.getElementById('specialNoticeModal');
        const closeNoticeBtn = document.getElementById('closeNoticeBtn');
        const mainContainer = document.querySelector('.main-container');

        if (!specialNoticeModal || !closeNoticeBtn || !mainContainer) {
            console.error('特别提醒弹窗元素未找到');
            return;
        }

        // 页面加载时显示特别提醒
        function checkAndShowNotice() {
            // 检查用户是否勾选了"不再显示"
            const dontShow = localStorage.getItem('specialNoticeDontShow');
            
            if (!dontShow || dontShow !== 'true') {
                specialNoticeModal.style.display = 'flex';
                // 隐藏创建房间界面
                mainContainer.style.display = 'none';
            } else {
                // 如果用户选择了不再显示，直接显示创建房间界面
                specialNoticeModal.style.display = 'none';
                mainContainer.style.display = 'flex';
                
                // 触发创建房间流程
                setTimeout(() => {
                    if (typeof showModal === 'function' && roomModal) {
                        if (!window.currentRoom || window.currentRoom.trim() === '') {
                            showModal(roomModal);
                        }
                    }
                }, 100);
            }
        }

        // 关闭特别提醒按钮事件
        closeNoticeBtn.addEventListener('click', function() {
            // 检查是否勾选了"不再显示"
            const dontShowCheckbox = document.getElementById('dontShowAgain');
            if (dontShowCheckbox && dontShowCheckbox.checked) {
                localStorage.setItem('specialNoticeDontShow', 'true');
            }
            
            // 添加关闭动画效果
            specialNoticeModal.style.opacity = '0';
            specialNoticeModal.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
                specialNoticeModal.style.display = 'none';
                mainContainer.style.display = 'flex';
                
                // 触发创建房间流程
                setTimeout(() => {
                    if (typeof showModal === 'function' && roomModal) {
                        if (!window.currentRoom || window.currentRoom.trim() === '') {
                            showModal(roomModal);
                        }
                    }
                }, 100);
            }, 300);
        });

        // 点击弹窗外部区域也可以关闭
        specialNoticeModal.addEventListener('click', function(e) {
            if (e.target === specialNoticeModal) {
                closeNoticeBtn.click();
            }
        });

        // ESC键也可以关闭弹窗
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && specialNoticeModal.style.display === 'flex') {
                closeNoticeBtn.click();
            }
        });

        // 初始化
        checkAndShowNotice();

        // 回车键在全屏模式下打开聊天框
        document.addEventListener('keydown', function(e) {
            // 只在回车键被按下时处理
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                // 检查是否在全屏或页面全屏模式
                const isFullscreen = document.fullscreenElement || 
                                 document.webkitFullscreenElement || 
                                 document.mozFullScreenElement ||
                                 document.msFullscreenElement;
                
                const isPageFullscreen = document.body.classList.contains('page-fullscreen');
                
                if (isFullscreen || isPageFullscreen) {
                    e.preventDefault(); // 阻止默认行为
                    
                    // 获取聊天输入框
                    const chatInput = document.getElementById('chatInput');
                    if (chatInput) {
                        // 确保聊天区域可见
                        const chatSection = document.querySelector('.chat-section');
                        if (chatSection) {
                            chatSection.style.display = 'flex';
                        }
                        
                        // 聚焦到输入框
                        chatInput.focus();
                        
                        // 添加视觉反馈
                        chatInput.style.boxShadow = '0 0 0 2px #4ecdc4';
                        setTimeout(() => {
                            chatInput.style.boxShadow = '';
                        }, 500);
                    }
                }
            }
        });
    }
})();