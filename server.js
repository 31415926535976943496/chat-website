// 完整的 server.js 配合 index.html 使用（已修正好友邀請對方無法即時收到的問題）
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

let users = {
  admin: { password: '123456', friends: [], rooms: [] }
};
let rooms = {}; // roomId: { name, users: [], messages: [] }
let roomCount = 1;

// ===== API: 註冊 =====
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '帳號密碼不可為空' });
  if (users[username]) return res.json({ ok: false, msg: '帳號已存在' });
  users[username] = { password, friends: [], rooms: [] };
  return res.json({ ok: true });
});

// ===== API: 登入 =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!users[username]) return res.json({ ok: false, msg: '帳號不存在' });
  if (users[username].password !== password) return res.json({ ok: false, msg: '密碼錯誤' });
  return res.json({ ok: true, token: username });
});

// ===== Socket 連線驗證 =====
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!users[token]) return next(new Error('未授權'));
  socket.username = token;
  next();
});

// ===== Socket 事件處理 =====
io.on('connection', (socket) => {
  const user = users[socket.username];
  socket.emit('friends', user.friends);
  socket.emit('rooms', user.rooms.map(id => ({ id, name: rooms[id].name })));

  socket.on('createRoom', (roomName) => {
    const roomId = 'room-' + roomCount++;
    rooms[roomId] = { name: roomName, users: [socket.username], messages: [] };
    user.rooms.push(roomId);
    socket.emit('rooms', user.rooms.map(id => ({ id, name: rooms[id].name })));
    socket.emit('system', `已創建聊天室「${roomName}」`);
  });

  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) return;
    socket.join(roomId);
    const history = rooms[roomId].messages;
    history.forEach(m => socket.emit('message', { room: roomId, from: m.from, text: m.text }));
  });

  socket.on('chat', ({ roomId, text }) => {
    if (!rooms[roomId]) return;
    const msg = { from: socket.username, text };
    rooms[roomId].messages.push(msg);
    io.to(roomId).emit('message', { room: roomId, ...msg });
  });

  socket.on('addFriend', (target) => {
    if (!users[target]) return socket.emit('system', '使用者不存在');

    // 雙方互加好友
    if (!user.friends.includes(target)) user.friends.push(target);
    if (!users[target].friends.includes(socket.username)) users[target].friends.push(socket.username);

    socket.emit('friends', user.friends);
    socket.emit('system', `已新增好友 ${target}`);

    // 嘗試發送好友更新給對方（如果他在線上）
    for (let [id, s] of io.of('/').sockets) {
      if (s.username === target) {
        s.emit('friends', users[target].friends);
        s.emit('system', `你已被 ${socket.username} 加為好友`);
        break;
      }
    }
  });

  socket.on('adminAdd', ({ username, password }) => {
    if (socket.username !== 'admin') return;
    if (users[username]) return socket.emit('system', '帳號已存在');
    users[username] = { password, friends: [], rooms: [] };
    socket.emit('system', `已新增帳號 ${username}`);
  });

  socket.on('adminDel', (target) => {
    if (socket.username !== 'admin') return;
    if (!users[target]) return socket.emit('system', '帳號不存在');

    // 移除好友關係
    Object.values(users).forEach(u => {
      u.friends = u.friends.filter(f => f !== target);
    });

    // 移除聊天室關聯
    const userRooms = users[target].rooms;
    userRooms.forEach(id => delete rooms[id]);

    delete users[target];
    socket.emit('system', `已刪除帳號 ${target}`);
  });
});

server.listen(3000, () => console.log('伺服器啟動於 http://localhost:3000'));
