// 功能菜单交互逻辑
(function() {
  'use strict';

  // 获取DOM元素
  const featureMenuButton = document.getElementById('featureMenuButton');
  const featureMenuContainer = document.getElementById('featureMenuContainer');
  const featureMenuItems = document.querySelectorAll('.feature-menu-item');

  // 功能菜单状态
  let isMenuOpen = false;

  // 切换功能菜单显示/隐藏
  function toggleFeatureMenu() {
    isMenuOpen = !isMenuOpen;
    
    if (isMenuOpen) {
      // 显示菜单
      featureMenuContainer.style.display = 'flex';
      featureMenuButton.classList.add('active');
      featureMenuButton.innerHTML = '<i class="fas fa-times"></i> <span>关闭菜单</span>';
      // 获取父级容器中的tooltip元素
      const tooltip = featureMenuButton.parentNode.querySelector('.custom-tooltip');
      if (tooltip) {
        tooltip.textContent = '收起功能菜单';
      }
    } else {
      // 隐藏菜单
      featureMenuContainer.style.display = 'none';
      featureMenuButton.classList.remove('active');
      featureMenuButton.innerHTML = '<i class="fas fa-bars"></i> <span>功能菜单</span>';
      // 获取父级容器中的tooltip元素
      const tooltip = featureMenuButton.parentNode.querySelector('.custom-tooltip');
      if (tooltip) {
        tooltip.textContent = '展开功能菜单';
      }
    }
  }

  // 隐藏功能菜单
  function hideFeatureMenu() {
    if (isMenuOpen) {
      isMenuOpen = false;
      featureMenuContainer.style.display = 'none';
      featureMenuButton.classList.remove('active');
      featureMenuButton.innerHTML = '<i class="fas fa-bars"></i> <span>功能菜单</span>';
      // 获取父级容器中的tooltip元素
      const tooltip = featureMenuButton.parentNode.querySelector('.custom-tooltip');
      if (tooltip) {
        tooltip.textContent = '展开功能菜单';
      }
    }
  }

  // 处理功能菜单按钮点击事件
  if (featureMenuButton) {
    featureMenuButton.addEventListener('click', function(e) {
      e.stopPropagation(); // 防止事件冒泡
      toggleFeatureMenu();
    });
  }

  // 处理功能菜单项点击事件
  featureMenuItems.forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.stopPropagation(); // 防止事件冒泡
      
      // 检查是否是移动端
      const isMobile = window.MobileAdapter && window.MobileAdapter.isMobileDevice();
      const featureNumber = this.getAttribute('data-feature');
      
      console.log('功能菜单项被点击:', featureNumber, '移动端:', isMobile);
      
      // 如果是移动端且点击视频选择按钮，不执行默认逻辑
      if (isMobile && featureNumber === '1') {
        console.log('移动端视频选择按钮，跳过默认逻辑');
        return;
      }
      
      // 如果是移动端且点击用户列表按钮，显示用户列表弹窗
      if (isMobile && featureNumber === '2') {
        console.log('移动端用户列表按钮，显示用户列表');
        // 创建移动端用户列表弹窗
        showMobileUserListModal();
        // 点击后自动收起菜单
        hideFeatureMenu();
        return;
      }
      
      // 这里可以添加具体的功能逻辑
      switch(featureNumber) {
        case '1':
          console.log('执行视频选择功能');
          // TODO: 添加视频选择的具体逻辑
          showBottomToast('视频选择功能开发中...');
          break;
        case '2':
          console.log('执行用户列表功能');
          // TODO: 添加用户列表的具体逻辑
          showBottomToast('用户列表功能开发中...');
          break;
        case '3':
          console.log('执行网络检测功能');
          // 触发网络状态面板显示
          const networkToggleBtn = document.getElementById('networkToggleBtn');
          if (networkToggleBtn) {
            networkToggleBtn.click();
            console.log('已触发网络状态面板显示');
          } else {
            console.log('网络状态切换按钮未找到');
            showBottomToast('网络状态功能暂不可用');
          }
          break;
        case '4':
          console.log('执行主题切换功能');
          // TODO: 添加主题切换的具体逻辑
          showBottomToast('主题切换功能开发中...');
          break;
        default:
          console.log('未知功能:', featureNumber);
      }
      
      // 点击后自动收起菜单
      hideFeatureMenu();
    });
  });

  // 点击页面其他地方时收起菜单
  document.addEventListener('click', function(e) {
    if (isMenuOpen && 
        !featureMenuButton.contains(e.target) && 
        !featureMenuContainer.contains(e.target)) {
      hideFeatureMenu();
    }
  });

  // 监听键盘事件，按ESC键收起菜单
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isMenuOpen) {
      hideFeatureMenu();
    }
  });

  // 页面卸载时清理
  window.addEventListener('beforeunload', function() {
    hideFeatureMenu();
  });

  // 显示移动端用户列表弹窗
  function showMobileUserListModal() {
    // 检查是否已经存在弹窗
    let existingModal = document.querySelector('.mobile-user-list-modal');
    if (existingModal) {
      existingModal.classList.remove('hidden');
      // 重新更新用户列表（可能数据有变化）
      updateMobileUserList();
      return;
    }

    // 创建移动端用户列表弹窗
    const modal = document.createElement('div');
    modal.className = 'mobile-user-list-modal';
    
    modal.innerHTML = `
      <div class="mobile-user-list-content">
        <div class="mobile-user-list-header">
          <h3 class="mobile-user-list-title">在线用户</h3>
          <button class="mobile-user-list-close" onclick="hideMobileUserListModal()">&times;</button>
        </div>
        <div class="mobile-user-list-body">
          <div class="mobile-user-list-container">
            <div class="user-list" id="mobileUserList">
              <ul id="mobileUsersListUl">
                <li style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                  正在加载用户数据...
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击背景关闭弹窗
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        hideMobileUserListModal();
      }
    });
    
    // 主动请求用户列表数据
    if (window.socket && window.currentRoom) {
      console.log('显示弹窗时主动请求用户列表');
      window.socket.emit('request_user_list', { room: window.currentRoom });
    }
    
    // 延迟更新用户列表，确保数据已准备好
    setTimeout(function() {
      updateMobileUserList();
    }, 300);
  }
  
  // 隐藏移动端用户列表弹窗
  function hideMobileUserListModal() {
    const modal = document.querySelector('.mobile-user-list-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
  
  // 更新移动端用户列表
  function updateMobileUserList() {
    console.log('更新移动端用户列表');
    
    const pcUsersList = document.getElementById('usersList');
    const mobileUsersListUl = document.getElementById('mobileUsersListUl');
    
    if (!mobileUsersListUl) {
      console.log('移动端用户列表容器不存在');
      return;
    }
    
    console.log('PC端用户列表:', pcUsersList);
    console.log('移动端用户列表:', mobileUsersListUl);
    
    // 检查PC端列表是否存在且有内容
    if (pcUsersList) {
      console.log('PC端列表子元素数量:', pcUsersList.children.length);
      console.log('PC端列表HTML:', pcUsersList.innerHTML.substring(0, 200) + '...');
    } else {
      console.log('PC端用户列表不存在');
    }
    
    // 清空移动端用户列表
    mobileUsersListUl.innerHTML = '';
    
    // 如果有PC端用户列表，复制其内容
    if (pcUsersList) {
      mobileUsersListUl.innerHTML = pcUsersList.innerHTML;
      console.log('从PC端复制用户列表到移动端，共复制了', pcUsersList.children.length, '个用户项');
      
      // 检查移动端用户列表项
    const mobileItems = mobileUsersListUl.querySelectorAll('li');
    console.log('移动端用户列表项详情:', mobileItems.length);
    mobileItems.forEach((item, index) => {
      const usernameElement = item.querySelector('.user-name-text');
      console.log(`用户项 ${index}:`, {
        className: item.className,
        innerHTML: item.innerHTML.substring(0, 100) + '...',
        hasUsernameElement: !!usernameElement,
        username: usernameElement ? usernameElement.textContent : '未找到'
      });
    });
      
      // 延迟执行，确保DOM完全更新
      setTimeout(() => {
        // 为移动端用户列表项添加长按菜单功能
        addLongPressMenuToMobileUsers();
        
        // 同时尝试直接绑定事件（备用方案）
        bindLongPressEventsDirectly();
      }, 100);
    } else {
      // 如果没有PC端列表，尝试主动请求用户数据
      if (window.socket && window.currentRoom) {
        console.log('请求用户列表数据...');
        window.socket.emit('request_user_list', { room: window.currentRoom });
      } else {
        // 显示空列表提示
        const emptyItem = document.createElement('li');
        emptyItem.style.cssText = 'text-align: center; padding: 20px; color: #999; font-size: 14px;';
        emptyItem.textContent = '暂无用户数据';
        mobileUsersListUl.appendChild(emptyItem);
        console.log('没有可用的用户数据');
      }
    }
    
    console.log('移动端用户列表已更新');
  }
  
  // 为移动端用户列表项添加长按菜单功能（已启用）
  function addLongPressMenuToMobileUsers() {
    const mobileUsersListUl = document.getElementById('mobileUsersListUl');
    if (!mobileUsersListUl) return;
    
    const userItems = mobileUsersListUl.querySelectorAll('.user-list-item');
    
    console.log('找到', userItems.length, '个用户列表项（长按功能已启用）');
    
    userItems.forEach((item, index) => {
      console.log('用户项', index, '长按事件已启用:', item);
      
      // 获取用户名数据
      const usernameElement = item.querySelector('.user-name-text');
      const username = usernameElement ? usernameElement.textContent : '';
      
      if (username) {
        // 添加触摸事件支持长按菜单
        item.ontouchstart = function(e) {
          handleTouchStart.call(this, e, username);
        };
        item.ontouchend = handleTouchEnd;
        item.ontouchmove = handleTouchMove;
        
        // 阻止默认的上下文菜单
        item.oncontextmenu = preventContextMenu;
        
        console.log('为用户项', index, '（用户名：', username, '）添加长按事件');
      }
    });
    
    console.log('移动端用户列表项长按菜单功能已启用');
  }
  
  // 长按菜单相关变量
  let longPressTimer = null;
  let longPressTarget = null;
  let longPressStartTime = 0;
  const LONG_PRESS_DELAY = 500; // 长按延迟时间（毫秒）
  
  // 调试模式
  window.debugMode = true; // 开启调试模式
  window.simpleTestMode = false; // 关闭简单测试模式，使用正常长按逻辑
  
  // 阻止默认的上下文菜单
  function preventContextMenu(e) {
    e.preventDefault();
  }
  
  // 处理触摸开始事件（长按功能已启用）
  function handleTouchStart(e, username) {
    const target = this;
    longPressTarget = target;
    longPressStartTime = Date.now();
    
    console.log('触摸开始（长按功能已启用）:', target, '用户名:', username);
    
    // 清除之前的定时器
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    
    // 设置长按定时器，触发右键菜单
    longPressTimer = setTimeout(() => {
      if (longPressTarget === target) {
        console.log('长按触发，显示右键菜单');
        e.preventDefault();
        
        // 获取触摸坐标
        const touch = e.touches[0];
        const x = touch.clientX;
        const y = touch.clientY;
        
        // 调用PC端的右键菜单函数
        if (window.showUserContextMenu && username) {
          // 创建用户对象（模拟PC端的用户数据结构）
          const user = {
            username: username,
            // 从DOM元素获取其他信息
            isHost: target.querySelector('.host-badge') !== null,
            isReady: target.classList.contains('ready')
          };
          
          console.log('调用PC端右键菜单，坐标:', x, y, '用户:', user);
          window.showUserContextMenu(x, y, user);
        }
      }
    }, LONG_PRESS_DELAY);
  }
  
  // 处理触摸结束事件
  function handleTouchEnd(e) {
    // 清除长按定时器
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    
    longPressTarget = null;
    
    console.log('触摸结束');
    
    // 长按功能已禁用，不需要处理菜单隐藏逻辑
  }
  
  // 处理触摸移动事件（取消长按）
  function handleTouchMove(e) {
    // 如果移动距离过大，取消长按定时器
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      console.log('触摸移动，取消长按定时器');
      
      // 长按功能已禁用，不需要处理菜单隐藏
    }
  }
  
  // 显示移动端用户长按菜单（功能已启用，直接调用PC端菜单）
  function showMobileUserContextMenu(e, targetElement) {
    console.log('移动端长按菜单功能已启用，使用PC端右键菜单');
    // 现在通过handleTouchStart直接调用PC端菜单，此函数保留兼容性
    return;
  }
  
  // 显示移动端上下文菜单（功能已完全禁用）
  function showMobileContextMenu(x, y, user) {
    console.log('移动端上下文菜单功能已禁用');
    // 此函数不再执行任何操作
    return;
  }
  
  // 创建移动端上下文菜单（功能已完全禁用）
  function createMobileContextMenu() {
    console.log('移动端上下文菜单创建功能已禁用');
    // 此函数不再执行任何操作
    return null;
  }
  
  // 隐藏移动端上下文菜单（功能已完全禁用）
  function hideMobileContextMenu() {
    console.log('移动端上下文菜单隐藏功能已禁用');
    // 此函数不再执行任何操作
    return;
  }
  
  // 处理移动端上下文菜单操作（功能已完全禁用）
  function handleMobileContextMenuAction(action) {
    console.log('移动端上下文菜单操作功能已禁用');
    // 此函数不再执行任何操作
    return;
  }

  // 监听用户列表更新事件
  if (typeof window.socket !== 'undefined' && window.socket) {
    window.socket.on('user_list_update', function(users) {
      console.log('收到用户列表更新事件，更新移动端用户列表');
      updateMobileUserList();
    });
    
    // 监听房间加入成功事件，立即请求用户列表
    window.socket.on('room_joined', function(data) {
      console.log('加入房间成功，请求用户列表');
      setTimeout(function() {
        updateMobileUserList();
      }, 500); // 延迟500ms确保数据已准备好
    });
  }
  
  // 监听房间变化，更新移动端用户列表
  if (typeof window.currentRoom !== 'undefined') {
    Object.defineProperty(window, 'currentRoom', {
      set: function(value) {
        this._currentRoom = value;
        console.log('房间变更，更新移动端用户列表');
        setTimeout(updateMobileUserList, 1000); // 房间变更后1秒更新用户列表
      },
      get: function() {
        return this._currentRoom;
      }
    });
  }
  
  // 定期更新用户列表（作为备选方案）
  setInterval(function() {
    if (document.querySelector('.mobile-user-list-modal') && 
        !document.querySelector('.mobile-user-list-modal').classList.contains('hidden')) {
      updateMobileUserList();
    }
  }, 2000); // 每2秒更新一次

  // 显示底部提示消息（如果存在该函数）
  function showBottomToast(message) {
    if (typeof window.showBottomToast === 'function') {
      window.showBottomToast(message);
    } else {
      console.log('Toast消息:', message);
      // 简单的备用提示方式
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 9999;
        font-size: 14px;
      `;
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 2000);
    }
  }

  // 直接绑定长按事件的备用函数
  function bindLongPressEventsDirectly() {
    const mobileUsersListUl = document.getElementById('mobileUsersListUl');
    if (!mobileUsersListUl) return;
    
    // 使用事件委托，直接绑定到列表项
    mobileUsersListUl.addEventListener('touchstart', function(e) {
      const target = e.target.closest('.user-list-item');
      if (target) {
        const usernameElement = target.querySelector('.user-name-text');
        const username = usernameElement ? usernameElement.textContent : '';
        if (username) {
          handleTouchStart.call(target, e, username);
        }
      }
    });
    
    mobileUsersListUl.addEventListener('touchend', handleTouchEnd);
    mobileUsersListUl.addEventListener('touchmove', handleTouchMove);
    
    console.log('已直接绑定长按事件到移动端用户列表');
  }
  
  // 将函数暴露到全局作用域
  window.showMobileUserListModal = showMobileUserListModal;
  window.hideMobileUserListModal = hideMobileUserListModal;
  window.updateMobileUserList = updateMobileUserList;
  window.addLongPressMenuToMobileUsers = addLongPressMenuToMobileUsers;
  window.bindLongPressEventsDirectly = bindLongPressEventsDirectly;
  
  // 检查并获取当前用户的房主状态
  function updateCurrentUserHostStatus() {
    // 尝试从全局变量获取房主状态
    if (typeof window.isHost !== 'undefined') {
      return window.isHost;
    }
    
    // 尝试从PC端用户列表中获取当前用户状态
    const pcUsersList = document.getElementById('usersList');
    if (pcUsersList) {
      const currentUserItems = pcUsersList.querySelectorAll('.user-list-item');
      currentUserItems.forEach(item => {
        const userNameElement = item.querySelector('.user-name-text, .user-name');
        const hostBadge = item.querySelector('.host-badge');
        if (userNameElement && hostBadge) {
          const username = userNameElement.textContent.trim();
          if (username === window.username) {
            window.isHost = true;
            return true;
          }
        }
      });
    }
    
    return window.isHost || false;
  }
  
  // 定期检查并更新房主状态
  setInterval(updateCurrentUserHostStatus, 5000);

  console.log('功能菜单脚本已加载');
})();