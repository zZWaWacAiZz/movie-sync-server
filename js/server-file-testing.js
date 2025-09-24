// 动态获取服务器地址 - 支持本地和生产环境
      const getServerUrl = () => {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const port = window.location.port ? ':' + window.location.port : '';
        
        // 如果是本地访问，使用本地服务器
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return 'http://localhost:3000';
        }
        
        // 如果是生产环境，使用当前域名（你的服务器地址）
        return `${protocol}//${hostname}${port}`;
      };
      
      const serverUrl = getServerUrl();
      console.log('连接到服务器:', serverUrl);
      
      const socket = io(serverUrl, {
        timeout: 20000, // 20秒连接超时
        reconnection: true, // 开启自动重连
        reconnectionAttempts: 5, // 重连尝试次数
        reconnectionDelay: 1000 // 重连延迟
      });
      
      // 监听连接状态
      socket.on('connect', () => {
        console.log('已连接到服务器');
        addStatusMessage('网络连接已恢复');
        
        // 连接成功后，延迟1秒开始网络质量检测
        setTimeout(() => {
          console.log('Socket连接稳定，开始网络质量检测');
          measureNetworkQuality();
          networkQuality.lastPingTime = Date.now();
        }, 1000);
        
        // 获取房间配置
        socket.emit('get_room_config');
      });
      
      socket.on('disconnect', (reason) => {
        console.log('与服务器断开连接:', reason);
        addStatusMessage('网络连接已断开，正在尝试重连...');
        
        // 重置网络状态为较差状态
        networkQuality.quality = 0.2;
        networkQuality.rtt = 5000;
        updateNetworkStatusDisplay();
        console.log('网络断开，重置网络质量为较差状态');
      });
      
      socket.on('connect_error', (error) => {
        console.error('连接错误:', error);
        addStatusMessage('网络连接错误，请检查网络连接');
      });
      
      socket.on('reconnect', (attemptNumber) => {
        console.log('重连成功，尝试次数:', attemptNumber);
        addStatusMessage('网络连接已恢复');
        
        // 如果之前在房间内，尝试重新加入
        if (currentRoom && username) {
          socket.emit('join_room', {
            username,
            room: currentRoom,
            password: '' // 重连时可能需要重新输入密码
          });
        }
      });
      
      socket.on('reconnect_error', (error) => {
        console.error('重连失败:', error);
        addStatusMessage('重连失败，请刷新页面');
      });
      
      socket.on('reconnect_failed', () => {
        console.error('重连失败，超出最大尝试次数');
        addStatusMessage('无法连接到服务器，请检查网络或刷新页面');
      });
      
      // 监听消息发送确认
      socket.on('message_sent', (data) => {
        console.log('消息发送成功确认:', data);
      });
      
      socket.on('message_error', (error) => {
        console.error('消息发送错误:', error);
        addStatusMessage(`消息发送失败: ${error.message}`);
      });
      
      // 监听房间配置更新
      socket.on('room_config_update', (config) => {
        console.log('房间配置更新:', config);
        window.currentRoomConfig = config;
      });

      // 获取DOM元素
      const videoContainer = document.getElementById('videoContainer');
      const currentTimeEl = document.getElementById('currentTime');
      const currentRoomNameEl = document.getElementById('currentRoomName');
      const userCountEl = document.getElementById('userCount');
      const usernameInput = document.getElementById('username');
      const roomNameInput = document.getElementById('roomName');
      const passwordInput = document.getElementById('roomPassword');
      const btnCreate = document.getElementById('btnCreate');
      const btnJoin = document.getElementById('btnJoin');
      const roomModal = document.getElementById('roomModal');
      const chatMessages = document.getElementById('chatMessages');
      const userListEl = document.getElementById('usersList'); // 修复用户列表ID
      const readyButton = document.getElementById('readyButton');
      const themeToggle = document.getElementById('themeToggle');
      const videoPlayer = document.getElementById('videoPlayer'); // 原生视频播放器
      
      // 初始化房间名称显示为空
      currentRoomNameEl.innerHTML = '未加入房间';

      // 房间相关信息
      let currentRoom = '';
      let username = '';
      let users = [];
      let isReady = false;
      
      // 同步控制标志位 - 移到全局避免作用域问题
      let isSyncing = false;
      
      // 加载状态跟踪
      let isLoading = false;
      
      // 网络自适应同步系统
      let networkQuality = {
        rtt: 100, // 往返延迟(ms)
        quality: 1.0, // 网络质量评分 (0-1)
        lossRate: 0, // 丢包率
        lastPingTime: 0,
        pingHistory: [], // 延迟历史记录
        syncFailCount: 0, // 同步失败计数
        adaptiveThreshold: 2.0 // 动态同步阈值
      };
      
      let syncTimer = null; // 动态同步定时器
      let syncInterval = 10000; // 初始同步间隔
      
      // 视频资源信息 - 用于一致性校验
      let currentVideoId = '';
      let videoResourceInfo = {}; // 存储房间内各用户的视频资源信息

      // 网络质量检测函数
      function measureNetworkQuality() {
        // 检查Socket连接状态
        if (!socket || !socket.connected) {
          console.log('Socket未连接，跳过网络检测');
          return;
        }
        
        const startTime = Date.now();
        console.log('开始网络质量检测，发送ping...');
        
        // 发送ping测试
        socket.emit('network_ping', { timestamp: startTime });
        
        // 设置超时检测 - 本地服务器用更长的超时时间
        const timeoutDuration = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 1000 : 3000;
        const timeout = setTimeout(() => {
          console.log(`网络检测超时 (${timeoutDuration}ms)，设置为较差质量`);
          networkQuality.syncFailCount++;
          updateNetworkQuality(timeoutDuration); // 使用超时时间作为RTT
        }, timeoutDuration);
        
        // 监听pong响应
        const onPong = (data) => {
          clearTimeout(timeout);
          const rtt = Date.now() - data.timestamp;
          console.log(`收到pong响应，RTT: ${rtt}ms`);
          updateNetworkQuality(rtt);
          socket.off('network_pong', onPong);
        };
        
        socket.once('network_pong', onPong);
      }
      
      // 更新网络质量评分
      function updateNetworkQuality(rtt) {
        networkQuality.rtt = rtt;
        networkQuality.pingHistory.push(rtt);
        
        // 保持最近10次记录
        if (networkQuality.pingHistory.length > 10) {
          networkQuality.pingHistory.shift();
        }
        
        // 计算平均延迟
        const avgRtt = networkQuality.pingHistory.reduce((a, b) => a + b, 0) / networkQuality.pingHistory.length;
        
        // 计算网络质量评分 (0-1) - 针对本地服务器优化
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isLocalhost) {
          // 本地服务器的评分标准
          if (avgRtt <= 10) {
            networkQuality.quality = 1.0; // 优秀
          } else if (avgRtt <= 50) {
            networkQuality.quality = 0.9; // 很好
          } else if (avgRtt <= 100) {
            networkQuality.quality = 0.8; // 良好
          } else if (avgRtt <= 200) {
            networkQuality.quality = 0.6; // 一般
          } else if (avgRtt <= 500) {
            networkQuality.quality = 0.4; // 较差
          } else {
            networkQuality.quality = 0.2; // 很差
          }
        } else {
          // 远程服务器的评分标准
          if (avgRtt <= 50) {
            networkQuality.quality = 1.0; // 优秀
          } else if (avgRtt <= 150) {
            networkQuality.quality = 0.8; // 良好
          } else if (avgRtt <= 300) {
            networkQuality.quality = 0.6; // 一般
          } else if (avgRtt <= 500) {
            networkQuality.quality = 0.4; // 较差
          } else {
            networkQuality.quality = 0.2; // 很差
          }
        }
        
        // 动态调整同步参数
        adjustSyncParameters();
        
        // 更新网络状态显示
        updateNetworkStatusDisplay();
        
        console.log(`网络质量检测 - RTT: ${rtt}ms, 平均: ${Math.round(avgRtt)}ms, 质量评分: ${networkQuality.quality}`);
      }
      
      // 动态调整同步参数
      function adjustSyncParameters() {
        // 根据网络质量调整同步间隔
        if (networkQuality.quality >= 0.8) {
          syncInterval = 15000; // 网络好时减少同步频率
          networkQuality.adaptiveThreshold = 1.5;
        } else if (networkQuality.quality >= 0.6) {
          syncInterval = 10000; // 正常间隔
          networkQuality.adaptiveThreshold = 2.0;
        } else if (networkQuality.quality >= 0.4) {
          syncInterval = 7000; // 网络一般时增加同步频率
          networkQuality.adaptiveThreshold = 2.5;
        } else {
          syncInterval = 5000; // 网络差时频繁同步
          networkQuality.adaptiveThreshold = 3.0;
        }
        
        // 重新设置定时器
        setupAdaptiveSync();
      }
      
      // 设置自适应同步定时器
      function setupAdaptiveSync() {
        if (syncTimer) {
          clearInterval(syncTimer);
        }
        
        syncTimer = setInterval(() => {
          if (videoPlayer && videoPlayer.currentTime && currentRoom && !videoPlayer.paused && !isLoading) {
            // 添加网络延迟补偿的时间戳
            const compensatedTime = videoPlayer.currentTime + (networkQuality.rtt / 2000); // 补偿半个往返时间
            
            socket.emit('sync_time', {
              room: currentRoom,
              time: compensatedTime,
              networkQuality: networkQuality.quality,
              timestamp: Date.now() // 用于计算延迟
            });
            
            // 定期检测网络质量
            if (Date.now() - networkQuality.lastPingTime > 30000) { // 30秒检测一次
              measureNetworkQuality();
              networkQuality.lastPingTime = Date.now();
            }
          }
        }, syncInterval);
      }
      
      // 智能同步算法 - 根据网络质量调整同步策略
      function smartSync(targetTime, senderNetworkQuality = 1.0) {
        if (isSyncing || isLoading || videoPlayer.paused) return;
        
        const currentTime = videoPlayer.currentTime;
        const timeDiff = Math.abs(currentTime - targetTime);
        
        // 防止视频回退检测
        const isBackward = targetTime < currentTime;
        const backwardThreshold = 1.0; // 1秒以内的回退不处理
        
        if (isBackward && timeDiff < backwardThreshold) {
          console.log(`防止小幅回退: 当前${currentTime.toFixed(2)}s, 目标${targetTime.toFixed(2)}s`);
          return; // 防止小幅度的视频回退
        }
        
        // 根据双方网络质量计算动态阈值
        const combinedQuality = Math.min(networkQuality.quality, senderNetworkQuality);
        const dynamicThreshold = networkQuality.adaptiveThreshold * (1 + (1 - combinedQuality));
        
        console.log(`智能同步检测 - 时间差: ${timeDiff.toFixed(2)}s, 动态阈值: ${dynamicThreshold.toFixed(2)}s, 网络质量: ${combinedQuality.toFixed(2)}, 方向: ${isBackward ? '向后' : '向前'}`);
        
        if (timeDiff > dynamicThreshold) {
          isSyncing = true;
          
          // 对于大幅度回退，需要特殊处理
          if (isBackward && timeDiff > 3.0) {
            console.log(`检测到大幅度回退: ${timeDiff.toFixed(2)}s`);
            // 大幅度回退直接跳转，避免平滑过渡造成的问题
            videoPlayer.currentTime = targetTime;
            setTimeout(() => {
              isSyncing = false;
            }, 100);
            return;
          }
          
          // 根据网络质量选择同步策略
          if (combinedQuality >= 0.7 && timeDiff <= 8 && !isBackward) {
            // 网络好且非回退时使用平滑过渡
            smoothTimeTransition(targetTime, Math.min(1000, timeDiff * 200));
          } else {
            // 网络差或时间差很大或回退时直接跳转
            videoPlayer.currentTime = targetTime;
            setTimeout(() => {
              isSyncing = false;
            }, 100);
          }
        }
      }
      
      // 平滑时间过渡函数
      function smoothTimeTransition(targetTime, duration = 800) {
        const startTime = Date.now();
        const startPos = videoPlayer.currentTime;
        const adjustment = targetTime - startPos;
        
        function smoothStep() {
          if (!isSyncing) return;
          
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          
          videoPlayer.currentTime = startPos + adjustment * easeProgress;
          
          if (progress < 1) {
            requestAnimationFrame(smoothStep);
          } else {
            videoPlayer.currentTime = targetTime;
            isSyncing = false;
          }
        }
        
        requestAnimationFrame(smoothStep);
      }
      
      // 更新网络状态显示
      function updateNetworkStatusDisplay() {
        const networkStatusEl = document.getElementById('networkStatus');
        const qualityEl = document.getElementById('networkQuality');
        const rttEl = document.getElementById('networkRtt');
        const intervalEl = document.getElementById('syncInterval');
        const thresholdEl = document.getElementById('syncThreshold');
        const toggleBtn = document.getElementById('networkToggleBtn');
        
        if (!networkStatusEl || !toggleBtn) return;
        
        // 更新网络质量显示
        let qualityText, qualityClass;
        if (networkQuality.quality >= 0.9) {
          qualityText = '优秀';
          qualityClass = 'network-quality-excellent';
        } else if (networkQuality.quality >= 0.7) {
          qualityText = '良好';
          qualityClass = 'network-quality-good';
        } else if (networkQuality.quality >= 0.5) {
          qualityText = '一般';
          qualityClass = 'network-quality-fair';
        } else if (networkQuality.quality >= 0.3) {
          qualityText = '较差';
          qualityClass = 'network-quality-poor';
        } else {
          qualityText = '很差';
          qualityClass = 'network-quality-bad';
        }
        
        // 更新显示内容
        qualityEl.textContent = qualityText;
        qualityEl.className = qualityClass;
        rttEl.textContent = `${networkQuality.rtt}ms`;
        intervalEl.textContent = `${Math.round(syncInterval/1000)}s`;
        thresholdEl.textContent = `${networkQuality.adaptiveThreshold.toFixed(1)}s`;
        
        // 根据网络质量更新按钮颜色
        if (networkQuality.quality >= 0.7) {
          toggleBtn.style.background = 'rgba(76, 175, 80, 0.8)'; // 绿色
          toggleBtn.style.borderColor = '#4CAF50';
        } else if (networkQuality.quality >= 0.4) {
          toggleBtn.style.background = 'rgba(255, 193, 7, 0.8)'; // 黄色
          toggleBtn.style.borderColor = '#FFC107';
        } else {
          toggleBtn.style.background = 'rgba(244, 67, 54, 0.8)'; // 红色
          toggleBtn.style.borderColor = '#F44336';
        }
      }
      
      // 初始化网络状态按钮事件
      function initNetworkStatusToggle() {
        const toggleBtn = document.getElementById('networkToggleBtn');
        const networkStatusEl = document.getElementById('networkStatus');
        
        if (!toggleBtn || !networkStatusEl) return;
        
        let isVisible = false;
        
        // 点击外部关闭的处理函数
        function handleClickOutside(event) {
          // 如果点击的是网络状态面板内部或切换按钮，不关闭
          if (networkStatusEl.contains(event.target) || toggleBtn.contains(event.target)) {
            return;
          }
          
          // 关闭面板
          isVisible = false;
          networkStatusEl.classList.add('hidden');
          toggleBtn.classList.remove('active');
          
          // 移除事件监听
          document.removeEventListener('click', handleClickOutside);
          console.log('点击外部关闭网络状态面板');
        }
        
        toggleBtn.addEventListener('click', (event) => {
          event.stopPropagation(); // 防止触发外部点击关闭
          isVisible = !isVisible;
          
          if (isVisible && currentRoom) {
            console.log('显示网络状态弹窗');
            networkStatusEl.classList.remove('hidden');
            toggleBtn.classList.add('active');
            
            // 移动端强制显示样式
            if (window.innerWidth <= 768) {
              networkStatusEl.style.display = 'block';
              networkStatusEl.style.opacity = '1';
              networkStatusEl.style.visibility = 'visible';
              networkStatusEl.style.position = 'fixed';
              networkStatusEl.style.zIndex = '99999';
              networkStatusEl.style.top = '50%';
              networkStatusEl.style.left = '50%';
              networkStatusEl.style.transform = 'translate(-50%, -50%)';
              networkStatusEl.style.background = 'rgba(0, 0, 0, 0.95)';
              networkStatusEl.style.border = '2px solid rgba(255, 255, 255, 0.3)';
              networkStatusEl.style.borderRadius = '12px';
              networkStatusEl.style.padding = '20px';
              networkStatusEl.style.color = 'white';
              networkStatusEl.style.minWidth = '280px';
              networkStatusEl.style.minHeight = '150px';
              networkStatusEl.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
              networkStatusEl.style.backdropFilter = 'blur(10px)';
              networkStatusEl.style.webkitBackdropFilter = 'blur(10px)';
            }
            
            // 更新网络状态显示
            updateNetworkStatusDisplay();
            
            // 延迟添加外部点击监听，避免立即触发关闭
            setTimeout(() => {
              document.addEventListener('click', handleClickOutside);
            }, 100);
            
            console.log('网络状态弹窗已显示');
          } else {
            networkStatusEl.classList.add('hidden');
            toggleBtn.classList.remove('active');
            document.removeEventListener('click', handleClickOutside);
          }
        });
        
        // 鼠标悬停显示简要信息
        toggleBtn.addEventListener('mouseenter', () => {
          if (!isVisible && currentRoom) {
            const qualityText = networkQuality.quality >= 0.7 ? '好' : 
                               networkQuality.quality >= 0.4 ? '一般' : '差';
            toggleBtn.title = `网络: ${qualityText} | 延迟: ${networkQuality.rtt}ms | 点击查看详情`;
          }
        });
        
        // 为关闭按钮添加事件监听
        const closeBtn = document.getElementById('closeNetworkStatus');
        if (closeBtn) {
          closeBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // 防止事件冒泡
            console.log('点击关闭按钮关闭网络状态弹窗');
            
            // 关闭面板
            isVisible = false;
            networkStatusEl.classList.add('hidden');
            toggleBtn.classList.remove('active');
            
            // 移除外部点击监听
            document.removeEventListener('click', handleClickOutside);
            
            // 重置移动端样式
            if (window.innerWidth <= 768) {
              networkStatusEl.style.display = '';
              networkStatusEl.style.opacity = '';
              networkStatusEl.style.visibility = '';
              networkStatusEl.style.position = '';
              networkStatusEl.style.zIndex = '';
              networkStatusEl.style.top = '';
              networkStatusEl.style.left = '';
              networkStatusEl.style.transform = '';
              networkStatusEl.style.background = '';
              networkStatusEl.style.border = '';
              networkStatusEl.style.borderRadius = '';
              networkStatusEl.style.padding = '';
              networkStatusEl.style.color = '';
              networkStatusEl.style.minWidth = '';
              networkStatusEl.style.minHeight = '';
              networkStatusEl.style.boxShadow = '';
              networkStatusEl.style.backdropFilter = '';
              networkStatusEl.style.webkitBackdropFilter = '';
            }
          });
        }
      }

      // 初始化视频播放器事件监听
      function initVideoPlayer() {
        // 监听加载状态
        videoPlayer.addEventListener('waiting', () => {
          isLoading = true;
        });
        
        videoPlayer.addEventListener('loadeddata', () => {
          isLoading = false;
        });
        
        videoPlayer.addEventListener('canplay', () => {
          isLoading = false;
        });
        
        videoPlayer.addEventListener('play', () => {
          if (currentRoom && !isSyncing) {
            const currentTime = videoPlayer.currentTime;
            socket.emit('video_play', {
              room: currentRoom,
              time: currentTime,
              username: username
            });
            
            // 显示播放操作到聊天框
            const now = new Date();
            const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            addStatusMessage(`您继续播放了视频 [${formatTime(currentTime)}] ${currentTimeStr}`);
          }
        });

        videoPlayer.addEventListener('pause', () => {
          if (currentRoom && !isSyncing) {
            const currentTime = videoPlayer.currentTime;
            socket.emit('video_pause', {
              room: currentRoom,
              time: currentTime,
              username: username
            });
            
            // 显示暂停操作到聊天框
            const now = new Date();
            const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            addStatusMessage(`您暂停了视频 [${formatTime(currentTime)}] ${currentTimeStr}`);
          }
        });

        videoPlayer.addEventListener('seeked', () => {
          if (currentRoom && !isSyncing) {
            socket.emit('video_seek', {
              room: currentRoom,
              time: videoPlayer.currentTime
            });
          }
        });
        
        // 初始化智能同步系统
        setupAdaptiveSync();
        
        // 延迟进行初始网络质量检测，确保Socket连接稳定
        setTimeout(() => {
          if (socket && socket.connected) {
            console.log('开始初始网络质量检测...');
            measureNetworkQuality();
            networkQuality.lastPingTime = Date.now();
          } else {
            console.log('Socket未连接，延迟网络检测');
            // 如果Socket还未连接，再延迟5秒检测
            setTimeout(() => {
              if (socket && socket.connected) {
                measureNetworkQuality();
                networkQuality.lastPingTime = Date.now();
              }
            }, 5000);
          }
        }, 3000); // 3秒后开始检测
      }

      // 房间切换确认对话框
      function showRoomSwitchConfirm(message, onConfirm) {
        // 创建对话框覆盖层
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.style.backgroundColor = document.body.classList.contains('dark-theme') ? '#2a2a2a' : 'white';
        dialog.style.borderRadius = '12px';
        dialog.style.padding = '24px';
        dialog.style.maxWidth = '400px';
        dialog.style.width = '90%';
        dialog.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
        dialog.style.textAlign = 'center';
        dialog.style.color = document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#333';
        
        // 消息文本
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        messageEl.style.fontSize = '16px';
        messageEl.style.lineHeight = '1.5';
        messageEl.style.margin = '0 0 24px 0';
        messageEl.style.color = document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#333';
        
        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '12px';
        buttonContainer.style.justifyContent = 'center';
        
        // 取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.style.border = '1px solid #ddd';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.backgroundColor = document.body.classList.contains('dark-theme') ? '#444' : '#f8f9fa';
        cancelBtn.style.color = document.body.classList.contains('dark-theme') ? '#e0e0e0' : '#333';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontSize = '14px';
        
        // 确认按钮
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确认';
        confirmBtn.style.padding = '10px 20px';
        confirmBtn.style.border = 'none';
        confirmBtn.style.borderRadius = '6px';
        confirmBtn.style.backgroundColor = '#007bff';
        confirmBtn.style.color = 'white';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.fontSize = '14px';
        
        // 按钮事件
        cancelBtn.addEventListener('click', () => {
          document.body.removeChild(overlay);
        });
        
        confirmBtn.addEventListener('click', () => {
          document.body.removeChild(overlay);
          onConfirm();
        });
        
        // 组装对话框
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(confirmBtn);
        dialog.appendChild(messageEl);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);
        
        // 添加到页面
        document.body.appendChild(overlay);
        
        // 点击覆盖层关闭
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            document.body.removeChild(overlay);
          }
        });
      }
      btnCreate.addEventListener('click', () => {
        username = usernameInput.value.trim();
        const roomName = roomNameInput.value.trim();
        const password = passwordInput.value.trim();
        const errorMessage = document.getElementById('errorMessage');

        // 显示错误消息的函数
        function showError(message) {
          errorMessage.textContent = message;
          errorMessage.style.display = 'block';
          // 3秒后自动隐藏错误消息
          setTimeout(() => {
            errorMessage.style.display = 'none';
          }, 3000);
        }

        // 验证用户名和房间名
        if (!username) {
          showError('请输入用户名');
          return;
        }
        if (!roomName) {
          showError('请输入房间名称');
          return;
        }

        // 智能房间管理逻辑
        if (currentRoom) {
          // 用户已在房间内
          if (roomName === currentRoom) {
            // 输入的是当前房间名
            showError('房间已存在');
            return;
          } else {
            // 输入的是不同的房间名，确认是否创建新房间
            showRoomSwitchConfirm(
              `您已处于房间「${currentRoom}」内，是否创建新的房间「${roomName}」？您将离开当前房间。`,
              () => {
                // 确认创建新房间
                errorMessage.style.display = 'none';
                socket.emit('create_room', {
                  username,
                  room: roomName,
                  password
                });
              }
            );
            return;
          }
        }

        // 验证通过，隐藏错误消息并发送请求
        errorMessage.style.display = 'none';
        socket.emit('create_room', {
          username,
          room: roomName,
          password
        });
      });

      // 加入房间 - 添加验证逻辑，成功才关闭弹窗
      btnJoin.addEventListener('click', () => {
        username = usernameInput.value.trim();
        const roomName = roomNameInput.value.trim();
        const password = passwordInput.value.trim();
        const errorMessage = document.getElementById('errorMessage');

        // 显示错误消息的函数
        function showError(message) {
          errorMessage.textContent = message;
          errorMessage.style.display = 'block';
          // 3秒后自动隐藏错误消息
          setTimeout(() => {
            errorMessage.style.display = 'none';
          }, 3000);
        }

        // 验证用户名和房间名
        if (!username) {
          showError('请输入用户名');
          return;
        }
        if (!roomName) {
          showError('请输入房间名称');
          return;
        }

        // 智能房间管理逻辑
        if (currentRoom) {
          // 用户已在房间内
          if (roomName === currentRoom) {
            // 输入的是当前房间名
            showError('您已经在该房间内，无需重新加入');
            return;
          } else {
            // 输入的是不同的房间名，确认是否加入新房间
            showRoomSwitchConfirm(
              `您已处于房间「${currentRoom}」内，是否加入新的房间「${roomName}」？您将离开当前房间。`,
              () => {
                // 确认加入新房间
                errorMessage.style.display = 'none';
                socket.emit('join_room', {
                  username,
                  room: roomName,
                  password
                });
              }
            );
            return;
          }
        }

        // 验证通过，隐藏错误消息并发送请求
        errorMessage.style.display = 'none';
        socket.emit('join_room', {
          username,
          room: roomName,
          password
        });
      });
      
      // 右下角房间图标按钮点击事件
      const roomIconButton = document.getElementById('roomIconButton');
      if (roomIconButton) {
        roomIconButton.addEventListener('click', () => {
          // 打开房间创建/加入弹窗
          roomModal.style.display = 'flex';
          
          // 智能填充表单
          if (currentRoom && username) {
            // 如果用户已在房间内，自动填充当前用户名
            usernameInput.value = username;
            // 清空房间名和密码，让用户输入新的
            roomNameInput.value = '';
            passwordInput.value = '';
            // 设置焦点到房间名输入框
            setTimeout(() => {
              roomNameInput.focus();
            }, 100);
          } else {
            // 如果用户还未加入房间，清空所有输入框
            usernameInput.value = '';
            roomNameInput.value = '';
            passwordInput.value = '';
            // 设置焦点到用户名输入框
            setTimeout(() => {
              usernameInput.focus();
            }, 100);
          }
          
          // 清空错误消息
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
          errorMessage.style.display = 'none';
          errorMessage.textContent = '';
        }
      });

      // 首页按钮点击事件 - 与房间图标按钮功能相同
      const homeButton = document.getElementById('homeButton');
      if (homeButton) {
        homeButton.addEventListener('click', () => {
          // 显示房间创建/加入弹窗
          const roomModal = document.getElementById('roomModal');
          if (roomModal) {
            roomModal.style.display = 'flex';
            
            // 获取输入框元素（使用正确的ID）
            const usernameInput = document.getElementById('username');
            const roomNameInput = document.getElementById('roomName');
            const passwordInput = document.getElementById('roomPassword');
            
            // 智能填充表单
            if (currentRoom && username) {
              // 如果用户已在房间内，自动填充当前用户名
              usernameInput.value = username;
              // 清空房间名和密码，让用户输入新的
              roomNameInput.value = '';
              passwordInput.value = '';
              // 设置焦点到房间名输入框
              setTimeout(() => {
                roomNameInput.focus();
              }, 100);
            } else {
              // 如果用户还未加入房间，清空所有输入框
              usernameInput.value = '';
              roomNameInput.value = '';
              passwordInput.value = '';
              // 设置焦点到用户名输入框
              setTimeout(() => {
                usernameInput.focus();
              }, 100);
            }
            
            // 清空错误消息
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
              errorMessage.style.display = 'none';
              errorMessage.textContent = '';
            }
          }
        });
      }
      }

      // 准备按钮点击事件
      readyButton.addEventListener('click', () => {
        // 检查用户是否已加入房间
        if (!currentRoom || currentRoom.trim() === '') {
          showBottomToast('请先加入房间');
          return;
        }
        
        isReady = !isReady;
        
        // 更新按钮文本和图标
        const iconElement = readyButton.querySelector('i');
        if (isReady) {
          readyButton.innerHTML = '<i class="fas fa-check-circle"></i> 已准备';
        } else {
          readyButton.innerHTML = '<i class="fas fa-circle"></i> 准备';
        }
        
        readyButton.classList.toggle('ready', isReady);
        
        // 发送准备状态更新
        if (currentRoom) {
          socket.emit('update_ready_status', {
            room: currentRoom,
            username,
            isReady
          });
          // 在聊天窗口显示准备状态变更
          addStatusMessage(`${username}${isReady ? ' 准备好了' : ' 未准备'}`);
        }
      });

      // 主题切换功能
      themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        // 只更新按钮内的span元素文本，保留图标
        const textSpan = themeToggle.querySelector('span');
        if (textSpan) {
          textSpan.textContent = isDark ? '浅色模式' : '暗色模式';
        }
        // 更新图标 - 深色模式显示月亮图标，浅色模式显示太阳图标
        const iconElement = themeToggle.querySelector('i');
        if (iconElement) {
          iconElement.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        }
      });

      // 发送聊天消息
      function sendChatMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        if (message && currentRoom && username) {
          socket.emit('chat_message', {
            room: currentRoom,
            username,
            message,
            isImage: false // 添加isImage字段，显式标记为文本消息
          });
          addChatMessage(username, message, true, false); // 调用addChatMessage时也传入isImage参数
          messageInput.value = '';
          
          // 重置自动隐藏计时器
          resetAutoHideTimer();
        }
      }

      // 为普通模式的发送按钮添加点击事件监听器
      document.getElementById('sendButton').addEventListener('click', function() {
        console.log('普通模式发送按钮被点击');
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        console.log('输入的消息:', message);
        console.log('当前房间:', currentRoom);
        console.log('用户名:', username);
        console.log('socket连接状态:', socket ? 'socket存在' : 'socket不存在');
        console.log('socket是否连接:', socket && socket.connected ? '已连接' : '未连接');
        
        if (message && currentRoom && username) {
          console.log('条件满足，开始发送消息');
          // 直接发送消息
          socket.emit('chat_message', {
            room: currentRoom,
            username,
            message,
            isImage: false
          });
          console.log('socket.emit已调用');
          // 直接调用addChatMessage函数，确保消息显示在聊天窗口
          window.addChatMessage(username, message, true, false);
          console.log('addChatMessage已调用');
          // 清空输入框
          messageInput.value = '';
          console.log('消息已发送，输入框已清空');
        } else {
          console.log('发送条件不满足:', {
            hasMessage: !!message,
            hasRoom: !!currentRoom,
            hasUsername: !!username
          });
        }
      });

      // 按回车发送
      document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          // 使用全屏发送按钮的点击事件，避免重复逻辑
          const sendButton = document.getElementById('sendButton');
          if (sendButton) {
            sendButton.click();
          } else {
            // 备用方案：直接调用sendChatMessage
            sendChatMessage();
          }
        }
      });

      // emoji按钮点击事件 - 显示优化后的表情选择器
      document.getElementById('emojiButton').addEventListener('click', () => {
        const messageInput = document.getElementById('messageInput');
        const emojiButton = document.getElementById('emojiButton');
        
        // 如果已有表情面板，先移除
        const existingPanel = document.getElementById('emojiPickerPanel');
        if (existingPanel) {
          document.body.removeChild(existingPanel);
          return;
        }
        
        // 创建表情选择面板 - 使用全屏模式的实现
        const emojiPanel = document.createElement('div');
        emojiPanel.id = 'emojiPickerPanel';
        emojiPanel.className = 'emoji-picker-panel';
        
        // 设置样式（与全屏模式保持一致）
        const panelWidth = 252;
        const panelHeight = 288;
        
        // 获取emoji按钮的位置用于定位
        const buttonRect = emojiButton.getBoundingClientRect();
        
        emojiPanel.style.position = 'absolute';
        emojiPanel.style.width = `${panelWidth}px`;
        emojiPanel.style.maxHeight = `${panelHeight}px`;
        emojiPanel.style.backgroundColor = 'var(--popup-bg)';
        emojiPanel.style.border = '1px solid var(--popup-border)';
        emojiPanel.style.borderRadius = '8px';
        emojiPanel.style.boxShadow = 'var(--popup-shadow)';
        emojiPanel.style.zIndex = '1000';
        emojiPanel.style.overflow = 'hidden';
        
        // 计算面板位置（类似全屏模式的定位逻辑）
        let leftPos = buttonRect.left + buttonRect.width / 2 - panelWidth / 2;
        let topPos = buttonRect.top - panelHeight - 10; // 显示在按钮上方
        
        // 边界检测
        if (leftPos < 10) leftPos = 10;
        if (leftPos + panelWidth > window.innerWidth - 10) {
          leftPos = window.innerWidth - panelWidth - 10;
        }
        if (topPos < 10) { // 如果上方空间不足，显示在下方
          topPos = buttonRect.bottom + 10;
        }
        
        emojiPanel.style.left = `${leftPos}px`;
        emojiPanel.style.top = `${topPos}px`;
        
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
        emojiPanel.appendChild(tabs);
        
        // 创建内容区域 - 完全隐藏滚动条但保留滚动功能
        const content = document.createElement('div');
        content.style.padding = '7px';
        content.style.maxHeight = '225px';
        content.style.overflowY = 'scroll';  // 使用scroll确保有滚动功能
        content.style.overflowX = 'hidden';
        content.style.width = '100%';
        content.style.boxSizing = 'border-box';
        content.style.msOverflowStyle = 'none';  // IE/Edge隐藏滚动条
        content.style.scrollbarWidth = 'none';     // Firefox隐藏滚动条
        
        // 隐藏滚动条样式 - 完全隐藏所有滚动条
        const scrollStyle = document.createElement('style');
        scrollStyle.textContent = `
          /* 隐藏所有滚动条 */
          *::-webkit-scrollbar {
            display: none !important;
          }
          
          /* 隐藏内容区域滚动条 */
          #emojiPanel > div::-webkit-scrollbar {
            display: none !important;
          }
          
          /* 跨浏览器隐藏滚动条 */
          #emojiPanel > div {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
          
          #emojiPanel, #emojiPanel * {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
        `;
        document.head.appendChild(scrollStyle);
        
        // 引入表情数据
        if (!window.emojiData) {
          const script = document.createElement('script');
          script.src = 'js/extra/emojiData.js';
          document.head.appendChild(script);
        }
        
        // 等待数据加载完成
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
        
        // 创建网格容器
        const emojiGrid = document.createElement('div');
        emojiGrid.style.display = 'grid';
        emojiGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(25px, 1fr))';
        emojiGrid.style.gap = '1.8px';
        emojiGrid.style.padding = '3.6px';
        emojiGrid.style.width = '100%';
        emojiGrid.style.boxSizing = 'border-box';
        
        const kaomojiGrid = document.createElement('div');
        kaomojiGrid.style.display = 'none';
        kaomojiGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        kaomojiGrid.style.gap = '1.8px';
        kaomojiGrid.style.padding = '3.6px';
        kaomojiGrid.style.width = '100%';
        kaomojiGrid.style.boxSizing = 'border-box';
        
        // 加载并渲染表情数据
        waitForEmojiData().then(() => {
          // 渲染emoji
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
            kaomojiBtn.style.display = 'flex';
            kaomojiBtn.style.alignItems = 'center';
            kaomojiBtn.style.justifyContent = 'center';
            kaomojiBtn.onmouseover = () => kaomojiBtn.style.backgroundColor = 'var(--popup-hover-bg)';
            kaomojiBtn.onmouseout = () => kaomojiBtn.style.backgroundColor = 'transparent';
            kaomojiBtn.onclick = () => {
              messageInput.value += kaomoji;
              messageInput.focus();
            };
            kaomojiGrid.appendChild(kaomojiBtn);
          });
        });
        
        content.appendChild(emojiGrid);
        content.appendChild(kaomojiGrid);
        emojiPanel.appendChild(content);
        
        // 标签页切换（与全屏模式相同）
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
        
        // 添加到页面
        document.body.appendChild(emojiPanel);
        
        // 点击外部关闭面板 - 使用全屏模式的逻辑
        function closeEmojiPanel(event) {
          if (emojiPanel.style.display !== 'none' && 
              event.target !== emojiButton && 
              !emojiButton.contains(event.target) && 
              event.target !== emojiPanel && 
              !emojiPanel.contains(event.target)) {
            if (document.body.contains(emojiPanel)) {
              document.body.removeChild(emojiPanel);
            }
            if (document.head.contains(scrollStyle)) {
              document.head.removeChild(scrollStyle);
            }
            document.removeEventListener('click', closeEmojiPanel);
          }
        }
        
        // 为面板添加点击事件，阻止事件冒泡
        emojiPanel.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        
        // 延迟绑定关闭事件，避免当前点击触发
        setTimeout(() => {
          document.addEventListener('click', closeEmojiPanel);
        }, 10);
      });

      // 图片上传按钮点击事件
      document.getElementById('imageUploadButton').addEventListener('click', () => {
        document.getElementById('imageUploadInput').click();
      });

      // 处理图片上传
      document.getElementById('imageUploadInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 检查文件大小是否超过5MB
        if (file.size > 5 * 1024 * 1024) {
          window.errorHandler.showError('图片大小不能超过5MB');
          e.target.value = ''; // 清空文件选择
          return;
        }
        
        // 检查Socket连接状态
        if (!socket || !socket.connected) {
          window.errorHandler.showError('网络连接已断开，请稍后重试');
          e.target.value = '';
          return;
        }
        
        // 检查是否在房间内
        if (!currentRoom || !username) {
          window.errorHandler.showError('请先加入房间后再发送图片');
          e.target.value = '';
          return;
        }
        
        // 读取图片并发送，添加异常处理防止断开连接
        const reader = new FileReader();
        
        // 创建图片预览元素，用于显示上传进度
        let imagePreview = null;
        let progressOverlay = null;
        let progressText = null;
        
        reader.onload = (event) => {
          try {
            const imageData = event.target.result;
            const imageSizeKB = Math.round(imageData.length / 1024);
            
            console.log('准备发送图片，大小约为', imageSizeKB, 'KB');
            
            // 再次检查连接状态
            if (!socket || !socket.connected) {
              if (imagePreview) {
                imagePreview.remove();
              }
              window.errorHandler.showError('网络连接已断开，图片发送失败');
              e.target.value = '';
              return;
            }
            
            // 创建图片消息元素和上传状态显示
            const messageEl = document.createElement('div');
            messageEl.classList.add('message', 'own');
            
            const contentEl = document.createElement('div');
            contentEl.classList.add('message-content');
            
            // 创建图片预览
            imagePreview = document.createElement('img');
            imagePreview.src = imageData;
            imagePreview.classList.add('chat-image');
            imagePreview.style.height = 'auto';
            imagePreview.style.borderRadius = '4px';
            imagePreview.style.opacity = '0.5'; // 上传中亮度减低50%
            imagePreview.style.position = 'relative';
            
            // 创建进度覆盖层
            progressOverlay = document.createElement('div');
            progressOverlay.style.position = 'absolute';
            progressOverlay.style.top = '0';
            progressOverlay.style.left = '0';
            progressOverlay.style.width = '100%';
            progressOverlay.style.height = '100%';
            progressOverlay.style.display = 'flex';
            progressOverlay.style.alignItems = 'center';
            progressOverlay.style.justifyContent = 'center';
            progressOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            progressOverlay.style.borderRadius = '4px';
            progressOverlay.style.zIndex = '10';
            
            // 创建进度文本
            progressText = document.createElement('span');
            progressText.style.color = 'white';
            progressText.style.fontWeight = 'bold';
            progressText.style.fontSize = '14px';
            progressText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
            progressText.textContent = '0%';
            
            progressOverlay.appendChild(progressText);
            
            // 创建图片容器（相对定位）
            const imageContainer = document.createElement('div');
            imageContainer.style.position = 'relative';
            imageContainer.style.display = 'inline-block';
            imageContainer.appendChild(imagePreview);
            imageContainer.appendChild(progressOverlay);
            
            contentEl.appendChild(imageContainer);
            
            // 创建消息信息（发送者头像、名字和时间）
            const now = new Date();
            const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const infoEl = document.createElement('div');
            infoEl.classList.add('message-info');
            
            const senderEl = document.createElement('span');
            senderEl.classList.add('message-sender');
            
            // 创建小头像
            const avatarEl = document.createElement('span');
            avatarEl.classList.add('message-avatar');
            const initial = username.charAt(0).toUpperCase();
            avatarEl.textContent = initial;
            if (!userColors[username]) {
              userColors[username] = getUsernameColor(username);
            }
            avatarEl.style.backgroundColor = userColors[username];
            senderEl.appendChild(avatarEl);
            
            // 设置发送者名字
            const senderText = document.createTextNode(username);
            senderEl.appendChild(senderText);
            
            const timeEl = document.createElement('span');
            timeEl.classList.add('message-time');
            timeEl.textContent = time;
            
            senderEl.appendChild(timeEl);
            infoEl.appendChild(senderEl);
            
            // 组装消息元素
            messageEl.appendChild(contentEl);
            messageEl.appendChild(infoEl);
            
            // 添加到聊天区域
            chatMessages.appendChild(messageEl);
            
            // 初始滚动到底部
            scrollToBottom();
            
            // 确保图片加载完成后再次滚动到底部，处理第一次加载图片时滚动不完整的问题
            imagePreview.onload = function() {
              // 延迟滚动确保图片完全渲染
              setTimeout(() => {
                scrollToBottom();
              }, 100);
            };
            
            // 如果图片已经缓存，手动触发滚动
            if (imagePreview.complete) {
              setTimeout(() => {
                scrollToBottom();
              }, 100);
            } else {
              // 确保在图片加载完成后滚动
              imagePreview.addEventListener('load', function() {
                setTimeout(() => {
                  scrollToBottom();
                }, 100);
              });
            }
            
            // 模拟上传进度
            let progress = 0;
            const progressInterval = setInterval(() => {
              progress += Math.random() * 15 + 5; // 每次增加5-20%
              if (progress > 95) progress = 95; // 最多到95%，等待服务器响应
              progressText.textContent = Math.round(progress) + '%';
            }, 150);
            
            // 设置发送超时处理
            const sendTimeout = setTimeout(() => {
              clearInterval(progressInterval);
              if (progressOverlay) {
                progressOverlay.remove();
              }
              if (imagePreview) {
                // 保持50%暗度，不恢复亮度
                imagePreview.style.opacity = '0.5';
                
                // 创建重新上传图标容器
                const retryContainer = document.createElement('div');
                retryContainer.style.position = 'absolute';
                retryContainer.style.top = '50%';
                retryContainer.style.left = '50%';
                retryContainer.style.transform = 'translate(-50%, -50%)';
                retryContainer.style.width = '40px';
                retryContainer.style.height = '40px';
                retryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                retryContainer.style.borderRadius = '50%';
                retryContainer.style.display = 'flex';
                retryContainer.style.alignItems = 'center';
                retryContainer.style.justifyContent = 'center';
                retryContainer.style.cursor = 'pointer';
                retryContainer.style.zIndex = '10';
                retryContainer.style.transition = 'background-color 0.3s ease';
                
                // 添加重新上传图标
                const retryIcon = document.createElement('i');
                retryIcon.className = 'fas fa-redo-alt';
                retryIcon.style.color = 'white';
                retryIcon.style.fontSize = '16px';
                
                retryContainer.appendChild(retryIcon);
                
                // 添加悬停效果
                retryContainer.addEventListener('mouseenter', () => {
                  retryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                });
                retryContainer.addEventListener('mouseleave', () => {
                  retryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                });
                
                // 点击重试功能
                retryContainer.addEventListener('click', () => {
                  // 移除重试图标
                  retryContainer.remove();
                  
                  // 重新开始上传流程
                  imagePreview.style.opacity = '0.5';
                  
                  // 重新创建进度覆盖层
                  const newProgressOverlay = document.createElement('div');
                  newProgressOverlay.style.position = 'absolute';
                  newProgressOverlay.style.top = '0';
                  newProgressOverlay.style.left = '0';
                  newProgressOverlay.style.width = '100%';
                  newProgressOverlay.style.height = '100%';
                  newProgressOverlay.style.display = 'flex';
                  newProgressOverlay.style.alignItems = 'center';
                  newProgressOverlay.style.justifyContent = 'center';
                  newProgressOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                  newProgressOverlay.style.borderRadius = '4px';
                  
                  const newProgressText = document.createElement('div');
                  newProgressText.style.color = 'white';
                  newProgressText.style.fontWeight = 'bold';
                  newProgressText.style.fontSize = '14px';
                  newProgressText.textContent = '0%';
                  
                  newProgressOverlay.appendChild(newProgressText);
                  imageContainer.appendChild(newProgressOverlay);
                  
                  // 模拟上传进度
                  let retryProgress = 0;
                  const retryProgressInterval = setInterval(() => {
                    retryProgress += Math.random() * 15 + 5;
                    if (retryProgress > 95) retryProgress = 95;
                    newProgressText.textContent = Math.round(retryProgress) + '%';
                  }, 150);
                  
                  // 重新设置超时处理
                  const retryTimeout = setTimeout(() => {
                    clearInterval(retryProgressInterval);
                    if (newProgressOverlay) {
                      newProgressOverlay.remove();
                    }
                    // 再次失败时重新显示重试图标
                    imageContainer.appendChild(retryContainer);
                  }, 15000);
                  
                  // 重新发送图片消息
                  const retryOnMessageSent = (response) => {
                    clearTimeout(retryTimeout);
                    clearInterval(retryProgressInterval);
                    if (response.success) {
                      newProgressText.textContent = '100%';
                      setTimeout(() => {
                        if (newProgressOverlay) {
                          newProgressOverlay.remove();
                        }
                        imagePreview.style.opacity = '1.0';
                        
                        // 添加点击放大功能
                        imagePreview.addEventListener('click', () => {
                          const overlay = document.createElement('div');
                          overlay.classList.add('image-overlay');
                          overlay.style.position = 'fixed';
                          overlay.style.top = '0';
                          overlay.style.left = '0';
                          overlay.style.width = '100%';
                          overlay.style.height = '100%';
                          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                          overlay.style.display = 'flex';
                          overlay.style.alignItems = 'center';
                          overlay.style.justifyContent = 'center';
                          overlay.style.zIndex = '1000';
                          
                          const largeImg = document.createElement('img');
                          largeImg.src = imageData;
                          largeImg.style.maxWidth = '90%';
                          largeImg.style.maxHeight = '90%';
                          largeImg.style.objectFit = 'contain';
                          
                          overlay.addEventListener('click', () => {
                            document.body.removeChild(overlay);
                          });
                          
                          document.body.appendChild(overlay);
                          overlay.appendChild(largeImg);
                        });
                      }, 500);
                    }
                    socket.off('message_sent', retryOnMessageSent);
                    socket.off('message_error', retryOnMessageError);
                  };
                  
                  const retryOnMessageError = (error) => {
                    clearTimeout(retryTimeout);
                    clearInterval(retryProgressInterval);
                    console.error('图片重试发送失败:', error);
                    if (newProgressOverlay) {
                      newProgressOverlay.remove();
                    }
                    // 重新显示重试图标
                    imageContainer.appendChild(retryContainer);
                    socket.off('message_sent', retryOnMessageSent);
                    socket.off('message_error', retryOnMessageError);
                  };
                  
                  // 注册重试事件监听器
                  socket.once('message_sent', retryOnMessageSent);
                  socket.once('message_error', retryOnMessageError);
                  
                  // 重新发送图片消息
                  socket.emit('chat_message', {
                    room: currentRoom,
                    username,
                    message: imageData,
                    isImage: true
                  });
                });
                
                imageContainer.appendChild(retryContainer);
              }
            }, 15000); // 15秒超时
            
            // 监听发送结果
            const onMessageSent = (response) => {
              clearTimeout(sendTimeout);
              clearInterval(progressInterval);
              if (response.success) {
                // 上传成功：显示100%然后隐藏进度条，恢复亮度
                if (progressText) progressText.textContent = '100%';
                setTimeout(() => {
                  if (progressOverlay) {
                    progressOverlay.remove();
                  }
                  if (imagePreview) {
                    imagePreview.style.opacity = '1.0'; // 恢复亮度
                    
                    // 添加点击放大功能
                    imagePreview.addEventListener('click', () => {
                      const overlay = document.createElement('div');
                      overlay.classList.add('image-overlay');
                      overlay.style.position = 'fixed';
                      overlay.style.top = '0';
                      overlay.style.left = '0';
                      overlay.style.width = '100%';
                      overlay.style.height = '100%';
                      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                      overlay.style.display = 'flex';
                      overlay.style.alignItems = 'center';
                      overlay.style.justifyContent = 'center';
                      overlay.style.zIndex = '1000';
                      
                      const largeImg = document.createElement('img');
                      largeImg.src = imageData;
                      largeImg.style.maxWidth = '90%';
                      largeImg.style.maxHeight = '90%';
                      largeImg.style.objectFit = 'contain';
                      
                      overlay.addEventListener('click', () => {
                        document.body.removeChild(overlay);
                      });
                      
                      document.body.appendChild(overlay);
                      overlay.appendChild(largeImg);
                    });
                  }
                }, 500); // 0.5秒后隐藏进度条
              }
              socket.off('message_sent', onMessageSent);
              socket.off('message_error', onMessageError);
            };
            
            const onMessageError = (error) => {
              clearTimeout(sendTimeout);
              clearInterval(progressInterval);
              console.error('图片发送失败:', error);
              if (progressOverlay) {
                progressOverlay.remove();
              }
              if (imagePreview) {
                // 保持50%暗度，不恢复亮度
                imagePreview.style.opacity = '0.5';
                
                // 创建重新上传图标容器
                const retryContainer = document.createElement('div');
                retryContainer.style.position = 'absolute';
                retryContainer.style.top = '50%';
                retryContainer.style.left = '50%';
                retryContainer.style.transform = 'translate(-50%, -50%)';
                retryContainer.style.width = '40px';
                retryContainer.style.height = '40px';
                retryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                retryContainer.style.borderRadius = '50%';
                retryContainer.style.display = 'flex';
                retryContainer.style.alignItems = 'center';
                retryContainer.style.justifyContent = 'center';
                retryContainer.style.cursor = 'pointer';
                retryContainer.style.zIndex = '10';
                retryContainer.style.transition = 'background-color 0.3s ease';
                
                // 添加重新上传图标
                const retryIcon = document.createElement('i');
                retryIcon.className = 'fas fa-redo-alt';
                retryIcon.style.color = 'white';
                retryIcon.style.fontSize = '16px';
                
                retryContainer.appendChild(retryIcon);
                
                // 添加悬停效果
                retryContainer.addEventListener('mouseenter', () => {
                  retryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                });
                retryContainer.addEventListener('mouseleave', () => {
                  retryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                });
                
                // 点击重试功能
                retryContainer.addEventListener('click', () => {
                  // 移除重试图标
                  retryContainer.remove();
                  
                  // 重新开始上传流程
                  imagePreview.style.opacity = '0.5';
                  
                  // 重新创建进度覆盖层
                  const newProgressOverlay = document.createElement('div');
                  newProgressOverlay.style.position = 'absolute';
                  newProgressOverlay.style.top = '0';
                  newProgressOverlay.style.left = '0';
                  newProgressOverlay.style.width = '100%';
                  newProgressOverlay.style.height = '100%';
                  newProgressOverlay.style.display = 'flex';
                  newProgressOverlay.style.alignItems = 'center';
                  newProgressOverlay.style.justifyContent = 'center';
                  newProgressOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                  newProgressOverlay.style.borderRadius = '4px';
                  
                  const newProgressText = document.createElement('div');
                  newProgressText.style.color = 'white';
                  newProgressText.style.fontWeight = 'bold';
                  newProgressText.style.fontSize = '14px';
                  newProgressText.textContent = '0%';
                  
                  newProgressOverlay.appendChild(newProgressText);
                  imageContainer.appendChild(newProgressOverlay);
                  
                  // 模拟上传进度
                  let retryProgress = 0;
                  const retryProgressInterval = setInterval(() => {
                    retryProgress += Math.random() * 15 + 5;
                    if (retryProgress > 95) retryProgress = 95;
                    newProgressText.textContent = Math.round(retryProgress) + '%';
                  }, 150);
                  
                  // 重新设置超时处理
                  const retryTimeout = setTimeout(() => {
                    clearInterval(retryProgressInterval);
                    if (newProgressOverlay) {
                      newProgressOverlay.remove();
                    }
                    // 再次失败时重新显示重试图标
                    imageContainer.appendChild(retryContainer);
                  }, 15000);
                  
                  // 重新发送图片消息
                  const retryOnMessageSent = (response) => {
                    clearTimeout(retryTimeout);
                    clearInterval(retryProgressInterval);
                    if (response.success) {
                      newProgressText.textContent = '100%';
                      setTimeout(() => {
                        if (newProgressOverlay) {
                          newProgressOverlay.remove();
                        }
                        imagePreview.style.opacity = '1.0';
                        
                        // 添加点击放大功能
                        imagePreview.addEventListener('click', () => {
                          const overlay = document.createElement('div');
                          overlay.classList.add('image-overlay');
                          overlay.style.position = 'fixed';
                          overlay.style.top = '0';
                          overlay.style.left = '0';
                          overlay.style.width = '100%';
                          overlay.style.height = '100%';
                          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                          overlay.style.display = 'flex';
                          overlay.style.alignItems = 'center';
                          overlay.style.justifyContent = 'center';
                          overlay.style.zIndex = '1000';
                          
                          const largeImg = document.createElement('img');
                          largeImg.src = imageData;
                          largeImg.style.maxWidth = '90%';
                          largeImg.style.maxHeight = '90%';
                          largeImg.style.objectFit = 'contain';
                          
                          overlay.addEventListener('click', () => {
                            document.body.removeChild(overlay);
                          });
                          
                          document.body.appendChild(overlay);
                          overlay.appendChild(largeImg);
                        });
                      }, 500);
                    }
                    socket.off('message_sent', retryOnMessageSent);
                    socket.off('message_error', retryOnMessageError);
                  };
                  
                  const retryOnMessageError = (error) => {
                    clearTimeout(retryTimeout);
                    clearInterval(retryProgressInterval);
                    console.error('图片重试发送失败:', error);
                    if (newProgressOverlay) {
                      newProgressOverlay.remove();
                    }
                    // 重新显示重试图标
                    imageContainer.appendChild(retryContainer);
                    socket.off('message_sent', retryOnMessageSent);
                    socket.off('message_error', retryOnMessageError);
                  };
                  
                  // 注册重试事件监听器
                  socket.once('message_sent', retryOnMessageSent);
                  socket.once('message_error', retryOnMessageError);
                  
                  // 重新发送图片消息
                  socket.emit('chat_message', {
                    room: currentRoom,
                    username,
                    message: imageData,
                    isImage: true
                  });
                });
                
                imageContainer.appendChild(retryContainer);
              }
              socket.off('message_sent', onMessageSent);
              socket.off('message_error', onMessageError);
            };
            
            // 注册事件监听器
            socket.once('message_sent', onMessageSent);
            socket.once('message_error', onMessageError);
            
            // 发送图片消息到服务器
            socket.emit('chat_message', {
              room: currentRoom,
              username,
              message: imageData,
              isImage: true
            });
            
            // 清空文件选择
            e.target.value = '';
            
          } catch (error) {
            console.error('图片处理错误:', error);
            if (imagePreview) {
              imagePreview.remove();
            }
            window.errorHandler.showError('图片处理失败，请重试');
            e.target.value = '';
          }
        };
        
        // 添加错误处理
        reader.onerror = (error) => {
          console.error('图片读取错误:', error);
          window.errorHandler.showError('图片读取失败，请重试');
          e.target.value = '';
        };
        
        // 设置超时处理，防止FileReader卡住
        const readerTimeout = setTimeout(() => {
          if (reader.readyState !== FileReader.DONE) {
            console.error('图片读取超时');
            reader.abort();
            window.errorHandler.showError('图片读取超时，请重试');
            e.target.value = '';
          }
        }, 10000); // 10秒超时
        
        reader.onloadend = () => {
          clearTimeout(readerTimeout);
        };
        
        // 开始读取文件
        reader.readAsDataURL(file);
      });

      // 添加状态消息
      function addStatusMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', 'system');
        
        const contentEl = document.createElement('div');
        contentEl.classList.add('message-content');
        contentEl.textContent = message;
        
        messageEl.appendChild(contentEl);
        chatMessages.appendChild(messageEl);
        
        // 使用统一的平滑滚动功能
        scrollToBottom();
        
        // 同时添加到全屏聊天面板（如果存在）
        const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
        if (fullscreenChatPanel) {
          const fullscreenMessagesContainer = fullscreenChatPanel.querySelector('.chat-messages');
          if (fullscreenMessagesContainer) {
            // 克隆消息元素并添加到全屏聊天面板
            const clonedMessageEl = messageEl.cloneNode(true);
            fullscreenMessagesContainer.appendChild(clonedMessageEl);
            
            // 检查是否存在全屏模式下的滚动函数
            if (window.scrollToBottomForFullscreen) {
              window.scrollToBottomForFullscreen();
            }
          }
        }
      }
      
      // 移动端用户列表弹窗功能已移除
      
      // 显示视频资源不一致提示
      function showVideoResourceMismatch(message, inconsistentUsers = {}) {
        // 添加日志以便调试
        console.log('显示视频资源不一致提示，消息:', message);
        console.log('当前用户是否是房主:', isHost);
        
        // 检查是否已经存在提示框，如果有则移除
        const existingModal = document.getElementById('videoMismatchModal');
        if (existingModal) {
          document.body.removeChild(existingModal);
        }
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.id = 'videoMismatchModal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '2000';
        
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = document.body.classList.contains('dark-theme') ? '#333' : '#fff';
        modalContent.style.padding = '18px';
        modalContent.style.borderRadius = '10px';
        modalContent.style.maxWidth = '400px';
        modalContent.style.width = '85%';
        modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        modalContent.style.color = document.body.classList.contains('dark-theme') ? '#eee' : '#333';
        
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = '视频资源不一致';
        modalTitle.style.marginTop = '0';
        modalTitle.style.marginBottom = '15px';
        
        const modalMessage = document.createElement('p');
        modalMessage.textContent = message;
        modalMessage.style.margin = '15px 0';
        modalMessage.style.fontWeight = 'bold';
        
        const warningMessage = document.createElement('p');
        warningMessage.textContent = '视频资源不一致可能会导致同步功能失效，请确保所有用户使用相同的视频资源。';
        warningMessage.style.color = '#e74c3c';
        warningMessage.style.fontSize = '14px';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '我知道了';
        closeButton.style.padding = '10px 20px';
        closeButton.style.backgroundColor = '#3498db';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '6px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.width = '100%';
        closeButton.style.marginTop = '15px';
        
        closeButton.addEventListener('click', () => {
          document.body.removeChild(modal);
        });
        
        modalContent.appendChild(modalTitle);
        modalContent.appendChild(modalMessage);
        modalContent.appendChild(warningMessage);
        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
      }
      
      // 存储之前创建的本地视频对象URL，用于后续释放
      let previousLocalVideoUrl = null;
      
      // 处理本地视频选择
      function handleLocalVideoSelection(file) {
        if (!file) return;
        
        // 添加调试日志，开始跟踪视频切换过程
        console.log('开始处理本地视频选择:', file.name);
        
        // 验证文件类型
        if (!file.type.startsWith('video/')) {
          window.errorHandler.showError('请选择有效的视频文件');
          return;
        }
        
        // 视频文件大小无限制（已移除100MB的大小限制）
        
        // 显示加载状态
        addStatusMessage('正在加载本地视频...');
        
        // 重置isLoading标志，确保从网络视频切换到本地视频时能正常工作
        isLoading = false;
        
        // 移除之前可能存在的错误监听器，防止切换视频时弹出错误提示
        videoPlayer.onerror = null;
        
        // 清理HLS实例和相关事件监听器，确保从网络视频切换到本地视频时完全隔离
        if (hls) {
          hls.destroy();
          hls = null;
          console.log('已销毁HLS实例，准备加载本地视频');
        }
        if (hlsLoadTimeout) {
          clearTimeout(hlsLoadTimeout);
          hlsLoadTimeout = null;
          console.log('已清除HLS加载超时计时器');
        }
        
        // 释放之前创建的本地视频对象URL，防止内存泄漏和浏览器混淆
        if (previousLocalVideoUrl) {
          URL.revokeObjectURL(previousLocalVideoUrl);
          previousLocalVideoUrl = null;
          console.log('已释放之前的本地视频URL，防止资源混淆');
        }
        
        // 完全重置视频播放器状态 - 增强版
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        videoPlayer.src = '';
        videoPlayer.load(); // 先执行一次空加载，彻底清除当前状态
        console.log('已完全重置视频播放器状态，准备加载新视频');
        
        // 保存当前视频的唯一标识，添加LOCAL_前缀以区分本地和网络视频
        currentVideoId = 'LOCAL_' + file.name;
        
        // 添加更充分的延迟，确保浏览器有足够时间释放旧资源
        setTimeout(() => {
          // 隐藏加载状态
          
          // 创建新的本地视频URL
          const videoURL = URL.createObjectURL(file);
          previousLocalVideoUrl = videoURL;
          
          // 加载视频
          videoPlayer.src = videoURL;
          videoPlayer.load();
          
          // 添加错误恢复机制
          videoPlayer.onerror = function(e) {
            console.error('视频加载错误:', e);
            addStatusMessage('视频加载失败，正在尝试恢复...');
            
            // 尝试恢复策略：重新创建URL并加载
            setTimeout(() => {
              // 再次释放并重新创建URL
              if (previousLocalVideoUrl) {
                URL.revokeObjectURL(previousLocalVideoUrl);
              }
              const recoveryURL = URL.createObjectURL(file);
              previousLocalVideoUrl = recoveryURL;
              
              videoPlayer.src = recoveryURL;
              videoPlayer.load();
              console.log(`尝试恢复视频加载: ${file.name}`);
            }, 300);
          };
          
          // 监听视频加载完成事件
          videoPlayer.onloadeddata = function() {
            console.log(`本地视频 ${file.name} 数据加载完成`);
            
            // 在视频加载完成后立即检查资源一致性
          setTimeout(() => {
            // 发送视频资源更新事件到服务器
            socket.emit('video_resource_update', {
              room: currentRoom,
              videoName: currentVideoId
            });
          }, 500);
          };
          
          // 添加日志以便调试
          console.log(`已加载本地视频 ${file.name}，URL: ${videoURL}`);
        }, 200); // 增加到200毫秒延迟，给浏览器更多时间释放资源
        
        // 添加状态消息
        addStatusMessage(`正在加载本地视频: ${file.name}...`);
        
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
              console.log(`发送视频状态请求到房间 ${currentRoom}`);
              socket.emit('video_state_request', {
                room: currentRoom
              });
              addStatusMessage('正在同步视频进度...');
            }
          }, 1000);
        }
      }
      
      // 初始化本地视频选择功能
      function initLocalVideoSelection() {
        const videoButton = document.getElementById('localVideoButton');
        const videoInput = document.getElementById('localVideoInput');
        
        if (videoButton && videoInput) {
          videoButton.addEventListener('click', () => {
            videoInput.click();
          });
          
          videoInput.addEventListener('change', (e) => {
            handleLocalVideoSelection(e.target.files[0]);
          });
        }
      }
      
      // 移动端按钮功能已移除
      
      // 抽屉系统初始化
      // 抽屉系统已移除
      
      // 格式化视频时间显示
      function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      // 添加聊天消息 - 支持文本和图片消息，确保消息对齐正确
      function addChatMessage(sender, message, isOwn = false, isImage = false) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message');
        if (isOwn) {
          messageEl.classList.add('own');
        }

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
          // 移除内联样式，完全使用CSS类定义的样式
          
          // 图片加载完成后再次滚动到底部，确保图片完整显示
          img.onload = function() {
            // 延迟滚动确保图片完全渲染，解决第一次发送图片滚动不完整的问题
            setTimeout(() => {
              scrollToBottom();
            }, 100);
          };
          
          // 图片点击放大缩小功能
          img.addEventListener('click', () => {
            const overlay = document.createElement('div');
            overlay.classList.add('image-overlay');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '1000';
            
            const largeImg = document.createElement('img');
            largeImg.src = message;
            largeImg.style.maxWidth = '90%';
            largeImg.style.maxHeight = '90%';
            largeImg.style.objectFit = 'contain';
            
            // 点击大图或遮罩层关闭
            overlay.addEventListener('click', () => {
              document.body.removeChild(overlay);
            });
            
            document.body.appendChild(overlay);
            overlay.appendChild(largeImg);
          });
          
          contentEl.appendChild(img);
        } else {
          // 文本消息（支持emoji）
          contentEl.textContent = message;
        }
        
        // 创建消息信息（发送者头像、名字和时间）
        const infoEl = document.createElement('div');
        infoEl.classList.add('message-info');
        
        const senderEl = document.createElement('span');
        senderEl.classList.add('message-sender');
        
        // 创建小头像 - 为所有消息（包括自己发送的）都添加头像
        const avatarEl = document.createElement('span');
        avatarEl.classList.add('message-avatar');
        
        // 检查发送者是否有自定义头像
        let customAvatar = null;
        if (sender === username) {
          // 当前用户，优先使用内存中的最新头像数据
          customAvatar = window.currentUserAvatar || loadAvatarFromLocalStorage();
        } else {
          // 其他用户，优先使用内存中的头像缓存
          customAvatar = window.avatarCache && window.avatarCache[sender];
          if (!customAvatar) {
            // 如果内存中没有，尝试从用户列表中查找自定义头像
            const userItems = document.querySelectorAll('#usersList li');
            for (let item of userItems) {
              const usernameElement = item.querySelector('.user-name-text');
              if (usernameElement && usernameElement.textContent === sender) {
                const avatarElement = item.querySelector('.user-avatar img');
                if (avatarElement) {
                  customAvatar = avatarElement.src;
                  // 缓存到内存中，下次直接使用
                  if (!window.avatarCache) window.avatarCache = {};
                  window.avatarCache[sender] = customAvatar;
                }
                break;
              }
            }
          }
        }
        
        if (customAvatar) {
          // 显示自定义头像
          const img = document.createElement('img');
          img.src = customAvatar;
          img.style.cssText = `
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
          `;
          avatarEl.appendChild(img);
        } else {
          // 使用默认头像（首字母）
          // 设置头像文字（首字母或首字）
          const initial = sender.charAt(0).toUpperCase();
          avatarEl.textContent = initial;
          // 设置头像颜色
          if (!userColors[sender]) {
            // 如果用户还没有颜色，分配一个基于用户名的固定颜色
            userColors[sender] = getUsernameColor(sender);
          }
          avatarEl.style.backgroundColor = userColors[sender];
        }
        
        // 将头像添加到发送者元素前
        senderEl.appendChild(avatarEl);
        
        // 设置发送者名字
        const senderText = document.createTextNode(sender);
        senderEl.appendChild(senderText);
        
        const timeEl = document.createElement('span');
        timeEl.classList.add('message-time');
        timeEl.textContent = time;
        
        // 将时间添加到发送者元素内部，确保它们在同一行
        senderEl.appendChild(timeEl);
        
        // 添加到信息元素
        infoEl.appendChild(senderEl);
        
        // 组装消息元素
        messageEl.appendChild(contentEl);
        messageEl.appendChild(infoEl);

        chatMessages.appendChild(messageEl);
        
        // 应用当前样式设置到新消息
        // 确保使用全局作用域的currentSettings
        const globalSettings = window.currentSettings || currentSettings;
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
        
        // 优化的自动滚动到底部功能
        scrollToBottom();
        
        // 在全屏模式下，接收到消息或发送消息时自动显示聊天对话框
        setTimeout(() => {
          // 检查是否处于全屏模式
          const isFullscreen = !!(document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement);
          // 检查是否处于页面全屏模式
          const isPageFullscreen = videoContainer.classList.contains('page-fullscreen');
          // 检查是否处于旋转全屏模式
          const isRotateFullscreen = videoContainer.classList.contains('rotate-fullscreen');
          
          // 如果处于全屏、页面全屏或旋转全屏模式
          if (isFullscreen || isPageFullscreen || isRotateFullscreen) {
            const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
            const collapseButton = document.getElementById('fullscreenChatCollapseButton');
            
            if (fullscreenChatPanel && collapseButton) {
              // 检查聊天面板是否被折叠
              const isCollapsed = fullscreenChatPanel.dataset.collapsed === 'true';
              
              if (isCollapsed) {
                // 展开聊天面板
                fullscreenChatPanel.style.height = '200px';
                fullscreenChatPanel.dataset.collapsed = 'false';
                collapseButton.innerText = '▼';
                
                // 添加自动展开标记，用于区分自动展开和手动展开
                fullscreenChatPanel.dataset.autoExpanded = 'true';
                
                // 显示折叠按钮
                collapseButton.style.display = 'flex';
                
                // 展开后滚动到底部
                setTimeout(() => {
                  if (window.scrollToBottomForFullscreen) {
                    window.scrollToBottomForFullscreen(false);
                  }
                }, 300); // 等待动画完成后再滚动
                
                // 10秒后自动隐藏面板（仅当面板是自动展开的时）
                // 清除之前可能存在的计时器
                if (window.autoHideTimer) {
                  clearTimeout(window.autoHideTimer);
                }
                
                window.autoHideTimer = setTimeout(() => {
                  // 再次检查是否处于全屏模式
                  const stillFullscreen = !!(document.fullscreenElement || 
                                         document.webkitFullscreenElement || 
                                         document.mozFullScreenElement || 
                                         document.msFullscreenElement);
                  const stillPageFullscreen = videoContainer.classList.contains('page-fullscreen');
                  const stillRotateFullscreen = videoContainer.classList.contains('rotate-fullscreen');
                  
                  // 只有在全屏、页面全屏或旋转全屏模式下，并且面板已经展开，并且是自动展开的情况下才自动隐藏
                  if ((stillFullscreen || stillPageFullscreen || stillRotateFullscreen) && 
                      fullscreenChatPanel.dataset.collapsed === 'false' && 
                      fullscreenChatPanel.dataset.autoExpanded === 'true') {
                    // 折叠聊天面板
                    fullscreenChatPanel.style.height = '0px';
                    fullscreenChatPanel.style.padding = '0px 10px';
                    fullscreenChatPanel.dataset.collapsed = 'true';
                    collapseButton.innerText = '▲';
                    
                    // 清除自动展开标记
                    delete fullscreenChatPanel.dataset.autoExpanded;
                  }
                }, 10000); // 10秒
              }
            }
          }
        }, 10);
      }
      
      // 平滑滚动到底部的函数
      function scrollToBottom() {
        // 总是滚动到底部，无论用户当前滚动位置
        // 使用平滑滚动，如果浏览器支持的话
        if (chatMessages.scrollTo) {
          chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          // 降级方案：直接设置 scrollTop
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }

      // 通用弹窗显示函数，确保正确居中 - 强化版本
      function showModal(modalElement) {
        if (modalElement) {
          // 强制设置弹窗为flex布局并居中
          modalElement.style.display = 'flex';
          modalElement.style.alignItems = 'center';
          modalElement.style.justifyContent = 'center';
          modalElement.style.position = 'fixed';
          modalElement.style.top = '0';
          modalElement.style.left = '0';
          modalElement.style.width = '100%';
          modalElement.style.height = '100%';
          modalElement.style.zIndex = '1000';
          
          console.log('显示弹窗:', modalElement.id);
        }
      }
      
      // 通用弹窗隐藏函数
      function hideModal(modalElement) {
        if (modalElement) {
          modalElement.style.display = 'none';
          console.log('隐藏弹窗:', modalElement.id);
        }
      }
      
      // 关闭弹窗
      function closeModal() {
        hideModal(roomModal);
        videoContainer.style.display = 'block';
        
        // 初始化视频播放器
        initVideoPlayer();
        
        // 始终显示右下角的小房子图标
        const roomIconButton = document.getElementById('roomIconButton');
        if (roomIconButton) {
          roomIconButton.style.display = 'flex';
        }
      }

      // 生成基于用户名的固定颜色 - 确保不同客户端看到相同用户的颜色一致
      function getUsernameColor(username) {
        const colors = [
          '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
          '#1abc9c', '#e67e22', '#95a5a6', '#34495e', '#16a085',
          '#f1c40f', '#d35400', '#c0392b', '#8e44ad', '#2c3e50'
        ];
        
        // 基于用户名生成一个固定的索引
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
          hash = username.charCodeAt(i) + ((hash << 5) - hash);
          hash = hash & hash; // 转换为32位整数
        }
        
        // 使用哈希值选择颜色，确保相同用户名总是得到相同的颜色
        const index = Math.abs(hash) % colors.length;
        return colors[index];
      }
      
      // 保存用户名和颜色的映射关系
      const userColors = {};
      
      // 上下文菜单相关变量
      let currentContextMenu = null;
      let currentTargetUser = null;
      let isHost = false; // 当前用户是否是房主
      
      // 创建右键菜单DOM元素
      function createContextMenu() {
        // 检查是否已经创建了菜单
        if (document.getElementById('userContextMenu')) {
          return document.getElementById('userContextMenu');
        }
        
        const menu = document.createElement('div');
        menu.id = 'userContextMenu';
        menu.className = 'context-menu';
        
        // 创建菜单项
        const menuItems = [
          {
            id: 'viewAvatar',
            text: '查看头像'
          },
          {
            id: 'transferHost',
            text: '转让房主',
            isHostOnly: true
          },
          {
            id: 'atUser',
            text: '@TA'
          }
        ];
        
        // 添加菜单项
        menuItems.forEach(item => {
          const menuItem = document.createElement('div');
          menuItem.id = `menu-${item.id}`;
          menuItem.className = 'context-menu-item';
          menuItem.textContent = item.text;
          
          // 根据当前用户权限设置菜单项可用性
          if (item.isHostOnly) {
            menuItem.dataset.hostOnly = 'true';
          }
          
          // 添加点击事件
          menuItem.addEventListener('click', function() {
            handleContextMenuAction(item.id);
          });
          
          menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        return menu;
      }
      
      // 创建上下文菜单容器
      function createUserContextMenu() {
        // 检查是否已存在上下文菜单
        let menu = document.getElementById('userContextMenu');
        if (!menu) {
          // 创建菜单容器
          menu = document.createElement('div');
          menu.id = 'userContextMenu';
          menu.className = 'context-menu';
          menu.style.display = 'none';
          
          // 创建查看头像选项
          const viewAvatarOption = document.createElement('div');
          viewAvatarOption.id = 'viewAvatarOption';
          viewAvatarOption.className = 'context-menu-item';
          viewAvatarOption.textContent = '查看头像';
          
          // 添加转让房主选项
          const transferHostOption = document.createElement('div');
          transferHostOption.id = 'transferHostOption';
          transferHostOption.className = 'context-menu-item';
          transferHostOption.textContent = '转让房主';
          
          // 创建@用户选项
          const atUserOption = document.createElement('div');
          atUserOption.id = 'atUserOption';
          atUserOption.className = 'context-menu-item';
          atUserOption.textContent = '@ 用户';
          
          // 添加统一的点击事件处理
          const menuItems = [viewAvatarOption, transferHostOption, atUserOption];
          menuItems.forEach(function(item) {
            item.addEventListener('click', function() {
              if (currentTargetUser && currentTargetUser.username) {
                const actionId = item.id.replace('Option', '');
                handleContextMenuAction(actionId);
                hideUserContextMenu();
              }
            });
            
            // 添加到菜单
            menu.appendChild(item);
          });
          
          // 添加到文档
          document.body.appendChild(menu);
          
          // 点击文档其他地方隐藏菜单
          document.addEventListener('click', function hideMenuOnClick() {
            if (document.getElementById('userContextMenu')) {
              hideUserContextMenu();
            }
          });
          
          // 阻止菜单内部点击事件冒泡
          menu.addEventListener('click', function(e) {
            e.stopPropagation();
          });
        }
        return menu;
      }
      
      // 隐藏用户上下文菜单
      function hideUserContextMenu() {
        const menu = document.getElementById('userContextMenu');
        if (menu) {
          menu.style.display = 'none';
        }
      }
      
      // 显示用户右键菜单
      function showUserContextMenu(x, y, user) {
        // 保存当前目标用户
        currentTargetUser = user;
        
        // 创建或获取菜单
        const menu = createUserContextMenu();
        
        // 获取菜单项
        const transferHostOption = document.getElementById('transferHostOption');
        
        // 根据用户权限更新菜单项状态
        if (isHost && user && user.username && user.username !== username) {
          // 房主可以看到并使用转让选项
          if (transferHostOption) {
            transferHostOption.style.display = 'block';
            transferHostOption.style.opacity = '1';
            transferHostOption.style.pointerEvents = 'auto';
          }
        } else {
          // 非房主用户或点击自己时，隐藏转让选项
          if (transferHostOption) {
            transferHostOption.style.display = 'none';
          }
        }
        
        // 获取菜单尺寸
        menu.style.display = 'block'; // 临时显示以获取尺寸
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        menu.style.display = 'none'; // 隐藏菜单
        
        // 计算菜单位置，确保不超出浏览器窗口
        let left = x;
        let top = y;
        
        // 检查是否超出右边界
        if (left + menuWidth > window.innerWidth) {
          left = window.innerWidth - menuWidth;
        }
        
        // 检查是否超出下边界
        if (top + menuHeight > window.innerHeight) {
          top = window.innerHeight - menuHeight;
        }
        
        // 确保位置不小于0
        left = Math.max(0, left);
        top = Math.max(0, top);
        
        // 设置最终位置
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.display = 'block';
        
        // 保存当前菜单引用
        currentContextMenu = menu;
        
        // 添加点击其他地方关闭菜单的事件
        setTimeout(() => {
          document.addEventListener('click', closeContextMenu);
        }, 0);
      }
      
      // 关闭右键菜单
      function closeContextMenu() {
        if (currentContextMenu) {
          currentContextMenu.style.display = 'none';
          currentContextMenu = null;
          currentTargetUser = null;
        }
        // 移除事件监听器
        document.removeEventListener('click', closeContextMenu);
      }
      
      // 处理右键菜单操作
      function handleContextMenuAction(action) {
        if (!currentTargetUser) return;
        
        switch (action) {
          case 'viewAvatar':
            // 查看头像功能
            showUserAvatar(currentTargetUser);
            break;
          case 'transferHost':
            // 转让房主功能
            if (isHost && currentTargetUser.username !== username) {
              transferHostTo(currentTargetUser.username);
            }
            break;
          case 'atUser':
            // @用户功能
            atUser(currentTargetUser.username);
            break;
        }
        
        // 关闭菜单
        closeContextMenu();
      }
      
      // 显示用户头像
      function showUserAvatar(user) {
        // 创建头像弹窗
        const avatarModal = document.createElement('div');
        avatarModal.className = 'modal';
        avatarModal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        `;
        
        const avatarContent = document.createElement('div');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        avatarContent.style.cssText = `
          background-color: ${isDarkTheme ? '#333' : 'white'};
          padding: 30px;
          border-radius: 10px;
          text-align: center;
          box-shadow: 0 5px 20px rgba(0,0,0,0.3);
          position: relative;
          max-width: 90%;
          width: 400px;
        `;
        
        // 创建大头像
        const largeAvatar = document.createElement('div');
        let avatarColor = userColors[user.username] || '#007bff';
        
        // 检查是否有自定义头像
        let customAvatar = null;
        if (user.username === username) {
          // 当前用户，检查本地存储
          customAvatar = loadAvatarFromLocalStorage();
        } else {
          // 其他用户，使用传入的自定义头像数据
          customAvatar = user.customAvatar;
        }
        
        largeAvatar.style.cssText = `
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background-color: ${avatarColor};
          color: white;
          font-size: 60px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        `;
        
        if (customAvatar) {
          // 显示自定义头像
          const img = document.createElement('img');
          img.src = customAvatar;
          img.style.cssText = `
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
          `;
          largeAvatar.appendChild(img);
        } else {
          // 使用默认头像（用户名首字母）
          largeAvatar.textContent = user.username.charAt(0).toUpperCase();
        }
        
        // 创建用户名
        const usernameDisplay = document.createElement('div');
        usernameDisplay.style.cssText = `
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
          color: ${isDarkTheme ? '#e0e0e0' : '#333'};
        `;
        usernameDisplay.textContent = user.username;
        
        // 创建状态信息
        const statusInfo = document.createElement('div');
        statusInfo.style.cssText = `
          font-size: 16px;
          margin-bottom: 20px;
          color: ${isDarkTheme ? '#ccc' : '#666'};
        `;
        statusInfo.textContent = user.isReady ? '已准备' : '未准备';
        
        // 如果是房主，添加房主标识
        if (user.isHost) {
          const hostBadge = document.createElement('span');
          hostBadge.style.cssText = `
            background-color: #e74c3c;
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            margin-left: 10px;
          `;
          hostBadge.textContent = '房主';
          usernameDisplay.appendChild(hostBadge);
        }
        
        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
        `;
        
        // 创建关闭按钮
        const closeButton = document.createElement('button');
        closeButton.style.cssText = `
          padding: 8px 20px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        `;
        closeButton.textContent = '关闭';
        closeButton.addEventListener('click', function() {
          document.body.removeChild(avatarModal);
        });
        
        // 如果是当前用户，添加上传头像按钮
        let uploadButton = null;
        if (user.username === username) {
          uploadButton = document.createElement('button');
          uploadButton.style.cssText = `
            padding: 8px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          `;
          uploadButton.textContent = '上传头像';
          uploadButton.addEventListener('click', function() {
            // 关闭当前弹窗
            document.body.removeChild(avatarModal);
            // 显示上传头像弹窗
            showUploadAvatarModal();
          });
          
          buttonContainer.appendChild(uploadButton);
        }
        
        buttonContainer.appendChild(closeButton);
        
        // 组装弹窗内容
        avatarContent.appendChild(largeAvatar);
        avatarContent.appendChild(usernameDisplay);
        avatarContent.appendChild(statusInfo);
        avatarContent.appendChild(buttonContainer);
        avatarModal.appendChild(avatarContent);
        
        // 添加点击背景关闭弹窗
        avatarModal.addEventListener('click', function(e) {
          if (e.target === avatarModal) {
            document.body.removeChild(avatarModal);
          }
        });
        
        document.body.appendChild(avatarModal);
      }
      
      // 显示上传头像弹窗
      function showUploadAvatarModal() {
        // 创建上传头像弹窗
        const uploadModal = document.createElement('div');
        uploadModal.className = 'modal';
        uploadModal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        `;
        
        const uploadContent = document.createElement('div');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        uploadContent.style.cssText = `
          background-color: ${isDarkTheme ? '#333' : 'white'};
          padding: 30px;
          border-radius: 10px;
          text-align: center;
          box-shadow: 0 5px 20px rgba(0,0,0,0.3);
          position: relative;
          max-width: 90%;
          width: 500px;
        `;
        
        // 创建标题
        const title = document.createElement('h2');
        title.textContent = '上传头像';
        title.style.cssText = `
          margin-top: 0;
          margin-bottom: 20px;
          color: ${isDarkTheme ? '#e0e0e0' : '#333'};
        `;
        
        // 创建文件选择区域
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.cssText = `
          display: none;
        `;
        
        const fileLabel = document.createElement('label');
        fileLabel.style.cssText = `
          display: block;
          padding: 15px;
          border: 2px dashed ${isDarkTheme ? '#555' : '#ccc'};
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 20px;
          transition: border-color 0.3s;
        `;
        fileLabel.textContent = '点击选择图片或拖拽图片到此处';
        
        // 添加点击事件触发文件选择
        fileLabel.addEventListener('click', function() {
          fileInput.click();
        });
        
        fileLabel.addEventListener('dragover', function(e) {
          e.preventDefault();
          fileLabel.style.borderColor = '#007bff';
        });
        
        fileLabel.addEventListener('dragleave', function(e) {
          e.preventDefault();
          fileLabel.style.borderColor = isDarkTheme ? '#555' : '#ccc';
        });
        
        fileLabel.addEventListener('drop', function(e) {
          e.preventDefault();
          fileLabel.style.borderColor = isDarkTheme ? '#555' : '#ccc';
          if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect(e.dataTransfer.files[0]);
          }
        });
        
        fileInput.addEventListener('change', function() {
          if (fileInput.files.length) {
            handleFileSelect(fileInput.files[0]);
          }
        });
        
        // 创建预览区域容器
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
          position: relative;
          width: 200px;
          height: 200px;
          margin: 0 auto 20px;
          overflow: hidden;
          border-radius: 50%;
          border: 2px solid ${isDarkTheme ? '#555' : '#ccc'};
        `;
        
        // 创建预览图像
        const previewImage = document.createElement('img');
        previewImage.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: none;
          max-height: none;
          display: none;
        `;
        
        // 创建默认头像占位符
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: ${isDarkTheme ? '#444' : '#f0f0f0'};
          color: ${isDarkTheme ? '#ccc' : '#666'};
          font-size: 16px;
        `;
        placeholder.textContent = '预览区域';
        
        previewContainer.appendChild(placeholder);
        previewContainer.appendChild(previewImage);
        
        // 创建裁剪提示信息
        const cropInfo = document.createElement('div');
        cropInfo.style.cssText = `
          font-size: 14px;
          color: ${isDarkTheme ? '#ccc' : '#666'};
          margin-bottom: 20px;
        `;
        cropInfo.textContent = '提示：可以通过鼠标拖拽和滚轮来调整头像';
        
        // 创建操作提示
        const operationInfo = document.createElement('div');
        operationInfo.style.cssText = `
          font-size: 12px;
          color: ${isDarkTheme ? '#999' : '#999'};
          margin-bottom: 20px;
          text-align: left;
        `;
        operationInfo.innerHTML = `
          <p>操作说明：</p>
          <ul style="text-align: left; padding-left: 20px;">
            <li>鼠标拖拽：移动头像位置</li>
            <li>鼠标滚轮：缩放头像大小</li>
          </ul>
        `;
        
        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
          display: flex;
          justify-content: center;
          gap: 10px;
        `;
        
        // 创建取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.style.cssText = `
          padding: 8px 20px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        `;
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', function() {
          document.body.removeChild(uploadModal);
        });
        
        // 创建上传按钮
        const uploadButton = document.createElement('button');
        uploadButton.style.cssText = `
          padding: 8px 20px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          display: none; // 默认隐藏，选择图片后显示
        `;
        uploadButton.textContent = '上传';
        uploadButton.addEventListener('click', function() {
          if (previewImage.src) {
            // 根据预览区域的调整生成裁剪后的图像
            const croppedAvatar = getCroppedAvatar(previewImage, previewContainer);
            
            // 保存头像到本地存储
            saveAvatarToLocalStorage(croppedAvatar);
            // 关闭弹窗
            document.body.removeChild(uploadModal);
            // 显示成功提示
            showBottomToast('头像上传成功', 2000);
            // 更新用户列表中的头像
            updateUserAvatarInList(username, croppedAvatar);
            // 向房间内其他用户发送头像更新通知
            if (currentRoom) {
              socket.emit('avatar_update', {
                room: currentRoom,
                username: username,
                avatar: croppedAvatar
              });
            }
            
            // 增加检测逻辑：同步所有使用到头像的地方
            setTimeout(() => {
              syncAvatarAcrossAllPlaces(username, croppedAvatar);
            }, 100);
          }
        });
        
        // 组装弹窗内容
        uploadContent.appendChild(title);
        uploadContent.appendChild(fileInput);
        uploadContent.appendChild(fileLabel);
        uploadContent.appendChild(previewContainer);
        uploadContent.appendChild(cropInfo);
        uploadContent.appendChild(operationInfo);
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(uploadButton);
        uploadContent.appendChild(buttonContainer);
        uploadModal.appendChild(uploadContent);
        
        // 添加点击背景关闭弹窗
        uploadModal.addEventListener('click', function(e) {
          if (e.target === uploadModal) {
            document.body.removeChild(uploadModal);
          }
        });
        
        document.body.appendChild(uploadModal);
        
        // 处理文件选择
        function handleFileSelect(file) {
          if (!file || !file.type.startsWith('image/')) {
            window.errorHandler.showError('请选择有效的图片文件');
            return;
          }
          
          // 检查文件大小（限制为2MB）
          if (file.size > 2 * 1024 * 1024) {
            window.errorHandler.showError('图片大小不能超过2MB');
            return;
          }
          
          // 检测是否为GIF动态图
          const isGif = file.type === 'image/gif';
          
          const reader = new FileReader();
          reader.onload = function(e) {
            // 显示预览图像
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
            placeholder.style.display = 'none';
            uploadButton.style.display = 'block';
            
            // 设置初始变换，使图像居中并适当缩放
            previewImage.style.transform = 'translate(-50%, -50%) scale(1)';
            
            // 如果是GIF，隐藏操作说明并禁用拖拽缩放
            if (isGif) {
              operationInfo.style.display = 'none';
              cropInfo.textContent = '检测到GIF动态图，将保留动画效果';
              cropInfo.style.color = '#28a745';
            } else {
              operationInfo.style.display = 'block';
              cropInfo.textContent = '提示：可以通过鼠标拖拽和滚轮来调整头像';
              cropInfo.style.color = isDarkTheme ? '#ccc' : '#666';
              // 添加拖拽和缩放功能
              addImageManipulation(previewImage, previewContainer);
            }
            
            // 存储文件类型信息供后续使用
            previewImage.dataset.fileType = file.type;
          };
          reader.readAsDataURL(file);
        }
        
        // 添加图像操作功能（拖拽和缩放）
        function addImageManipulation(image, container) {
          let isDragging = false;
          let startX, startY, startTranslateX, startTranslateY;
          let scale = 1;
          const minScale = 0.5;
          const maxScale = 3;
          
          // 获取当前变换值
          function getTransformValues() {
            const transform = image.style.transform;
            const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^,]+)px\)/);
            const scaleMatch = transform.match(/scale\(([^,]+)\)/);
            
            return {
              translateX: translateMatch ? parseFloat(translateMatch[1]) : -50,
              translateY: translateMatch ? parseFloat(translateMatch[2]) : -50,
              scale: scaleMatch ? parseFloat(scaleMatch[1]) : 1
            };
          }
          
          // 设置变换值
          function setTransform(translateX, translateY, scale) {
            image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
          }
          
          // 鼠标按下事件
          image.addEventListener('mousedown', function(e) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const transformValues = getTransformValues();
            startTranslateX = transformValues.translateX;
            startTranslateY = transformValues.translateY;
            
            image.style.cursor = 'grabbing';
            e.preventDefault();
          });
          
          // 鼠标移动事件
          document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            const newTranslateX = startTranslateX + dx;
            const newTranslateY = startTranslateY + dy;
            
            setTransform(newTranslateX, newTranslateY, scale);
          });
          
          // 鼠标释放事件
          document.addEventListener('mouseup', function() {
            isDragging = false;
            image.style.cursor = 'grab';
          });
          
          // 鼠标滚轮事件（缩放）
          container.addEventListener('wheel', function(e) {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            scale = Math.min(maxScale, Math.max(minScale, scale + delta));
            
            const transformValues = getTransformValues();
            setTransform(transformValues.translateX, transformValues.translateY, scale);
          });
          
          // 设置初始光标样式
          image.style.cursor = 'grab';
        }
      }
      
      // 根据预览区域的调整生成裁剪后的图像
      function getCroppedAvatar(image, container) {
        // 检查是否为GIF动态图
        const fileType = image.dataset.fileType || 'image/jpeg';
        const isGif = fileType === 'image/gif';
        
        // 如果是GIF动态图，直接返回原图，跳过Canvas裁剪以保持动画效果
        if (isGif) {
          return image.src;
        }
        
        // 对于静态图片，使用现有的Canvas裁剪逻辑
        // 创建canvas用于裁剪图像
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置canvas大小为头像容器大小
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        
        // 获取图像在预览区域中的实际边界框
        // 使用getBoundingClientRect来获取图像的实际位置和尺寸
        const containerRect = container.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        
        // 计算图像相对于容器的位置
        const relativeX = imageRect.left - containerRect.left;
        const relativeY = imageRect.top - containerRect.top;
        
        // 获取图像的自然尺寸
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;
        
        // 计算缩放比例
        const scaleX = imageRect.width / naturalWidth;
        const scaleY = imageRect.height / naturalHeight;
        
        // 在canvas上绘制图像，使用与预览区域完全相同的位置和尺寸
        ctx.drawImage(
          image,
          0, 0, naturalWidth, naturalHeight,  // 源图像的完整区域
          relativeX, relativeY, imageRect.width, imageRect.height  // 目标位置和尺寸
        );
        
        // 返回裁剪后的图像数据URL
        return canvas.toDataURL('image/jpeg', 0.8);
      }
      
      // 保存头像到本地存储
      function saveAvatarToLocalStorage(avatarDataUrl) {
        try {
          localStorage.setItem(`avatar_${username}`, avatarDataUrl);
        } catch (e) {
          console.error('保存头像到本地存储失败:', e);
        }
      }
      
      // 从本地存储加载头像
      function loadAvatarFromLocalStorage(targetUsername) {
        // 如果没有指定用户名，则加载当前用户的头像
        const usernameToLoad = targetUsername || username;
        try {
          return localStorage.getItem(`avatar_${usernameToLoad}`);
        } catch (e) {
          console.error(`从本地存储加载用户 ${usernameToLoad} 的头像失败:`, e);
          return null;
        }
      }
      
      // 更新用户列表中的头像
      function updateUserAvatarInList(username, avatarDataUrl) {
        // 查找用户列表中对应的用户项
        const userItems = document.querySelectorAll('#usersList li');
        userItems.forEach(item => {
          const usernameElement = item.querySelector('.user-name-text');
          if (usernameElement && usernameElement.textContent === username) {
            const avatarElement = item.querySelector('.user-avatar');
            if (avatarElement) {
              // 移除原有内容
              avatarElement.textContent = '';
              if (avatarDataUrl) {
                // 创建图像元素
                const img = document.createElement('img');
                img.src = avatarDataUrl;
                img.style.cssText = `
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  object-fit: cover;
                `;
                avatarElement.appendChild(img);
              } else {
                // 显示默认头像（首字母）
                const initial = username.charAt(0).toUpperCase();
                avatarElement.textContent = initial;
                // 设置背景色
                if (!userColors[username]) {
                  userColors[username] = getUsernameColor(username);
                }
                avatarElement.style.backgroundColor = userColors[username];
              }
            }
          }
        });
      }
      
      // 更新聊天消息中的头像
      function updateChatAvatar(username, avatarDataUrl) {
        // 查找所有该用户的聊天消息（包括普通模式和全屏模式）
        const messageElements = document.querySelectorAll('.message');
        
        // 查找全屏模式下的聊天消息
        const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
        let fullscreenMessageElements = [];
        if (fullscreenChatPanel) {
          fullscreenMessageElements = fullscreenChatPanel.querySelectorAll('.message');
        }
        
        // 合并所有消息元素
        const allMessageElements = [...messageElements, ...fullscreenMessageElements];
        
        allMessageElements.forEach(messageElement => {
          const senderElement = messageElement.querySelector('.message-sender');
          if (senderElement) {
            // 获取发送者文本节点内容（排除时间元素）
            let senderName = '';
            for (let node of senderElement.childNodes) {
              // 只获取文本节点且不是时间元素
              if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() && !node.parentElement?.classList?.contains('message-time')) {
                senderName = node.textContent.trim();
                break;
              }
            }
            
            // 检查发送者是否匹配
            if (senderName === username) {
              const avatarElement = senderElement.querySelector('.message-avatar');
              if (avatarElement) {
                // 清空原有内容
                avatarElement.innerHTML = '';
                if (avatarDataUrl) {
                  // 创建图像元素
                  const img = document.createElement('img');
                  img.src = avatarDataUrl;
                  img.style.cssText = `
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                  `;
                  avatarElement.appendChild(img);
                } else {
                  // 显示默认头像（首字母）
                  const initial = username.charAt(0).toUpperCase();
                  avatarElement.textContent = initial;
                  // 设置背景色
                  if (!userColors[username]) {
                    userColors[username] = getUsernameColor(username);
                  }
                  avatarElement.style.backgroundColor = userColors[username];
                }
              }
            }
          }
        });
      }
      
      // 同步头像到所有使用到的地方
      function syncAvatarAcrossAllPlaces(username, avatarDataUrl) {
        console.log(`同步头像到所有地方: ${username}`, avatarDataUrl);
        
        // 更新内存缓存中的头像数据
        if (username === window.username) {
          window.currentUserAvatar = avatarDataUrl;
        } else {
          if (!window.avatarCache) window.avatarCache = {};
          window.avatarCache[username] = avatarDataUrl;
        }
        
        // 更新用户列表中的头像
        updateUserAvatarInList(username, avatarDataUrl);
        
        // 更新聊天消息中的头像
        updateChatAvatar(username, avatarDataUrl);
        
        // 检测并更新可能遗漏的地方
        setTimeout(() => {
          // 再次检查用户列表
          const userItems = document.querySelectorAll('#usersList li');
          userItems.forEach(item => {
            const usernameElement = item.querySelector('.user-name-text');
            if (usernameElement && usernameElement.textContent === username) {
              const avatarElement = item.querySelector('.user-avatar img');
              // 如果有新的头像数据且与当前显示的不一致，则更新
              if (avatarDataUrl && avatarElement && avatarElement.src !== avatarDataUrl) {
                // 更新不一致的头像
                avatarElement.src = avatarDataUrl;
              }
              // 如果没有新的头像数据但当前显示的是图片，则移除图片显示默认头像
              if (!avatarDataUrl && avatarElement) {
                // 移除图片元素，显示默认头像
                const parent = avatarElement.parentElement;
                parent.removeChild(avatarElement);
                // 设置默认头像文字（首字母）
                const initial = username.charAt(0).toUpperCase();
                parent.textContent = initial;
                // 设置背景色
                if (!userColors[username]) {
                  userColors[username] = getUsernameColor(username);
                }
                parent.style.backgroundColor = userColors[username];
              }
            }
          });
          
          // 再次检查聊天消息
          const messageElements = document.querySelectorAll('.message');
          messageElements.forEach(messageElement => {
            const senderElement = messageElement.querySelector('.message-sender');
            if (senderElement) {
              // 获取发送者名字
              let senderName = '';
              for (let node of senderElement.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                  senderName = node.textContent.trim();
                  break;
                }
              }
              
              // 检查发送者是否匹配
              if (senderName === username) {
                const avatarElement = senderElement.querySelector('.message-avatar img');
                // 如果有新的头像数据且与当前显示的不一致，则更新
                if (avatarDataUrl && avatarElement && avatarElement.src !== avatarDataUrl) {
                  // 更新不一致的头像
                  avatarElement.src = avatarDataUrl;
                }
                // 如果没有新的头像数据但当前显示的是图片，则移除图片显示默认头像
                if (!avatarDataUrl && avatarElement) {
                  // 移除图片元素，显示默认头像
                  const parent = avatarElement.parentElement;
                  parent.removeChild(avatarElement);
                  // 设置默认头像文字（首字母）
                  const initial = username.charAt(0).toUpperCase();
                  parent.textContent = initial;
                  // 设置背景色
                  if (!userColors[username]) {
                    userColors[username] = getUsernameColor(username);
                  }
                  parent.style.backgroundColor = userColors[username];
                }
              }
            }
          });
        }, 500);
      }
      
      // 创建转让房主确认弹窗
      function createTransferHostModal() {
        // 检查是否已经创建了弹窗
        if (document.getElementById('transferHostModal')) {
          return document.getElementById('transferHostModal');
        }
        
        const modal = document.createElement('div');
        modal.id = 'transferHostModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.zIndex = '1000';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.backgroundColor = 'var(--bg-secondary)';
        modalContent.style.margin = '12% auto'; /* 缩小顶部边距从15%到12% */
        modalContent.style.padding = '18px'; /* 缩小内边距从20px到18px */
        modalContent.style.border = '1px solid var(--border-color)';
        modalContent.style.borderRadius = 'var(--border-radius-medium)';
        modalContent.style.width = '75%'; /* 缩小宽度比例从80%到75% */
        modalContent.style.maxWidth = '360px'; /* 缩小最大宽度从400px到360px */
        
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.style.padding = '10px 0';
        modalHeader.style.borderBottom = '1px solid var(--border-color)';
        
        const modalTitle = document.createElement('h2');
        modalTitle.textContent = '转让房主身份';
        modalTitle.style.margin = '0';
        modalTitle.style.color = 'var(--text-primary)';
        
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.style.padding = '20px 0';
        
        const modalMessage = document.createElement('p');
        modalMessage.id = 'transferHostMessage';
        modalMessage.style.color = 'var(--text-primary)';
        
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        modalFooter.style.padding = '10px 0';
        modalFooter.style.textAlign = 'right';
        
        const cancelButton = document.createElement('button');
        cancelButton.id = 'cancelTransferHost';
        cancelButton.className = 'btn';
        cancelButton.textContent = '取消';
        cancelButton.style.backgroundColor = 'var(--button-background)';
        cancelButton.style.color = 'var(--button-text-color)';
        cancelButton.style.border = '1px solid var(--button-border)';
        cancelButton.style.padding = '8px 16px';
        cancelButton.style.marginRight = '10px';
        cancelButton.style.borderRadius = 'var(--border-radius-small)';
        cancelButton.style.cursor = 'pointer';
        
        const confirmButton = document.createElement('button');
        confirmButton.id = 'confirmTransferHost';
        confirmButton.className = 'btn';
        confirmButton.textContent = '确认';
        confirmButton.style.backgroundColor = 'var(--button-ready-bg)';
        confirmButton.style.color = 'white';
        confirmButton.style.border = 'none';
        confirmButton.style.padding = '8px 16px';
        confirmButton.style.borderRadius = 'var(--border-radius-small)';
        confirmButton.style.cursor = 'pointer';
        
        modalHeader.appendChild(modalTitle);
        modalBody.appendChild(modalMessage);
        modalFooter.appendChild(cancelButton);
        modalFooter.appendChild(confirmButton);
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // 添加事件监听
        cancelButton.addEventListener('click', function() {
          hideTransferHostModal();
        });
        
        modal.addEventListener('click', function(event) {
          if (event.target === modal) {
            hideTransferHostModal();
          }
        });
        
        return modal;
      }
      
      // 显示转让房主确认弹窗
      function showTransferHostModal(targetUsername) {
        const modal = createTransferHostModal();
        const message = document.getElementById('transferHostMessage');
        const confirmButton = document.getElementById('confirmTransferHost');
        
        if (message) {
          message.textContent = `确定要将房主身份转让给 ${targetUsername} 吗？`;
        }
        
        // 更新确认按钮的点击事件
        if (confirmButton) {
          // 移除之前的事件监听器
          const newConfirmButton = confirmButton.cloneNode(true);
          confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
          
          // 添加新的事件监听器
          newConfirmButton.addEventListener('click', function() {
            // 执行转让操作
            if (currentRoom && socket && socket.connected) {
              socket.emit('transfer_host', {
                room: currentRoom,
                targetUsername: targetUsername
              });
              addStatusMessage(`正在将房主身份转让给 ${targetUsername}...`);
              hideTransferHostModal();
            }
          });
        }
        
        modal.style.display = 'flex';
      }
      
      // 隐藏转让房主确认弹窗
      function hideTransferHostModal() {
        const modal = document.getElementById('transferHostModal');
        if (modal) {
          modal.style.display = 'none';
        }
      }
      
      // 转让房主身份
      function transferHostTo(targetUsername) {
        if (currentRoom && socket && socket.connected) {
          // 显示自定义确认弹窗
          showTransferHostModal(targetUsername);
        }
      }
      
      // @用户功能
      function atUser(username) {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
          chatInput.value = `@${username} `;
          chatInput.focus();
        }
      }
      
      // 更新用户列表 - 新的竖向布局：状态图标 + 头像 + 延迟显示
      function updateUserList(userData) {
        users = userData;
        userListEl.innerHTML = '';
        
        // 检查并更新当前用户的房主状态
        let currentUserIsHost = false;
        
        // 智能排序：房主第一，当前用户第二，其他用户保持原有顺序
        const sortedUsers = [...users].sort((a, b) => {
          // 1. 房主优先（权重最高）
          if (a.isHost && !b.isHost) return -1;
          if (!a.isHost && b.isHost) return 1;
          
          // 2. 当前用户优先（权重次高）
          if (a.username === username && b.username !== username) return -1;
          if (a.username !== username && b.username === username) return 1;
          
          // 3. 其他用户保持原有顺序（不交换位置）
          return 0;
        });
        
        sortedUsers.forEach(user => {
          // 创建列表项
          const li = document.createElement('li');
          li.classList.add('user-list-item'); // 添加用户列表项类名
          
          // 创建左侧区域（状态图标 + 头像）
          const leftArea = document.createElement('div');
          leftArea.classList.add('user-info-left');
          
          // 创建状态图标
          const statusIcon = document.createElement('div');
          statusIcon.classList.add('user-status-icon');
          if (user.isReady) {
            statusIcon.classList.add('ready');
            statusIcon.textContent = '✓'; // 准备状态显示勾号
            li.classList.add('ready');
          } else {
            statusIcon.classList.add('not-ready');
            statusIcon.textContent = '✕'; // 未准备状态显示叉号
            li.classList.add('not-ready');
          }
          
          // 创建头像
          const avatar = document.createElement('div');
          avatar.classList.add('user-avatar');
          
          // 检查是否有自定义头像
          let customAvatar = null;
          if (user.username === username) {
            // 当前用户，优先使用内存中的最新头像数据
            customAvatar = window.currentUserAvatar || loadAvatarFromLocalStorage();
          } else {
            // 其他用户，优先使用内存缓存
            customAvatar = window.avatarCache && window.avatarCache[user.username];
            if (!customAvatar) {
              // 如果内存中没有，使用用户数据中的头像
              customAvatar = user.customAvatar;
              // 缓存到内存中
              if (customAvatar) {
                if (!window.avatarCache) window.avatarCache = {};
                window.avatarCache[user.username] = customAvatar;
              }
            }
          }
          
          if (customAvatar) {
            // 显示自定义头像
            const img = document.createElement('img');
            img.src = customAvatar;
            img.style.cssText = `
              width: 100%;
              height: 100%;
              border-radius: 50%;
              object-fit: cover;
            `;
            avatar.appendChild(img);
          } else {
            // 使用默认头像（用户名首字母）
            const initial = user.username.charAt(0).toUpperCase();
            avatar.textContent = initial;
            
            // 为用户分配基于用户名的固定颜色（如果还没有颜色）
            if (!userColors[user.username]) {
              userColors[user.username] = getUsernameColor(user.username);
            }
            
            // 设置头像背景色
            avatar.style.backgroundColor = userColors[user.username];
          }
          
          // 添加用户鼠标悬停提示
          avatar.title = user.username;
          
          // 创建延迟显示
          const pingDisplay = document.createElement('div');
          pingDisplay.classList.add('user-ping');
          
          // 使用真实的网络延迟数据
          let pingValue;
          if (user.username === username) {
            // 当前用户显示自己的延迟
            pingValue = networkQuality.rtt;
          } else {
            // 其他用户的延迟（从服务器获取或估算）
            pingValue = user.ping || Math.floor(Math.random() * 100) + 30; // 如果没有数据则使用估算值
          }
          
          // 根据延迟值和主题设置颜色
          let pingColor = '#666'; // 默认颜色
          const isDarkTheme = document.body.classList.contains('dark-theme');
          
          if (pingValue <= 50) {
            pingColor = isDarkTheme ? '#44cc55' : '#00aa44'; // 优秀 - 绿色
          } else if (pingValue <= 100) {
            pingColor = isDarkTheme ? '#88cc44' : '#66aa00'; // 良好 - 黄绿色
          } else if (pingValue <= 200) {
            pingColor = isDarkTheme ? '#ffcc44' : '#ffaa00'; // 一般 - 橙色
          } else {
            pingColor = isDarkTheme ? '#ff6666' : '#ff4444'; // 较差 - 红色
          }
          
          pingDisplay.textContent = `${Math.round(pingValue)}ms`;
          pingDisplay.style.color = pingColor;
          
          // 创建用户名容器
          const usernameContainer = document.createElement('div');
          usernameContainer.classList.add('user-name');
          
          // 创建用户名文本
          const usernameText = document.createElement('span');
          usernameText.classList.add('user-name-text');
          usernameText.textContent = user.username;
          usernameContainer.appendChild(usernameText);
          
          // 创建标识容器
          const badgesContainer = document.createElement('div');
          badgesContainer.classList.add('user-badges');
          
          // 添加房主标识
          if (user.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.classList.add('host-badge');
            hostBadge.textContent = '房主';
            badgesContainer.appendChild(hostBadge);
            
            // 检查是否是当前用户
            if (user.username === username) {
              currentUserIsHost = true;
            }
          }
          
          // 如果是当前用户，添加精美的"您"标记
          if (user.username === username) {
            const currentUserBadge = document.createElement('span');
            currentUserBadge.classList.add('current-user-badge');
            currentUserBadge.textContent = '您';
            badgesContainer.appendChild(currentUserBadge);
          }
          
          usernameContainer.appendChild(badgesContainer);
          
          // 组装左侧区域
          leftArea.appendChild(statusIcon);
          leftArea.appendChild(avatar);
          leftArea.appendChild(usernameContainer);
          
          // 组装整个列表项
          li.appendChild(leftArea);
          li.appendChild(pingDisplay);
          
          // 添加右键菜单事件
          li.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            showUserContextMenu(e.clientX, e.clientY, user);
          });
          
          // 添加点击事件（头像点击也可以触发右键菜单）
          leftArea.addEventListener('click', function() {
            // 这里可以添加点击头像的逻辑
          });
          
          userListEl.appendChild(li);
        });
        
        // 更新用户数量显示
        userCountEl.textContent = users.length;
        
        // 更新当前用户的房主状态
        if (isHost !== currentUserIsHost) {
          isHost = currentUserIsHost;
        }
      }

      // Socket.io 事件
      socket.on('room_result', (data) => {
        // 如果是来自小弹窗的请求，并且失败了，就不在主窗口显示错误
        if (data.fromSmallModal && !data.success) {
          return; // 小弹窗会处理自己的错误显示
        }
        
        if (data.success) {
          currentRoom = data.room;
          currentRoomNameEl.textContent = data.room; // 使用图标代替文字
          closeModal();
          
          // 设置当前用户的房主状态
          isHost = data.isHost || false;
          
          addStatusMessage(`成功${data.action === 'create' ? '创建' : '加入'}房间: ${data.room}${isHost ? ' (房主)' : ''}`);
          
          // 清空错误消息
          const errorMessage = document.getElementById('errorMessage');
          errorMessage.style.display = 'none';
          errorMessage.textContent = '';
          
          // 成功加入或创建房间后，显示右下角的小房子图标以便换房间
          const roomIconButton = document.getElementById('roomIconButton');
          if (roomIconButton) {
            roomIconButton.style.display = 'flex'; // 始终显示房间图标
          }
          
          // 启用退出房间按钮（桌面端）
      enableExitRoomButtons();
          
          // 启用准备按钮并重置为未准备状态
          const readyButton = document.getElementById('readyButton');
          if (readyButton) {
            // 重置为未准备状态
            isReady = false;
            readyButton.innerHTML = '<i class="fas fa-circle"></i> 准备';
            readyButton.classList.remove('ready');
            
            // 启用按钮
            readyButton.style.opacity = '1';
            readyButton.style.cursor = 'pointer';
            readyButton.title = '准备/取消准备';
          }
          
          // 新用户加入房间时，请求当前视频状态
          if (data.action === 'join' || data.action === 'create') {
            console.log(`加入房间 ${currentRoom} 后，请求视频状态同步`);
            socket.emit('video_state_request', { room: currentRoom });
            
            // 请求当前房间的视频资源信息
            socket.emit('request_video_resources', { room: currentRoom });
            
            // 请求当前房间的用户列表
            socket.emit('request_user_list', { room: currentRoom });
          }
          
          // 如果已经选择了本地视频，通知房间内其他用户
          if (currentVideoId) {
            socket.emit('update_video_resource', {
              room: currentRoom,
              username: username,
              videoId: currentVideoId
            });
          }
        } else {
          // 失败时在弹窗下方显示错误消息，而不是在聊天窗口
          // 注意：这里不会处理来自小弹窗的错误，因为前面已经return了
          const errorMessage = document.getElementById('errorMessage');
          errorMessage.style.display = 'block';
          errorMessage.textContent = `错误: ${data.message}`;
        }
      });
      
      // 监听头像更新事件
      socket.on('avatar_updated', (data) => {
        const { username, avatar } = data;
        console.log(`收到用户 ${username} 的头像更新`);
        
        // 使用同步函数更新所有地方的头像
        syncAvatarAcrossAllPlaces(username, avatar);
      });
      
      // 更新聊天消息中的头像
      function updateChatAvatar(username, avatarDataUrl) {
        // 查找所有该用户的聊天消息（包括普通模式和全屏模式）
        const messageElements = document.querySelectorAll('.message');
        
        // 查找全屏模式下的聊天消息
        const fullscreenChatPanel = document.getElementById('fullscreenChatPanel');
        let fullscreenMessageElements = [];
        if (fullscreenChatPanel) {
          fullscreenMessageElements = fullscreenChatPanel.querySelectorAll('.message');
        }
        
        // 合并所有消息元素
        const allMessageElements = [...messageElements, ...fullscreenMessageElements];
        
        allMessageElements.forEach(messageElement => {
          const senderElement = messageElement.querySelector('.message-sender');
          if (senderElement) {
            // 获取发送者文本节点内容（排除时间元素）
            let senderName = '';
            for (let node of senderElement.childNodes) {
              // 只获取文本节点且不是时间元素
              if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() && !node.parentElement?.classList?.contains('message-time')) {
                senderName = node.textContent.trim();
                break;
              }
            }
            
            // 检查发送者是否匹配
            if (senderName === username) {
              const avatarElement = senderElement.querySelector('.message-avatar');
              if (avatarElement) {
                // 清空原有内容
                avatarElement.innerHTML = '';
                // 创建图像元素
                const img = document.createElement('img');
                img.src = avatarDataUrl;
                img.style.cssText = `
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  object-fit: cover;
                `;
                avatarElement.appendChild(img);
              }
            }
          }
        });
      }
      
      // 监听视频资源更新
      socket.on('video_resource_update', (data) => {
        if (currentRoom === data.room) {
          // 更新房间内各用户的视频资源信息
          videoResourceInfo[data.username] = data.videoId;
          
          // 检查视频资源一致性
          checkVideoResourceConsistency();
          
          // 如果新加入的用户使用了与我相同的视频资源，并且我不是加载这个视频的用户
          if (currentVideoId && currentVideoId === data.videoId && username !== data.username) {
            // 请求当前房间的视频进度同步
            // 延迟一小段时间，确保视频元数据已加载
            setTimeout(() => {
              if (currentRoom && !isLoading) {
                socket.emit('video_state_request', {
                  room: currentRoom
                });
              }
            }, 1000);
          }
        }
      });
      
      // 防抖变量
      let lastInconsistentCheck = 0;
      let lastConsistentCheck = 0;
      
      // 监听视频资源不一致通知 - 统一处理所有不一致情况
      socket.on('video_resource_inconsistent', (data) => {
        console.log('收到视频资源不一致通知:', data);
        
        // 防抖检查：3秒内只处理一次
        const now = Date.now();
        if (now - lastInconsistentCheck < 3000) {
          console.log('防抖：跳过重复的不一致通知');
          return;
        }
        lastInconsistentCheck = now;
        
        // 检查是否是共享视频的情况（跳过共享视频的不一致提示）
        const isSharedVideo = window.lastSharedVideo && 
                          data.inconsistentUsers && 
                          Object.values(data.inconsistentUsers).some(user => user.videoUrl === window.lastSharedVideo);
        
        // 只有在非共享情况下且确实不一致时才显示提示
        if (data.inconsistentUsers && Object.keys(data.inconsistentUsers).length > 0 && !isSharedVideo) {
          console.log('显示资源不一致弹窗，消息:', data.message);
          
          // 直接使用服务器发送的个性化消息
          showVideoResourceMismatch(data.message, data.inconsistentUsers || {});
        } else if (isSharedVideo) {
          console.log('🚫 共享视频跳过资源不一致提示');
          // 清除之前的不一致提示
          const existingModal = document.getElementById('videoMismatchModal');
          if (existingModal) {
            document.body.removeChild(existingModal);
          }
        } else {
          // 资源已一致，清除提示
          console.log('✅ 视频资源已一致，清除提示');
          const existingModal = document.getElementById('videoMismatchModal');
          if (existingModal) {
            document.body.removeChild(existingModal);
          }
        }
      });

      // 监听视频资源已同步通知
      socket.on('video_resource_consistent', (data) => {
        console.log('收到视频资源已同步通知:', data);
        
        // 防抖检查：2秒内只处理一次
        const now = Date.now();
        if (now - lastConsistentCheck < 2000) {
          console.log('防抖：跳过重复的同步通知');
          return;
        }
        lastConsistentCheck = now;
        
        // 清除所有不一致提示
        const existingModal = document.getElementById('videoMismatchModal');
        if (existingModal) {
          document.body.removeChild(existingModal);
        }
        
        // 显示同步成功提示
        showBottomToast('视频资源已同步 ✓', 2000);
      });
      
      // 接收房间视频资源信息
      socket.on('video_resources_response', (data) => {
        if (currentRoom === data.room) {
          videoResourceInfo = data.resources;
          
          // 检查视频资源一致性
          checkVideoResourceConsistency();
        }
      });
      
      // 检查视频资源一致性
      function checkVideoResourceConsistency() {
        console.log('检查视频资源一致性 - 当前用户:', username, '是否是房主:', isHost, '当前视频ID:', currentVideoId);
        console.log('房间视频资源信息:', videoResourceInfo);
        
        // 获取所有非空的视频ID
        const videoIds = Object.values(videoResourceInfo).filter(id => id);
        
        if (videoIds.length === 0) {
          console.log('还没有用户选择视频');
          return;
        }
        
        // 检查是否所有视频ID都相同
        const allSame = videoIds.every(id => id === videoIds[0]);
        
        if (!allSame && currentVideoId) {
          console.log('检测到视频资源不一致');
          // 找出使用不同视频的用户
          const usersWithDifferentVideos = Object.keys(videoResourceInfo)
            .filter(username => videoResourceInfo[username] && videoResourceInfo[username] !== currentVideoId);
          
          console.log('使用不同视频的用户:', usersWithDifferentVideos);
          if (usersWithDifferentVideos.length > 0) {
            showVideoResourceMismatch(usersWithDifferentVideos);
          }
        } else {
          console.log('所有用户视频资源一致');
        }
      }
      
      // 监听视频状态请求
      socket.on('video_state_request', (data) => {
          if (currentRoom === data.room && !isLoading) {
            // 回复当前视频状态，包含请求者信息
            socket.emit('video_state_response', {
              room: currentRoom,
              requestor: data.requestor,
              isPlaying: !videoPlayer.paused,
              currentTime: videoPlayer.currentTime
            });
          }
        });
      
      // 监听资源不一致通知 - 忽略共享新视频时的不一致警告
      socket.on('video_resource_inconsistent', function(data) {
        console.log('⚠️ 收到资源不一致通知:', data);
        
        // 检查是否是共享视频的情况
        const isSharedVideo = window.lastSharedVideo && 
                          data.inconsistentUsers && 
                          Object.values(data.inconsistentUsers).some(user => user.videoUrl === window.lastSharedVideo);
        
        // 只有在非共享情况下才显示提示
        if (data.inconsistentUsers && Object.keys(data.inconsistentUsers).length > 0 && !isSharedVideo) {
          const usernames = Object.values(data.inconsistentUsers).map(user => user.username);
          const message = `${usernames.join(', ')} 的视频资源与其他人不一致`;
          
          // 显示警告提示
          showBottomToast(message, 5000);
          
          // 在状态消息中也显示
          addStatusMessage(message);
        } else if (isSharedVideo) {
          console.log('🚫 共享视频跳过资源不一致提示');
        }
      });
      
      // 接收视频状态响应
      socket.on('video_state_response', (data) => {
        if (currentRoom === data.room && !isLoading) {
          isSyncing = true;
          try {
            // 先设置时间
            if (data.currentTime && Math.abs(videoPlayer.currentTime - data.currentTime) > 0.5) {
              videoPlayer.currentTime = data.currentTime;
            }
            
            // 然后同步播放/暂停状态
            if (data.isPlaying) {
              videoPlayer.play();
            } else {
              videoPlayer.pause();
            }
            
            addStatusMessage(`已同步视频状态: ${data.isPlaying ? '播放中' : '已暂停'} [${formatTime(data.currentTime)}]`);
          } catch (error) {
            console.error('同步视频状态失败:', error);
          } finally {
            setTimeout(() => {
              isSyncing = false;
            }, 100);
          }
        }
      });

      socket.on('user_list_update', (userData) => {
        console.log('收到用户列表更新:', userData);
        updateUserList(userData);
        
        // 新用户加入后，检查视频资源一致性
        if (currentRoom && userData.length > 1) {
          console.log('用户列表更新，检查视频资源一致性');
          socket.emit('video_resource_update', {
            room: currentRoom,
            videoName: currentVideoId || 'none'
          });
        }
        
        // 当用户列表更新时，触发头像同步机制
        // 遍历所有用户，同步他们的头像
        if (currentRoom) {
          console.log('开始头像同步检查，当前房间:', currentRoom);
          console.log('当前用户列表长度:', userData.length);
          // 使用setTimeout确保用户列表已经更新完成
          setTimeout(() => {
            console.log('执行头像同步，用户数据:', userData);
            let avatarSyncCount = 0;
            userData.forEach(user => {
              console.log(`检查用户 ${user.username} 是否有自定义头像:`, user.customAvatar);
              // 不管是否有customAvatar，都尝试同步
              // 如果没有customAvatar，会使用默认头像
              console.log(`同步用户 ${user.username} 的头像信息`);
              // 获取用户的头像数据
              let avatarData = user.customAvatar;
              if (!avatarData) {
                // 如果没有自定义头像，尝试从本地存储加载
                avatarData = loadAvatarFromLocalStorage(user.username);
                console.log(`从本地存储加载用户 ${user.username} 的头像:`, avatarData);
              }
              
              // 调用同步函数，即使avatarData为null也会正确处理
              syncAvatarAcrossAllPlaces(user.username, avatarData);
              if (avatarData) {
                avatarSyncCount++;
              }
            });
            console.log(`头像同步完成，共同步了 ${avatarSyncCount} 个用户`);
          }, 100);
        } else {
          console.log('不在房间内，跳过头像同步');
        }
      });

      // 监听房主身份变更通知
      socket.on('host_changed', (data) => {
        if (currentRoom === data.room) {
          addStatusMessage(`${data.oldHost} 将房主身份转让给了 ${data.newHost}`);
          
          // 如果当前用户是新房主，更新状态
          if (data.newHost === username) {
            isHost = true;
            addStatusMessage('恭喜你成为了新房主！');
          } else if (data.oldHost === username) {
            // 如果当前用户不再是房主，更新状态
            isHost = false;
          }
          
          // 不需要额外请求用户列表，服务器端已经在房主转让后调用了updateUserList函数
        }
      });

      socket.on('system_message', (data) => {
        addStatusMessage(data.message);
      });

      socket.on('chat_message', (data) => {
        console.log('收到聊天消息:', data);
        addChatMessage(data.username, data.message, false, data.isImage);
      });

      // 视频播放命令
      socket.on('video_play', (data) => {
        if (currentRoom === data.room) {
          isSyncing = true;
          try {
            // 先设置时间再播放
            if (Math.abs(videoPlayer.currentTime - data.time) > 0.5) {
              videoPlayer.currentTime = data.time;
            }
            videoPlayer.play();
            
            // 如果是其他人播放的，显示消息
            if (data.username && data.username !== username) {
              const now = new Date();
              const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              addStatusMessage(`${data.username} 继续播放了视频 [${formatTime(data.time)}] ${currentTimeStr}`);
            }
          } catch (error) {
            console.error('播放视频失败:', error);
          } finally {
            setTimeout(() => {
              isSyncing = false;
            }, 100);
          }
        }
      });

      // 视频暂停命令
      socket.on('video_pause', (data) => {
        if (currentRoom === data.room) {
          isSyncing = true;
          try {
            // 先设置时间再暂停
            if (Math.abs(videoPlayer.currentTime - data.time) > 0.5) {
              videoPlayer.currentTime = data.time;
            }
            videoPlayer.pause();
            
            // 如果是其他人暂停的，显示消息
            if (data.username && data.username !== username) {
              setTimeout(() => {
                if (!isSyncing) {
                  const now = new Date();
                  const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  addStatusMessage(`${data.username} 暂停了视频 [${formatTime(data.time)}] ${currentTimeStr}`);
                }
              }, 150);
            }
          } catch (error) {
            console.error('暂停视频失败:', error);
          } finally {
            setTimeout(() => {
              isSyncing = false;
            }, 100);
          }
        }
      });

      // 视频快进命令 - 修复拖动进度条显示暂停消息的问题
      socket.on('video_seek', (data) => {
        if (currentRoom === data.room && !isLoading) {
          isSyncing = true;
          const wasPaused = videoPlayer.paused; // 记录操作前的播放状态
          try {
            // 只有当时间差大于0.5秒时才执行同步
            if (Math.abs(videoPlayer.currentTime - data.time) > 0.5) {
              videoPlayer.currentTime = data.time;
            }
          } catch (error) {
            console.error('视频快进失败:', error);
          } finally {
            // 确保恢复原始的播放状态
            setTimeout(() => {
              if (!wasPaused && videoPlayer.paused) {
                videoPlayer.play();
              }
              isSyncing = false;
            }, 100);
          }
        }
      });

      // 视频同步信息 - 使用智能同步算法
      socket.on('sync_time', (data) => {
        if (currentRoom === data.room) {
          try {
            // 计算网络延迟补偿
            let targetTime = data.time;
            if (data.timestamp) {
              const networkDelay = (Date.now() - data.timestamp) / 1000;
              targetTime += networkDelay; // 补偿网络延迟
            }
            
            // 使用智能同步算法
            smartSync(targetTime, data.networkQuality || 1.0);
            
          } catch (error) {
            console.error('智能同步失败:', error);
            networkQuality.syncFailCount++;
          }
        }
      });

      // 初始化本地视频选择功能
      initLocalVideoSelection();
      
      // 初始化网络状态显示按钮
      initNetworkStatusToggle();
      
      // 移动端功能已移除
      
      // 初始化房间列表功能
      initRoomListFeatures();
      
      // 智能显示房间弹窗逻辑 - 只有未加入房间时才显示
      function showInitialRoomModal() {
        // 延迟检查，确保所有初始化完成
        setTimeout(() => {
          if (!currentRoom || currentRoom === '') {
            console.log('用户未加入房间，显示房间选择弹窗');
            showModal(roomModal);
          } else {
            console.log('用户已在房间内，不显示弹窗');
          }
        }, 500);
      }
      
      // 初始化页面状态（未加入房间状态）
      function initPageState() {
        // 设置房间名称为带括号的状态
        if (currentRoomNameEl) {
          currentRoomNameEl.innerHTML = '(未加入房间)';
        }
        
        // 设置在线人数为0
        const userCountEl = document.getElementById('userCount');
        if (userCountEl) userCountEl.textContent = '0';
        
        // 设置用户列表为初始状态
        const usersList = document.getElementById('usersList');
        
        if (usersList) {
          usersList.innerHTML = '';
        }
      }
      
      // 初始化页面状态
      initPageState();
      
      // 执行智能显示逻辑
      showInitialRoomModal();
      
      // 房间列表功能实现
      function initRoomListFeatures() {
        // 获取DOM元素
        const joinRoomModal = document.getElementById('joinRoomModal');
        const selectedRoomName = document.getElementById('selectedRoomName');
        const joinUsername = document.getElementById('joinUsername');
        const joinRoomPassword = document.getElementById('joinRoomPassword');
        const btnConfirmJoin = document.getElementById('btnConfirmJoin');
        const joinErrorMessage = document.getElementById('joinErrorMessage');
        const roomList = document.getElementById('roomList');
        
        // 存储当前选择的房间信息
        let selectedRoom = null;
        
        // 请求房间列表
        function requestRoomList() {
          if (socket && socket.connected) {
            console.log('正在请求房间列表...');
            socket.emit('get_room_list');
          } else {
            console.log('Socket未连接，等待连接后重试...');
            // 如果socket未连接，显示连接中状态
            roomList.innerHTML = '<div class="room-list-loading"><i class="fas fa-spinner fa-spin"></i> 连接服务器中...</div>';
            
            // 等待连接成功后重试
            const checkConnection = setInterval(() => {
              if (socket && socket.connected) {
                clearInterval(checkConnection);
                socket.emit('get_room_list');
              }
            }, 500);
            
            // 10秒后如果还未连接，显示连接失败
            setTimeout(() => {
              clearInterval(checkConnection);
              if (!socket || !socket.connected) {
                roomList.innerHTML = '<div class="room-list-empty">❌ 无法连接到服务器</div>';
              }
            }, 10000);
          }
        }

        // 刷新按钮功能
        let lastRefreshTime = 0;
        const refreshBtn = document.getElementById('refreshRoomListBtn');
        
        function handleRefreshClick() {
          const now = Date.now();
          const timeDiff = now - lastRefreshTime;
          
          // 检查3秒冷却时间
          if (timeDiff < 3000) {
            const remainingTime = Math.ceil((3000 - timeDiff) / 1000);
            showBottomToast(`请等待 ${remainingTime} 秒后再刷新`);
            return;
          }
          
          // 更新最后刷新时间
          lastRefreshTime = now;
          
          // 添加加载动画和禁用状态
          refreshBtn.classList.add('spinning');
          refreshBtn.disabled = true;
          
          // 显示正在刷新的视觉反馈
          roomList.innerHTML = '<div class="room-list-loading"><i class="fas fa-spinner fa-spin"></i> 正在刷新房间列表，请稍候...</div>';
          
          // 立即请求房间列表
          requestRoomList();
          
          // 3秒后恢复按钮状态
          setTimeout(() => {
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
          }, 3000);
        }
        
        // 绑定刷新按钮事件
        if (refreshBtn) {
          refreshBtn.addEventListener('click', handleRefreshClick);
        }
        
        // 监听房间列表更新
        socket.on('room_list_update', (roomList) => {
          console.log('收到房间列表更新:', roomList);
          updateRoomListDisplay(roomList || []);
        });
        
        // 添加请求超时处理
        let roomListRequestTimeout = null;
        
        // 重写requestRoomList函数，添加超时处理
        const originalRequestRoomList = requestRoomList;
        requestRoomList = function() {
          // 清除之前的超时
          if (roomListRequestTimeout) {
            clearTimeout(roomListRequestTimeout);
          }
          
          // 设置5秒超时
          roomListRequestTimeout = setTimeout(() => {
            roomList.innerHTML = '<div class="room-list-empty">⏰ 请求超时，请手动刷新</div>';
          }, 5000);
          
          // 调用原始函数
          originalRequestRoomList();
        };
        
        // 监听房间列表更新时清除超时
        socket.on('room_list_update', (roomList) => {
          if (roomListRequestTimeout) {
            clearTimeout(roomListRequestTimeout);
            roomListRequestTimeout = null;
          }
          console.log('收到房间列表更新:', roomList);
          updateRoomListDisplay(roomList || []);
        });

        // 监听共享的视频链接
        socket.on('video_shared', function(data) {
          const { url, username, currentTime, shouldPlay, isNewVideo, skipConsistencyCheck } = data;
          
          console.log('📥 收到共享视频事件:', data);
          
          // 显示系统消息
          addStatusMessage(`${username} 共享了一个视频链接`);
          
          // 自动填充到输入框 - 使用全局变量
          if (window.videoUrlInput) {
            window.videoUrlInput.value = url;
            console.log('✅ 已自动填充共享链接到输入框:', url);
          } else {
            console.warn('⚠️ 无法找到视频输入框元素');
          }
          
          // 加载共享的视频
          if (url) {
            console.log('🔄 开始加载共享视频:', url, '起始时间:', currentTime, '是否播放:', shouldPlay);
            
            // 使用服务器发送的currentTime，确保同步暂停时间
            const startTime = currentTime || 0;
            const playWhenReady = false; // 共享的视频不自动播放
            handleNetworkVideoLoading(url, startTime, playWhenReady);
            
            // 标记这是共享视频，避免触发资源不一致检查
            window.lastSharedVideo = url;
            console.log('🚫 共享视频已跳过资源一致性检查');
          }
        });
        
        // 监听共享视频错误
        socket.on('share_video_error', function(data) {
          showBottomToast(`共享失败: ${data.message}`);
        });
        
        // 更新房间列表显示
        function updateRoomListDisplay(rooms) {
          console.log('更新房间列表显示:', rooms, '当前房间:', currentRoom);
          
          // 过滤掉当前用户所在的房间
          const filteredRooms = rooms.filter(room => room.name !== currentRoom);
          
          if (filteredRooms.length === 0) {
            roomList.innerHTML = '<div class="room-list-empty">🏠 暂无其他在线房间</div>';
          } else {
            roomList.innerHTML = '';
            
            filteredRooms.forEach(room => {
              const roomItem = document.createElement('div');
              roomItem.className = 'room-item';
              
              // 显示密码保护状态
              const passwordIcon = room.hasPassword ? '<i class="fas fa-lock" title="需要密码"></i>' : '<i class="fas fa-unlock" title="无密码"></i>';
              
              roomItem.innerHTML = `
                <div class="room-icon">
                  <i class="fas fa-home"></i>
                </div>
                <div class="room-info">
                  <div class="room-name">
                    ${room.name} ${passwordIcon}
                    <span class="room-user-count">(👥${room.userCount})</span>
                  </div>
                  <div class="room-delay">在线房间</div>
                </div>
                <button class="room-join-btn" data-room="${room.name}">加入</button>
              `;
              
              // 添加加入按钮点击事件
              const joinBtn = roomItem.querySelector('.room-join-btn');
              joinBtn.addEventListener('click', () => {
                openJoinRoomModal(room);
              });
              
              roomList.appendChild(roomItem);
            });
          }
        }
        
        // 打开加入房间子弹窗
        function openJoinRoomModal(room) {
          selectedRoom = room;
          selectedRoomName.textContent = room.name;
          
          // 自动填充用户名（如果已有）
          if (username) {
            joinUsername.value = username;
          }
          
          // 清空密码和错误信息
          joinRoomPassword.value = '';
          joinErrorMessage.style.display = 'none';
          
          // 显示子弹窗
          joinRoomModal.style.display = 'flex';
          
          // 设置焦点
          setTimeout(() => {
            if (username) {
              joinRoomPassword.focus();
            } else {
              joinUsername.focus();
            }
          }, 100);
        }
        
        // 关闭加入房间子弹窗
        window.closeJoinRoomModal = function() {
          joinRoomModal.style.display = 'none';
          selectedRoom = null;
        };
        
        // 确认加入房间按钮事件
        if (btnConfirmJoin) {
          btnConfirmJoin.addEventListener('click', () => {
            const joinUser = joinUsername.value.trim();
            const joinPassword = joinRoomPassword.value.trim();
            
            // 验证输入
            if (!joinUser) {
              showJoinError('请输入用户名');
              return;
            }
            
            if (!selectedRoom) {
              showJoinError('请选择要加入的房间');
              return;
            }
            
            // 检查是否尝试加入当前房间
            if (selectedRoom.name === currentRoom) {
              showJoinError('您已经在该房间内');
              return;
            }
            
            // 如果用户已在其他房间，显示确认对话框
            if (currentRoom) {
              showRoomSwitchConfirm(
                `您已处于房间「${currentRoom}」内，是否离开当前房间并加入「${selectedRoom.name}」？`,
                () => {
                  // 确认加入新房间
                  joinErrorMessage.style.display = 'none';
                  socket.emit('join_room', {
                    username: joinUser,
                    room: selectedRoom.name,
                    password: joinPassword
                  });
                  username = joinUser; // 更新全局用户名
                }
              );
            } else {
              // 直接加入房间
              joinErrorMessage.style.display = 'none';
              socket.emit('join_room', {
                username: joinUser,
                room: selectedRoom.name,
                password: joinPassword,
                fromSmallModal: true  // 添加标识，表示来自小弹窗
              });
              username = joinUser; // 更新全局用户名
            }
          });
        }
        
        // 显示加入房间错误信息
        function showJoinError(message) {
          joinErrorMessage.textContent = message;
          joinErrorMessage.style.display = 'block';
          // 3秒后自动隐藏
          setTimeout(() => {
            joinErrorMessage.style.display = 'none';
          }, 3000);
        }
        
        // 监听加入房间结果，处理成功和失败情况
        socket.on('room_result', (data) => {
          if (data.action === 'join') {
            if (data.success) {
              closeJoinRoomModal();
            } else {
              // 显示错误信息在小弹窗上
              showJoinError(data.message);
            }
          }
        });
        
        // 点击子弹窗背景关闭
        if (joinRoomModal) {
          joinRoomModal.addEventListener('click', (e) => {
            if (e.target === joinRoomModal) {
              closeJoinRoomModal();
            }
          });
        }
        
        // 监听房间弹窗显示时，请求房间列表
        const originalRoomIconClick = roomIconButton.onclick;
        roomIconButton.addEventListener('click', () => {
          // 立即显示加载状态
          roomList.innerHTML = '<div class="room-list-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
          
          // 优先使用实时请求，确保数据最新
          if (socket && socket.connected) {
            socket.emit('get_room_list');
          } else {
            // 如果连接断开，立即尝试重连并请求
            requestRoomList();
          }
        });
        
        // Socket连接成功后立即请求一次房间列表
        socket.on('connect', () => {
          console.log('Socket连接成功，自动获取房间列表');
          setTimeout(() => {
            requestRoomList();
          }, 500);
        });
        
        // 初始请求房间列表（页面加载时）
        setTimeout(() => {
          requestRoomList();
        }, 1000);
      }
      
      // 将PC端右键菜单函数暴露到全局作用域，供移动端调用
      window.showUserContextMenu = showUserContextMenu;
      window.createUserContextMenu = createUserContextMenu;
      window.closeContextMenu = closeContextMenu;
      window.handleContextMenuAction = handleContextMenuAction;
      window.showUserAvatar = showUserAvatar;
      window.hideUserContextMenu = hideUserContextMenu;
      
