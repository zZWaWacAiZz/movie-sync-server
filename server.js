const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const https = require('https');
const url = require('url');

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

// === 缓存优化配置 ===
// 为静态文件设置缓存头，提升加载速度
const cacheOptions = {
  maxAge: '1h',      // 缓存1小时
  etag: true,        // 启用ETag验证
  lastModified: true // 启用最后修改时间验证
};

// 移动端测试页面路由
app.get('/mobile-test', (req, res) => {
  res.sendFile(__dirname + '/mobile-test.html');
});
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10e6, // 10MB，增加消息大小限制
  pingTimeout: 60000, // 60秒ping超时
  pingInterval: 25000 // 25秒ping间隔
});

// 用户socket映射：用于精确发送视频状态响应等消息
const users = {};

// 房间数据结构：{ 房间名: { password: '密码', users: { socket.id: {username: '用户名', isReady: false, videoResource: null, isHost: false} } } }
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
        isReady: user.isReady,
        isHost: user.isHost // 添加房主标识
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
  if (!rooms[roomName] || !rooms[roomName].users) {
    return [];
  }
  
  // 确保返回包含完整用户信息的对象数组
  return Object.values(rooms[roomName].users).map(user => ({
    username: user.username,
    isReady: user.isReady,
    videoResource: user.videoResource,
    isHost: user.isHost,
    ping: user.ping || 0,
    customAvatar: user.customAvatar || null // 添加自定义头像信息
  }));
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
      users: { [socket.id]: { username: username, isReady: false, videoResource: null, isHost: true } }
    }
    
    // 保存用户socket信息
    users[socket.id] = { socket: socket, username: username, room: room };

    socket.join(room);
    socket.emit('room_result', {
      success: true,
      message: `房间创建成功，欢迎 ${username}（房主）`,
      room: room,
      action: 'create',
      isHost: true
    });
    
    updateUserCount(room);
    updateUserList(room);
    broadcastRoomListUpdate(); // 广播房间列表更新
  });

  // 加入房间
  socket.on('join_room', (data) => {
    const { username, room, password, fromSmallModal } = data;
    const roomData = rooms[room];

    if (!roomData) {
      socket.emit('room_result', {
        success: false,
        message: '房间不存在，请检查房间名',
        action: 'join',
        fromSmallModal: fromSmallModal || false
      });
      return;
    }

    if (roomData.password !== password) {
      socket.emit('room_result', {
        success: false,
        message: '密码错误，请重新输入',
        action: 'join',
        fromSmallModal: fromSmallModal || false
      });
      return;
    }

    roomData.users[socket.id] = { username: username, isReady: false, videoResource: null, isHost: false };
    
    // 保存用户socket信息
    users[socket.id] = { socket: socket, username: username, room: room }
    socket.join(room);

    socket.emit('room_result', {
        success: true,
        message: `成功加入房间，欢迎 ${username}`,
        room: room,
        action: 'join',
        isHost: false,
        fromSmallModal: fromSmallModal || false
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

  // 处理视频状态请求
  socket.on('video_state_request', (data) => {
    const { room } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      console.log(`用户 ${rooms[room].users[socket.id].username} 请求房间 ${room} 的视频状态`);
      // 将请求广播给房间内除请求者外的其他用户
      socket.to(room).emit('video_state_request', {
        room: room,
        requestor: socket.id
      });
    }
  });

  // 处理视频状态响应
  socket.on('video_state_response', (data) => {
    const { room, requestor } = data;
    if (rooms[room] && rooms[room].users[socket.id]) {
      console.log(`用户 ${rooms[room].users[socket.id].username} 响应房间 ${room} 的视频状态请求，播放状态：${data.isPlaying ? '播放中' : '已暂停'}，时间：${data.currentTime.toFixed(2)}s`);
      // 将响应只发送给请求的用户
      if (requestor && users[requestor]) {
        users[requestor].socket.emit('video_state_response', data);
      }
    }
  });

  // 存储用户socket映射，用于精确发送响应
  socket.on('disconnect', () => {
    // 移除用户socket映射
    if (users[socket.id]) {
      delete users[socket.id];
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
  
  // 房主转让功能
  socket.on('transfer_host', (data) => {
    const { room: roomName, targetUsername } = data;
    const room = rooms[roomName];
    
    // 安全检查
    if (room && room.users && room.users[socket.id] && room.users[socket.id].isHost) {
      // 找到目标用户名对应的socketId
      let targetSocketId = null;
      for (const [id, userData] of Object.entries(room.users)) {
        if (userData.username === targetUsername) {
          targetSocketId = id;
          break;
        }
      }
      
      if (targetSocketId) {
        // 取消当前用户的房主身份
        room.users[socket.id].isHost = false;
        // 设置目标用户为房主
        room.users[targetSocketId].isHost = true;
        
        // 通知房间内所有用户房主已变更
        io.to(roomName).emit('system_message', {
          message: `${room.users[socket.id].username} 已将房主身份转让给 ${room.users[targetSocketId].username}`
        });
        
        // 发送房主变更事件，用于前端更新UI状态
        io.to(roomName).emit('host_changed', {
          room: roomName,
          oldHost: room.users[socket.id].username,
          newHost: room.users[targetSocketId].username
        });
        
        // 更新用户列表
        updateUserList(roomName);
        
        // 通知新房主
        io.to(targetSocketId).emit('host_transfer_notification', {
          message: '您已成为新的房主'
        });
      }
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
        usersWithResource.push({ 
          socketId, 
          username: userData.username, 
          resource: userData.videoResource,
          isHost: userData.isHost
        });
      }
    });
    
    // 如果有多个用户且资源不一致，发送通知
    if (usersWithResource.length > 1) {
      // 使用Set来检查是否存在多种不同的资源
      const uniqueResources = new Set(resources);
      const allSame = uniqueResources.size === 1;
      
      if (!allSame) {
        console.log(`房间 ${roomName} 检测到视频资源不一致，向所有用户发送通知`);
        
        // 找出所有不同的资源和对应的用户
        const resourceGroups = new Map();
        usersWithResource.forEach(user => {
          if (!resourceGroups.has(user.resource)) {
            resourceGroups.set(user.resource, []);
          }
          resourceGroups.get(user.resource).push(user.username);
        });
        
        // 向所有用户发送通知
        io.to(roomName).emit('video_resource_inconsistent', {
          message: '检测到视频资源不一致',
          inconsistentUsers: Object.fromEntries(resourceGroups)
        });
        
        console.log(`向房间 ${roomName} 所有用户发送视频资源不一致通知`);
      } else {
        console.log(`房间 ${roomName} 所有用户视频资源一致`);
      }
    } else {
      console.log(`房间 ${roomName} 用户数量不足，无法检查视频资源一致性`);
    }
  }
  
  // 处理用户主动离开房间
  socket.on('leave_room', (data) => {
    const { room: roomName } = data;
    const room = rooms[roomName];
    
    // 安全检查
    if (!room) {
      console.log(`用户 ${socket.id} 尝试离开不存在的房间: ${roomName}`);
      socket.emit('leave_room_error', { message: '房间不存在或已关闭' });
      return;
    }
    
    if (!room.users || !room.users[socket.id]) {
      console.log(`用户 ${socket.id} 不在房间 ${roomName} 中`);
      socket.emit('leave_room_error', { message: '您不在该房间中' });
      return;
    }
    
    const username = room.users[socket.id].username;
    const wasHost = room.users[socket.id].isHost;
    
    // 删除用户
    delete room.users[socket.id];
    
    // 从Socket.io的房间中移除用户
    socket.leave(roomName);
    
    // 如果房间还有其他用户
    if (Object.keys(room.users).length > 0) {
      // 如果离开的是房主，需要转移房主身份
      if (wasHost) {
        // 找到第一个用户并设为房主
        const firstSocketId = Object.keys(room.users)[0];
        room.users[firstSocketId].isHost = true;
        
        // 通知房间内所有用户房主已变更
        io.to(roomName).emit('system_message', { 
          message: `${username} 已离开房间，${room.users[firstSocketId].username} 成为新房主` 
        });
        
        // 通知新房主
        io.to(firstSocketId).emit('host_transfer_notification', {
          message: '您已成为新的房主'
        });
      } else {
        // 发送系统消息给房间内其他用户
        socket.to(roomName).emit('system_message', { message: `${username} 离开了房间` });
      }
      
      // 更新用户数量和列表
      updateUserCount(roomName);
      updateUserList(roomName);
      broadcastRoomListUpdate(); // 广播房间列表更新
      // 延迟清理空房间
      scheduleCleanupEmptyRooms();
    } else {
      // 如果房间为空，设置10秒后删除房间
      console.log(`房间 ${roomName} 现在为空，10秒后删除`);
      setTimeout(() => {
        if (room && Object.keys(room.users).length === 0) {
          delete rooms[roomName];
          console.log(`房间 ${roomName} 已删除`);
          broadcastRoomListUpdate(); // 广播房间列表更新
        }
      }, 10000); // 10秒后删除房间
    }
    
    // 通知用户离开成功
    socket.emit('leave_room_success', { message: '已成功离开房间' });
  });
  
  // 处理请求用户列表
    socket.on('request_user_list', (data) => {
        const { room } = data;
        if (rooms[room]) {
            // 使用getRoomUsers函数确保返回格式化的用户对象数组
            const users = getRoomUsers(room);
            socket.emit('user_list_update', users);
        }
    });

    // 处理视频资源更新请求
    socket.on('video_resource_update', (data) => {
        const { room, videoName } = data;
        if (rooms[room] && rooms[room].users[socket.id]) {
            // 更新当前用户的视频资源
            rooms[room].users[socket.id].currentVideo = videoName;
            
            // 立即检查视频资源一致性
            checkVideoResourceConsistency(room);
        }
    });

    // 处理共享视频链接
  socket.on('share_video', (data) => {
      const { room, url, username, currentTime, preservePause } = data;
      
      console.log('收到共享视频请求:', { room, url, username, currentTime, preservePause });
      
      if (!room || !url) {
          console.error('共享视频失败：缺少必要参数', { room, url });
          socket.emit('share_video_error', { message: '缺少必要的参数' });
          return;
      }
      
      if (!rooms[room]) {
          console.error('共享视频失败：房间不存在', room);
          socket.emit('share_video_error', { message: '房间不存在' });
          return;
      }
      
      // 验证URL格式
      if (!isValidVideoUrl(url)) {
          console.error('共享视频失败：无效的链接格式', url);
          socket.emit('share_video_error', { message: '无效的链接格式' });
          return;
      }
      
      console.log('验证通过，准备广播共享视频');
      
      // 更新房间内所有用户的视频资源标识为新链接，避免资源不一致提示
      const roomData = rooms[room];
      Object.keys(roomData.users).forEach(socketId => {
        roomData.users[socketId].currentVideo = url;
      });
      
      // 广播共享的视频链接给房间内的所有用户（包括发送者）
      // 根据preservePause参数决定是否使用实际的暂停时间
      const startFromTime = (preservePause === true) ? currentTime : 0;
      io.to(room).emit('video_shared', {
          url: url,
          username: username || '匿名用户',
          currentTime: startFromTime, // 使用实际的暂停时间或从0开始
          shouldPlay: false, // 明确指示不自动播放
          timestamp: new Date().toISOString(),
          isNewVideo: true, // 标记这是新共享的视频
          skipConsistencyCheck: true // 跳过资源一致性检查
      });
      
      // 延迟发送资源一致性检查，给客户端时间更新状态
      // 共享视频不触发资源一致性检查
      setTimeout(() => {
        // 检查是否需要跳过一致性检查
        const roomData = rooms[room];
        if (roomData && roomData.skipNextConsistencyCheck) {
          console.log('🚫 跳过共享视频的资源一致性检查');
          roomData.skipNextConsistencyCheck = false; // 重置标记
        } else {
          checkVideoResourceConsistency(room);
        }
      }, 1000);
      
      // 标记跳过下一次一致性检查
      rooms[room].skipNextConsistencyCheck = true;
      
      const startMsg = (preservePause === true) ? `从${currentTime}秒开始` : "从0秒开始";
      console.log(`✅ 用户 ${username} 在房间 ${room} 共享了新视频链接: ${url}，${startMsg}`);
  });
  
  // 处理头像更新
  socket.on('avatar_update', (data) => {
    const { room, username, avatar } = data;
    
    console.log('收到头像更新请求:', { room, username });
    
    if (!room || !username || !avatar) {
      console.error('头像更新失败：缺少必要参数', { room, username, avatar });
      socket.emit('avatar_update_error', { message: '缺少必要的参数' });
      return;
    }
    
    if (!rooms[room]) {
      console.error('头像更新失败：房间不存在', room);
      socket.emit('avatar_update_error', { message: '房间不存在' });
      return;
    }
    
    // 检查用户是否在房间内
    const roomData = rooms[room];
    let userSocketId = null;
    for (const [socketId, userData] of Object.entries(roomData.users)) {
      if (userData.username === username) {
        userSocketId = socketId;
        break;
      }
    }
    
    if (!userSocketId) {
      console.error('头像更新失败：用户不在房间内', { room, username });
      socket.emit('avatar_update_error', { message: '用户不在房间内' });
      return;
    }
    
    // 保存用户的自定义头像数据
    roomData.users[userSocketId].customAvatar = avatar;
    
    // 广播头像更新给房间内的所有其他用户
    socket.to(room).emit('avatar_updated', {
      username: username,
      avatar: avatar
    });
    
    console.log(`✅ 用户 ${username} 在房间 ${room} 更新了头像`);
  });
  
  // 检查房间视频资源一致性
    function checkVideoResourceConsistency(room) {
        if (!rooms[room]) return;
        
        const roomData = rooms[room];
        const users = roomData.users;
        const userIds = Object.keys(users);
        
        if (userIds.length <= 1) return; // 只有一个用户不需要检查
        
        // 收集所有用户的视频标识（简化比较）
        const videoIds = {};
        userIds.forEach(userId => {
            if (users[userId].currentVideo) {
                let videoId = users[userId].currentVideo;
                
                // 对于网络视频，提取关键部分进行比较
                 if (videoId.startsWith('NETWORK_')) {
                     videoId = videoId.replace('NETWORK_', '');
                     // 移除时间戳参数，确保相同链接被正确识别
                     try {
                         const url = new URL(videoId);
                         // 移除常见的时间戳参数
                         url.searchParams.delete('t');
                         url.searchParams.delete('timestamp');
                         url.searchParams.delete('_');
                         videoId = url.toString();
                     } catch (e) {
                         // 如果URL格式无效，保持原样
                         videoId = videoId.split('?')[0].split('&')[0];
                     }
                 }
                // 对于本地视频，提取文件名进行比较
                else if (videoId.startsWith('LOCAL_')) {
                    videoId = videoId.replace('LOCAL_', '');
                }
                
                videoIds[userId] = videoId;
            }
        });
        
        // 过滤掉无效或空的视频标识
        const validVideoIds = Object.values(videoIds).filter(id => id && id !== 'none');
        if (validVideoIds.length <= 1) return; // 只有一个有效视频
        
        const uniqueIds = [...new Set(validVideoIds)];
        
        // 如果所有用户的视频都相同，则发送"已同步"通知
        if (uniqueIds.length <= 1) {
            console.log(`房间 ${room} 视频资源一致，发送同步通知`);
            
            // 当检测到资源一致时，主动清除之前的错误状态
            io.to(room).emit('video_resource_consistent', {
                message: '视频资源已同步',
                consistent: true,
                timestamp: Date.now()
            });
            return;
        }
        
        // 额外检查：如果所有链接都指向同一个视频源（即使参数不同）
        const normalizedUrls = uniqueIds.map(id => {
            if (id.includes('youtube.com') || id.includes('youtu.be')) {
                // YouTube视频提取视频ID
                const match = id.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
                return match ? `youtube_${match[1]}` : id;
            }
            
            // 抖音视频处理
            if (id.includes('douyinvod.com') || id.includes('douyin.com')) {
                // 提取抖音视频ID
                const match = id.match(/\/([a-f0-9]{32})\./);
                return match ? `douyin_${match[1]}` : id;
            }
            
            return id;
        });
        
        const finalUniqueUrls = [...new Set(normalizedUrls)];
        if (finalUniqueUrls.length <= 1) {
            console.log(`房间 ${room} 视频资源实际相同，发送同步通知`);
            
            // 当检测到资源一致时，主动清除之前的错误状态
            io.to(room).emit('video_resource_consistent', {
                message: '视频资源已同步',
                consistent: true,
                timestamp: Date.now()
            });
            return;
        }
        
        // 找出使用不同视频的用户
        const inconsistentUsers = {};
        const firstVideoId = uniqueIds[0];
        
        Object.keys(videoIds).forEach(userId => {
            if (videoIds[userId] !== firstVideoId) {
                inconsistentUsers[userId] = {
                    username: users[userId].username,
                    videoUrl: users[userId].currentVideo
                };
            }
        });
        
        if (Object.keys(inconsistentUsers).length > 0) {
            console.log(`房间 ${room} 检测到视频资源不一致:`, inconsistentUsers);
            
            // 找出使用主流视频的用户（大多数用户使用的视频）
            const videoCounts = {};
            Object.keys(videoIds).forEach(userId => {
                const videoId = videoIds[userId];
                videoCounts[videoId] = (videoCounts[videoId] || 0) + 1;
            });
            
            let mainVideoId = Object.keys(videoCounts)[0];
            let maxCount = videoCounts[mainVideoId];
            Object.keys(videoCounts).forEach(videoId => {
                if (videoCounts[videoId] > maxCount) {
                    maxCount = videoCounts[videoId];
                    mainVideoId = videoId;
                }
            });
            
            // 找出切换了视频的用户（使用非主流视频的用户）
            const switchedUsers = {};
            Object.keys(videoIds).forEach(userId => {
                if (videoIds[userId] !== mainVideoId) {
                    switchedUsers[userId] = {
                        username: users[userId].username,
                        videoUrl: users[userId].currentVideo
                    };
                }
            });
            
            // 向所有用户发送资源不一致通知，包含切换者信息
            Object.keys(users).forEach(userId => {
                const currentUser = users[userId];
                const isSwitchedUser = switchedUsers[userId];
                
                let personalizedMessage = '';
                let switchedUsernames = Object.values(switchedUsers).map(u => u.username);
                
                if (isSwitchedUser) {
                    // 这是切换了视频的用户
                    const otherUsers = switchedUsernames.filter(name => name !== currentUser.username);
                    if (otherUsers.length > 0) {
                        personalizedMessage = `你切换了视频资源，与${otherUsers.join('、')}的视频不一致`;
                    } else {
                        const consistentUsers = Object.keys(users).filter(id => !switchedUsers[id]).map(id => users[id].username);
                        personalizedMessage = `你切换了视频资源，与${consistentUsers.join('、')}的视频不一致`;
                    }
                } else {
                    // 这是保持原视频的用户
                    if (switchedUsernames.length === 1) {
                        personalizedMessage = `${switchedUsernames[0]}切换了视频资源，与你的视频不一致`;
                    } else {
                        personalizedMessage = `${switchedUsernames.join('、')}切换了视频资源，与你的视频不一致`;
                    }
                }
                
                io.to(userId).emit('video_resource_inconsistent', {
                    message: personalizedMessage,
                    inconsistentUsers: inconsistentUsers,
                    switchedUsers: switchedUsers,
                    isCurrentUserSwitched: !!isSwitchedUser,
                    timestamp: Date.now(),
                    debounceId: Math.random().toString(36).substr(2, 9)
                });
            });
            
            console.log(`房间 ${room} 检测到视频资源不一致，发送个性化通知`);
        } else {
            console.log(`房间 ${room} 视频资源实际一致，无需警告`);
        }
    }
    
    // 验证视频URL格式的辅助函数
    function isValidVideoUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        // 检查是否为有效的HTTP(S) URL
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(url)) return false;
        
        // 检查常见的视频格式和流媒体域名
        const videoExtensions = ['.mp4', '.m3u8', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.mpg'];
        const lowerUrl = url.toLowerCase();
        
        // 检查文件扩展名或常见视频流媒体域名
        return videoExtensions.some(ext => lowerUrl.includes(ext)) ||
               lowerUrl.includes('douyinvod.com') ||
               lowerUrl.includes('douyin.com') ||
               lowerUrl.includes('youtube.com') ||
               lowerUrl.includes('vimeo.com') ||
               lowerUrl.includes('bilibili.com') ||
               lowerUrl.includes('iqiyi.com') ||
               lowerUrl.includes('youku.com') ||
               lowerUrl.includes('tencent.com') ||
               lowerUrl.includes('qq.com') ||
               lowerUrl.includes('stream') ||
               lowerUrl.includes('video');
    }
  
  // 断开连接处理
  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(roomName => {
      const room = rooms[roomName];
      // 安全检查
      if (room && room.users && room.users[socket.id]) {
        const username = room.users[socket.id].username;
        const wasHost = room.users[socket.id].isHost;
        
        delete room.users[socket.id];

        // 如果房间还有其他用户
        if (Object.keys(room.users).length > 0) {
          // 如果离开的是房主，需要转移房主身份
          if (wasHost) {
            // 找到第一个用户并设为房主
            const firstSocketId = Object.keys(room.users)[0];
            room.users[firstSocketId].isHost = true;
            
            // 通知房间内所有用户房主已变更
            socket.to(roomName).emit('system_message', { 
              message: `${username} 已离开房间，${room.users[firstSocketId].username} 成为新房主` 
            });
            
            // 通知新房主
            io.to(firstSocketId).emit('host_transfer_notification', {
              message: '您已成为新的房主'
            });
          } else {
            // 发送系统消息给房间内其他用户
            socket.to(roomName).emit('system_message', { message: `${username} 离开了房间` });
          }
          
          // 更新用户数量和列表
          updateUserCount(roomName);
          updateUserList(roomName);
          broadcastRoomListUpdate(); // 广播房间列表更新
          // 延迟清理空房间
          scheduleCleanupEmptyRooms();
        } else {
          // 房间现在为空，设置10秒后删除房间
          console.log(`用户 ${username} 断开连接，房间 ${roomName} 现在为空，10秒后删除`);
          setTimeout(() => {
            if (room && Object.keys(room.users).length === 0) {
              delete rooms[roomName];
              console.log(`房间 ${roomName} 已删除`);
              broadcastRoomListUpdate(); // 广播房间列表更新
            }
          }, 10000); // 10秒后删除房间
        }
      }
    });
    console.log('连接断开:', socket.id);
  });
});

// 抖音直链代理 - 主节点
app.use('/proxy/douyin', (req, res) => {
  // 只处理GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只支持GET请求' });
  }

  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: '缺少URL参数' });
  }

  // 验证是否为抖音域名
  const douyinDomains = [
    'douyinvod.com',
    'douyin.com',
    'v.douyin.com',
    'www.douyin.com',
    'v3-web-prime.douyinvod.com',
    'v1-cold.douyinvod.com',
    'v9-cold.douyinvod.com'
  ];
  
  try {
    const lowerUrl = targetUrl.toLowerCase();
    const isValidDouyinUrl = douyinDomains.some(domain => lowerUrl.includes(domain));
    if (!isValidDouyinUrl) {
      return res.status(403).json({ error: '只允许代理抖音相关域名' });
    }

    const parsedUrl = url.parse(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Origin': 'https://www.douyin.com'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // 检查响应是否已经结束
      if (res.headersSent) {
        return;
      }

      try {
        // 设置跨域头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // 转发响应头
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });

        // 设置内容类型
        if (proxyRes.headers['content-type']) {
          res.setHeader('Content-Type', proxyRes.headers['content-type']);
        }

        // 转发响应状态码
        res.statusCode = proxyRes.statusCode;

        // 转发响应数据
        proxyRes.pipe(res);
      } catch (error) {
        console.error('代理响应处理错误:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: '代理响应处理失败' });
        }
      }
    });

    proxyReq.on('error', (err) => {
      console.error('代理请求错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: '代理请求失败', details: err.message });
      }
    });

    // 设置超时
    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: '代理请求超时' });
      }
    });

    proxyReq.end();

  } catch (error) {
    console.error('代理处理错误:', error);
    res.status(500).json({ error: '代理处理失败', details: error.message });
  }
});

// 备用代理节点1
app.use('/proxy/backup1', (req, res) => {
  // 只处理GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只支持GET请求' });
  }

  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: '缺少URL参数' });
  }

  // 验证是否为抖音域名
  const douyinDomains = [
    'douyinvod.com',
    'douyin.com',
    'v.douyin.com',
    'www.douyin.com',
    'v3-web-prime.douyinvod.com',
    'v1-cold.douyinvod.com',
    'v9-cold.douyinvod.com'
  ];
  
  try {
    const lowerUrl = targetUrl.toLowerCase();
    const isValidDouyinUrl = douyinDomains.some(domain => lowerUrl.includes(domain));
    if (!isValidDouyinUrl) {
      return res.status(403).json({ error: '只允许代理抖音相关域名' });
    }

    const parsedUrl = url.parse(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Origin': 'https://www.douyin.com'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      if (res.headersSent) return;
      try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
        if (proxyRes.headers['content-type']) {
          res.setHeader('Content-Type', proxyRes.headers['content-type']);
        }
        res.statusCode = proxyRes.statusCode;
        proxyRes.pipe(res);
      } catch (error) {
        console.error('备用代理1响应处理错误:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: '备用代理1响应处理失败' });
        }
      }
    });

    proxyReq.on('error', (err) => {
      console.error('备用代理1请求错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: '备用代理1请求失败', details: err.message });
      }
    });

    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: '备用代理1请求超时' });
      }
    });

    proxyReq.end();

  } catch (error) {
    console.error('备用代理1处理错误:', error);
    res.status(500).json({ error: '备用代理1处理失败', details: error.message });
  }
});

// 备用代理节点2
app.use('/proxy/backup2', (req, res) => {
  // 只处理GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只支持GET请求' });
  }

  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: '缺少URL参数' });
  }

  // 验证是否为抖音域名
  const douyinDomains = [
    'douyinvod.com',
    'douyin.com',
    'v.douyin.com',
    'www.douyin.com',
    'v3-web-prime.douyinvod.com',
    'v1-cold.douyinvod.com',
    'v9-cold.douyinvod.com'
  ];
  
  try {
    const lowerUrl = targetUrl.toLowerCase();
    const isValidDouyinUrl = douyinDomains.some(domain => lowerUrl.includes(domain));
    if (!isValidDouyinUrl) {
      return res.status(403).json({ error: '只允许代理抖音相关域名' });
    }

    const parsedUrl = url.parse(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Origin': 'https://www.douyin.com'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      if (res.headersSent) return;
      try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
        if (proxyRes.headers['content-type']) {
          res.setHeader('Content-Type', proxyRes.headers['content-type']);
        }
        res.statusCode = proxyRes.statusCode;
        proxyRes.pipe(res);
      } catch (error) {
        console.error('备用代理2响应处理错误:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: '备用代理2响应处理失败' });
        }
      }
    });

    proxyReq.on('error', (err) => {
      console.error('备用代理2请求错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: '备用代理2请求失败', details: err.message });
      }
    });

    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: '备用代理2请求超时' });
      }
    });

    proxyReq.end();

  } catch (error) {
    console.error('备用代理2处理错误:', error);
    res.status(500).json({ error: '备用代理2处理失败', details: error.message });
  }
});

// 使用缓存优化的静态文件服务
app.use(express.static(__dirname, cacheOptions));

// 为不同类型的文件设置不同的缓存策略
app.use('/css', express.static(__dirname + '/css', {
  maxAge: '1h', // CSS文件缓存1小时
  etag: true
}));

app.use('/js', express.static(__dirname + '/js', {
  maxAge: '1h', // JS文件缓存1小时  
  etag: true
}));
const port = process.argv[2] || 3000;
server.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});