const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());

// 使用記憶體資料，實務請換成DB
const users = {
  admin: { password: 'admin123', isAdmin: true, friends: [], rooms: [] },
};
const rooms = {}; // roomId: { id, name, members: [] }
const userSockets = {}; // username => socket.id

// Helper 產生隨機 ID
function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// API: 註冊
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '帳號密碼必填' });
  if (users[username]) return res.json({ ok: false, msg: '帳號已存在' });
  users[username] = { password, isAdmin: false, friends: [], rooms: [] };
  return res.json({ ok: true });
});

// API: 登入
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== password) {
    return res.json({ ok: false, msg: '帳號或密碼錯誤' });
  }
  return res.json({ ok: true, isAdmin: user.isAdmin });
});

app.use(express.static('public')); // 你的前端檔案放 public 資料夾

// 管理帳號新增刪除
function isAdmin(username) {
  return users[username]?.isAdmin;
}

// 移除用戶資料，並從好友列表清除
function removeUser(username) {
  delete users[username];
  // 從其他用戶好友清單移除
  Object.values(users).forEach(u => {
    u.friends = u.friends.filter(f => f !== username);
    // 同時移除聊天室成員
    u.rooms = u.rooms.filter(roomId => {
      const room = rooms[roomId];
      if (!room) return false;
      room.members = room.members.filter(m => m !== username);
      if (room.members.length === 0) delete rooms[roomId];
      return rooms[roomId] !== undefined;
    });
  });
  // 刪除該用戶的聊天室
  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    room.members = room.members.filter(m => m !== username);
    if (room.members.length === 0) delete rooms[roomId];
  });
}

io.use((socket, next) => {
  const username = socket.handshake.auth.token;
  if (!username || !users[username]) {
    return next(new Error('未授權'));
  }
  socket.username = username;
  next();
});

io.on('connection', (socket) => {
  userSockets[socket.username] = socket.id;

  // 傳送好友與聊天室列表
  function emitLists() {
    const user = users[socket.username];
    socket.emit('friends', user.friends);
    // rooms資料轉陣列且帶id與name
    const userRooms = user.rooms.map(rid => rooms[rid]).filter(r => r);
    socket.emit('rooms', userRooms);
  }
  emitLists();

  // 加好友（互相加入）
  socket.on('addFriend', (friendName) => {
    if (!friendName || friendName === socket.username) {
      socket.emit('system', '無效的好友名稱');
      return;
    }
    if (!users[friendName]) {
      socket.emit('system', '找不到此用戶');
      return;
    }
    const user = users[socket.username];
    if (!user.friends.includes(friendName)) user.friends.push(friendName);
    const friend = users[friendName];
    if (!friend.friends.includes(socket.username)) friend.friends.push(socket.username);

    emitLists();
    // 對方在線的話也更新好友列表
    const friendSocketId = userSockets[friendName];
    if (friendSocketId) {
      io.to(friendSocketId).emit('friends', friend.friends);
    }
    socket.emit('system', `已成功加好友 ${friendName}`);
  });

  // 創建聊天室（不能重名）
  socket.on('createRoom', (roomName) => {
    if (!roomName) {
      socket.emit('system', '聊天室名稱不可空白');
      return;
    }
    if (Object.values(rooms).some(r => r.name === roomName)) {
      socket.emit('system', '聊天室名稱已存在');
      return;
    }
    const roomId = genId();
    rooms[roomId] = { id: roomId, name: roomName, members: [socket.username] };
    users[socket.username].rooms.push(roomId);

    emitLists();
    socket.emit('system', `聊天室 ${roomName} 已建立`);
  });

  // 加入聊天室
  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) {
      socket.emit('system', '聊天室不存在');
      return;
    }
    if (!rooms[roomId].members.includes(socket.username)) {
      rooms[roomId].members.push(socket.username);
      users[socket.username].rooms.push(roomId);
      emitLists();
    }
    socket.join(roomId);
    socket.emit('system', `加入聊天室：${rooms[roomId].name}`);
  });

  // 聊天訊息
  socket.on('chat', ({ roomId, text }) => {
    if (!rooms[roomId]) {
      socket.emit('system', '聊天室不存在');
      return;
    }
    if (!rooms[roomId].members.includes(socket.username)) {
      socket.emit('system', '你不在此聊天室中');
      return;
    }
    io.to(roomId).emit('message', { from: socket.username, text });
  });

  // 管理員新增帳號
  socket.on('adminAdd', ({ username: newUser, password }) => {
    if (!isAdmin(socket.username)) {
      socket.emit('system', '沒有管理員權限');
      return;
    }
    if (users[newUser]) {
      socket.emit('system', '帳號已存在');
      return;
    }
    users[newUser] = { password, isAdmin: false, friends: [], rooms: [] };
    socket.emit('system', `成功新增帳號 ${newUser}`);
  });

  // 管理員刪除帳號
  socket.on('adminDel', (delUser) => {
    if (!isAdmin(socket.username)) {
      socket.emit('system', '沒有管理員權限');
      return;
    }
    if (!users[delUser]) {
      socket.emit('system', '帳號不存在');
      return;
    }
    if (delUser === socket.username) {
      socket.emit('system', '無法刪除自己');
      return;
    }
    removeUser(delUser);
    socket.emit('system', `成功刪除帳號 ${delUser}`);

    // 如果該用戶在線，通知並斷線
    const sId = userSockets[delUser];
    if (sId) {
      io.to(sId).emit('system', '你的帳號已被刪除');
      io.sockets.sockets.get(sId)?.disconnect();
    }
  });

  socket.on('disconnect', () => {
    delete userSockets[socket.username];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
