const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public')); // 你前端放 public 資料夾或根目錄

// 記憶體資料
const users = {
  admin: { password: '123456', friends: [] }
};
const rooms = []; // { id, name, members: [username] }
let roomIdSeq = 1;

// Helper: 產生房間 ID
function genRoomId() {
  return 'room-' + roomIdSeq++;
}

// 登入 API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '帳密不可空白' });
  const u = users[username];
  if (!u || u.password !== password) return res.json({ ok: false, msg: '帳號或密碼錯誤' });
  // 簡單 token 用 username
  res.json({ ok: true, token: username });
});

// 註冊 API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '帳密不可空白' });
  if (users[username]) return res.json({ ok: false, msg: '帳號已存在' });
  users[username] = { password, friends: [] };
  res.json({ ok: true });
});

// 管理員新增帳號
io.on('connection', (socket) => {
  // 驗證 token
  socket.on('auth', (token) => {
    if (!users[token]) {
      socket.emit('system', '驗證失敗');
      socket.disconnect();
      return;
    }
    socket.username = token;
    socket.emit('system', `歡迎 ${token}`);

    // 送出好友與聊天室列表
    sendFriends(socket);
    sendRooms(socket);

    // 處理前端事件
    socket.on('createRoom', (roomName) => {
      // 一個人不能有重名聊天室
      if (rooms.find(r => r.name === roomName && r.members.includes(socket.username))) {
        socket.emit('system', '聊天室名稱已存在');
        return;
      }
      const id = genRoomId();
      const room = { id, name: roomName, members: [socket.username] };
      rooms.push(room);
      socket.join(id);
      sendRoomsToAll(socket.username);
      socket.emit('system', `已建立聊天室 ${roomName}`);
    });

    socket.on('joinRoom', (roomId) => {
      const room = rooms.find(r => r.id === roomId);
      if (!room) {
        socket.emit('system', '聊天室不存在');
        return;
      }
      if (!room.members.includes(socket.username)) room.members.push(socket.username);
      socket.join(roomId);
      socket.emit('system', `已加入聊天室 ${room.name}`);
      sendRoomsToAll(socket.username);
    });

    socket.on('chat', ({ roomId, text }) => {
      if (!text || !roomId) return;
      const room = rooms.find(r => r.id === roomId);
      if (!room || !room.members.includes(socket.username)) {
        socket.emit('system', '無法發送訊息，未加入該聊天室');
        return;
      }
      io.to(roomId).emit('message', { room: roomId, from: socket.username, text });
    });

    socket.on('addFriend', (friendName) => {
      if (!users[friendName]) {
        socket.emit('system', '好友不存在');
        return;
      }
      if (friendName === socket.username) {
        socket.emit('system', '不能加自己為好友');
        return;
      }
      const userData = users[socket.username];
      if (!userData.friends.includes(friendName)) {
        userData.friends.push(friendName);
      }
      // 互加好友
      const friendData = users[friendName];
      if (!friendData.friends.includes(socket.username)) {
        friendData.friends.push(socket.username);
      }
      sendFriendsToAll(socket.username);
      sendFriendsToAll(friendName);
      socket.emit('system', `已新增好友 ${friendName}`);
    });

    // 管理員操作新增帳號
    socket.on('adminAdd', ({ username, password }) => {
      if (socket.username !== 'admin') return socket.emit('system', '沒有權限');
      if (!username || !password) return socket.emit('system', '帳密不可空白');
      if (users[username]) return socket.emit('system', '帳號已存在');
      users[username] = { password, friends: [] };
      socket.emit('system', `已新增帳號 ${username}`);
    });

    // 管理員刪除帳號
    socket.on('adminDel', (username) => {
      if (socket.username !== 'admin') return socket.emit('system', '沒有權限');
      if (!users[username]) return socket.emit('system', '帳號不存在');
      // 從好友列表移除
      Object.values(users).forEach(u => {
        const idx = u.friends.indexOf(username);
        if (idx !== -1) u.friends.splice(idx, 1);
      });
      // 刪除使用者本人
      delete users[username];
      // 移除該使用者聊天室成員
      rooms.forEach(r => {
        const idx = r.members.indexOf(username);
        if (idx !== -1) r.members.splice(idx, 1);
      });
      socket.emit('system', `已刪除帳號 ${username}`);
      sendFriendsToAll(socket.username);
    });
  });
});

// 輸出好友清單給該使用者
function sendFriends(socket) {
  const userData = users[socket.username];
  if (!userData) return;
  socket.emit('friends', userData.friends);
}
// 送給所有有連線的該用戶（多裝置時）
function sendFriendsToAll(username) {
  for (const [id, s] of io.of('/').sockets) {
    if (s.username === username) sendFriends(s);
  }
}
// 輸出聊天室給該使用者（有該人為成員）
function sendRooms(socket) {
  if (!users[socket.username]) return;
  const list = rooms.filter(r => r.members.includes(socket.username)).map(r => ({ id: r.id, name: r.name }));
  socket.emit('rooms', list);
}
// 送給所有連線該用戶
function sendRoomsToAll(username) {
  for (const [id, s] of io.of('/').sockets) {
    if (s.username === username) sendRooms(s);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

