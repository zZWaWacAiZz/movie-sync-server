    // 简化的设备检测 - 仅PC模式
    (function() {
      // 设置PC布局模式
      function setDeviceLayoutMode() {
        const root = document.documentElement;
        // 强制PC布局
        root.style.setProperty('--is-mobile-device', '0');
        root.style.setProperty('--force-layout-mode', 'pc');
        root.classList.add('force-pc-layout');
        root.classList.remove('force-mobile-layout');
        console.log('使用PC布局');
      }
      
      // 立即执行
      setDeviceLayoutMode();
      
      // 页面加载完成后确认
      document.addEventListener('DOMContentLoaded', setDeviceLayoutMode);
      
      // 房间配置管理函数
      window.roomConfig = {
        get: function() {
          if (socket && socket.connected) {
            socket.emit('get_room_config');
          }
        },
        setKeepEmptyRooms: function(keep) {
          if (socket && socket.connected) {
            socket.emit('update_room_config', { KEEP_EMPTY_ROOMS: keep });
            console.log(`设置空房间保留: ${keep}`);
          }
        }
      };
    })();