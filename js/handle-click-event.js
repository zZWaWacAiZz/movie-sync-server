// 获取DOM元素
    const backButton = document.getElementById('backButton');
    const exitRoomButton = document.getElementById('exitRoomButton');
    const exitConfirmModal = document.getElementById('exitConfirmModal');
    const cancelExit = document.getElementById('cancelExit');
    const confirmExit = document.getElementById('confirmExit');
    
    // 返回上一页按钮点击事件 - 增加画中画功能
    backButton.addEventListener('click', function() {
      const videoElement = document.getElementById('videoPlayer');
      
      // 检查是否支持画中画功能
      if (videoElement && document.pictureInPictureEnabled && !videoElement.disablePictureInPicture) {
        // 如果当前不在画中画模式，则开启画中画
        if (document.pictureInPictureElement !== videoElement) {
          videoElement.requestPictureInPicture().then(() => {
            console.log('画中画模式已开启');
            // 画中画开启成功后才返回上一页
            if (window.history.length > 1) {
              window.history.back(); // 返回上一页
            } else {
              window.location.href = 'https://www.baidu.com'; // 如果没有历史记录则跳转到百度
            }
          }).catch(error => {
            console.error('画中画开启失败:', error);
            // 如果画中画失败，提示用户并直接返回
            addStatusMessage('画中画功能不可用，直接返回上一页');
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = 'https://www.baidu.com';
            }
          });
        } else {
          // 如果已经在画中画模式，直接返回上一页
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = 'https://www.baidu.com';
          }
        }
      } else {
        // 如果不支持画中画或没有视频元素，直接返回上一页
        addStatusMessage('浏览器不支持画中画功能，直接返回上一页');
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = 'https://www.baidu.com';
        }
      }
    });
    
    // 点击退出房间按钮，只有在已加入房间时才显示确认弹窗
    exitRoomButton.addEventListener('click', function() {
      if (currentRoom && currentRoom.trim() !== '') {
        showModal(exitConfirmModal);
      } else {
        // 如果未加入房间，显示提示
        showBottomToast('请先加入房间');
      }
    });
    
    // 点击取消按钮，关闭弹窗
    cancelExit.addEventListener('click', function() {
      hideModal(exitConfirmModal);
    });
    
    // 点击继续按钮，执行退出操作 - 仅退出当前房间，保留本地缓存数据
    confirmExit.addEventListener('click', function() {
      try {
        // 关闭弹窗
        hideModal(exitConfirmModal);
        
        // 如果已加入房间，发送离开房间消息给服务器
        if (currentRoom && socket) {
          if (!socket.connected) {
            console.warn('Socket连接已断开，无法发送离开房间消息');
            // 即使连接断开也执行本地清理操作
            performLocalRoomCleanup();
            return;
          }
          
          // 发送离开房间消息给服务器（不直接断开socket连接）
          console.log('正在发送离开房间请求...', { room: currentRoom });
          socket.emit('leave_room', { room: currentRoom });
          
          // 设置超时处理，3秒后如果没有响应也执行清理
          const timeoutId = setTimeout(() => {
            console.log('离开房间请求超时，执行本地清理');
            performLocalRoomCleanup();
          }, 3000);
          
          // 监听一次响应，然后清除超时
          socket.once('leave_room_success', () => {
            clearTimeout(timeoutId);
            performLocalRoomCleanup();
          });
          
          // 移除leave_room_error处理，因为按钮被禁用后不再触发
        } else {
          // 如果没有加入房间，直接清理
          performLocalRoomCleanup();
        }
      } catch (error) {
        console.error('退出房间错误:', error);
        window.errorHandler.showError('退出房间失败，请重试');
      }
    });
    
    // 执行本地房间清理的函数
    function performLocalRoomCleanup() {
      // 清空当前房间信息（但保留聊天记录和用户列表的HTML内容）
      currentRoom = '';
      
      // 要求1：房间名称加上括号避免用户名冲突
      currentRoomNameEl.innerHTML = '(未加入房间)';
      
      // 要求2：清空在线人数显示为0
      const userCountEl = document.getElementById('userCount');
      if (userCountEl) userCountEl.textContent = '0';
      
      // 要求3：清空用户列表到初始状态
      const usersList = document.getElementById('usersList');
      const modalUsersList = document.getElementById('modalUsersList');
      
      if (usersList) {
        usersList.innerHTML = '';
      }
      
      // 要求4：断开不必要的连接（只保留主socket连接）
      // 清除视频播放数据，恢复到未加载状态
      clearVideoPlayerData();
      
      // 清除全屏聊天设置
      clearFullscreenChatSettings();
      
      // 禁用退出房间按钮（桌面端）
      disableExitRoomButtons();
      
      // 禁用准备按钮
      const readyButton = document.getElementById('readyButton');
      if (readyButton) {
        readyButton.style.opacity = '0.5';
        readyButton.style.cursor = 'not-allowed';
        readyButton.title = '请先加入房间';
      }
      
      // 显示房间创建/加入弹窗，使用showModal函数确保居中
      if (roomModal) {
        showModal(roomModal);
      }
      
      // 添加状态消息
      addStatusMessage('已退出房间');
    }
    
    // 简化版：退出房间按钮状态更新（仅用于视觉提示）
    function disableExitRoomButtons() {
      // 更新桌面端退出房间按钮视觉状态
      const exitRoomButton = document.getElementById('exitRoomButton');
      if (exitRoomButton) {
        exitRoomButton.style.opacity = '0.5';
        exitRoomButton.style.cursor = 'not-allowed';
        exitRoomButton.title = '请先加入房间';
      }
    }
    
    // 简化版：启用退出房间按钮（仅用于视觉提示）
    function enableExitRoomButtons() {
      // 更新桌面端退出房间按钮视觉状态
      const exitRoomButton = document.getElementById('exitRoomButton');
      if (exitRoomButton) {
        exitRoomButton.style.opacity = '1';
        exitRoomButton.style.cursor = 'pointer';
        exitRoomButton.title = '退出当前房间';
      }
    }
    
    // 清除视频播放器数据的函数 - 完全回到未加载状态
    function clearVideoPlayerData() {
      // 1. 完全停止视频播放并清除所有数据
      if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.removeAttribute('src'); // 完全移除src属性
        videoPlayer.load(); // 强制加载空状态
        videoPlayer.currentTime = 0;
        
        // 清除视频元数据，强制回到未加载状态
        videoPlayer.src = '';
        videoPlayer.load();
      }
      
      // 2. 彻底清理HLS实例
      if (window.hls) {
        try {
          window.hls.destroy();
        } catch (e) {
          console.warn('清理HLS实例时出错:', e);
        }
        window.hls = null;
        delete window.hls;
      }
      
      // 3. 清理所有网络视频相关资源
      if (window.hlsLoadTimeout) {
        clearTimeout(window.hlsLoadTimeout);
        window.hlsLoadTimeout = null;
      }
      
      // 4. 重置所有视频相关变量
      currentVideoId = '';
      videoResourceInfo = {};
      
      // 5. 清除所有输入框和缓存
      const videoUrlInput = document.getElementById('videoUrlInput');
      if (videoUrlInput) {
        videoUrlInput.value = '';
      }
      
      const localVideoInput = document.getElementById('localVideoInput');
      if (localVideoInput) {
        localVideoInput.value = '';
      }
      
      // 6. 释放所有本地视频URL对象
      if (window.previousLocalVideoUrl) {
        URL.revokeObjectURL(window.previousLocalVideoUrl);
        window.previousLocalVideoUrl = null;
      }
      
      // 7. 清除共享记录
      window.lastSharedVideo = null;
      
      // 8. 清除视频容器的加载状态
      const videoContainer = document.getElementById('videoContainer');
      if (videoContainer) {
        // 移除任何加载指示器
        const loadingElements = videoContainer.querySelectorAll('.loading-overlay');
        loadingElements.forEach(el => el.remove());
      }
      
      // 9. 清除DPlayer实例（如果存在）
      if (window.dp && window.dp.destroy) {
        try {
          window.dp.destroy();
        } catch (e) {
          console.warn('清理DPlayer实例时出错:', e);
        }
        window.dp = null;
        delete window.dp;
      }
      
      // 10. 强制刷新视频元素状态
      if (videoPlayer) {
        // 创建新的video元素替换旧的，确保完全清除
        const newVideo = videoPlayer.cloneNode(true);
        videoPlayer.parentNode.replaceChild(newVideo, videoPlayer);
        
        // 重新获取并初始化新的video元素
        window.videoPlayer = document.getElementById('videoPlayer');
        
        // 重新初始化视频事件监听
        setTimeout(() => {
          if (window.videoPlayer) {
            initVideoPlayer();
          }
        }, 100);
      }
      
      console.log('视频文件数据已完全清除，播放器回到未加载状态');
    }
    
    // 点击弹窗外部区域，关闭弹窗
    window.addEventListener('click', function(event) {
      if (event.target === exitConfirmModal) {
        hideModal(exitConfirmModal);
      }
    });
    
    // 处理离开房间成功事件
    socket.on('leave_room_success', function(data) {
      console.log('离开房间成功:', data.message);
    });
    
    // 处理离开房间失败事件
    // 移除leave_room_error处理，因为退出房间按钮被禁用后不再触发此类错误
    
    // 处理网络视频链接加载功能
    function initNetworkVideoLoading() {
      // 将videoUrlInput设置为全局变量，以便其他函数访问
      window.videoUrlInput = document.getElementById('videoUrlInput');
      const videoUrlInput = window.videoUrlInput;
      const loadUrlButton = document.getElementById('loadUrlButton');
      const clearUrlButton = document.getElementById('clearUrlButton');
      
      if (videoUrlInput && loadUrlButton) {
        loadUrlButton.addEventListener('click', function() {
          const videoUrl = videoUrlInput.value.trim();
          if (videoUrl) {
            showBottomToast('正在加载视频...');
            handleNetworkVideoLoading(videoUrl);
          } else {
            showBottomToast('请添加连接');
          }
        });
        
        // 支持回车键加载视频
        videoUrlInput.addEventListener('keypress', function(event) {
          if (event.key === 'Enter') {
            loadUrlButton.click();
          }
        });
        
        // 显示/隐藏清除按钮
        videoUrlInput.addEventListener('input', function() {
          if (clearUrlButton) {
            if (this.value.trim()) {
              clearUrlButton.style.display = 'block';
            } else {
              clearUrlButton.style.display = 'none';
            }
          }
        });
        
        // 清除按钮功能
        if (clearUrlButton) {
          clearUrlButton.addEventListener('click', function() {
            videoUrlInput.value = '';
            clearUrlButton.style.display = 'none';
            videoUrlInput.focus();
          });
        }
      }
    }
    
    // 为共享按钮添加点击事件
    const shareButton = document.getElementById('shareButton');
    const shareConfirmModal = document.getElementById('shareConfirmModal');
    const cancelShare = document.getElementById('cancelShare');
    const confirmShare = document.getElementById('confirmShare');
    
    // 新增：记录暂停状态的变量
    let recordedPauseState = null;
    
    if (shareButton && window.videoUrlInput) {
      shareButton.addEventListener('click', function() {
        const videoUrl = window.videoUrlInput.value.trim();
        if (videoUrl) {
          // 新增：检测当前视频状态
          recordedPauseState = {
            isPaused: videoPlayer.paused,
            currentTime: videoPlayer.currentTime || 0,
            timestamp: new Date().toISOString()
          };
          
          console.log('📊 检测到视频状态:', recordedPauseState);
          
          // 显示共享确认弹窗
          showModal(shareConfirmModal);
        } else {
          showBottomToast('请添加连接');
        }
      });
    }
    
    // 点击取消共享按钮
    if (cancelShare) {
      cancelShare.addEventListener('click', function() {
        // 清空记录的暂停状态
        recordedPauseState = null;
        console.log('❌ 取消共享，清空记录的暂停状态');
        hideModal(shareConfirmModal);
      });
    }
    
    // 点击确认共享按钮
    if (confirmShare) {
      confirmShare.addEventListener('click', function() {
        const videoUrl = window.videoUrlInput.value.trim();
        if (videoUrl && socket && socket.connected && currentRoom) {
          // 使用记录的暂停状态，如果没有记录则使用当前状态
          let shareTime = 0;
          if (recordedPauseState) {
            shareTime = recordedPauseState.currentTime;
            console.log('📤 使用记录的暂停时间:', shareTime);
          } else {
            shareTime = videoPlayer.currentTime || 0;
            console.log('📤 使用当前时间:', shareTime);
          }
          
          // 暂停共享者的视频
          videoPlayer.pause();
          
          // 发送共享视频链接给服务器，包含暂停位置
          socket.emit('share_video', {
            room: currentRoom,
            url: videoUrl,
            username: username || '匿名用户',
            currentTime: shareTime,
            preservePause: true  // 标记保持实际暂停时间
          });
          
          // 清空记录的暂停状态
          recordedPauseState = null;
          
          showBottomToast('链接已共享给房间内的所有人');
          hideModal(shareConfirmModal);
        } else {
          showBottomToast('请先加入房间');
          hideModal(shareConfirmModal);
        }
      });
    }
    
    // 点击共享弹窗外部区域关闭弹窗
    if (shareConfirmModal) {
      shareConfirmModal.addEventListener('click', function(event) {
        if (event.target === shareConfirmModal) {
          // 清空记录的暂停状态
          recordedPauseState = null;
          console.log('❌ 点击外部关闭，清空记录的暂停状态');
          hideModal(shareConfirmModal);
        }
      });
    }
    
    // HLS实例变量，用于管理m3u8流
    let hls = null;
    let hlsLoadTimeout = null;
    
    // 加载网络视频链接
    // 网络状态监听 - 断网时自动暂停播放
    if (!window.networkListenerAdded) {
      window.addEventListener('online', function() {
        console.log('网络已恢复');
        if (window.notificationSystem) {
          window.notificationSystem.success('网络已恢复，可以继续播放', 3000);
        }
      });
      
      window.addEventListener('offline', function() {
        console.log('网络已断开');
        if (videoPlayer) {
          videoPlayer.pause();
        }
        if (window.notificationSystem) {
          window.notificationSystem.warning('网络已断开，已自动暂停播放', 5000);
        }
      });
      
      window.networkListenerAdded = true; // 防止重复添加
    }

    // 智能缓存系统 - 记住最近成功的链接
    const VideoCache = {
      cache: new Map(),
      maxAge: 3600000, // 1小时有效期
      
      set(url, data) {
        this.cache.set(url, {
          data,
          timestamp: Date.now()
        });
        console.log('缓存视频链接:', url);
      },
      
      get(url) {
        const item = this.cache.get(url);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.maxAge) {
          this.cache.delete(url);
          return null;
        }
        
        console.log('使用缓存的视频链接:', url);
        return item.data;
      },
      
      has(url) {
        return this.get(url) !== null;
      },
      
      clear() {
        this.cache.clear();
      }
    };
    
    // 暴露到全局
    window.VideoCache = VideoCache;

    // 智能链接预检测函数
    // 区域检测工具
    const RegionDetector = {
      detect() {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const languages = navigator.languages || [navigator.language];
        
        // 简单的区域检测逻辑
        if (timezone.includes('Asia/Shanghai') || languages.some(l => l.includes('zh'))) {
          return 'CN';
        } else if (timezone.includes('America')) {
          return 'US';
        } else if (timezone.includes('Europe')) {
          return 'EU';
        }
        return 'UNKNOWN';
      }
    };

    function checkLinkValidity(videoUrl) {
      return new Promise((resolve) => {
        // 抖音直链跳过检测（走代理）
        if (isDouyinUrl(videoUrl)) {
          resolve({valid: true, skip: true});
          return;
        }
        
        // 检查缓存
        const cached = window.VideoCache.get(videoUrl);
        if (cached) {
          resolve({valid: true, skip: true});
          return;
        }
        
        const xhr = new XMLHttpRequest();
        xhr.open('HEAD', videoUrl, true);
        xhr.timeout = 10000; // 延长到10秒超时，给网络检测更多时间
        
        xhr.onload = function() {
          const status = xhr.status;
          
          if (status >= 200 && status < 400) {
            // 缓存成功的验证
            window.VideoCache.set(videoUrl, { valid: true });
            resolve({valid: true, status});
          } else if (status === 403 || status === 451) {
            // 区域限制特殊处理
            const region = RegionDetector.detect();
            console.warn(`区域限制检测: ${region}, 状态码: ${status}`);
            resolve({valid: false, status, error: getErrorMessage(status), region});
          } else if (status === 0) {
            // CORS问题，降级处理
            console.warn('检测到CORS限制，降级处理');
            window.VideoCache.set(videoUrl, { valid: true });
            resolve({valid: true, skip: true});
          } else {
            // 其他错误，根据情况降级
            console.warn(`状态码 ${status}，降级处理`);
            window.VideoCache.set(videoUrl, { valid: true });
            resolve({valid: true, skip: true});
          }
        };
        
        xhr.onerror = xhr.ontimeout = function() {
          // 网络错误降级处理
          console.warn('网络错误，降级处理');
          window.VideoCache.set(videoUrl, { valid: true });
          resolve({valid: true, skip: true});
        };
        
        xhr.send();
      });
    }
    
    function getErrorMessage(status) {
      const messages = {
        403: '视频链接已失效（权限不足）',
        404: '视频文件不存在或已被删除',
        410: '视频已过期，请重新获取链接',
        0: '无法连接到视频服务器'
      };
      return messages[status] || `链接异常 (${status})`;
    }

    async function handleNetworkVideoLoading(videoUrl, startTime = 0, shouldPlay = false) {
      console.log('🔍 handleNetworkVideoLoading开始执行');
      console.log('参数:', { videoUrl, startTime, shouldPlay });
      
      // 简单的URL验证
      if (!isValidVideoUrl(videoUrl)) {
        console.error('❌ URL验证失败:', videoUrl);
        
        // 完全停止所有加载和检测
        isLoading = false;
        if (hls) {
          hls.destroy();
          hls = null;
        }
        if (hlsLoadTimeout) {
          clearTimeout(hlsLoadTimeout);
          hlsLoadTimeout = null;
        }
        if (videoPlayer) {
          videoPlayer.pause();
          videoPlayer.src = '';
          videoPlayer.load();
        }
        
        // 显示错误并完全停止
        window.errorHandler.showError('请输入有效的视频链接，支持MP4、M3U8等格式');
        return;
      }
      
      console.log('✅ URL验证通过:', videoUrl);
      
      // 显示加载状态
      isLoading = true;
      addStatusMessage('🔍 正在检测视频链接有效性...');
      
      try {
        // 检查缓存
        const cached = window.VideoCache.has(videoUrl);
        if (cached) {
          addStatusMessage('✅ 使用缓存的验证结果');
        } else {
          // 预检测链接有效性
          const checkResult = await checkLinkValidity(videoUrl);
          
          if (!checkResult.valid) {
            isLoading = false;
            const errorMsg = checkResult.error;
            
            // 区域限制特殊提示
            if (checkResult.status === 451) {
              errorMsg = '该视频在您所在地区无法访问';
            } else if (checkResult.status === 403) {
              errorMsg = '视频链接已失效或权限不足';
            }
            
            // 友好的错误提示
            const fullError = `${errorMsg}\n\n💡 建议：\n1. 重新获取视频直链\n2. 检查链接是否完整\n3. 稍后再试`;
            
            if (window.notificationSystem) {
              window.notificationSystem.error(fullError, 8000);
            } else {
              if (window.notificationSystem) {
                window.notificationSystem.error(fullError, 0); // 0表示不自动消失
            } else {
                alert(fullError);
            }
            }
            
            addStatusMessage('❌ ' + errorMsg);
            return;
          }
          
          // 缓存成功的验证
          if (!checkResult.skip) {
            window.VideoCache.set(videoUrl, { valid: true });
            addStatusMessage('✅ 链接检测通过，开始加载...');
          }
        }
        
      } catch (error) {
        console.warn('检测失败，继续尝试加载:', error);
        addStatusMessage('检测失败，尝试直接加载...');
      }
      
      // 添加调试日志
      console.log('切换到网络视频:', videoUrl);
      
      // 保存当前视频的唯一标识，添加NETWORK_前缀以区分本地和网络视频
      currentVideoId = 'NETWORK_' + videoUrl;
      
      // 彻底清除所有资源，防止内存泄漏
      function cleanupVideoResources() {
        if (hls) {
          hls.destroy();
          hls = null;
          console.log('已销毁HLS实例');
        }
        if (hlsLoadTimeout) {
          clearTimeout(hlsLoadTimeout);
          hlsLoadTimeout = null;
          console.log('已清除HLS加载超时计时器');
        }
        
        // 清理事件监听器
        if (videoPlayer) {
          videoPlayer.onerror = null;
          videoPlayer.onloadeddata = null;
          videoPlayer.onended = null;
        }
        
        // 清理过期的缓存
        if (window.VideoCache) {
          window.VideoCache.clear();
          console.log('已清理视频链接缓存');
        }
      }
      
      // 执行清理
      cleanupVideoResources();
      
      // 释放之前创建的本地视频对象URL，确保从本地视频切换到网络视频时也清理资源
      if (previousLocalVideoUrl) {
        URL.revokeObjectURL(previousLocalVideoUrl);
        previousLocalVideoUrl = null;
        console.log('已释放之前的本地视频URL');
      }
      
      // 完全重置视频元素状态
      videoPlayer.pause();
      videoPlayer.currentTime = 0; // 添加这一行来重置播放位置
      videoPlayer.src = '';
      videoPlayer.load(); // 强制重新加载，清除可能的缓存状态
      videoPlayer.controls = true; // 确保控制条可见
      console.log('已重置视频播放器状态');
      
      // 检查是否为m3u8格式视频
      // 检查是否为抖音直链（包含douyinvod.com或douyin.com域名）
      if (isDouyinUrl(videoUrl)) {
        console.log('检测到抖音直链，使用特殊处理');
        loadDouyinVideo(videoUrl, startTime, shouldPlay);
      } else if (videoUrl.toLowerCase().includes('.m3u8')) {
        // 检查浏览器是否支持MSE和HLS.js库是否已加载
        if (window.Hls && Hls.isSupported()) {
          hls = new Hls({
            // 优化的HLS配置，适用于各种网络环境
            enableWorker: true,
            lowLatencyMode: false, // 禁用低延迟模式以提高兼容性
            backBufferLength: 30, // 减少缓冲时间
            maxBufferLength: 10,  // 减少最大缓冲区长度
            maxBufferSize: 0,     // 不限制缓冲区大小
            maxMaxBufferLength: 60, // 网络不好时的最大缓冲长度
            startFragPrefetch: true, // 启用片段预加载
            enableWebVtt: true, // 支持字幕
            enableCEA708Captions: true, // 支持隐藏字幕
            autoStartLoad: true, // 自动开始加载
            debug: false // 生产环境关闭调试
          });
          
          // 监听HLS关键事件
          hls.on(Hls.Events.MANIFEST_PARSED, function() {
            addStatusMessage('视频流解析成功，准备播放...');
            isLoading = false;
            
            // 设置起始播放位置
            if (startTime > 0) {
              videoPlayer.currentTime = startTime;
              addStatusMessage(`视频已同步到 ${formatTime(startTime)} 位置`);
            }
            
            // 在视频流解析成功后，通知服务器更新视频资源并检查一致性
            setTimeout(() => {
              if (currentRoom && socket && socket.connected) {
                socket.emit('video_resource_update', {
                  room: currentRoom,
                  videoName: currentVideoId || 'none'
                });
              }
            }, 500);
            
            // 根据shouldPlay参数决定是否自动播放
            if (shouldPlay) {
              try {
                videoPlayer.play().catch(err => {
                  console.log('自动播放失败，需要用户交互:', err);
                  addStatusMessage('请点击播放按钮开始观看');
                });
              } catch (e) {
                console.error('播放错误:', e);
              }
            } else {
              // 不自动播放，保持暂停状态
              videoPlayer.pause();
              addStatusMessage('视频已加载完成，点击播放按钮开始观看');
            }
          });
          
          // 监听加载进度
          hls.on(Hls.Events.BUFFER_CREATED, function(data) {
            console.log('缓冲区已创建，类型:', data.media);
          });
          
          hls.on(Hls.Events.BUFFER_APPENDING, function(data) {
            // 可以在这里添加缓冲进度条
            console.log('正在缓冲数据，类型:', data.media);
          });
          
          hls.on(Hls.Events.BUFFER_APPENDED, function(data) {
            console.log('缓冲数据已追加，类型:', data.media);
          });
          
          hls.on(Hls.Events.FRAG_LOADED, function(data) {
            console.log('片段已加载，持续时间:', data.frag.duration);
          });
          
          // 增强的错误处理
          hls.on(Hls.Events.ERROR, function(event, data) {
            isLoading = false;
            console.error('HLS错误:', data);
            
            let errorMessage = '视频加载失败';
            
            // 处理非致命错误
            if (!data.fatal) {
              // 对于网络错误，可以尝试继续加载
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                addStatusMessage('网络连接暂时中断，正在重试...');
                return;
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                addStatusMessage('媒体解码警告，但尝试继续播放');
                return;
              }
            }
            
            // 处理致命错误
            if (data.fatal) {
              switch(data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  errorMessage = '网络错误，无法连接到视频服务器，请检查网络连接';
                  // 尝试重新加载
                  setTimeout(() => {
                    if (hls) {
                      hls.startLoad();
                    }
                  }, 2000);
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  errorMessage = '媒体解码错误，可能不支持此视频格式或视频文件已损坏';
                  break;
                case Hls.ErrorTypes.MANIFEST_ERROR:
                  errorMessage = '视频流配置错误，无法解析播放列表';
                  break;
                default:
                  errorMessage = '无法加载视频流，请稍后再试';
                  break;
              }
              // 防止重复弹窗：只显示一次错误通知
              if (!window.lastErrorMessage || window.lastErrorMessage !== errorMessage) {
                window.lastErrorMessage = errorMessage;
                if (window.notificationSystem) {
                  window.notificationSystem.error(errorMessage, 5000);
                } else {
                  alert(errorMessage);
                }
                // 5秒后清除错误标记，允许显示新的错误
                setTimeout(() => { window.lastErrorMessage = null; }, 5000);
              }
              
                  // 调用统一的停止函数
              stopAllVideoLoading();
            }
          });
          
          // 设置加载超时处理（60秒，给M3U8更多加载时间）
          hlsLoadTimeout = setTimeout(() => {
            if (isLoading && hls) {
              isLoading = false;
              window.errorHandler.showError('视频加载超时，请检查网络连接或尝试其他视频链接');
              hls.destroy();
              hls = null;
            }
          }, 60000);
          
          // 加载m3u8流
          try {
            hls.loadSource(videoUrl);
            hls.attachMedia(videoPlayer);
          } catch (error) {
            console.error('HLS加载失败:', error);
            isLoading = false;
            if (hlsLoadTimeout) {
              clearTimeout(hlsLoadTimeout);
              hlsLoadTimeout = null;
            }
            if (window.notificationSystem) {
              window.notificationSystem.error('无法加载m3u8格式视频，请检查链接是否有效', 5000);
            } else {
              if (window.notificationSystem) {
                window.notificationSystem.error('无法加载m3u8格式视频，请检查链接是否有效', 5000);
            } else {
                alert('无法加载m3u8格式视频，请检查链接是否有效');
            }
            }
          }
        } else {
          // 浏览器不支持HLS.js或库未正确加载
          console.error('❌ 浏览器不支持HLS.js或库未加载');
          
          // 检测浏览器类型并提供针对性建议
          const userAgent = navigator.userAgent.toLowerCase();
          let browserWarning = '';
          
          if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            browserWarning = 'Safari浏览器对m3u8支持有限，建议使用Chrome或Edge浏览器';
          } else if (userAgent.includes('firefox')) {
            browserWarning = 'Firefox可能需要额外配置，建议使用Chrome或Edge浏览器';
          } else if (userAgent.includes('edge')) {
            browserWarning = 'Edge浏览器支持良好，如播放失败请尝试Chrome浏览器';
          } else {
            browserWarning = '您的浏览器不支持m3u8格式，建议使用Chrome、Edge或Firefox浏览器';
          }
          
          if (window.notificationSystem) {
            window.notificationSystem.warning(browserWarning, 8000);
          } else {
            const fullMessage = browserWarning + '\n\n其他建议：\n1. 检查网络连接\n2. 尝试其他视频链接\n3. 确保链接可直接访问';
            if (window.notificationSystem) {
                window.notificationSystem.error(fullMessage, 0); // 0表示不自动消失
            } else {
                alert(fullMessage);
            }
          }
          isLoading = false;
          
          // 尝试使用原生方式加载作为备选方案
          videoPlayer.src = videoUrl;
          videoPlayer.load();
        }
      } else {
        // 普通视频格式，使用原生方式加载
        // 添加时间戳作为查询参数，避免浏览器缓存问题
        const videoUrlWithTimestamp = videoUrl + (videoUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        console.log('加载普通网络视频:', videoUrlWithTimestamp);
        
        videoPlayer.src = videoUrlWithTimestamp;
        
        // 添加错误处理和恢复机制
        videoPlayer.onerror = function(error) {
          isLoading = false;
          addStatusMessage('视频加载失败，正在尝试恢复...');
          console.error('视频加载错误:', error);
          
          // 尝试恢复策略：使用新的时间戳重新加载
          setTimeout(() => {
            console.log('尝试恢复网络视频加载');
            isLoading = true;
            const recoveryUrl = videoUrl + (videoUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
            videoPlayer.src = recoveryUrl;
            videoPlayer.load();
          }, 500);
          
          // 检查具体错误类型
          const errorCode = error.target.error.code;
          const errorMessages = {
            1: '用户中止了视频加载',
            2: '网络错误，请检查网络连接',
            3: '视频解码错误，格式可能不受支持',
            4: '视频格式不支持或链接无效'
          };
          
          console.error('❌ 视频加载失败:', {
            errorCode: errorCode,
            errorMessage: errorMessages[errorCode] || '未知错误',
            videoUrl: videoUrl
          });
          
          // 完全停止所有加载和检测
          stopAllVideoLoading();
          
          if (errorCode === error.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
            // 防止重复弹窗
            if (!window.lastVideoError || window.lastVideoError !== 'format_not_supported') {
              window.lastVideoError = 'format_not_supported';
              if (window.notificationSystem) {
                window.notificationSystem.error('视频格式不支持或链接无效，请检查链接是否有效', 5000);
              } else {
                if (window.notificationSystem) {
                window.notificationSystem.error('视频格式不支持或链接无效，请检查链接是否有效', 5000);
            } else {
                alert('视频格式不支持或链接无效，请检查链接是否有效');
            }
              }
              setTimeout(() => { window.lastVideoError = null; }, 5000);
            }
          } else if (errorCode !== error.target.error.MEDIA_ERR_ABORTED) {
            setTimeout(() => {
              if (isLoading === false && (!window.lastVideoError || window.lastVideoError !== 'load_failed')) {
                window.lastVideoError = 'load_failed';
                if (window.notificationSystem) {
                  window.notificationSystem.error('视频加载失败，请检查网络连接和视频链接', 5000);
                } else {
                  if (window.notificationSystem) {
                window.notificationSystem.error('视频加载失败，请检查网络连接和视频链接', 5000);
            } else {
                alert('视频加载失败，请检查网络连接和视频链接');
            }
                }
                setTimeout(() => { window.lastVideoError = null; }, 5000);
              }
            }, 1000);
          }
        };
        
        // 监听加载事件
        videoPlayer.onloadeddata = function() {
          isLoading = false;
          
          // 设置起始播放位置
          if (startTime > 0) {
            videoPlayer.currentTime = startTime;
            addStatusMessage(`视频已同步到 ${formatTime(startTime)} 位置`);
          } else {
            addStatusMessage('视频加载成功，准备播放...');
          }
          console.log('网络视频数据加载成功');
          
          // 在视频加载完成后立即检查资源一致性
          setTimeout(() => {
            // 发送视频资源更新事件到服务器
            socket.emit('video_resource_update', {
              room: currentRoom,
              videoName: currentVideoId
            });
          }, 500);
          
          // 根据shouldPlay参数决定是否自动播放
          if (!shouldPlay) {
            videoPlayer.pause();
            addStatusMessage('视频已加载完成，点击播放按钮开始观看');
          }
        };
        
        videoPlayer.load();
      }
      
      // 通知房间内其他用户当前使用的视频资源
      if (currentRoom) {
        socket.emit('video_resource_update', {
          room: currentRoom,
          videoName: currentVideoId
        });
        
        // 请求同步当前房间的视频进度
        // 延迟一小段时间，确保视频元数据已加载
        setTimeout(() => {
          if (currentRoom && !isLoading) {
            console.log(`发送网络视频状态请求到房间 ${currentRoom}`);
            socket.emit('video_state_request', {
              room: currentRoom
            });
            addStatusMessage('正在同步视频进度...');
          }
        }, 1000);
      }
    }
    
    // 验证视频URL是否有效
    function isValidVideoUrl(url) {
      // 检查是否以http/https开头
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false;
      }
      
      // 检查是否为抖音直链
      if (isDouyinUrl(url)) {
        return true;
      }
      
      // 检查常见的视频文件扩展名或流媒体格式
      const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.flv', '.wmv', '.mpg', '.3gp'];
      const streamFormats = ['.m3u8', '.mpd', '.ts'];
      
      // 转换为小写进行比较
      const lowerUrl = url.toLowerCase();
      
      // 检查是否包含常见视频扩展名
      for (const ext of videoExtensions) {
        if (lowerUrl.endsWith(ext)) {
          return true;
        }
      }
      
      // 检查是否包含流媒体格式
      for (const format of streamFormats) {
        if (lowerUrl.includes(format)) {
          return true;
        }
      }
      
      // 检查常见视频流媒体域名
      const videoDomains = [
        'bilibili.com', 'iqiyi.com', 'youku.com', 'tencent.com', 'qq.com',
        'youtube.com', 'vimeo.com', 'netflix.com', 'hulu.com', 'dailymotion.com',
        'twitch.tv', 'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com'
      ];
      
      for (const domain of videoDomains) {
        if (lowerUrl.includes(domain)) {
          return true;
        }
      }
      
      // 对于包含video、stream等关键词的URL也接受
      if (lowerUrl.includes('video') || lowerUrl.includes('stream') || lowerUrl.includes('media')) {
        return true;
      }
      
      // 对于没有明显扩展名的URL，我们仍然尝试加载
      // 因为有些视频服务可能使用动态URL
      return true;
    }
    
    // 检查是否为抖音直链
    function isDouyinUrl(url) {
      const douyinDomains = [
        'douyinvod.com',
        'douyin.com', 
        'v.douyin.com',
        'www.douyin.com',
        'v3-web-prime.douyinvod.com',
        'v1-cold.douyinvod.com',
        'v9-cold.douyinvod.com'
      ];
      
      const lowerUrl = url.toLowerCase();
      return douyinDomains.some(domain => lowerUrl.includes(domain));
    }
    
    // 抖音直链专用加载函数
    function loadDouyinVideo(videoUrl, startTime = 0, shouldPlay = false) {
      console.log('加载抖音直链:', videoUrl);
      
      // 使用代理路由解决跨域问题
      const proxyUrl = '/proxy/douyin?url=' + encodeURIComponent(videoUrl);
      
      videoPlayer.src = proxyUrl;
      
      // 抖音直链的特殊处理 - 使用代理后不需要crossOrigin
      // videoPlayer.crossOrigin = 'anonymous';
      
      // 错误处理
      videoPlayer.onerror = function(error) {
        isLoading = false;
        console.error('抖音视频加载错误:', error);
        
        // 抖音直链可能有时效性，提供更友好的错误提示
        setTimeout(() => {
          if (videoPlayer.error && videoPlayer.error.code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
            window.errorHandler.showError('抖音直链已失效或无法访问，请获取新的直链地址');
          } else {
            window.errorHandler.showError('抖音视频加载失败，请检查链接是否有效');
          }
        }, 100);
      };
      
      // 监听加载成功
      videoPlayer.onloadeddata = function() {
        isLoading = false;
        
        // 设置起始播放位置
        if (startTime > 0) {
          videoPlayer.currentTime = startTime;
          addStatusMessage(`抖音视频已同步到 ${formatTime(startTime)} 位置`);
        } else {
          addStatusMessage('抖音视频通过代理加载成功，准备播放...');
        }
        console.log('抖音直链视频通过代理加载成功');
        
        // 在视频加载完成后检查资源一致性
        setTimeout(() => {
          checkVideoResourceConsistency();
        }, 500);
      };
      
      // 监听可以播放事件
      videoPlayer.oncanplay = function() {
        isLoading = false;
        addStatusMessage('视频可以播放了');
        
        // 根据shouldPlay参数决定是否自动播放
        if (shouldPlay) {
          videoPlayer.play().catch(err => {
            console.log('抖音视频自动播放失败:', err);
            addStatusMessage('请点击播放按钮开始观看');
          });
        } else {
          // 不自动播放，保持暂停状态
          videoPlayer.pause();
          addStatusMessage('视频已加载完成，点击播放按钮开始观看');
        }
      };
      
      videoPlayer.load();
    }
    
    // 简单的底部提示函数
    function showBottomToast(message) {
      // 移除已存在的提示
      const existingToast = document.querySelector('.bottom-toast');
      if (existingToast) {
        existingToast.remove();
      }
      
      // 创建新的提示元素
      const toast = document.createElement('div');
      toast.className = 'bottom-toast';
      toast.textContent = message;
      
      // 添加到页面
      document.body.appendChild(toast);
      
      // 显示动画
      setTimeout(() => {
        toast.classList.add('show');
      }, 10);
      
      // 2秒后移除
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 2000);
    }

    // 初始化网络视频加载功能
    initNetworkVideoLoading();

    // 全页播放功能实现 - 页面级全尺寸播放
    document.addEventListener('DOMContentLoaded', function() {
      const videoPlayer = document.getElementById('videoPlayer');
      const videoContainer = document.getElementById('videoContainer');
      const fullscreenButton = document.getElementById('fullscreenButton');
      const mainContainer = document.querySelector('.main-container');
      const videoChatContainer = document.querySelector('.video-chat-container');
      const chatInput = document.querySelector('.chat-input');
      const documentElement = document.documentElement;
      
      // 浏览器原生全屏功能核心逻辑函数
      function toggleBrowserFullscreen() {
        const isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        
        if (!isFullscreen) {
          // 进入浏览器原生全屏模式（占领整个用户屏幕）
          if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();
          } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();
          } else if (videoContainer.mozRequestFullScreen) {
            videoContainer.mozRequestFullScreen();
          } else if (videoContainer.msRequestFullscreen) {
            videoContainer.msRequestFullscreen();
          }
        } else {
          // 退出浏览器原生全屏模式
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        }
      }
      
      // 页面级全屏功能核心逻辑函数（占领整个浏览器窗口）
      function togglePageFullscreen() {
        const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');
        
        if (!isPageFullscreen) {
          // 进入页面级全屏模式（占领整个浏览器窗口）
          // 添加全页播放类
          videoContainer.classList.add('page-fullscreen');
          mainContainer.classList.add('page-fullscreen');
          videoChatContainer.classList.add('page-fullscreen');
          
          // 更改按钮图标和文本以表示退出页面全屏
          fullscreenButton.innerHTML = '<i class="fas fa-compress"></i><span>退出页面全屏</span>';
          
          // 保存原始样式以便恢复
          saveOriginalStyles();
          
          // 设置视频播放器为100vh和100vw
          setFullPageStyles();
          
          // 隐藏页面其他元素
          hideOtherElements();
          
          // 在页面全屏模式下创建聊天输入框
          createFullscreenChatInput();
          // 应用保存的设置
          setTimeout(() => {
            applySavedFullscreenSettings();
          }, 100);
        } else {
          // 退出页面级全屏模式 - 保存设置
          saveFullscreenChatSettings();
          
          // 移除全页播放类
          videoContainer.classList.remove('page-fullscreen');
          mainContainer.classList.remove('page-fullscreen');
          videoChatContainer.classList.remove('page-fullscreen');
          
          // 恢复按钮图标和文本以表示进入页面全屏
          fullscreenButton.innerHTML = '<i class="fas fa-expand"></i><span>页面全屏</span>';
          
          // 恢复原始样式
          restoreOriginalStyles();
          
          // 显示页面其他元素
          showOtherElements();
          
          // 移除页面全屏模式下的聊天输入框
          removeFullscreenChatInput();
          
          // 退出页面全屏时，确保正常模式下的聊天消息滚动到最新消息
          setTimeout(() => {
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
              if (chatMessages.scrollTo) {
                chatMessages.scrollTo({
                  top: chatMessages.scrollHeight,
                  behavior: 'smooth'
                });
              } else {
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            }
          }, 100); // 延迟100ms确保DOM更新完成
        }
      }
      
      // 为页面全屏按钮添加点击事件
      fullscreenButton.addEventListener('click', togglePageFullscreen);
      
      // 保存全屏聊天设置到本地存储
      function saveFullscreenChatSettings() {
        try {
          const settings = {
            chatPosition: document.getElementById('fullscreenChatPositionSelect')?.value || 'bottom-right',
            inputPosition: document.getElementById('fullscreenInputPositionSelect')?.value || 'default',
            fontSize: document.getElementById('fullscreenFontSizeSelect')?.value || 14,
            fontColor: document.getElementById('fullscreenFontColorSelect')?.value || '#ffffff',
            bubbleDisplay: document.getElementById('fullscreenBubbleDisplaySelect')?.value || 'show',
            bubbleColor: document.getElementById('fullscreenBubbleColorSelect')?.value || '#dcf8c6'
          };
          localStorage.setItem('fullscreenChatSettings', JSON.stringify(settings));
        } catch (e) {
          console.warn('无法保存全屏聊天设置:', e);
        }
      }

      // 从本地存储加载全屏聊天设置
      function loadFullscreenChatSettings() {
        try {
          const savedSettings = localStorage.getItem('fullscreenChatSettings');
          if (savedSettings) {
            return JSON.parse(savedSettings);
          }
        } catch (e) {
          console.warn('无法加载全屏聊天设置:', e);
        }
        return null;
      }

      // 应用保存的全屏聊天设置
      function applySavedFullscreenSettings() {
        const settings = loadFullscreenChatSettings();
        if (!settings) return;

        try {
          // 应用聊天位置设置
          const positionSelect = document.getElementById('fullscreenChatPositionSelect');
          const positionValue = document.getElementById('fullscreenChatPositionValue');
          if (positionSelect && positionValue) {
            positionSelect.value = settings.chatPosition || 'bottom-right';
            const selectedOption = document.querySelector(`#fullscreenChatPositionOptions [data-value="${settings.chatPosition}"]`);
            if (selectedOption) {
              positionValue.textContent = selectedOption.textContent;
              // 更新选中状态
              document.querySelectorAll('#fullscreenChatPositionOptions .custom-option').forEach(opt => {
                opt.classList.toggle('selected', opt === selectedOption);
                opt.style.backgroundColor = opt === selectedOption ? 'var(--popup-hover-bg)' : 'transparent';
              });
            }
          }





          // 应用其他设置
          const fontSizeSelect = document.getElementById('fullscreenFontSizeSelect');
          const fontSizeValue = document.getElementById('fullscreenFontSizeValue');
          if (fontSizeSelect && fontSizeValue) {
            fontSizeSelect.value = settings.fontSize || 14;
            const fontSizeOption = document.querySelector(`#fullscreenFontSizeOptions [data-value="${settings.fontSize}"]`);
            if (fontSizeOption) {
              fontSizeValue.textContent = fontSizeOption.textContent;
            }
          }

          const fontColorSelect = document.getElementById('fullscreenFontColorSelect');
          const fontColorValue = document.getElementById('fullscreenFontColorValue');
          if (fontColorSelect && fontColorValue) {
            fontColorSelect.value = settings.fontColor || '#ffffff';
            const fontColorOption = document.querySelector(`#fullscreenFontColorOptions [data-value="${settings.fontColor}"]`);
            if (fontColorOption) {
              fontColorValue.textContent = fontColorOption.textContent;
            }
          }

          const bubbleDisplaySelect = document.getElementById('fullscreenBubbleDisplaySelect');
          const bubbleDisplayValue = document.getElementById('fullscreenBubbleDisplayValue');
          if (bubbleDisplaySelect && bubbleDisplayValue) {
            bubbleDisplaySelect.value = settings.bubbleDisplay || 'show';
            const bubbleDisplayOption = document.querySelector(`#fullscreenBubbleDisplayOptions [data-value="${settings.bubbleDisplay}"]`);
            if (bubbleDisplayOption) {
              bubbleDisplayValue.textContent = bubbleDisplayOption.textContent;
            }
          }

          const bubbleColorSelect = document.getElementById('fullscreenBubbleColorSelect');
          const bubbleColorValue = document.getElementById('fullscreenBubbleColorValue');
          if (bubbleColorSelect && bubbleColorValue) {
            bubbleColorSelect.value = settings.bubbleColor || '#dcf8c6';
            const bubbleColorOption = document.querySelector(`#fullscreenBubbleColorOptions [data-value="${settings.bubbleColor}"]`);
            if (bubbleColorOption) {
              bubbleColorValue.textContent = bubbleColorOption.textContent;
            }
          }

          // 应用设置到实际界面
          setTimeout(() => {
            updateFullscreenChatPosition();
          }, 100);

        } catch (e) {
          console.warn('应用全屏聊天设置时出错:', e);
        }
      }

      // 清除全屏聊天设置（当用户退出房间时调用）
      function clearFullscreenChatSettings() {
        try {
          localStorage.removeItem('fullscreenChatSettings');
        } catch (e) {
          console.warn('无法清除全屏聊天设置:', e);
        }
      }

      // 更新全屏聊天框位置
      function updateFullscreenChatPosition() {
        const chatPanel = document.getElementById('fullscreenChatPanel');
        if (!chatPanel) return;

        const positionSelect = document.getElementById('fullscreenChatPositionSelect');
        if (!positionSelect) return;

        const position = positionSelect.value;

        // 根据位置设置定位
        switch (position) {
          case 'top-center':
            chatPanel.style.top = '10px';
            chatPanel.style.left = '50%';
            chatPanel.style.transform = 'translateX(-50%)';
            chatPanel.style.bottom = 'auto';
            chatPanel.style.right = 'auto';
            break;
          case 'top-left':
            chatPanel.style.top = '10px';
            chatPanel.style.left = '10px';
            chatPanel.style.transform = 'none';
            chatPanel.style.bottom = 'auto';
            chatPanel.style.right = 'auto';
            break;
          case 'top-right':
            chatPanel.style.top = '10px';
            chatPanel.style.right = '10px';
            chatPanel.style.left = 'auto';
            chatPanel.style.transform = 'none';
            chatPanel.style.bottom = 'auto';
            break;
          case 'bottom-left':
            chatPanel.style.bottom = '10px';
            chatPanel.style.left = '10px';
            chatPanel.style.transform = 'none';
            chatPanel.style.top = 'auto';
            chatPanel.style.right = 'auto';
            break;
          case 'bottom-right':
            chatPanel.style.bottom = '10px';
            chatPanel.style.right = '10px';
            chatPanel.style.left = 'auto';
            chatPanel.style.transform = 'none';
            chatPanel.style.top = 'auto';
            break;

        }

        // 保存设置
        saveFullscreenChatSettings();
      }

      // 为浏览器全屏按钮添加点击事件
      fullscreenWithChatButton.addEventListener('click', function() {
        // 先确保不在页面全屏模式
        if (videoContainer.classList.contains('page-fullscreen')) {
          togglePageFullscreen();
        }
        // 然后切换浏览器原生全屏
        toggleBrowserFullscreen();
      });
      
      // 监听浏览器原生全屏事件，支持播放器自带的全屏按钮
      function handleFullscreenChange() {
        const isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        
        if (isFullscreen) {
          // 进入全屏模式时显示聊天面板和输入框
          createFullscreenChatInput();
          // 应用保存的设置
          setTimeout(() => {
            applySavedFullscreenSettings();
          }, 100);
        } else {
          // 退出全屏模式时保存设置
          saveFullscreenChatSettings();
          
          // 退出全屏模式时移除聊天面板和输入框
          // 但要检查是否同时处于自定义全页模式
          const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');
          if (!isPageFullscreen) {
            removeFullscreenChatInput();
          }
          
          // 退出全屏时，确保正常模式下的聊天消息滚动到最新消息
          setTimeout(() => {
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
              if (chatMessages.scrollTo) {
                chatMessages.scrollTo({
                  top: chatMessages.scrollHeight,
                  behavior: 'smooth'
                });
              } else {
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            }
          }, 100); // 延迟100ms确保DOM更新完成
        }
      }
      
      // 添加全屏变化事件监听
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);
      
      // 存储原始样式的对象
      let originalStyles = {};
      
      // 保存原始样式
      function saveOriginalStyles() {
        originalStyles = {
          videoPlayerWidth: videoPlayer.style.width,
          videoPlayerHeight: videoPlayer.style.height,
          videoPlayerPosition: videoPlayer.style.position,
          videoContainerWidth: videoContainer.style.width,
          videoContainerHeight: videoContainer.style.height,
          videoContainerPosition: videoContainer.style.position,
          mainContainerDisplay: mainContainer.style.display,
          mainContainerPosition: mainContainer.style.position
        };
      }
      
      // 设置全页样式
      function setFullPageStyles() {
        // 让视频容器占满整个页面
        videoContainer.style.width = '100vw';
        videoContainer.style.height = '100vh';
        videoContainer.style.position = 'fixed';
        videoContainer.style.top = '0';
        videoContainer.style.left = '0';
        videoContainer.style.zIndex = '9999';
        videoContainer.style.margin = '0';
        videoContainer.style.padding = '0';
        videoContainer.style.aspectRatio = 'unset';
        
        // 让视频播放器占满视频容器
        videoPlayer.style.width = '100%';
        videoPlayer.style.height = '100%';
        videoPlayer.style.objectFit = 'contain';
        
        // 确保主容器不会影响全屏显示
        mainContainer.style.display = 'block';
        mainContainer.style.position = 'relative';
        
        // 调整视频聊天容器
        videoChatContainer.style.display = 'block';
      }
      
      // 恢复原始样式
      function restoreOriginalStyles() {
        // 恢复视频容器样式
        videoContainer.style.width = originalStyles.videoContainerWidth || '';
        videoContainer.style.height = originalStyles.videoContainerHeight || '';
        videoContainer.style.position = originalStyles.videoContainerPosition || '';
        videoContainer.style.top = '';
        videoContainer.style.left = '';
        videoContainer.style.zIndex = '';
        videoContainer.style.margin = '';
        videoContainer.style.padding = '';
        videoContainer.style.aspectRatio = 'var(--video-aspect-ratio)';
        
        // 恢复视频播放器样式
        videoPlayer.style.width = originalStyles.videoPlayerWidth || '';
        videoPlayer.style.height = originalStyles.videoPlayerHeight || '';
        videoPlayer.style.position = originalStyles.videoPlayerPosition || '';
        videoPlayer.style.objectFit = 'contain';
        
        // 恢复主容器样式
        mainContainer.style.display = originalStyles.mainContainerDisplay || '';
        mainContainer.style.position = originalStyles.mainContainerPosition || '';
        
        // 恢复视频聊天容器
        videoChatContainer.style.display = '';
      }
      
      // 隐藏其他页面元素
      function hideOtherElements() {
        // 获取除了视频容器和控制按钮外的所有元素
        const elementsToHide = document.querySelectorAll(
          '.chat-container, .user-list-container, .button-section, .drawer-container, .network-status, .network-toggle-btn, .room-icon-button'
        );
        
        // 保存这些元素的原始display属性并隐藏它们
        elementsToHide.forEach(function(element) {
          element.dataset.originalDisplay = element.style.display;
          element.style.display = 'none';
        });
      }
      
      // 显示其他页面元素
      function showOtherElements() {
        // 获取之前隐藏的元素
        const elementsToShow = document.querySelectorAll(
          '.chat-container, .user-list-container, .button-section, .drawer-container, .network-status, .network-toggle-btn, .room-icon-button'
        );
        
        // 恢复这些元素的display属性
        elementsToShow.forEach(function(element) {
          element.style.display = element.dataset.originalDisplay || '';
        });
      }
      
      // 创建全页模式下的聊天输入框
      function createFullscreenChatInput() {
        // 检查是否已经存在全页聊天输入框
        if (document.getElementById('fullscreenChatInput')) {
          return;
        }
        
        // 创建一个专门用于全屏聊天面板的滚动到底部函数
        // 添加smooth参数来控制是否使用平滑滚动效果
        // 同时将函数暴露到全局作用域，以便其他地方调用
        window.scrollToBottomForFullscreen = function(smooth = true) {
          const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
          if (fullscreenChatPanel) {
            const messagesContainer = fullscreenChatPanel.querySelector('.chat-messages');
            if (messagesContainer) {
              // 总是滚动到底部，无论用户当前滚动位置
              // 根据参数决定是否使用平滑滚动
              if (messagesContainer.scrollTo) {
                messagesContainer.scrollTo({
                  top: messagesContainer.scrollHeight,
                  behavior: smooth ? 'smooth' : 'auto'
                });
              } else {
                // 降级方案：直接设置 scrollTop
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            }
          }
        }
        
        // 创建一个全页模式下的聊天面板容器
        const fullscreenChatPanel = document.createElement('div');
        fullscreenChatPanel.id = 'fullscreenChatPanel';
        fullscreenChatPanel.style.position = 'absolute';
        fullscreenChatPanel.style.top = '20px';
        fullscreenChatPanel.style.left = '50%';
        fullscreenChatPanel.style.transform = 'translateX(-50%)';
        fullscreenChatPanel.style.width = '80%';
        fullscreenChatPanel.style.maxWidth = '600px';
        fullscreenChatPanel.style.height = '200px';
        fullscreenChatPanel.style.zIndex = '2147483647'; // 使用最大z-index确保显示在最上层
        fullscreenChatPanel.style.backgroundColor = 'transparent'; // 改为完全透明背景
        fullscreenChatPanel.style.borderRadius = '8px';
        fullscreenChatPanel.style.boxShadow = 'none'; // 移除阴影，让聊天框完全透明
        fullscreenChatPanel.style.overflowY = 'hidden'; // 设置为hidden而不是auto，避免显示滚动条
        fullscreenChatPanel.style.padding = '10px';
        // 移除column-reverse布局，改为常规布局，避免滚动问题
        fullscreenChatPanel.style.display = 'block';
        // 添加过渡动画效果
        fullscreenChatPanel.style.transition = 'all 0.3s ease';
        // 默认折叠状态
        fullscreenChatPanel.dataset.collapsed = 'true';
        
        // 创建折叠按钮
        const collapseButton = document.createElement('button');
        collapseButton.id = 'fullscreenChatCollapseButton';
        collapseButton.innerText = '▼';
        collapseButton.style.position = 'absolute';
        collapseButton.style.top = '0px'; // 调整位置到可见区域
        collapseButton.style.left = '50%';
        collapseButton.style.transform = 'translateX(-50%)';
        collapseButton.style.width = '50px'; // 扩大按钮宽度
        collapseButton.style.height = '25px'; // 扩大按钮高度
        collapseButton.style.border = 'none';
        collapseButton.style.borderTopLeftRadius = '4px';
        collapseButton.style.borderTopRightRadius = '4px';
        collapseButton.style.backgroundColor = document.body.classList.contains('dark-theme') ? 'rgba(42, 42, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)';
        collapseButton.style.color = document.body.classList.contains('dark-theme') ? 'white' : 'black';
        collapseButton.style.cursor = 'pointer';
        collapseButton.style.zIndex = '2147483648'; // 确保在面板之上
        collapseButton.style.display = 'none'; // 默认隐藏
        
        // 初始显示3秒，让用户知道按钮存在
        setTimeout(() => {
          // 在外部重新检查全屏状态
          const isFullscreen = !!(document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement);
          const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');
           
          if ((isFullscreen || isPageFullscreen)) {
            collapseButton.style.display = 'flex';
            setTimeout(() => {
              collapseButton.style.display = 'none';
            }, 3000);
          }
        }, 500);
        collapseButton.style.alignItems = 'center';
        collapseButton.style.justifyContent = 'center';
        collapseButton.style.fontSize = '14px'; // 增大字体大小
        
        // 添加鼠标悬停事件，防止按钮闪烁
        collapseButton.addEventListener('mouseenter', function() {
          clearTimeout(collapseButton.hideTimeout);
          collapseButton.style.display = 'flex';
        });

        collapseButton.addEventListener('mouseleave', function(event) {
          // 鼠标离开按钮后，隐藏按钮
          collapseButton.hideTimeout = setTimeout(() => {
            // 检查是否仍在全屏或全页模式
            const isFullscreen = !!(document.fullscreenElement || 
                                  document.webkitFullscreenElement || 
                                  document.mozFullScreenElement || 
                                  document.msFullscreenElement);
            const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');

            // 只有在全屏或全页模式下，并且鼠标不在顶部区域时才隐藏
            if ((isFullscreen || isPageFullscreen) && event.clientY >= 20) {
              collapseButton.style.display = 'none';
            }
          }, 500);
        });



        // 鼠标移动检测函数
        function handleMouseMove(e) {
          // 检查是否是全屏模式
          const isFullscreen = !!(document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement);
          // 检查是否是全页模式
          const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');
           
          // 全屏模式或全页模式下，鼠标移动到顶部20px区域时显示按钮
          if (isFullscreen || isPageFullscreen) {
            if (e.clientY < 20) {
              collapseButton.style.display = 'flex';
            } else {
              // 延迟隐藏，避免快速移动鼠标时按钮闪烁
            collapseButton.hideTimeout = setTimeout(() => {
              // 检查鼠标是否仍在顶部区域或按钮上
              // 检查是否仍在全屏或全页模式
              const isFullscreen = !!(document.fullscreenElement || 
                                    document.webkitFullscreenElement || 
                                    document.mozFullScreenElement || 
                                    document.msFullscreenElement);
              const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');

              if ((isFullscreen || isPageFullscreen) && e.clientY >= 20 && !collapseButton.matches(':hover')) {
                collapseButton.style.display = 'none';
              }
            }, 500); // 缩短延迟时间，提高响应速度
            }
          }
        }
        
        // 添加鼠标移动事件监听器
        document.addEventListener('mousemove', handleMouseMove);
        
        // 存储事件监听器引用，以便后续移除
        collapseButton._handleMouseMove = handleMouseMove;
        
        // 添加折叠按钮到视频容器
        videoContainer.appendChild(collapseButton);
        
        // 初始显示一次按钮，让用户知道它的存在
        setTimeout(() => {
          collapseButton.style.display = 'flex';
          setTimeout(() => {
            collapseButton.style.display = 'none';
          }, 3000);
        }, 1000);
        
        // 折叠/展开功能
        collapseButton.addEventListener('click', function() {
          const isCollapsed = fullscreenChatPanel.dataset.collapsed === 'true';
          
          if (isCollapsed) {
            // 展开聊天面板
            fullscreenChatPanel.style.height = '200px';
            fullscreenChatPanel.style.padding = '10px'; // 恢复padding
            collapseButton.innerText = '▼';
            
            // 清除自动展开标记（表示这是用户手动展开的）
            delete fullscreenChatPanel.dataset.autoExpanded;
            
            // 清除自动隐藏计时器
            if (window.autoHideTimer) {
              clearTimeout(window.autoHideTimer);
            }
          } else {
            // 折叠聊天面板
            fullscreenChatPanel.style.height = '0px';
            fullscreenChatPanel.style.padding = '0px 10px';
            collapseButton.innerText = '▲';
          }
          
          // 更新折叠状态
          fullscreenChatPanel.dataset.collapsed = isCollapsed ? 'false' : 'true';
          
          // 如果展开，滚动到底部
          if (!isCollapsed) {
            setTimeout(() => {
              scrollToBottomForFullscreen(false);
            }, 300); // 等待动画完成后再滚动
          }
        });
        
        // 初始折叠聊天面板
        fullscreenChatPanel.style.height = '0px';
        fullscreenChatPanel.style.padding = '0px 10px';
        
        // 创建消息容器
        const messagesContainer = document.createElement('div');
        messagesContainer.className = 'chat-messages';
        messagesContainer.style.display = 'flex';
        messagesContainer.style.flexDirection = 'column';
        messagesContainer.style.gap = '8px';
        messagesContainer.style.height = '100%';
        messagesContainer.style.overflowY = 'auto';
        messagesContainer.style.backgroundColor = 'transparent'; // 设置消息容器背景为完全透明
        // 隐藏滚动条但保持滚动功能
        messagesContainer.style.scrollbarWidth = 'none'; // Firefox
        messagesContainer.style.msOverflowStyle = 'none'; // IE和Edge
        // 为Webkit浏览器(Chrome,Safari)添加样式以隐藏滚动条
        const style = document.createElement('style');
        style.textContent = `
          #fullscreenChatPanel::-webkit-scrollbar {
            display: none;
          }
          #fullscreenChatPanel .chat-messages::-webkit-scrollbar {
            display: none;
          }
        `;
        document.head.appendChild(style);
        
        // 将原始聊天记录克隆到全页聊天面板
        const originalChatMessages = document.querySelector('.chat-messages');
        if (originalChatMessages) {
          // 克隆所有聊天消息
          originalChatMessages.querySelectorAll('.message').forEach(message => {
            const clonedMessage = message.cloneNode(true);
            messagesContainer.appendChild(clonedMessage);
          });
        }
        
        fullscreenChatPanel.appendChild(messagesContainer);
        
        // 初始滚动到底部，使用专门的滚动函数
        // 延迟执行确保DOM完全渲染
        // 使用auto行为（非平滑滚动），避免从第一条消息滑动到最新消息的体验问题
        setTimeout(() => {
          scrollToBottomForFullscreen(false);
        }, 50);
        
        // 创建一个新的聊天输入框容器
        const fullscreenChatInput = document.createElement('div');
        fullscreenChatInput.id = 'fullscreenChatInput';
        fullscreenChatInput.className = 'chat-input';
        
        // 设置样式，使其浮在视频上方
        fullscreenChatInput.style.position = 'absolute';
        fullscreenChatInput.style.bottom = '80px';
        fullscreenChatInput.style.left = '50%';
        fullscreenChatInput.style.transform = 'translateX(-50%)';
        // 调整宽度，让输入框两边往中间缩
        fullscreenChatInput.style.width = '60%';
        fullscreenChatInput.style.maxWidth = '500px';
        fullscreenChatInput.style.zIndex = '2147483647'; // 使用最大z-index确保显示在最上层
        fullscreenChatInput.style.padding = '10px';
        fullscreenChatInput.style.backgroundColor = document.body.classList.contains('dark-theme') ? 'rgba(42, 42, 42, 0)' : 'rgba(255, 255, 255, 0)';
        fullscreenChatInput.style.borderRadius = '0px';
        fullscreenChatInput.style.border = 'none';
        fullscreenChatInput.style.boxShadow = 'none';
        // 默认隐藏聊天发送窗口
        fullscreenChatInput.style.display = 'none';
        
        // 创建全屏模式的聊天输入框，避免使用innerHTML导致ID重复
        // 创建输入框包装器 - 改为垂直布局
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-wrapper';
        inputWrapper.style.display = 'flex';
        inputWrapper.style.flexDirection = 'column'; // 改为垂直布局
        inputWrapper.style.gap = '8px'; // 添加间距
        
        // 创建按钮容器 - 放在输入框上方
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'center'; // 居中排列按钮
        buttonsContainer.style.alignItems = 'center';
        buttonsContainer.style.gap = '10px'; // 按钮间距
        buttonsContainer.style.padding = '5px 0'; // 上下内边距
        
        // 创建消息输入框
        const messageInput = document.createElement('input');
        messageInput.id = 'fullscreenMessageInput'; // 唯一ID
        messageInput.type = 'text';
        messageInput.placeholder = '输入消息...';
        messageInput.style.padding = '8px 12px';
        messageInput.style.border = '1px solid #ddd';
        messageInput.style.borderRadius = '20px';
        messageInput.style.width = '100%';
        messageInput.style.backgroundColor = document.body.classList.contains('dark-theme') ? 'rgba(42, 42, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)';
        messageInput.style.color = document.body.classList.contains('dark-theme') ? 'white' : 'black';
        
        // 创建表情按钮
        const emojiButton = document.createElement('button');
        emojiButton.id = 'fullscreenEmojiButton'; // 唯一ID
        emojiButton.innerHTML = '<i class="far fa-smile"></i>';
        emojiButton.style.padding = '8px';
        emojiButton.style.backgroundColor = 'transparent';
        emojiButton.style.border = 'none';
        emojiButton.style.cursor = 'pointer';
        emojiButton.style.color = document.body.classList.contains('dark-theme') ? 'white' : 'black';
        
        // 创建图片上传按钮
        const imageUploadButton = document.createElement('button');
        imageUploadButton.id = 'fullscreenImageUploadButton'; // 唯一ID
        imageUploadButton.innerHTML = '<i class="far fa-image"></i>';
        imageUploadButton.style.padding = '8px';
        imageUploadButton.style.backgroundColor = 'transparent';
        imageUploadButton.style.border = 'none';
        imageUploadButton.style.cursor = 'pointer';
        imageUploadButton.style.color = document.body.classList.contains('dark-theme') ? 'white' : 'black';
        
        // 创建发送按钮
        const sendButton = document.createElement('button');
        sendButton.id = 'fullscreenSendButton'; // 唯一ID
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
        sendButton.style.padding = '8px 16px';
        sendButton.style.backgroundColor = 'transparent';
        sendButton.style.border = 'none';
        sendButton.style.borderRadius = '20px';
        sendButton.style.cursor = 'pointer';
        sendButton.style.color = document.body.classList.contains('dark-theme') ? 'white' : 'black';
        
        // 创建A按钮（聊天设置按钮）
        const aButton = document.createElement('button');
        aButton.id = 'fullscreenAButton'; // 唯一ID
        aButton.className = 'chat-tool-button a-button';
        aButton.title = '聊天设置';
        aButton.innerHTML = '<span style="font-weight: bold; font-size: 18px;">A</span>';
        aButton.style.padding = '8px';
        aButton.style.backgroundColor = 'transparent';
        aButton.style.border = 'none';
        aButton.style.cursor = 'pointer';
        aButton.style.color = document.body.classList.contains('dark-theme') ? 'white' : 'black';
        
        // 将按钮添加到按钮容器
        buttonsContainer.appendChild(emojiButton);
        buttonsContainer.appendChild(imageUploadButton);
        buttonsContainer.appendChild(aButton);
        buttonsContainer.appendChild(sendButton);
        
        // 将按钮容器和输入框添加到包装器
        inputWrapper.appendChild(buttonsContainer); // 按钮在上
        inputWrapper.appendChild(messageInput); // 输入框在下
        
        // 添加包装器到全屏聊天输入框
        fullscreenChatInput.appendChild(inputWrapper);
        
        // 设置按钮背景为完全透明并隐藏边框
        const buttons = [sendButton, emojiButton, imageUploadButton, aButton];
        buttons.forEach(button => {
          if (button) {
            button.style.backgroundColor = 'transparent';
            button.style.border = 'none';
          }
        });
        
        // 创建全屏模式专用的文件输入框
        const clonedImageUploadInput = document.createElement('input');
        clonedImageUploadInput.id = 'fullscreenImageUploadInput'; // 唯一ID
        clonedImageUploadInput.type = 'file';
        clonedImageUploadInput.accept = 'image/*';
        clonedImageUploadInput.style.display = 'none';
        document.body.appendChild(clonedImageUploadInput);
        
        // 在发送按钮右侧添加关闭按钮
        const closeButton = document.createElement('button');
        closeButton.id = 'fullscreenCloseChatButton'; // 唯一ID
        closeButton.innerHTML = '<i class="fas fa-times"></i>';
        closeButton.style.backgroundColor = 'transparent';
        closeButton.style.border = 'none';
        closeButton.style.color = document.body.classList.contains('dark-theme') ? 'white' : 'black';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '5px 10px';
        closeButton.style.borderRadius = '4px';
        closeButton.style.marginLeft = '5px';
        
        // 添加关闭按钮到输入框父容器
        const inputContainer = messageInput.parentElement;
        if (inputContainer) {
          inputContainer.appendChild(closeButton);
        }
        
        // 为发送按钮添加点击事件
        sendButton.addEventListener('click', function() {
          const message = messageInput.value.trim();
          if (message && currentRoom && username) {
            // 直接发送消息
            socket.emit('chat_message', {
              room: currentRoom,
              username,
              message,
              isImage: false
            });
            // 直接调用addChatMessage函数，确保消息显示在两个聊天窗口
            window.addChatMessage(username, message, true, false);
            // 清空全屏输入框
            messageInput.value = '';
            // 确保消息发送后聊天发送窗口保持显现
            fullscreenChatInput.style.display = 'block';
          }
        });
        
        // 为关闭按钮添加点击事件
        closeButton.addEventListener('click', function() {
          fullscreenChatInput.style.display = 'none';
        });
        
        // 为了确保消息能够被正确记录，我们也可以在发送成功后直接添加消息到全页聊天面板
        // 监听原始消息输入框的变化，当消息发送后可以额外处理
        const originalMessageInput = document.getElementById('messageInput');
        let lastMessageValue = originalMessageInput.value;
        
        // 定期检查原始输入框内容变化
        function checkMessageChange() {
          if (lastMessageValue && !originalMessageInput.value && document.getElementById('fullscreenChatInput')) {
            // 输入框从有内容变为空，可能是消息发送了
            // 这里我们可以稍微延迟一下，确保addChatMessage已经被调用
            setTimeout(() => {
              const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
              if (fullscreenChatPanel) {
                // 强制滚动到底部，使用专门的滚动函数
                setTimeout(() => {
                  scrollToBottomForFullscreen();
                }, 10);
              }
            }, 100);
          }
          lastMessageValue = originalMessageInput.value;
          requestAnimationFrame(checkMessageChange);
        }
        checkMessageChange();
        
        // 为输入框添加回车发送功能
        messageInput.addEventListener('keydown', function(event) {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendButton.click();
          }
        });
        
        // 为表情按钮添加点击事件 - 使用与A按钮相同的显示/隐藏切换模式
        emojiButton.addEventListener('click', function(event) {
          event.stopPropagation();
          
          // 检查是否已存在全屏模式的表情面板
          let fullscreenEmojiPanel = document.getElementById('fullscreenEmojiPickerPanel');
          
          if (fullscreenEmojiPanel) {
            // 如果面板已存在，切换显示/隐藏（与A按钮模式一致）
            fullscreenEmojiPanel.style.display = fullscreenEmojiPanel.style.display === 'none' ? 'block' : 'none';
          } else {
            // 创建新的全屏表情面板
            createFullscreenEmojiPicker(emojiButton);
          }
        });
        
        // 创建全屏专用表情选择器（与A按钮同步模式一致）
        function createFullscreenEmojiPicker(targetButton) {
          // 创建新的全屏表情面板（不再清理，因为已经在外部处理了显示/隐藏）
          
          // 创建新的全屏表情面板（完全独立的实例）
          const fullscreenEmojiPanel = document.createElement('div');
          fullscreenEmojiPanel.id = 'fullscreenEmojiPickerPanel';
          fullscreenEmojiPanel.className = 'emoji-picker-panel';
          
          // 设置样式（与正常模式保持一致）
          const panelWidth = 252;
          const panelHeight = 288;
          
          fullscreenEmojiPanel.style.position = 'absolute';
          fullscreenEmojiPanel.style.width = `${panelWidth}px`;
          fullscreenEmojiPanel.style.maxHeight = `${panelHeight}px`;
          fullscreenEmojiPanel.style.backgroundColor = 'var(--popup-bg)';
          fullscreenEmojiPanel.style.border = '1px solid var(--popup-border)';
          fullscreenEmojiPanel.style.borderRadius = '8px';
          fullscreenEmojiPanel.style.boxShadow = 'var(--popup-shadow)';
          fullscreenEmojiPanel.style.zIndex = '2147483647';
          fullscreenEmojiPanel.style.overflow = 'hidden';
          
          // 创建标签页
          const tabs = document.createElement('div');
          tabs.style.display = 'flex';
          tabs.style.borderBottom = '1px solid var(--popup-border)';
          tabs.style.backgroundColor = 'var(--popup-hover-bg)';
          
          const emojiTab = document.createElement('button');
          emojiTab.textContent = '😊';
          emojiTab.style.flex = '1';
          emojiTab.style.padding = '7px';
          emojiTab.style.background = 'none';
          emojiTab.style.border = 'none';
          emojiTab.style.cursor = 'pointer';
          emojiTab.style.fontSize = '14px';
          emojiTab.style.color = 'var(--popup-text)';
          emojiTab.style.borderBottom = '2px solid #4299e1';
          
          const kaomojiTab = document.createElement('button');
          kaomojiTab.textContent = '⌒';
          kaomojiTab.style.flex = '1';
          kaomojiTab.style.padding = '7px';
          kaomojiTab.style.background = 'none';
          kaomojiTab.style.border = 'none';
          kaomojiTab.style.cursor = 'pointer';
          kaomojiTab.style.fontSize = '14px';
          kaomojiTab.style.color = 'var(--text-muted)';
          
          tabs.appendChild(emojiTab);
          tabs.appendChild(kaomojiTab);
          fullscreenEmojiPanel.appendChild(tabs);
          
          // 创建内容区域
          const content = document.createElement('div');
          content.style.padding = '7px';
          content.style.maxHeight = '225px';
          content.style.overflow = 'auto';
          content.style.msOverflowStyle = 'none';
          content.style.scrollbarWidth = 'none';
          
          // 获取当前输入框（根据模式选择）
          const isFullscreen = !!document.getElementById('fullscreenMessageInput');
          const messageInput = isFullscreen ? 
            document.getElementById('fullscreenMessageInput') : 
            document.getElementById('messageInput');
          
          // emoji网格
          const emojiGrid = document.createElement('div');
          emojiGrid.style.display = 'grid';
          emojiGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(25px, 1fr))';
          emojiGrid.style.gap = '1.8px';
          emojiGrid.style.padding = '3.6px';
          
          // 颜文字网格
          const kaomojiGrid = document.createElement('div');
          kaomojiGrid.style.display = 'none';
          kaomojiGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(60px, 1fr))';
          kaomojiGrid.style.gap = '1.8px';
          kaomojiGrid.style.padding = '3.6px';
          
          // 确保emojiData.js被加载
          if (!window.emojiData && !document.querySelector('script[src="js/extra/mojiData.js"]')) {
            const script = document.createElement('script');
            script.src = 'js/extra/emojiData.js';
            document.head.appendChild(script);
          }
          
          // 等待表情数据加载完成后填充emoji
          function waitForEmojiData() {
            return new Promise((resolve) => {
              if (window.emojiData) {
                resolve();
              } else {
                const checkInterval = setInterval(() => {
                  if (window.emojiData) {
                    clearInterval(checkInterval);
                    resolve();
                  }
                }, 50);
              }
            });
          }
          
          waitForEmojiData().then(() => {
            // 使用动态加载的表情数据
            window.emojiData.emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.textContent = emoji;
            emojiBtn.style.background = 'none';
            emojiBtn.style.border = 'none';
            emojiBtn.style.fontSize = '18px';
            emojiBtn.style.cursor = 'pointer';
            emojiBtn.style.padding = '3.6px';
            emojiBtn.style.borderRadius = '3.6px';
            emojiBtn.style.display = 'flex';
            emojiBtn.style.alignItems = 'center';
            emojiBtn.style.justifyContent = 'center';
            emojiBtn.style.transition = 'background-color 0.2s';
            emojiBtn.onmouseover = () => emojiBtn.style.backgroundColor = 'var(--popup-hover-bg)';
            emojiBtn.onmouseout = () => emojiBtn.style.backgroundColor = 'transparent';
            emojiBtn.onclick = () => {
              messageInput.value += emoji;
              messageInput.focus();
            };
            emojiGrid.appendChild(emojiBtn);
          });
          
            // 渲染颜文字
            window.emojiData.kaomojis.forEach(kaomoji => {
            const kaomojiBtn = document.createElement('button');
            kaomojiBtn.textContent = kaomoji;
            kaomojiBtn.style.background = 'none';
            kaomojiBtn.style.border = `1px solid ${document.body.classList.contains('dark-theme') ? '#2d3748' : '#e2e8f0'}`;
            kaomojiBtn.style.borderRadius = '3.6px';
            kaomojiBtn.style.padding = '5.4px 3.6px';
            kaomojiBtn.style.cursor = 'pointer';
            kaomojiBtn.style.fontSize = '10.8px';
            kaomojiBtn.style.textAlign = 'center';
            kaomojiBtn.style.transition = 'all 0.2s';
            kaomojiBtn.style.color = document.body.classList.contains('dark-theme') ? '#e2e8f0' : '#2d3748';
            kaomojiBtn.style.overflow = 'hidden';
            kaomojiBtn.style.whiteSpace = 'nowrap';
            kaomojiBtn.onmouseover = () => kaomojiBtn.style.backgroundColor = 'var(--popup-hover-bg)';
            kaomojiBtn.onmouseout = () => kaomojiBtn.style.backgroundColor = 'transparent';
            kaomojiBtn.onclick = () => {
              messageInput.value += kaomoji;
              messageInput.focus();
            };
            kaomojiGrid.appendChild(kaomojiBtn);
          });
          
          content.appendChild(emojiGrid);
          content.appendChild(kaomojiGrid);
          fullscreenEmojiPanel.appendChild(content);
        }); // 结束waitForEmojiData的Promise
          
          // 标签页切换功能
          emojiTab.onclick = () => {
            emojiTab.style.borderBottom = '2px solid #4299e1';
            emojiTab.style.color = 'var(--popup-text)';
            kaomojiTab.style.borderBottom = 'none';
            kaomojiTab.style.color = 'var(--text-muted)';
            emojiGrid.style.display = 'grid';
            kaomojiGrid.style.display = 'none';
          };
          
          kaomojiTab.onclick = () => {
            kaomojiTab.style.borderBottom = '2px solid #4299e1';
            kaomojiTab.style.color = 'var(--popup-text)';
            emojiTab.style.borderBottom = 'none';
            emojiTab.style.color = 'var(--text-muted)';
            emojiGrid.style.display = 'none';
            kaomojiGrid.style.display = 'grid';
          };
          
          // 添加到全屏聊天输入框 - 与A按钮保持一致
          const fullscreenChatInput = document.getElementById('fullscreenChatInput');
          if (fullscreenChatInput) {
            fullscreenChatInput.appendChild(fullscreenEmojiPanel);
          } else {
            document.body.appendChild(fullscreenEmojiPanel);
          }
          
          // 立即定位面板，然后显示
          positionEmojiPanel(fullscreenEmojiPanel, targetButton);
          fullscreenEmojiPanel.style.display = 'block';
          
          // 点击外部关闭面板 - 使用与A按钮相同的模式
          function closeFullscreenEmojiPanel(event) {
            // 检查点击是否在面板外部且不是表情按钮本身
            if (fullscreenEmojiPanel.style.display === 'block' && 
                event.target !== targetButton && 
                !targetButton.contains(event.target) && 
                event.target !== fullscreenEmojiPanel && 
                !fullscreenEmojiPanel.contains(event.target)) {
              fullscreenEmojiPanel.style.display = 'none';
            }
          }
          
          // 添加点击外部关闭事件监听（与A按钮模式一致）
          document.addEventListener('click', closeFullscreenEmojiPanel);
          
          // 为面板添加点击事件，阻止事件冒泡
          fullscreenEmojiPanel.addEventListener('click', function(event) {
            event.stopPropagation();
          });
        }
        
        // 表情面板定位函数（与A按钮保持一致）
        function positionEmojiPanel(panel, button) {
          // 与A按钮完全一致的定位策略
          panel.style.position = 'absolute';
          panel.style.bottom = '90%';
          panel.style.left = 'auto';
          panel.style.right = '245px';
          panel.style.marginBottom = '10px';
          panel.style.zIndex = '2147483647';
          
          console.log('表情面板定位完成：', {
            position: panel.style.position,
            bottom: panel.style.bottom,
            right: panel.style.right,
            zIndex: panel.style.zIndex
          });
        }
        
        // 为图片上传按钮添加点击事件
        imageUploadButton.addEventListener('click', function() {
          clonedImageUploadInput.click();
        });

        // 为A按钮添加点击事件 - 聊天设置弹窗
        aButton.addEventListener('click', function() {
          // 检查是否已存在全屏模式的A按钮弹窗
          let fullscreenPopup = document.getElementById('fullscreenAButtonPopup');
          
          if (fullscreenPopup) {
            // 如果弹窗已存在，切换显示/隐藏
            fullscreenPopup.style.display = fullscreenPopup.style.display === 'none' ? 'block' : 'none';
          } else {
            // 创建全屏模式专用的A按钮弹窗
            fullscreenPopup = document.createElement('div');
            fullscreenPopup.id = 'fullscreenAButtonPopup';
            fullscreenPopup.className = 'a-button-popup';
            fullscreenPopup.style.display = 'block';
            fullscreenPopup.style.position = 'absolute';
            fullscreenPopup.style.bottom = '1%';
            fullscreenPopup.style.left = 'auto';
            fullscreenPopup.style.right = '10px';
            fullscreenPopup.style.marginBottom = '-15px';
            fullscreenPopup.style.padding = '15px';
            fullscreenPopup.style.backgroundColor = document.body.classList.contains('dark-theme') ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
            fullscreenPopup.style.border = '1px solid var(--popup-border)';
            fullscreenPopup.style.borderRadius = '8px';
            fullscreenPopup.style.boxShadow = 'var(--popup-shadow)';
            fullscreenPopup.style.zIndex = '2147483647'; // 确保在最上层
            fullscreenPopup.style.minWidth = '240px';
            fullscreenPopup.style.maxWidth = 'calc(100vw - 40px)';
            fullscreenPopup.style.transform = 'scale(0.8)';
            fullscreenPopup.style.transformOrigin = 'bottom right';
            fullscreenPopup.style.transition = 'all 0.3s ease';
            
            // 创建弹窗内容 - 与普通模式完全一致（包含所有5个功能）
            fullscreenPopup.innerHTML = `
              <!-- 弹窗头部 -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 12.8px; color: var(--popup-text);">聊天设置</h3>
                <button id="fullscreenCloseAPopupButton" style="background: none; border: none; cursor: pointer; font-size: 14.4px; color: var(--popup-text); padding: 0;">×</button>
              </div>
              
              <!-- 文字大小和颜色设置 - 并列显示 -->
              <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <!-- 文字大小设置 - 自定义下拉菜单 -->
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 5px; font-size: 10.4px; color: var(--popup-text);">文字大小</label>
                  
                  <!-- 隐藏原始的select元素，但保留功能 -->
                  <select id="fullscreenFontSizeSelect" style="display: none;">
                    <option value="10">超小号 (10px)</option>
                    <option value="12">小号 (12px)</option>
                    <option value="14" selected>中号 (14px)</option>
                    <option value="16">大号 (16px)</option>
                    <option value="18">超大号 (18px)</option>
                    <option value="20">特大号 (20px)</option>
                  </select>
                  
                  <!-- 自定义下拉菜单容器 -->
                  <div id="fullscreenCustomFontSizeSelect" style="position: relative; width: 100%;">
                    <!-- 下拉菜单按钮 -->
                    <div id="fullscreenFontSizeButton" style="width: 100%; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; font-size: 10.4px; background-color: var(--popup-input-bg); color: var(--popup-text); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                      <span id="fullscreenFontSizeValue">中号 (14px)</span>
                      <span style="font-size: 8px;">▼</span>
                    </div>
                    
                    <!-- 下拉菜单选项列表 -->
                    <div id="fullscreenFontSizeOptions" class="custom-dropdown-options" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 2px; border: 1px solid var(--popup-border); border-radius: 4px; background-color: var(--popup-bg); max-height: 200px; overflow-y: auto; z-index: 1000;">
                      <div data-value="10" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">超小号 (10px)</div>
                      <div data-value="12" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">小号 (12px)</div>
                      <div data-value="14" class="custom-option selected" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px; background-color: var(--popup-hover-bg);">中号 (14px)</div>
                      <div data-value="16" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">大号 (16px)</div>
                      <div data-value="18" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">超大号 (18px)</div>
                      <div data-value="20" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">特大号 (20px)</div>
                    </div>
                  </div>
                </div>
                
                <!-- 文字颜色设置 - 自定义下拉菜单 -->
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 5px; font-size: 10.4px; color: var(--popup-text);">文字颜色</label>
                  
                  <!-- 隐藏原始的select元素，但保留功能 -->
                  <select id="fullscreenFontColorSelect" style="display: none;">
                    <option value="#000000" selected>黑色</option>
                    <option value="#ffffff">白色</option>
                    <option value="#007bff">蓝色</option>
                    <option value="#28a745">绿色</option>
                    <option value="#dc3545">红色</option>
                    <option value="#ffc107">黄色</option>
                    <option value="#6c757d">灰色</option>
                  </select>
                  
                  <!-- 自定义下拉菜单容器 -->
                  <div id="fullscreenCustomFontColorSelect" style="position: relative; width: 100%;">
                    <!-- 下拉菜单按钮 -->
                    <div id="fullscreenFontColorButton" style="width: 100%; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; font-size: 10.4px; background-color: var(--popup-input-bg); color: var(--popup-text); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                      <span id="fullscreenFontColorValue">黑色</span>
                      <span style="font-size: 8px;">▼</span>
                    </div>
                    
                    <!-- 下拉菜单选项列表 -->
                    <div id="fullscreenFontColorOptions" class="custom-dropdown-options" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 2px; border: 1px solid var(--popup-border); border-radius: 4px; background-color: var(--popup-bg); max-height: 200px; overflow-y: auto; z-index: 1000;">
                      <div data-value="#000000" class="color-option selected" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px; background-color: var(--popup-hover-bg);">黑色</div>
                      <div data-value="#ffffff" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">白色</div>
                      <div data-value="#007bff" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">蓝色</div>
                      <div data-value="#28a745" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">绿色</div>
                      <div data-value="#dc3545" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">红色</div>
                      <div data-value="#ffc107" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">黄色</div>
                      <div data-value="#6c757d" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">灰色</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 气泡显示和气泡颜色设置 - 并列显示 -->
              <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <!-- 气泡显示设置 -->
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 5px; font-size: 10.4px; color: var(--popup-text);">气泡显示</label>
                  
                  <!-- 隐藏原始的select元素 -->
                  <select id="fullscreenBubbleDisplaySelect" style="display: none;">
                    <option value="show" selected>显示</option>
                    <option value="hide">隐藏</option>
                  </select>
                  
                  <!-- 自定义下拉菜单容器 -->
                  <div id="fullscreenCustomBubbleDisplaySelect" style="position: relative; width: 100%;">
                    <!-- 下拉菜单按钮 -->
                    <div id="fullscreenBubbleDisplayButton" style="width: 100%; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; font-size: 10.4px; background-color: var(--popup-input-bg); color: var(--popup-text); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                      <span id="fullscreenBubbleDisplayValue">显示</span>
                      <span style="font-size: 8px;">▼</span>
                    </div>
                    
                    <!-- 下拉菜单选项列表 -->
                    <div id="fullscreenBubbleDisplayOptions" class="custom-dropdown-options" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 2px; border: 1px solid var(--popup-border); border-radius: 4px; background-color: var(--popup-bg); max-height: 200px; overflow-y: auto; z-index: 1000;">
                      <div data-value="show" class="custom-option selected" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px; background-color: var(--popup-hover-bg);">显示</div>
                      <div data-value="hide" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">隐藏</div>
                    </div>
                  </div>
                </div>
                
                <!-- 气泡颜色设置 -->
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 5px; font-size: 10.4px; color: var(--popup-text);">气泡颜色</label>
                  
                  <!-- 隐藏原始的select元素 -->
                  <select id="fullscreenBubbleColorSelect" style="display: none;">
                    <option value="#dcf8c6" data-own-color="#0084ff" selected>绿色</option>
                    <option value="#f3f3f3" data-own-color="#0084ff">灰色</option>
                    <option value="#e3f2fd" data-own-color="#2196f3">蓝色</option>
                    <option value="#fff3e0" data-own-color="#ff9800">橙色</option>
                    <option value="#fce4ec" data-own-color="#e91e63">粉色</option>
                    <option value="#f3e5f5" data-own-color="#9c27b0">紫色</option>
                  </select>
                  
                  <!-- 自定义下拉菜单容器 -->
                  <div id="fullscreenCustomBubbleColorSelect" style="position: relative; width: 100%;">
                    <!-- 下拉菜单按钮 -->
                    <div id="fullscreenBubbleColorButton" style="width: 100%; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; font-size: 10.4px; background-color: var(--popup-input-bg); color: var(--popup-text); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                      <span id="fullscreenBubbleColorValue">默认灰色</span>
                      <span style="font-size: 8px;">▼</span>
                    </div>
                    
                    <!-- 下拉菜单选项列表 -->
                    <div id="fullscreenBubbleColorOptions" class="custom-dropdown-options" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 2px; border: 1px solid var(--popup-border); border-radius: 4px; background-color: var(--popup-bg); max-height: 200px; overflow-y: auto; z-index: 1000;">
                      <div data-value="#666666" data-own-color="#666666" class="color-option selected" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px; background-color: var(--popup-hover-bg);">默认灰色</div>
                      <div data-value="#e3f2fd" data-own-color="#90caf9" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">蓝色系列</div>
                      <div data-value="#fff3e0" data-own-color="#ffcc80" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">橙色系列</div>
                      <div data-value="#f3e5f5" data-own-color="#ce93d8" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">紫色系列</div>
                      <div data-value="#e8f5e9" data-own-color="#a5d6a7" class="color-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">浅绿色系列</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 聊天框位置和发送消息框位置并排布局 -->
              <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <!-- 聊天框位置设置 -->
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 5px; font-size: 10.4px; color: var(--popup-text);">聊天框位置</label>
                  
                  <!-- 隐藏原始的select元素 -->
                  <select id="fullscreenChatPositionSelect" style="display: none;">
                    <option value="top-center" selected>顶部居中</option>
                    <option value="top-left">左上角</option>
                    <option value="top-right">右上角</option>
                    <option value="bottom-left">左下角</option>
                    <option value="bottom-right">右下角</option>
                  </select>
                  
                  <!-- 自定义下拉菜单容器 -->
                  <div id="fullscreenCustomChatPositionSelect" style="position: relative; width: 100%;">
                    <!-- 下拉菜单按钮 -->
                    <div id="fullscreenChatPositionButton" style="width: 100%; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; font-size: 10.4px; background-color: var(--popup-input-bg); color: var(--popup-text); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                      <span id="fullscreenChatPositionValue">顶部居中</span>
                      <span style="font-size: 8px;">▼</span>
                    </div>
                    
                    <!-- 下拉菜单选项列表 -->
                    <div id="fullscreenChatPositionOptions" class="custom-dropdown-options" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 2px; border: 1px solid var(--popup-border); border-radius: 4px; background-color: var(--popup-bg); max-height: 200px; overflow-y: auto; z-index: 1000;">
                      <div data-value="top-center" class="custom-option selected" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px; background-color: var(--popup-hover-bg);">顶部居中</div>
                      <div data-value="top-left" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">左上角</div>
                      <div data-value="top-right" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">右上角</div>
                      <div data-value="bottom-left" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">左下角</div>
                      <div data-value="bottom-right" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">右下角</div>
    
                    </div>
                  </div>
                </div>
                
                <!-- 发送消息框位置设置 -->
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 5px; font-size: 10.4px; color: var(--popup-text);">发送消息框位置</label>
                  
                  <!-- 隐藏原始的select元素 -->
                <select id="fullscreenInputPositionSelect" style="display: none;">
                  <option value="default" selected>默认位置</option>
                  <option value="bottom-center">底部居中</option>
                  <option value="center-center">中间居中</option>
                  <option value="bottom-left">左下角</option>
                  <option value="bottom-right">右下角</option>
                </select>
                  
                  <!-- 自定义下拉菜单容器 -->
                  <div id="fullscreenCustomInputPositionSelect" style="position: relative; width: 100%;">
                    <!-- 下拉菜单按钮 -->
                    <div id="fullscreenInputPositionButton" style="width: 100%; padding: 6px; border: 1px solid var(--popup-border); border-radius: 4px; font-size: 10.4px; background-color: var(--popup-input-bg); color: var(--popup-text); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                      <span id="fullscreenInputPositionValue">默认位置</span>
                      <span style="font-size: 8px;">▼</span>
                    </div>
                    
                    <!-- 下拉菜单选项列表 -->
                    <div id="fullscreenInputPositionOptions" class="custom-dropdown-options" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 2px; border: 1px solid var(--popup-border); border-radius: 4px; background-color: var(--popup-bg); max-height: 200px; overflow-y: auto; z-index: 1000;">
                      <div data-value="default" class="custom-option selected" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px; background-color: var(--popup-hover-bg);">默认位置</div>
                      <div data-value="bottom-center" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">底部居中</div>
                      <div data-value="center-center" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">中间居中</div>
                      <div data-value="bottom-left" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">左下角</div>
                      <div data-value="bottom-right" class="custom-option" style="padding: 6px; cursor: pointer; color: var(--popup-text); font-size: 10.4px;">右下角</div>
                    </div>
                  </div>
                </div>
              </div>
              
              
              
              <!-- 恢复默认设置按钮 -->
              <div style="margin-top: 20px; text-align: center;">
                <button id="fullscreenResetSettingsButton" style="padding: 8px 16px; background-color: var(--popup-hover-bg); color: var(--popup-text); border: 1px solid var(--popup-border); border-radius: 4px; cursor: pointer; font-size: 10.4px; transition: background-color 0.2s, transform 0.1s;" 
                        onmouseover="this.style.backgroundColor='var(--popup-active-bg)';" 
                        onmouseout="this.style.backgroundColor='var(--popup-hover-bg)';" 
                        onmousedown="this.style.transform='scale(0.95)';" 
                        onmouseup="this.style.transform='scale(1)';">
                  恢复默认设置
                </button>
              </div>
            `;
            
            // 添加到全屏聊天输入框
            fullscreenChatInput.appendChild(fullscreenPopup);
            
            // 添加关闭按钮事件
            const closeBtn = fullscreenPopup.querySelector('#fullscreenCloseAPopupButton');
            closeBtn.addEventListener('click', function() {
              fullscreenPopup.style.display = 'none';
            });
            
            // 添加点击外部关闭功能 - 修复第二次点击无效的问题
            function closeFullscreenPopupOnClickOutside(event) {
              // 检查点击是否在弹窗外部且不是A按钮本身
              if (fullscreenPopup.style.display === 'block' && 
                  event.target !== aButton && 
                  !aButton.contains(event.target) && 
                  event.target !== fullscreenPopup && 
                  !fullscreenPopup.contains(event.target)) {
                fullscreenPopup.style.display = 'none';
              }
            }
            
            // 添加点击外部关闭事件监听
            document.addEventListener('click', closeFullscreenPopupOnClickOutside);
            
            // 为弹窗添加点击事件，阻止事件冒泡
            fullscreenPopup.addEventListener('click', function(event) {
              event.stopPropagation();
            });
            
            // 同步设置状态 - 使用自定义下拉菜单（包含所有6个功能）
            const fullscreenFontSizeSelect = fullscreenPopup.querySelector('#fullscreenFontSizeSelect');
            const fullscreenFontColorSelect = fullscreenPopup.querySelector('#fullscreenFontColorSelect');
            const fullscreenBubbleDisplaySelect = fullscreenPopup.querySelector('#fullscreenBubbleDisplaySelect');
            const fullscreenBubbleColorSelect = fullscreenPopup.querySelector('#fullscreenBubbleColorSelect');
            const fullscreenChatPositionSelect = fullscreenPopup.querySelector('#fullscreenChatPositionSelect');
            const fullscreenInputPositionSelect = fullscreenPopup.querySelector('#fullscreenInputPositionSelect');
            
            const fullscreenFontSizeValue = fullscreenPopup.querySelector('#fullscreenFontSizeValue');
            const fullscreenFontColorValue = fullscreenPopup.querySelector('#fullscreenFontColorValue');
            const fullscreenBubbleDisplayValue = fullscreenPopup.querySelector('#fullscreenBubbleDisplayValue');
            const fullscreenBubbleColorValue = fullscreenPopup.querySelector('#fullscreenBubbleColorValue');
            const fullscreenChatPositionValue = fullscreenPopup.querySelector('#fullscreenChatPositionValue');
            const fullscreenInputPositionValue = fullscreenPopup.querySelector('#fullscreenInputPositionValue');
            
            const fullscreenFontSizeButton = fullscreenPopup.querySelector('#fullscreenFontSizeButton');
            const fullscreenFontColorButton = fullscreenPopup.querySelector('#fullscreenFontColorButton');
            const fullscreenBubbleDisplayButton = fullscreenPopup.querySelector('#fullscreenBubbleDisplayButton');
            const fullscreenBubbleColorButton = fullscreenPopup.querySelector('#fullscreenBubbleColorButton');
            const fullscreenChatPositionButton = fullscreenPopup.querySelector('#fullscreenChatPositionButton');
            const fullscreenInputPositionButton = fullscreenPopup.querySelector('#fullscreenInputPositionButton');
            
            const fullscreenFontSizeOptions = fullscreenPopup.querySelector('#fullscreenFontSizeOptions');
            const fullscreenFontColorOptions = fullscreenPopup.querySelector('#fullscreenFontColorOptions');
            const fullscreenBubbleDisplayOptions = fullscreenPopup.querySelector('#fullscreenBubbleDisplayOptions');
            const fullscreenBubbleColorOptions = fullscreenPopup.querySelector('#fullscreenBubbleColorOptions');
            const fullscreenChatPositionOptions = fullscreenPopup.querySelector('#fullscreenChatPositionOptions');
            const fullscreenInputPositionOptions = fullscreenPopup.querySelector('#fullscreenInputPositionOptions');
            

            
            // 从普通模式同步当前值
            const originalFontSizeSelect = document.getElementById('fontSizeSelect');
            const originalFontColorSelect = document.getElementById('fontColorSelect');
            const originalBubbleDisplaySelect = document.getElementById('bubbleDisplaySelect');
            const originalBubbleColorSelect = document.getElementById('bubbleColorSelect');

            
            // 同步所有设置值
            if (originalFontSizeSelect) {
              fullscreenFontSizeSelect.value = originalFontSizeSelect.value;
              const selectedText = fullscreenFontSizeOptions.querySelector(`[data-value="${originalFontSizeSelect.value}"]`).textContent;
              fullscreenFontSizeValue.textContent = selectedText;
            }
            if (originalFontColorSelect) {
              fullscreenFontColorSelect.value = originalFontColorSelect.value;
              const selectedText = fullscreenFontColorOptions.querySelector(`[data-value="${originalFontColorSelect.value}"]`).textContent;
              fullscreenFontColorValue.textContent = selectedText;
            }
            if (originalBubbleDisplaySelect) {
              fullscreenBubbleDisplaySelect.value = originalBubbleDisplaySelect.value;
              const selectedText = fullscreenBubbleDisplayOptions.querySelector(`[data-value="${originalBubbleDisplaySelect.value}"]`).textContent;
              fullscreenBubbleDisplayValue.textContent = selectedText;
            }
            if (originalBubbleColorSelect) {
              fullscreenBubbleColorSelect.value = originalBubbleColorSelect.value;
              const selectedOption = fullscreenBubbleColorOptions.querySelector(`[data-value="${originalBubbleColorSelect.value}"]`);
              if (selectedOption) {
                const selectedText = selectedOption.textContent;
                fullscreenBubbleColorValue.textContent = selectedText;
              }
            }

            
            // 文字大小自定义下拉菜单功能 - 优化版，与普通模式完全一致
            fullscreenFontSizeButton.addEventListener('click', function(event) {
              event.stopPropagation();
              const wasVisible = fullscreenFontSizeOptions.style.display === 'block';
              // 关闭所有下拉菜单
              fullscreenFontColorOptions.style.display = 'none';
              fullscreenBubbleDisplayOptions.style.display = 'none';
              fullscreenBubbleColorOptions.style.display = 'none';
              fullscreenChatPositionOptions.style.display = 'none';
              fullscreenInputPositionOptions.style.display = 'none';
              
              // 切换当前菜单的显示状态
              fullscreenFontSizeOptions.style.display = wasVisible ? 'none' : 'block';
            });
            
            fullscreenFontSizeOptions.querySelectorAll('.custom-option').forEach(option => {
              option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const text = this.textContent;
                fullscreenFontSizeValue.textContent = text;
                fullscreenFontSizeSelect.value = value;
                
                // 同步到普通模式
                if (originalFontSizeSelect) {
                  originalFontSizeSelect.value = value;
                  originalFontSizeSelect.dispatchEvent(new Event('change'));
                }
                
                // 应用到全屏聊天消息
                const fullscreenMessages = document.querySelectorAll('#fullscreenChatPanel .message');
                fullscreenMessages.forEach(msg => {
                  msg.style.fontSize = value + 'px';
                });
                
                fullscreenFontSizeOptions.style.display = 'none';
                
                // 更新选中状态样式 - 与普通模式一致
                fullscreenFontSizeOptions.querySelectorAll('.custom-option').forEach(opt => {
                  opt.classList.toggle('selected', opt === this);
                  opt.style.backgroundColor = opt === this ? 'var(--popup-hover-bg)' : 'transparent';
                });
              });
              
              option.addEventListener('mouseover', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'var(--popup-hover-bg)';
                }
              });
              
              option.addEventListener('mouseout', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'transparent';
                }
              });
            });
            
            // 文字颜色自定义下拉菜单功能 - 优化版
            fullscreenFontColorButton.addEventListener('click', function(event) {
              event.stopPropagation();
              const wasVisible = fullscreenFontColorOptions.style.display === 'block';
              // 关闭所有下拉菜单
              fullscreenFontSizeOptions.style.display = 'none';
              fullscreenBubbleDisplayOptions.style.display = 'none';
              fullscreenBubbleColorOptions.style.display = 'none';
              fullscreenChatPositionOptions.style.display = 'none';
              
              // 切换当前菜单的显示状态
              fullscreenFontColorOptions.style.display = wasVisible ? 'none' : 'block';
            });
            
            fullscreenFontColorOptions.querySelectorAll('.color-option').forEach(option => {
              option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const text = this.textContent;
                fullscreenFontColorValue.textContent = text;
                fullscreenFontColorSelect.value = value;
                
                // 同步到普通模式
                if (originalFontColorSelect) {
                  originalFontColorSelect.value = value;
                  originalFontColorSelect.dispatchEvent(new Event('change'));
                }
                
                // 应用到全屏聊天消息
                const fullscreenMessages = document.querySelectorAll('#fullscreenChatPanel .message');
                fullscreenMessages.forEach(msg => {
                  msg.style.color = value;
                });
                
                fullscreenFontColorOptions.style.display = 'none';
                
                // 更新选中状态样式 - 与普通模式一致
                fullscreenFontColorOptions.querySelectorAll('.color-option').forEach(opt => {
                  opt.classList.toggle('selected', opt === this);
                  opt.style.backgroundColor = opt === this ? 'var(--popup-hover-bg)' : 'transparent';
                });
              });
              
              option.addEventListener('mouseover', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'var(--popup-hover-bg)';
                }
              });
              
              option.addEventListener('mouseout', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'transparent';
                }
              });
            });
            
            // 点击外部关闭下拉菜单 - 使用全局函数
            document.addEventListener('click', function() {
              fullscreenFontSizeOptions.style.display = 'none';
              fullscreenFontColorOptions.style.display = 'none';
              fullscreenBubbleDisplayOptions.style.display = 'none';
              fullscreenBubbleColorOptions.style.display = 'none';
              fullscreenChatPositionOptions.style.display = 'none';
            });

            // 气泡显示下拉菜单功能 - 优化版
            fullscreenBubbleDisplayButton.addEventListener('click', function(event) {
              event.stopPropagation();
              const wasVisible = fullscreenBubbleDisplayOptions.style.display === 'block';
              // 关闭所有下拉菜单
              fullscreenFontSizeOptions.style.display = 'none';
              fullscreenFontColorOptions.style.display = 'none';
              fullscreenBubbleColorOptions.style.display = 'none';
              fullscreenChatPositionOptions.style.display = 'none';
              
              // 切换当前菜单的显示状态
              fullscreenBubbleDisplayOptions.style.display = wasVisible ? 'none' : 'block';
            });

            fullscreenBubbleDisplayOptions.querySelectorAll('.custom-option').forEach(option => {
              option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const text = this.textContent;
                fullscreenBubbleDisplayValue.textContent = text;
                fullscreenBubbleDisplaySelect.value = value;
                
                // 同步到普通模式
                if (originalBubbleDisplaySelect) {
                  originalBubbleDisplaySelect.value = value;
                  originalBubbleDisplaySelect.dispatchEvent(new Event('change'));
                }
                
                // 应用到全屏聊天消息 - 使用与正常模式相同的CSS类方法
                const messagesContainer = document.querySelector('#fullscreenChatPanel .chat-messages');
                
                if (messagesContainer) {
                  if (value === 'show') {
                    // 显示消息气泡 - 移除隐藏类
                    messagesContainer.classList.remove('message-bubble-hidden');
                  } else {
                    // 隐藏消息气泡 - 添加隐藏类（不影响容器本身）
                    messagesContainer.classList.add('message-bubble-hidden');
                  }
                }
                
                fullscreenBubbleDisplayOptions.style.display = 'none';
                
                // 更新选中状态样式
                fullscreenBubbleDisplayOptions.querySelectorAll('.custom-option').forEach(opt => {
                  opt.classList.toggle('selected', opt === this);
                  opt.style.backgroundColor = opt === this ? 'var(--popup-hover-bg)' : 'transparent';
                });
              });
              
              option.addEventListener('mouseover', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'var(--popup-hover-bg)';
                }
              });
              
              option.addEventListener('mouseout', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'transparent';
                }
              });
            });

            // 气泡颜色下拉菜单功能 - 优化版
            fullscreenBubbleColorButton.addEventListener('click', function(event) {
              event.stopPropagation();
              const wasVisible = fullscreenBubbleColorOptions.style.display === 'block';
              // 关闭所有下拉菜单
              fullscreenFontSizeOptions.style.display = 'none';
              fullscreenFontColorOptions.style.display = 'none';
              fullscreenBubbleDisplayOptions.style.display = 'none';
              fullscreenChatPositionOptions.style.display = 'none';
              
              // 切换当前菜单的显示状态
              fullscreenBubbleColorOptions.style.display = wasVisible ? 'none' : 'block';
            });

            fullscreenBubbleColorOptions.querySelectorAll('.color-option').forEach(option => {
              option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const ownColor = this.getAttribute('data-own-color');
                const text = this.textContent;
                fullscreenBubbleColorValue.textContent = text;
                fullscreenBubbleColorSelect.value = value;
                
                // 同步到普通模式 - 让普通模式处理所有状态更新
                if (originalBubbleColorSelect) {
                  originalBubbleColorSelect.value = value;
                  originalBubbleColorSelect.dispatchEvent(new Event('change'));
                }
                
                // 立即应用到全屏模式的旧消息
                const fullscreenMessages = document.querySelectorAll('#fullscreenChatPanel .message');
                fullscreenMessages.forEach(msg => {
                  const contentEl = msg.querySelector('.message-content');
                  if (contentEl) {
                    if (msg.classList.contains('own')) {
                      contentEl.style.backgroundColor = ownColor;
                    } else {
                      contentEl.style.backgroundColor = value;
                    }
                  }
                });
                
                fullscreenBubbleColorOptions.style.display = 'none';
                
                // 更新选中状态样式
                fullscreenBubbleColorOptions.querySelectorAll('.color-option').forEach(opt => {
                  opt.classList.toggle('selected', opt === this);
                  opt.style.backgroundColor = opt === this ? 'var(--popup-hover-bg)' : 'transparent';
                });
              });
              
              option.addEventListener('mouseover', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'var(--popup-hover-bg)';
                }
              });
              
              option.addEventListener('mouseout', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'transparent';
                }
              });
            });

            // 聊天位置下拉菜单功能 - 优化版
            fullscreenChatPositionButton.addEventListener('click', function(event) {
              event.stopPropagation();
              const wasVisible = fullscreenChatPositionOptions.style.display === 'block';
              // 关闭所有下拉菜单
              fullscreenFontSizeOptions.style.display = 'none';
              fullscreenFontColorOptions.style.display = 'none';
              fullscreenBubbleDisplayOptions.style.display = 'none';
              fullscreenBubbleColorOptions.style.display = 'none';
              
              // 切换当前菜单的显示状态
              fullscreenChatPositionOptions.style.display = wasVisible ? 'none' : 'block';
            });



            fullscreenChatPositionOptions.querySelectorAll('.custom-option').forEach(option => {
              option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const text = this.textContent;
                fullscreenChatPositionValue.textContent = text;
                fullscreenChatPositionSelect.value = value;
                
    
                
                // 应用到全屏聊天面板位置
                const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
                if (fullscreenChatPanel) {
                  switch(value) {
                    case 'top-center':
                      fullscreenChatPanel.style.top = '10px';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = '50%';
                      fullscreenChatPanel.style.right = 'auto';
                      fullscreenChatPanel.style.transform = 'translateX(-50%)';
                      fullscreenChatPanel.style.width = '30%';
                      break;
                    case 'top-left':
                      fullscreenChatPanel.style.top = '10px';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = '10px';
                      fullscreenChatPanel.style.right = 'auto';
                      fullscreenChatPanel.style.transform = 'none';
                      fullscreenChatPanel.style.width = '300px';
                      break;
                    case 'top-right':
                      fullscreenChatPanel.style.top = '10px';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = 'auto';
                      fullscreenChatPanel.style.right = '10px';
                      fullscreenChatPanel.style.transform = 'none';
                      fullscreenChatPanel.style.width = '300px';
                      break;
                    case 'bottom-left':
                      fullscreenChatPanel.style.top = 'auto';
                      fullscreenChatPanel.style.bottom = '60px';
                      fullscreenChatPanel.style.left = '10px';
                      fullscreenChatPanel.style.right = 'auto';
                      fullscreenChatPanel.style.transform = 'none';
                      fullscreenChatPanel.style.width = '300px';
                      break;
                    case 'bottom-right':
                      fullscreenChatPanel.style.top = 'auto';
                      fullscreenChatPanel.style.bottom = '60px';
                      fullscreenChatPanel.style.left = 'auto';
                      fullscreenChatPanel.style.right = '10px';
                      fullscreenChatPanel.style.transform = 'none';
                      fullscreenChatPanel.style.width = '300px';
                      break;
                    case 'bottom-center':
                      fullscreenChatPanel.style.top = 'auto';
                      fullscreenChatPanel.style.bottom = '60px';
                      fullscreenChatPanel.style.left = '50%';
                      fullscreenChatPanel.style.right = 'auto';
                      fullscreenChatPanel.style.transform = 'translateX(-50%)';
                      fullscreenChatPanel.style.width = '30%';
                      break;
                    case 'left':
                      fullscreenChatPanel.style.top = '50%';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = '10px';
                      fullscreenChatPanel.style.right = 'auto';
                      fullscreenChatPanel.style.transform = 'translateY(-50%)';
                      fullscreenChatPanel.style.width = '300px';
                      break;
                    case 'right':
                      fullscreenChatPanel.style.top = '50%';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = 'auto';
                      fullscreenChatPanel.style.right = '10px';
                      fullscreenChatPanel.style.transform = 'translateY(-50%)';
                      fullscreenChatPanel.style.width = '300px';
                      break;

                  }
                }
                
                fullscreenChatPositionOptions.style.display = 'none';
                
                // 更新选中状态样式
                fullscreenChatPositionOptions.querySelectorAll('.custom-option').forEach(opt => {
                  opt.classList.toggle('selected', opt === this);
                  opt.style.backgroundColor = opt === this ? 'var(--popup-hover-bg)' : 'transparent';
                });
              });
              
              option.addEventListener('mouseover', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'var(--popup-hover-bg)';
                }
              });
              
              option.addEventListener('mouseout', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'transparent';
                }
              });
            });

            // 发送消息框位置下拉菜单功能 - 新功能
            fullscreenInputPositionButton.addEventListener('click', function(event) {
              event.stopPropagation();
              const wasVisible = fullscreenInputPositionOptions.style.display === 'block';
              // 关闭所有下拉菜单
              fullscreenFontSizeOptions.style.display = 'none';
              fullscreenFontColorOptions.style.display = 'none';
              fullscreenBubbleDisplayOptions.style.display = 'none';
              fullscreenBubbleColorOptions.style.display = 'none';
              fullscreenChatPositionOptions.style.display = 'none';
              
              // 切换当前菜单的显示状态
              fullscreenInputPositionOptions.style.display = wasVisible ? 'none' : 'block';
            });

            fullscreenInputPositionOptions.querySelectorAll('.custom-option').forEach(option => {
              option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const text = this.textContent;
                fullscreenInputPositionValue.textContent = text;
                fullscreenInputPositionSelect.value = value;
                
                // 应用到发送消息悬浮窗位置
                const fullscreenChatInput = document.getElementById('fullscreenChatInput');
                if (fullscreenChatInput) {
                  switch(value) {
                    case 'default':
                      // 恢复默认位置：底部居中，距离底部80px
                      fullscreenChatInput.style.position = 'fixed';
                      fullscreenChatInput.style.bottom = '80px';
                      fullscreenChatInput.style.top = 'auto';
                      fullscreenChatInput.style.left = '50%';
                      fullscreenChatInput.style.right = 'auto';
                      fullscreenChatInput.style.transform = 'translateX(-50%)';
                      break;
                    case 'bottom-center':
                      fullscreenChatInput.style.position = 'fixed';
                      fullscreenChatInput.style.bottom = '20px';
                      fullscreenChatInput.style.top = 'auto';
                      fullscreenChatInput.style.left = '50%';
                      fullscreenChatInput.style.right = 'auto';
                      fullscreenChatInput.style.transform = 'translateX(-50%)';
                      break;
                    case 'center-center':
                      fullscreenChatInput.style.position = 'fixed';
                      fullscreenChatInput.style.top = '50%';
                      fullscreenChatInput.style.bottom = 'auto';
                      fullscreenChatInput.style.left = '50%';
                      fullscreenChatInput.style.right = 'auto';
                      fullscreenChatInput.style.transform = 'translate(-50%, -50%)';
                      break;
                    case 'bottom-left':
                      fullscreenChatInput.style.position = 'fixed';
                      fullscreenChatInput.style.bottom = '20px';
                      fullscreenChatInput.style.top = 'auto';
                      fullscreenChatInput.style.left = '20px';
                      fullscreenChatInput.style.right = 'auto';
                      fullscreenChatInput.style.transform = 'none';
                      break;
                    case 'bottom-right':
                      fullscreenChatInput.style.position = 'fixed';
                      fullscreenChatInput.style.bottom = '20px';
                      fullscreenChatInput.style.top = 'auto';
                      fullscreenChatInput.style.left = 'auto';
                      fullscreenChatInput.style.right = '20px';
                      fullscreenChatInput.style.transform = 'none';
                      break;
                  }
                }
                
                fullscreenInputPositionOptions.style.display = 'none';
                
                // 更新选中状态样式
                fullscreenInputPositionOptions.querySelectorAll('.custom-option').forEach(opt => {
                  opt.classList.toggle('selected', opt === this);
                  opt.style.backgroundColor = opt === this ? 'var(--popup-hover-bg)' : 'transparent';
                });
              });
              
              option.addEventListener('mouseover', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'var(--popup-hover-bg)';
                }
              });
              
              option.addEventListener('mouseout', function() {
                if (!this.classList.contains('selected')) {
                  this.style.backgroundColor = 'transparent';
                }
              });
            });

            
            // 恢复默认设置按钮功能 - 优化版，与普通模式保持一致
            const resetButton = fullscreenPopup.querySelector('#fullscreenResetSettingsButton');
            if (resetButton) {
              resetButton.addEventListener('click', function() {
                // 使用普通模式的默认设置值
                const defaultSettings = {
                  fontSize: 14,
                  fontColor: '#ffffff',
                  bubbleEnabled: true,
                  bubbleColor: '#666666',
                  ownBubbleColor: '#666666'
                };
                
                // 恢复文字大小
                if (originalFontSizeSelect) {
                  originalFontSizeSelect.value = defaultSettings.fontSize;
                  originalFontSizeSelect.dispatchEvent(new Event('change'));
                  
                  // 更新全屏模式显示
                  const selectedText = fullscreenFontSizeOptions.querySelector(`[data-value="${defaultSettings.fontSize}"]`).textContent;
                  fullscreenFontSizeValue.textContent = selectedText;
                  fullscreenFontSizeSelect.value = defaultSettings.fontSize;
                  
                  // 更新选中状态
                  fullscreenFontSizeOptions.querySelectorAll('.custom-option').forEach(opt => {
                    const isSelected = opt.getAttribute('data-value') === defaultSettings.fontSize;
                    opt.classList.toggle('selected', isSelected);
                    opt.style.backgroundColor = isSelected ? 'var(--popup-hover-bg)' : 'transparent';
                  });
                }
                
                // 恢复文字颜色
                if (originalFontColorSelect) {
                  originalFontColorSelect.value = defaultSettings.fontColor;
                  originalFontColorSelect.dispatchEvent(new Event('change'));
                  
                  // 更新全屏模式显示
                  const selectedText = fullscreenFontColorOptions.querySelector(`[data-value="${defaultSettings.fontColor}"]`).textContent;
                  fullscreenFontColorValue.textContent = selectedText;
                  fullscreenFontColorSelect.value = defaultSettings.fontColor;
                  
                  // 更新选中状态
                  fullscreenFontColorOptions.querySelectorAll('.color-option').forEach(opt => {
                    const isSelected = opt.getAttribute('data-value') === defaultSettings.fontColor;
                    opt.classList.toggle('selected', isSelected);
                    opt.style.backgroundColor = isSelected ? 'var(--popup-hover-bg)' : 'transparent';
                  });
                }
                
                // 恢复气泡显示
                if (originalBubbleDisplaySelect) {
                  const displayValue = defaultSettings.bubbleEnabled ? 'show' : 'hide';
                  originalBubbleDisplaySelect.value = displayValue;
                  originalBubbleDisplaySelect.dispatchEvent(new Event('change'));
                  
                  // 更新全屏模式显示
                  const selectedText = fullscreenBubbleDisplayOptions.querySelector(`[data-value="${displayValue}"]`).textContent;
                  fullscreenBubbleDisplayValue.textContent = selectedText;
                  fullscreenBubbleDisplaySelect.value = displayValue;
                  
                  // 更新选中状态
                  fullscreenBubbleDisplayOptions.querySelectorAll('.custom-option').forEach(opt => {
                    const isSelected = opt.getAttribute('data-value') === displayValue;
                    opt.classList.toggle('selected', isSelected);
                    opt.style.backgroundColor = isSelected ? 'var(--popup-hover-bg)' : 'transparent';
                  });
                }
                
                // 恢复气泡颜色
                if (originalBubbleColorSelect) {
                  originalBubbleColorSelect.value = defaultSettings.bubbleColor;
                  originalBubbleColorSelect.dispatchEvent(new Event('change'));
                  
                  // 更新全屏模式显示
                  const selectedOption = fullscreenBubbleColorOptions.querySelector(`[data-value="${defaultSettings.bubbleColor}"]`);
                  if (selectedOption) {
                    const selectedText = selectedOption.textContent;
                    fullscreenBubbleColorValue.textContent = selectedText;
                    fullscreenBubbleColorSelect.value = defaultSettings.bubbleColor;
                  }
                  
                  // 更新选中状态
                  fullscreenBubbleColorOptions.querySelectorAll('.color-option').forEach(opt => {
                    const isSelected = opt.getAttribute('data-value') === defaultSettings.bubbleColor;
                    opt.classList.toggle('selected', isSelected);
                    opt.style.backgroundColor = isSelected ? 'var(--popup-hover-bg)' : 'transparent';
                  });
                }
                

                

                
                // 应用所有设置到全屏聊天面板
                const fullscreenMessages = document.querySelectorAll('#fullscreenChatPanel .message:not(.system)');
                const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
                
                if (fullscreenMessages.length > 0) {
                  fullscreenMessages.forEach(msg => {
                    const contentEl = msg.querySelector('.message-content');
                    if (contentEl) {
                      contentEl.style.fontSize = defaultSettings.fontSize + 'px';
                      contentEl.style.color = defaultSettings.fontColor;
                      
                      // 应用气泡颜色
                      if (defaultSettings.bubbleEnabled) {
                        if (msg.classList.contains('own')) {
                          contentEl.style.backgroundColor = defaultSettings.ownBubbleColor || '#0084ff';
                        } else {
                          contentEl.style.backgroundColor = defaultSettings.bubbleColor || '#dcf8c6';
                        }
                        
                        // 还原气泡样式
                        contentEl.style.borderRadius = '18px';
                        contentEl.style.padding = '8px 12px';
                        contentEl.style.lineHeight = '1.4';
                        contentEl.style.marginTop = '2px';
                        contentEl.style.width = 'fit-content';
                        contentEl.style.maxWidth = '100%';
                      } else {
                        // 如果禁用了气泡，移除背景色
                        contentEl.style.backgroundColor = 'transparent';
                        contentEl.style.borderRadius = '0';
                        contentEl.style.padding = '0';
                        contentEl.style.maxWidth = '100%';
                      }
                    }
                  });
                }
                
                // 恢复发送消息框位置
                if (fullscreenInputPositionSelect) {
                  const defaultInputPosition = 'default';
                  fullscreenInputPositionSelect.value = defaultInputPosition;
                  
                  // 更新显示
                  const selectedText = fullscreenInputPositionOptions.querySelector(`[data-value="${defaultInputPosition}"]`).textContent;
                  fullscreenInputPositionValue.textContent = selectedText;
                  
                  // 更新选中状态
                  fullscreenInputPositionOptions.querySelectorAll('.custom-option').forEach(opt => {
                    const isSelected = opt.getAttribute('data-value') === defaultInputPosition;
                    opt.classList.toggle('selected', isSelected);
                    opt.style.backgroundColor = isSelected ? 'var(--popup-hover-bg)' : 'transparent';
                  });
                  
                  // 应用默认位置样式
                  if (fullscreenChatInput) {
                    switch(defaultInputPosition) {
                      case 'default':
                        fullscreenChatInput.style.position = 'fixed';
                        fullscreenChatInput.style.bottom = '80px';
                        fullscreenChatInput.style.top = 'auto';
                        fullscreenChatInput.style.left = '50%';
                        fullscreenChatInput.style.right = 'auto';
                        fullscreenChatInput.style.transform = 'translateX(-50%)';
                        break;
                      case 'bottom-center':
                        fullscreenChatInput.style.position = 'fixed';
                        fullscreenChatInput.style.bottom = '20px';
                        fullscreenChatInput.style.top = 'auto';
                        fullscreenChatInput.style.left = '50%';
                        fullscreenChatInput.style.right = 'auto';
                        fullscreenChatInput.style.transform = 'translateX(-50%)';
                        break;
                      case 'center-center':
                        fullscreenChatInput.style.position = 'fixed';
                        fullscreenChatInput.style.top = '50%';
                        fullscreenChatInput.style.bottom = 'auto';
                        fullscreenChatInput.style.left = '50%';
                        fullscreenChatInput.style.right = 'auto';
                        fullscreenChatInput.style.transform = 'translate(-50%, -50%)';
                        break;
                      case 'bottom-left':
                        fullscreenChatInput.style.position = 'fixed';
                        fullscreenChatInput.style.bottom = '20px';
                        fullscreenChatInput.style.top = 'auto';
                        fullscreenChatInput.style.left = '20px';
                        fullscreenChatInput.style.right = 'auto';
                        fullscreenChatInput.style.transform = 'none';
                        break;
                      case 'bottom-right':
                        fullscreenChatInput.style.position = 'fixed';
                        fullscreenChatInput.style.bottom = '20px';
                        fullscreenChatInput.style.top = 'auto';
                        fullscreenChatInput.style.left = 'auto';
                        fullscreenChatInput.style.right = '20px';
                        fullscreenChatInput.style.transform = 'none';
                        break;
                    }
                  }
                }
                
                if (fullscreenChatPanel) {
                  switch(defaultSettings.chatPosition) {
                    case 'bottom':
                      fullscreenChatPanel.style.top = 'auto';
                      fullscreenChatPanel.style.bottom = '60px';
                      fullscreenChatPanel.style.left = '10px';
                      fullscreenChatPanel.style.right = '10px';
                      break;
                    case 'top':
                      fullscreenChatPanel.style.top = '10px';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = '10px';
                      fullscreenChatPanel.style.right = '10px';
                      break;
                    case 'left':
                      fullscreenChatPanel.style.top = '10px';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = '10px';
                      fullscreenChatPanel.style.right = 'auto';
                      fullscreenChatPanel.style.width = '300px';
                      break;
                    case 'right':
                      fullscreenChatPanel.style.top = '10px';
                      fullscreenChatPanel.style.bottom = 'auto';
                      fullscreenChatPanel.style.left = 'auto';
                      fullscreenChatPanel.style.right = '10px';
                      fullscreenChatPanel.style.width = '300px';
                      break;
                  }
                }
                
                // 关闭弹窗
                fullscreenPopup.style.display = 'none';
              });
            }
            
            // 显示动画
            setTimeout(() => {
              fullscreenPopup.style.transform = 'scale(1)';
            }, 10);
            
            // 添加点击外部区域关闭弹窗的功能
            setTimeout(() => {
              function closePopupOnClickOutside(e) {
                if (fullscreenPopup && !fullscreenPopup.contains(e.target) && e.target !== aButton) {
                  fullscreenPopup.style.display = 'none';
                  document.removeEventListener('click', closePopupOnClickOutside);
                }
              }
              document.addEventListener('click', closePopupOnClickOutside);
              
              // 确保点击弹窗内部不会触发关闭
              fullscreenPopup.addEventListener('click', function(e) {
                e.stopPropagation();
              });
            }, 100);
          }
          
          // 定位弹窗到A按钮位置 - 与普通模式保持一致，显示在按钮上方
          fullscreenPopup.style.bottom = '100%';
          fullscreenPopup.style.left = 'auto';
          fullscreenPopup.style.right = '10px';
        });
        
        // 为全屏模式的文件输入框添加change事件
        clonedImageUploadInput.addEventListener('change', function(e) {
          // 如果有文件选择，处理图片上传
          if (e.target.files && e.target.files[0]) {
            // 这里我们直接处理图片上传，不通过触发原始文件输入框的change事件
            const file = e.target.files[0];
            
            // 检查文件类型是否为图片
            if (!file.type.match('image.*')) {
              if (window.notificationSystem) {
            window.notificationSystem.warning('请选择图片文件！', 3000);
        } else {
            alert('请选择图片文件！');
        }
              return;
            }
            
            // 创建文件读取器
            const reader = new FileReader();
            
            // 当文件读取完成时
            reader.onload = function(e) {
              // 发送图片消息
              socket.emit('chat_message', {
                room: currentRoom,
                username,
                message: e.target.result, // 图片的base64编码
                isImage: true
              });
              
              // 添加图片消息到聊天窗口
              window.addChatMessage(username, e.target.result, true, true);
            };
            
            // 读取文件为Data URL
            reader.readAsDataURL(file);
            
            // 重置文件输入框，以便能够重复选择同一文件
            clonedImageUploadInput.value = '';
          }
        });
        
        // 将聊天面板和输入框添加到视频容器中
          videoContainer.appendChild(fullscreenChatPanel);
          videoContainer.appendChild(fullscreenChatInput);
          
          // 为了更好地支持全页模式下的消息显示，我们创建一个更可靠的消息更新机制
          
          // 添加新消息到全页聊天面板
          function updateFullscreenChatPanel(newMessageElement) {
            const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
            if (fullscreenChatPanel) {
              const messagesContainer = fullscreenChatPanel.querySelector('.chat-messages');
              if (messagesContainer) {
                messagesContainer.appendChild(newMessageElement);
                // 滚动到底部，显示最新消息
                // 使用setTimeout确保DOM更新后再滚动
                setTimeout(() => {
                  scrollToBottomForFullscreen();
                }, 10);
              }
            }
          }
          
          // 实现按下回车键显示聊天发送窗口的功能
          function handleKeyDown(event) {
            // 检查是否在全屏模式或页面全屏模式
            const isFullscreen = !!(document.fullscreenElement || 
                                  document.webkitFullscreenElement || 
                                  document.mozFullScreenElement || 
                                  document.msFullscreenElement);
            const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');
            
            // 只有在全屏模式下才响应回车键
            if ((isFullscreen || isPageFullscreen) && event.key === 'Enter') {
              // 如果聊天窗口已经显示且光标在输入框中，让默认的回车发送逻辑处理
              if (fullscreenChatInput.style.display !== 'none' && document.activeElement === messageInput) {
                return; // 不阻止默认行为，让回车发送消息
              }
              
              // 否则显示聊天窗口并聚焦输入框
              event.preventDefault(); // 阻止默认行为，避免触发视频播放/暂停
              fullscreenChatInput.style.display = 'block';
              messageInput.focus();
            }
          }
          
          // 添加键盘事件监听器
          document.addEventListener('keydown', handleKeyDown);
          
          // 存储事件监听器引用，以便后续移除
          fullscreenChatInput._keydownHandler = handleKeyDown;
          
          // 保存原始的addChatMessage函数引用
          const originalAddChatMessage = window.originalAddChatMessage || window.addChatMessage;
          
          // 修正的addChatMessage函数覆盖，确保与原始函数参数完全匹配
          // 原始函数签名：addChatMessage(sender, message, isOwn = false, isImage = false)
          window.addChatMessage = function(sender, message, isOwn = false, isImage = false) {
            // 调用原始函数添加消息到主聊天窗口
            const result = originalAddChatMessage.apply(this, arguments);
            
            // 检查是否处于全页模式且存在全页聊天面板
            const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
            
            if (fullscreenChatPanel) {
              const messagesContainer = fullscreenChatPanel.querySelector('.chat-messages');
              if (messagesContainer) {
                // 直接创建新消息元素，确保与原始样式一致
                const newMessage = document.createElement('div');
                newMessage.classList.add('message');
                if (isOwn) {
                  newMessage.classList.add('own');
                }
                
                // 创建消息内容
                const contentEl = document.createElement('div');
                contentEl.classList.add('message-content');
                
                if (isImage) {
                  // 图片消息
                  const img = document.createElement('img');
                  img.src = message;
                  img.classList.add('chat-image');
                  img.style.height = 'auto';
                  img.style.borderRadius = '4px';
                  // 图片加载完成后再次滚动到底部，确保完整显示图片
                  img.onload = function() {
                    setTimeout(() => {
                      scrollToBottomForFullscreen();
                    }, 100); // 增加延迟时间确保图片完全渲染
                  };
                  contentEl.appendChild(img);
                } else {
                  // 文本消息
                  contentEl.textContent = message;
                }
                
                // 创建消息信息
                const infoEl = document.createElement('div');
                infoEl.classList.add('message-info');
                
                const senderEl = document.createElement('span');
                senderEl.classList.add('message-sender');
                
                // 添加头像
                const avatarEl = document.createElement('span');
                avatarEl.classList.add('message-avatar');
                
                // 检查用户是否有自定义头像
                let userAvatar = null;
                if (sender === window.username) {
                  // 当前用户，优先使用内存中的最新头像数据
                  userAvatar = window.currentUserAvatar || localStorage.getItem(`avatar_${sender}`);
                } else {
                  // 其他用户，优先使用内存缓存
                  userAvatar = window.avatarCache && window.avatarCache[sender];
                  if (!userAvatar) {
                    userAvatar = localStorage.getItem(`avatar_${sender}`);
                    // 缓存到内存中
                    if (userAvatar) {
                      if (!window.avatarCache) window.avatarCache = {};
                      window.avatarCache[sender] = userAvatar;
                    }
                  }
                }
                
                if (userAvatar) {
                  // 使用自定义头像
                  const avatarImg = document.createElement('img');
                  avatarImg.src = userAvatar;
                  avatarImg.style.cssText = `
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                  `;
                  avatarEl.appendChild(avatarImg);
                } else {
                  // 使用默认头像
                  const initial = sender.charAt(0).toUpperCase();
                  avatarEl.textContent = initial;
                  if (userColors[sender]) {
                    avatarEl.style.backgroundColor = userColors[sender];
                  }
                }
                senderEl.appendChild(avatarEl);
                
                // 设置发送者名字
                senderEl.appendChild(document.createTextNode(sender));
                
                // 设置时间
                const timeEl = document.createElement('span');
                timeEl.classList.add('message-time');
                const now = new Date();
                timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                senderEl.appendChild(timeEl);
                
                infoEl.appendChild(senderEl);
                
                // 组装消息
                newMessage.appendChild(contentEl);
                newMessage.appendChild(infoEl);
                
                // 应用当前样式设置到全页聊天面板的新消息
                // 确保使用全局作用域的currentSettings
                const globalSettings = window.currentSettings || {};
                
                if (globalSettings) {
                  // 应用字体大小设置
                  contentEl.style.fontSize = globalSettings.fontSize + 'px';
                  
                  // 应用字体颜色设置
                  contentEl.style.color = globalSettings.fontColor;
                  
                  // 应用气泡颜色设置
                  if (globalSettings.bubbleEnabled) {
                    if (isOwn) {
                      // 应用自己发送的消息气泡颜色
                      contentEl.style.backgroundColor = globalSettings.ownBubbleColor || '#0084ff';
                    } else {
                      // 应用对方发送的消息气泡颜色
                      contentEl.style.backgroundColor = globalSettings.bubbleColor || '#dcf8c6';
                    }
                    // 还原最开始的气泡样式
                    contentEl.style.borderRadius = '18px';
                    contentEl.style.padding = '8px 12px';
                    // 保留用户设置的字体大小，不覆盖
                    contentEl.style.lineHeight = '1.4';
                    contentEl.style.marginTop = '2px';
                    contentEl.style.width = 'fit-content';
                    contentEl.style.maxWidth = '100%';
                  } else {
                    // 如果禁用了气泡，移除背景色
                    contentEl.style.backgroundColor = 'transparent';
                    contentEl.style.borderRadius = '0';
                    contentEl.style.padding = '0';
                  }
                }
                
                // 添加到全页聊天面板
                messagesContainer.appendChild(newMessage);
                
                // 滚动到底部
                // 使用setTimeout确保DOM更新后再滚动
                setTimeout(() => {
                  scrollToBottomForFullscreen();
                }, 10);
              }
            }
            
            // 重置自动隐藏计时器
            resetAutoHideTimer();
            
            return result;
          };
          
          // 新增：重置自动隐藏计时器的函数
      function resetAutoHideTimer() {
        const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
        if (!fullscreenChatPanel) return;
        
        // 检查是否处于全屏模式
        const isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');
        
        // 只有在全屏模式下才重置计时器
        if (isFullscreen || isPageFullscreen) {
          // 清除现有的计时器
          if (window.autoHideTimer) {
            clearTimeout(window.autoHideTimer);
          }
          
          // 检查聊天面板是否已展开且是自动展开的
          if (fullscreenChatPanel.dataset.collapsed === 'false' && 
              fullscreenChatPanel.dataset.autoExpanded === 'true') {
            
            // 重新设置10秒计时器
            window.autoHideTimer = setTimeout(() => {
              // 再次检查条件
              const stillFullscreen = !!(document.fullscreenElement || 
                                     document.webkitFullscreenElement || 
                                     document.mozFullScreenElement || 
                                     document.msFullscreenElement);
              const stillPageFullscreen = videoContainer.classList.contains('page-fullscreen');
              
              if ((stillFullscreen || stillPageFullscreen) && 
                  fullscreenChatPanel.dataset.collapsed === 'false' && 
                  fullscreenChatPanel.dataset.autoExpanded === 'true') {
                
                // 折叠聊天面板
                fullscreenChatPanel.style.height = '0px';
                fullscreenChatPanel.style.padding = '0px 10px';
                fullscreenChatPanel.dataset.collapsed = 'true';
                const collapseButton = document.getElementById('fullscreenChatCollapseButton');
                if (collapseButton) {
                  collapseButton.innerText = '▲';
                }
                
                // 清除自动展开标记
                delete fullscreenChatPanel.dataset.autoExpanded;
              }
            }, 10000); // 10秒
          }
        }
      }
      
      // 保存函数引用，以便退出时恢复
      window.originalAddChatMessage = originalAddChatMessage;
      }
      
      // 移除全页模式下的聊天输入框和面板
       function removeFullscreenChatInput() {
         const fullscreenChatInput = document.getElementById('fullscreenChatInput');
         const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
         const fullscreenChatCollapseButton = document.getElementById('fullscreenChatCollapseButton');
         const clonedImageUploadInput = document.querySelector('#imageUploadInput:not([style*="display: none"])');
         
         if (fullscreenChatInput) {
           fullscreenChatInput.remove();
         }
         
         if (fullscreenChatPanel) {
           fullscreenChatPanel.remove();
         }
         
         // 移除折叠按钮和相关事件监听器
         if (fullscreenChatCollapseButton) {
           // 移除鼠标移动事件监听器
           if (fullscreenChatCollapseButton._handleMouseMove) {
             document.removeEventListener('mousemove', fullscreenChatCollapseButton._handleMouseMove);
           }
           fullscreenChatCollapseButton.remove();
         }
         
         if (clonedImageUploadInput) {
           clonedImageUploadInput.remove();
         }
         
         // 恢复原始的addChatMessage函数
         if (window.originalAddChatMessage) {
           window.addChatMessage = window.originalAddChatMessage;
         }
         
         // 移除键盘事件监听器
         if (fullscreenChatInput && fullscreenChatInput._keydownHandler) {
           document.removeEventListener('keydown', fullscreenChatInput._keydownHandler);
           delete fullscreenChatInput._keydownHandler;
         }
       }
      
      // 监听ESC键，按ESC键也可以退出全页播放
      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && videoContainer.classList.contains('page-fullscreen')) {
          // 保存设置后再退出全屏
          saveFullscreenChatSettings();
          fullscreenButton.click(); // 触发退出全页播放
        }
      });
    });
    
    // A按钮弹窗功能实现
    document.addEventListener('DOMContentLoaded', function() {
      // 获取所有需要的元素
      const aButton = document.getElementById('aButton');
      const aButtonPopup = document.getElementById('aButtonPopup');
      const closeAPopupButton = document.getElementById('closeAPopupButton');
      const fontSizeSlider = document.getElementById('fontSizeSlider');
      const colorOptions = document.querySelectorAll('.color-option');
      const bubbleToggle = document.getElementById('bubbleToggle');

      const resetButton = document.getElementById('resetButton');
      const chatInput = document.querySelector('.chat-input');
      
      // 获取聊天相关元素
      const chatMessages = document.querySelector('.chat-messages');
      const chatContainer = document.querySelector('.chat-input-wrapper');
      
      // 存储默认值
      const defaultSettings = {
        fontSize: 14,
        fontColor: '#ffffff', // 默认文字颜色改为白色
        bubbleEnabled: true,
        bubbleColor: '#666666', // 默认气泡颜色改为灰色
        ownBubbleColor: '#666666' // 自己发送的消息气泡颜色也改为灰色
      };
      
      // 当前设置 - 绑定到window对象，确保全局可访问
      window.currentSettings = { ...defaultSettings };
      
      // 确保父元素有相对定位，这样弹窗的绝对定位才能相对于父元素
      if (chatInput) {
        chatInput.style.position = 'relative';
      }
      
      // 点击A按钮时显示或隐藏弹窗
      if (aButton && aButtonPopup) {
        aButton.addEventListener('click', function(event) {
          event.stopPropagation(); // 阻止事件冒泡，避免触发文档的点击事件
          
          // 切换弹窗的显示状态
          if (aButtonPopup.style.display === 'none') {
            // 使用与表情按钮相同的定位方式 - 相对于视口定位
            const buttonRect = aButton.getBoundingClientRect();
            
            // 设置弹窗位置为相对于视口，避免被困在聊天区域内
            aButtonPopup.style.position = 'fixed';
            aButtonPopup.style.bottom = 'auto';
            aButtonPopup.style.top = (buttonRect.top - 10) + 'px'; // 按钮上方10px
            aButtonPopup.style.left = (buttonRect.left + buttonRect.width / 2) + 'px';
            aButtonPopup.style.transform = 'translateX(-50%) translateY(-100%)';
            aButtonPopup.style.zIndex = '2147483647'; // 确保在最上层
            
            // 显示弹窗
            aButtonPopup.style.display = 'block';
          } else {
            // 隐藏弹窗
            aButtonPopup.style.display = 'none';
          }
        });
        
        // 关闭按钮事件
        if (closeAPopupButton) {
          closeAPopupButton.addEventListener('click', function() {
            aButtonPopup.style.display = 'none';
          });
        }
        
        // 点击页面其他地方时隐藏弹窗
        document.addEventListener('click', function(event) {
          if (aButtonPopup.style.display === 'block' && 
              event.target !== aButton && 
              !aButton.contains(event.target) && 
              event.target !== aButtonPopup && 
              !aButtonPopup.contains(event.target)) {
            aButtonPopup.style.display = 'none';
          }
        });
        
        // 为弹窗添加点击事件，阻止事件冒泡
        aButtonPopup.addEventListener('click', function(event) {
          event.stopPropagation();
        });
        
        // 文字大小选择
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) {
          fontSizeSelect.addEventListener('change', function() {
            window.currentSettings.fontSize = parseInt(this.value);
            applySettings(window.currentSettings, 'size'); // 只应用文字大小设置
            // 显示设置已应用的提示
            showToast('文字大小已更新');
          });
        }
        
        // 文字颜色选择
        const fontColorSelect = document.getElementById('fontColorSelect');
        if (fontColorSelect) {
          fontColorSelect.addEventListener('change', function() {
            window.currentSettings.fontColor = this.value;
            applySettings(window.currentSettings, 'color'); // 只应用文字颜色设置
            // 显示设置已应用的提示
            showToast('文字颜色已更新');
          });
        }
        
        // 气泡显示切换 - 改为下拉菜单
        const bubbleDisplaySelect = document.getElementById('bubbleDisplaySelect');
        if (bubbleDisplaySelect) {
          bubbleDisplaySelect.addEventListener('change', function() {
            window.currentSettings.bubbleEnabled = this.value === 'show';
            applySettings(window.currentSettings, 'bubble'); // 只应用气泡显示设置
            // 显示设置已应用的提示
            showToast('聊天气泡显示设置已更新');
          });
        }
        
        // 气泡颜色选择
        const bubbleColorSelect = document.getElementById('bubbleColorSelect');
        if (bubbleColorSelect) {
          bubbleColorSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            window.currentSettings.bubbleColor = selectedOption.value;
            window.currentSettings.ownBubbleColor = selectedOption.getAttribute('data-own-color');
            applySettings(window.currentSettings, 'bubble'); // 应用气泡设置（包括颜色）
            // 显示设置已应用的提示
            showToast('聊天气泡颜色已更新');
          });
        }
        

        
        // 恢复默认按钮
        if (resetButton) {
          resetButton.addEventListener('click', function() {
            // 重置设置
            window.currentSettings = { ...defaultSettings };
            
            // 更新UI控件
            if (fontSizeSlider) fontSizeSlider.value = defaultSettings.fontSize;
            if (bubbleDisplaySelect) bubbleDisplaySelect.value = defaultSettings.bubbleEnabled ? 'show' : 'hide';
            if (bubbleColorSelect) bubbleColorSelect.value = defaultSettings.bubbleColor;
            
            // 更新颜色选项UI
            if (colorOptions.length > 0) {
              colorOptions.forEach(option => {
                if (option.getAttribute('data-color') === defaultSettings.fontColor) {
                  option.style.borderColor = '#ccc';
                } else {
                  option.style.borderColor = 'transparent';
                }
              });
            }
            
            // 应用默认设置 - 这里需要应用所有设置，所以不指定第二个参数
            applySettings(window.currentSettings);
            
            // 显示设置已恢复的提示
            showToast('设置已恢复为默认值');
          });
        }
        
        // 应用设置的函数 - 修复控制混乱问题，确保每个设置只控制自己应该控制的部分
        // 第二个参数控制要应用哪些设置项，可以是'size', 'color', 'bubble', 'position'或数组
        function applySettings(settings, applyWhat) {
          // 默认应用所有设置
          const applySize = !applyWhat || applyWhat === 'size' || (Array.isArray(applyWhat) && applyWhat.includes('size'));
          const applyColor = !applyWhat || applyWhat === 'color' || (Array.isArray(applyWhat) && applyWhat.includes('color'));
          const applyBubble = !applyWhat || applyWhat === 'bubble' || (Array.isArray(applyWhat) && applyWhat.includes('bubble'));

          
          // 应用文字大小 - 只影响文字大小，不影响系统消息
          if (applySize) {
            const fontSizeElements = document.querySelectorAll('.message:not(.system) .message-content');
            fontSizeElements.forEach(el => {
              el.style.fontSize = `${settings.fontSize}px`;
            });
          }
          
          // 应用文字颜色 - 只影响文字颜色，不影响系统消息
          if (applyColor) {
            const colorElements = document.querySelectorAll('.message:not(.system) .message-content');
            colorElements.forEach(el => {
              el.style.color = settings.fontColor;
            });
          }
          
          // 应用气泡显示状态和颜色 - 只影响气泡样式，不影响文字大小和颜色
          if (applyBubble) {
            const chatMessagesContainer = document.querySelector('.chat-messages');
            const messageContents = document.querySelectorAll('.message:not(.system) .message-content');
            
            // 处理气泡显示/隐藏
            if (chatMessagesContainer) {
              if (!settings.bubbleEnabled) {
                // 隐藏气泡：添加类而不是直接修改样式
                chatMessagesContainer.classList.add('message-bubble-hidden');
              } else {
                // 显示气泡：移除类
                chatMessagesContainer.classList.remove('message-bubble-hidden');
              }
            }
            
            // 应用气泡样式（包括颜色和形状）
            if (messageContents.length > 0) {
              if (settings.bubbleEnabled) {
                messageContents.forEach(el => {
                  // 检查是否是自己发送的消息
                  const isOwnMessage = el.closest('.message') && el.closest('.message').classList.contains('own');
                  
                  if (isOwnMessage) {
                    // 应用自己发送的消息气泡颜色
                    el.style.backgroundColor = settings.ownBubbleColor || '#0084ff';
                  } else {
                    // 应用对方发送的消息气泡颜色
                    el.style.backgroundColor = settings.bubbleColor || '#dcf8c6';
                  }
                  
                  // 还原最开始的气泡样式
                  el.style.borderRadius = '18px';
                  el.style.padding = '8px 12px';
                  el.style.fontSize = '13px';
                  el.style.lineHeight = '1.4';
                  el.style.marginTop = '2px';
                  el.style.width = 'fit-content';
                  el.style.maxWidth = '100%';
                });
              } else {
                // 如果禁用了气泡，移除所有气泡相关样式
                messageContents.forEach(el => {
                  el.style.backgroundColor = 'transparent';
                  el.style.borderRadius = '0';
                  el.style.padding = '0';
                  el.style.maxWidth = '100%';
                });
              }
            }
          }
          
          // 应用到全屏模式的消息（如果存在）
          if (document.getElementById('fullscreenChatPanel')) {
            // 应用文字大小到全屏模式
            if (applySize) {
              const fullscreenFontSizeElements = document.querySelectorAll('#fullscreenChatPanel .message:not(.system) .message-content');
              fullscreenFontSizeElements.forEach(el => {
                el.style.fontSize = `${settings.fontSize}px`;
              });
            }
            
            // 应用文字颜色到全屏模式
            if (applyColor) {
              const fullscreenColorElements = document.querySelectorAll('#fullscreenChatPanel .message:not(.system) .message-content');
              fullscreenColorElements.forEach(el => {
                el.style.color = settings.fontColor;
              });
            }
            
            // 应用气泡显示状态和颜色到全屏模式
            if (applyBubble) {
              const fullscreenMessageContents = document.querySelectorAll('#fullscreenChatPanel .message:not(.system) .message-content');
              
              if (fullscreenMessageContents.length > 0) {
                if (settings.bubbleEnabled) {
                  fullscreenMessageContents.forEach(el => {
                    // 检查是否是自己发送的消息
                    const isOwnMessage = el.closest('.message') && el.closest('.message').classList.contains('own');
                    
                    if (isOwnMessage) {
                      // 应用自己发送的消息气泡颜色
                      el.style.backgroundColor = settings.ownBubbleColor || '#0084ff';
                    } else {
                      // 应用对方发送的消息气泡颜色
                      el.style.backgroundColor = settings.bubbleColor || '#dcf8c6';
                    }
                    
                    // 还原最开始的气泡样式
                    el.style.borderRadius = '18px';
                    el.style.padding = '8px 12px';
                    el.style.lineHeight = '1.4';
                    el.style.marginTop = '2px';
                    el.style.width = 'fit-content';
                    el.style.maxWidth = '100%';
                  });
                } else {
                  // 如果禁用了气泡，移除所有气泡相关样式
                  fullscreenMessageContents.forEach(el => {
                    el.style.backgroundColor = 'transparent';
                    el.style.borderRadius = '0';
                    el.style.padding = '0';
                    el.style.maxWidth = '100%';
                  });
                }
              }
            }
          }

        }
        
        // 初始化时先获取所有聊天相关元素的引用
        function getChatElements() {
          const elements = {
            messages: document.querySelectorAll('.chat-messages, .message-content, [class*="chat-messages"]'),
            texts: document.querySelectorAll('.message-text, .message-content'),
            bubbles: document.querySelectorAll('.message-bubble, [class*="message-bubble"]'),
            container: document.querySelector('.chat-input-wrapper')
          };
          return elements;
        }
        
        // 调试信息 - 帮助检查是否能找到聊天元素
        console.log('聊天元素初始化结果:', getChatElements());
        
        // 显示提示消息的函数
        function showToast(message) {
          // 检查是否已存在toast元素
          let toast = document.getElementById('settingToast');
          if (!toast) {
            // 创建toast元素
            toast = document.createElement('div');
            toast.id = 'settingToast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '10px 20px';
            toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            toast.style.color = 'white';
            toast.style.borderRadius = '4px';
            toast.style.zIndex = '9999';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
          }
          
          // 设置消息内容并显示
          toast.textContent = message;
          toast.style.opacity = '1';
          
          // 3秒后隐藏
          setTimeout(() => {
            toast.style.opacity = '0';
          }, 3000);
        }
        
        // 为A按钮添加样式
        const style = document.createElement('style');
        style.textContent = `
          .chat-tool-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border: none;
            background-color: #f0f0f0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            margin: 0 4px;
            font-size: 16px;
          }
          
          .chat-tool-button:hover {
            background-color: #e0e0e0;
            transform: scale(1.05);
          }
          
          /* 深色模式下的按钮样式 */
          body.dark-theme .chat-tool-button {
            background-color: #444;
            color: #fff;
          }
          
          body.dark-theme .chat-tool-button:hover {
            background-color: #555;
          }
          
          /* 深色模式下的弹窗样式 */
          body.dark-theme .a-button-popup {
            background-color: var(--popup-bg);
            color: var(--popup-text);
            border: 1px solid var(--popup-border);
          }
          
          /* 深色模式下的表单元素样式 */
          body.dark-theme .a-button-popup label {
            color: white;
          }
          
          body.dark-theme .a-button-popup select {
            background-color: var(--popup-input-bg);
            color: var(--popup-text);
            border-color: var(--popup-border);
          }
          
          /* 高优先级的弹窗样式规则 */
          #aButtonPopup {
            background-color: var(--popup-bg) !important;
            border: 1px solid var(--popup-border) !important;
          }
          
          #aButtonPopup label,
          #aButtonPopup h3,
          #aButtonPopup #closeAPopupButton {
            color: white !important;
          }
          
          #aButtonPopup select {
            background-color: var(--popup-input-bg) !important;
            color: var(--popup-text) !important;
            border-color: var(--popup-border) !important;
          }
          
          #aButtonPopup select option,
          #aButtonPopup select option:visited,
          body.dark-theme #aButtonPopup select option,
          body.dark-theme #aButtonPopup select option:visited {
            background-color: var(--popup-input-bg) !important;
            color: var(--popup-text) !important;
            background-image: none !important;
            filter: none !important;
          }
          
          #aButtonPopup select option:checked,
          #aButtonPopup select option:hover,
          body.dark-theme #aButtonPopup select option:checked,
          body.dark-theme #aButtonPopup select option:hover {
            background-color: var(--popup-hover-bg) !important;
            color: var(--popup-text) !important;
            background-image: none !important;
            filter: none !important;
          }
          }
          
          #aButtonPopup #fontSizeSelect option,
          #aButtonPopup #fontColorSelect option,
          #aButtonPopup #bubbleDisplaySelect option,
          #aButtonPopup #bubbleColorSelect option {
            background-color: var(--popup-input-bg) !important;
            color: var(--popup-text) !important;
            background-image: none !important;
            filter: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
          }
          
          #aButtonPopup #fontSizeSelect option:checked,
          #aButtonPopup #fontColorSelect option:checked,
          #aButtonPopup #bubbleDisplaySelect option:checked,
          #aButtonPopup #bubbleColorSelect option:checked {
            background-color: var(--popup-hover-bg) !important;
            color: var(--popup-text) !important;
            background-image: none !important;
            filter: none !important;
          }
          
          #aButtonPopup select {
            background: var(--popup-input-bg) !important;
            color: var(--popup-text) !important;
          }
          .chat-messages {
            overflow-y: auto;
            transition: font-size 0.3s ease;
          }
          
          .chat-input-wrapper {
            transition: all 0.3s ease;
          }
        `;
        document.head.appendChild(style);
      }
    });
  


    // 简化版位置选择逻辑
    function initEnhancedPositionSelection() {
      const positionSelect = document.getElementById('fullscreenChatPositionSelect');
      if (!positionSelect) return;

      // 监听位置选择变化
      positionSelect.addEventListener('change', function() {
        const selectedValue = this.value;
        const chatPanel = document.getElementById('fullscreenChatPanel');
        if (!chatPanel) return;

        const margin = 10;
        const panelWidth = 300;
        const panelHeight = chatPanel.offsetHeight;

        switch(selectedValue) {
          case 'top-left':
            chatPanel.style.left = margin + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'top-right':
            chatPanel.style.left = Math.max(margin, window.innerWidth - panelWidth - margin) + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'top-center':
            chatPanel.style.left = Math.max(margin, (window.innerWidth - panelWidth) / 2) + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'bottom-left':
            chatPanel.style.left = margin + 'px';
            chatPanel.style.top = Math.max(margin, window.innerHeight - panelHeight - margin) + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'bottom-right':
            chatPanel.style.left = Math.max(margin, window.innerWidth - panelWidth - margin) + 'px';
            chatPanel.style.top = Math.max(margin, window.innerHeight - panelHeight - margin) + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          default:
            chatPanel.style.left = Math.max(margin, (window.innerWidth - panelWidth) / 2) + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
        }
        chatPanel.style.right = 'auto';
        chatPanel.style.bottom = 'auto';
        chatPanel.style.transform = 'none';
      });

      // 初始化时应用位置
      const initialValue = positionSelect.value;
      const chatPanel = document.getElementById('fullscreenChatPanel');
      if (chatPanel && initialValue !== 'custom') {
        const margin = 10;
        const panelWidth = 300;
        const panelHeight = chatPanel.offsetHeight;

        switch(initialValue) {
          case 'top-left':
            chatPanel.style.left = margin + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'top-right':
            chatPanel.style.left = Math.max(margin, window.innerWidth - panelWidth - margin) + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'top-center':
            chatPanel.style.left = Math.max(margin, (window.innerWidth - panelWidth) / 2) + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'bottom-left':
            chatPanel.style.left = margin + 'px';
            chatPanel.style.top = Math.max(margin, window.innerHeight - panelHeight - margin) + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          case 'bottom-right':
            chatPanel.style.left = Math.max(margin, window.innerWidth - panelWidth - margin) + 'px';
            chatPanel.style.top = Math.max(margin, window.innerHeight - panelHeight - margin) + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
          default:
            chatPanel.style.left = Math.max(margin, (window.innerWidth - panelWidth) / 2) + 'px';
            chatPanel.style.top = margin + 'px';
            chatPanel.style.width = panelWidth + 'px';
            break;
        }
        chatPanel.style.right = 'auto';
        chatPanel.style.bottom = 'auto';
        chatPanel.style.transform = 'none';
      }

      // 窗口大小改变时重新计算位置
      window.addEventListener('resize', function() {
        const currentValue = positionSelect.value;
        if (chatPanel && currentValue !== 'custom') {
          const margin = 10;
          const panelWidth = 300;
          const panelHeight = chatPanel.offsetHeight;

          switch(currentValue) {
            case 'top-left':
              chatPanel.style.left = margin + 'px';
              chatPanel.style.top = margin + 'px';
              chatPanel.style.width = panelWidth + 'px';
              break;
            case 'top-right':
              chatPanel.style.left = Math.max(margin, window.innerWidth - panelWidth - margin) + 'px';
              chatPanel.style.top = margin + 'px';
              chatPanel.style.width = panelWidth + 'px';
              break;
            case 'top-center':
              chatPanel.style.left = Math.max(margin, (window.innerWidth - panelWidth) / 2) + 'px';
              chatPanel.style.top = margin + 'px';
              chatPanel.style.width = panelWidth + 'px';
              break;
            case 'bottom-left':
              chatPanel.style.left = margin + 'px';
              chatPanel.style.top = Math.max(margin, window.innerHeight - panelHeight - margin) + 'px';
              chatPanel.style.width = panelWidth + 'px';
              break;
            case 'bottom-right':
              chatPanel.style.left = Math.max(margin, window.innerWidth - panelWidth - margin) + 'px';
              chatPanel.style.top = Math.max(margin, window.innerHeight - panelHeight - margin) + 'px';
              chatPanel.style.width = panelWidth + 'px';
              break;
          }
          chatPanel.style.right = 'auto';
          chatPanel.style.bottom = 'auto';
          chatPanel.style.transform = 'none';
        }
      });
    }

    // 初始化简化版位置选择
    initEnhancedPositionSelection();
    
    // 统一的视频加载停止函数 - 完全停止所有检测和加载
    function stopAllVideoLoading() {
      console.log('🛑 完全停止所有视频加载和检测');
      
      // 1. 立即停止加载状态
      isLoading = false;
      
      // 2. 销毁HLS实例
      if (hls) {
        hls.destroy();
        hls = null;
        console.log('HLS实例已销毁');
      }
      
      // 3. 清除所有定时器
      if (hlsLoadTimeout) {
        clearTimeout(hlsLoadTimeout);
        hlsLoadTimeout = null;
        console.log('HLS加载超时定时器已清除');
      }
      
      // 4. 停止视频元素加载
      if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.src = '';
        videoPlayer.load();
        console.log('视频元素已重置');
      }
      
      // 5. 清除错误标记（允许后续新的尝试）
      window.lastErrorMessage = null;
      window.lastVideoError = null;
      
      // 6. 移除加载状态指示器
      const loadingElements = document.querySelectorAll('.loading-overlay');
      loadingElements.forEach(el => el.remove());
      
      console.log('✅ 所有视频加载相关进程已完全停止');
    }