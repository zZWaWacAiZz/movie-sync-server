const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// === 房间数据管理配置 ===
const ROOM_CONFIG = {
  // 是否保留空房间数据（true=保留，false=清理）
  KEEP_EMPTY_ROOMS: false, // 设置为false以清理空房间
  // 是否保留聊天记录（未来扩展用）
  KEEP_CHAT_HISTORY: false,
  // 空房间清理延迟（毫秒）
  CLEANUP_DELAY: 5000 // 5秒后清理空房间
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10e6, // 10MB，增加消息大小限制
  pingTimeout: 60000, // 60秒ping超时
  pingInterval: 25000 // 25秒ping间隔
});

// 房间数据结构：{ 房间名: { password: '密码', users: { socket.id: {username: '用户名', isReady: false, videoResource: null} } } }
const rooms = {};

// 获取所有现有房间列表（不包含密码信息）
function getRoomList() {
  return Object.keys(rooms).map(roomName => {
    const roomData = rooms[roomName];
    return {
      name: roomName,
      userCount: Object.keys(roomData.users).length,
      hasPassword: !!roomData.password, // 只返回是否有密码，不返回密码内容
      users: Object.values(roomData.users).map(user => ({
        username: user.username,
        isReady: user.isReady
      }))
    };
  });
}

// 清理空房间（没有用户的房间）
function cleanupEmptyRooms() {
  if (!ROOM_CONFIG.KEEP_EMPTY_ROOMS) {
    Object.keys(rooms).forEach(roomName => {
      if (Object.keys(rooms[roomName].users).length === 0) {
        delete rooms[roomName];
        console.log(`清理空房间: ${roomName}`);
      }
    });
    // 清理后广播房间列表更新
    broadcastRoomListUpdate();
  } else {
    console.log('配置为保留空房间，跳过清理');
  }
}

// 延迟清理空房间（给用户一些时间重新连接）
function scheduleCleanupEmptyRooms() {
  setTimeout(() => {
    cleanupEmptyRooms();
  }, ROOM_CONFIG.CLEANUP_DELAY);
}

// 广播房间列表更新给所有客户端
function broadcastRoomListUpdate() {
  const roomList = getRoomList();
  io.emit('room_list_update', roomList);
}

// 获取房间内所有用户信息
function getRoomUsers(roomName) {
  return Object.values(rooms[roomName]?.users || {});
}

// 更新房间用户列表
function updateUserList(roomName) {
  const users = getRoomUsers(roomName);
  io.to(roomName).emit('user_list_update', users);
}

// 更新房间用户数量
function updateUserCount(roomName) {
  const userCount = Object.keys(rooms[roomName].users).length;
  io.to(roomName).emit('user_count_update', userCount);
}

// 视频同步事件处理
io.on('connection', (socket) => {
  console.log('新连接:', socket.id);

  // 创建房间
  socket.on('create_room', (data) => {
    const { username, room, password } = data;
    
    if (rooms[room]) {
      socket.emit('room_result', {
        success: false,
        message: '房间已存在，请更换房间名',
        action: 'create'
      });
      return;
    }

    rooms[room] = {
      password: password,
      users: { [socket.id]: { username: username, isReady: false, videoResource: null } }
    };

    socket.join(room);
    socket.emit('room_result', {
      success: true,
      message: `房间创建成功，欢迎 ${username}`,
      room: room,
      action: 'create'
    });
    
    updateUserCount(room);
    updateUserList(room);
    broadcastRoomListUpdate(); // 广播房间列表更新
  });

  // 加入房间
  socket.on('join_room', (data) => {
    const { username, room, password } = data;
    const roomData = rooms[room];

    if (!roomData) {
      socket.emit('room_result', {
        success: false,
        message: '房间不存在，请检查房间名',
        action: 'join'
      });
      return;
    }

    if (roomData.password !== password) {
      socket.emit('room_result', {
        success: false,
        message: '密码错误，请重新输入',
        action: 'join'
      });
      return;
    }

    roomData.users[socket.id] = { username: username, isReady: false, videoResource: null };
    socket.join(room);

    socket.emit('room_result', {
      success: true,
      message: `成功加入房间，欢迎 ${username}`,
      room: room,
      action: 'join'
    });
    
    socket.to(room).emit('system_message', { message: `${username} 加入了房间` });
    updateUserCount(room);
    updateUserList(room);
    broadcastRoomListUpdate(); // 广播房间列表更新
  });

  // 处理聊天消息
  socket.on('chat_message', (data) => {
    try {
      const { room, message, isImage } = data;
      
      // 验证用户是否在房间内
      if (!rooms[room] || !rooms[room].users[socket.id]) {
        socket.emit('message_error', { message: '您不在该房间内，无法发送消息' });
        return;
      }
      
      // 如果是图片消息，检查数据大小
      if (isImage && message) {
        const imageSizeKB = Math.round(message.length / 1024);
        console.log(`用户 ${rooms[room].users[socket.id].username} 发送图片，大小: ${imageSizeKB}KB`);
        
        // 如果图片过大，分块发送或拒绝
        if (message.length > 5 * 1024 * 1024) { // 5MB限制
          socket.emit('message_error', { message: '图片过大，请选择小于5MB的图片' });
          return;
        }
      }
      
      // 向房间内除当前用户外的其他用户广播消息
      socket.to(room).emit('chat_message', data);
      
      // 发送成功确认给发送者
      socket.emit('message_sent', { success: true });
      
    } catch (error) {
      console.error('处理聊天消息错误:', error);
      
      // 向发送者发送详细错误信息
      try {
        socket.emit('message_error', { 
          message: '消息发送失败，请检查网络连接后重试',
          error: error.message 
        });
      } catch (err) {
        console.error('无法发送错误通知:', err);
      }
    }
  });

  // 视频播放同步
  socket.on('video_play', (data) => {
    const { room } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      socket.to(room).emit('video_play', data);
    }
  });

  // 视频暂停同步
  socket.on('video_pause', (data) => {
    const { room } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      socket.to(room).emit('video_pause', data);
    }
  });

  // 视频进度同步
  socket.on('video_seek', (data) => {
    const { room } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      socket.to(room).emit('video_seek', data);
    }
  });

  // 定期同步视频时间 - 支持网络质量信息
  socket.on('sync_time', (data) => {
    const { room } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      // 传递完整的同步数据，包括网络质量信息
      socket.to(room).emit('sync_time', {
        room: data.room,
        time: data.time,
        networkQuality: data.networkQuality,
        timestamp: data.timestamp
      });
    }
  });
  
  // 网络质量检测 - ping/pong
  socket.on('network_ping', (data) => {
    // 立即返回pong响应
    socket.emit('network_pong', {
      timestamp: data.timestamp
    });
  });

  // 获取房间列表
  socket.on('get_room_list', () => {
    const roomList = getRoomList();
    socket.emit('room_list_update', roomList);
  });

  // 获取房间配置
  socket.on('get_room_config', () => {
    socket.emit('room_config_update', ROOM_CONFIG);
  });

  // 更新房间配置（可选，仅管理员使用）
  socket.on('update_room_config', (newConfig) => {
    if (newConfig.hasOwnProperty('KEEP_EMPTY_ROOMS')) {
      ROOM_CONFIG.KEEP_EMPTY_ROOMS = !!newConfig.KEEP_EMPTY_ROOMS;
      console.log(`房间配置更新: KEEP_EMPTY_ROOMS = ${ROOM_CONFIG.KEEP_EMPTY_ROOMS}`);
      
      // 如果设置为不保留，立即清理空房间
      if (!ROOM_CONFIG.KEEP_EMPTY_ROOMS) {
        cleanupEmptyRooms();
      }
      
      // 广播配置更新
      io.emit('room_config_update', ROOM_CONFIG);
    }
  });

  // 更新用户准备状态
  socket.on('update_ready_status', (data) => {
    const { room, username, isReady } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      // 更新用户准备状态
      rooms[room].users[socket.id].isReady = isReady;
      // 广播给房间内其他用户
      io.to(room).emit('user_list_update', getRoomUsers(room));
      // 发送系统消息通知
      socket.to(room).emit('system_message', { 
        message: `${username} 已${isReady ? '准备' : '取消准备'}` 
      });
    }
  });

  // 视频资源更新
  socket.on('video_resource_update', (data) => {
    const { room, videoName } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      // 更新用户视频资源
      rooms[room].users[socket.id].videoResource = videoName;
      
      // 检查房间内所有用户的视频资源是否一致
      checkVideoResourceConsistency(room);
    }
  });
  
  // 检查视频资源一致性
  function checkVideoResourceConsistency(roomName) {
    const room = rooms[roomName];
    if (!room) return;
    
    // 收集所有用户的视频资源
    const resources = [];
    const usersWithResource = [];
    
    Object.entries(room.users).forEach(([socketId, userData]) => {
      if (userData.videoResource) {
        resources.push(userData.videoResource);
        usersWithResource.push({ socketId, username: userData.username, resource: userData.videoResource });
      }
    });
    
    // 如果有多个用户且资源不一致，发送通知
    if (usersWithResource.length > 1) {
      const firstResource = resources[0];
      const allSame = resources.every(resource => resource === firstResource);
      
      if (!allSame) {
        // 找出使用不同资源的用户
        const inconsistentUsers = usersWithResource.filter(user => user.resource !== firstResource);
        
        inconsistentUsers.forEach(user => {
          io.to(user.socketId).emit('resource_mismatch', {
            message: `视频资源不一致，请确保与其他用户使用相同的视频文件`
          });
        });
      }
    }
  }
  
  // 处理用户主动离开房间
  socket.on('leave_room', (data) => {
    const { room: roomName } = data;
    const room = rooms[roomName];
    
    // 安全检查
    if (room && room.users && room.users[socket.id]) {
      const username = room.users[socket.id].username;
      delete room.users[socket.id];
      
      // 从Socket.io的房间中移除用户
      socket.leave(roomName);
      
      // 如果房间还有其他用户，更新用户列表和数量
      if (Object.keys(room.users).length > 0) {
        // 发送系统消息给房间内其他用户
        socket.to(roomName).emit('system_message', { message: `${username} 离开了房间` });
        // 更新用户数量和列表
        updateUserCount(roomName);
        updateUserList(roomName);
        broadcastRoomListUpdate(); // 广播房间列表更新
        // 延迟清理空房间
        scheduleCleanupEmptyRooms();
      } else {
        // 如果房间为空，保留房间数据（不删除房间）
        console.log(`房间 ${roomName} 现在为空，但保留房间数据`);
      }
      
      // 通知用户离开成功
      socket.emit('leave_room_success', { message: '已成功离开房间' });
    }
  });
  
  // 断开连接处理
  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(roomName => {
      const room = rooms[roomName];
      // 安全检查
      if (room && room.users && room.users[socket.id]) {
        const username = room.users[socket.id].username;
        delete room.users[socket.id];

        // 不再在断开连接时删除空房间，保留房间数据供后续使用
        if (Object.keys(room.users).length > 0) {
          // 发送系统消息给房间内其他用户
          socket.to(roomName).emit('system_message', { message: `${username} 离开了房间` });
          // 更新用户数量和列表
          updateUserCount(roomName);
          updateUserList(roomName);
          broadcastRoomListUpdate(); // 广播房间列表更新
          // 延迟清理空房间
          scheduleCleanupEmptyRooms();
        } else {
          // 房间现在为空，但保留房间数据
          console.log(`用户 ${username} 断开连接，房间 ${roomName} 现在为空，但保留房间数据`);
        }
      }
    });
    console.log('连接断开:', socket.id);
  });
});

app.use(express.static(__dirname));
server.listen(8080, () => {
  console.log('服务器运行在 http://localhost:8080');
});