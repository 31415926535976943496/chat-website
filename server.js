const express = require('express');
const app = express();
const http  = require('http').createServer(app);
const io    = require('socket.io')(http, { cors: { origin: '*' } });
app.use(express.static(__dirname));
app.use(express.json());

/* ==== in-memory DB ==== */
const users = {
  admin: { password: '123456', friends: new Set(), sockets: new Set() }
};
const rooms = {};
let roomSeq = 1;

/* ==== Helper ==== */
function genRoomId() { return 'r' + roomSeq++; }
function safe(fn) { 
  return (req, res) => { 
    try { fn(req, res); } 
    catch(e) { res.json({ ok: false, msg: e.message }); } 
  }; 
}

/* ==== REST: 註冊 / 登入 ==== */
app.post('/api/register', safe((req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw Error('帳號或密碼空白');
  if (users[username]) throw Error('帳號已存在');
  users[username] = { password, friends: new Set(), sockets: new Set() };
  console.log('註冊後 users:', users);
  res.json({ ok: true });
}));

app.post('/api/login', safe((req, res) => {
  const { username, password } = req.body;
  console.log('登入請求:', username, password);
  if (!users[username] || users[username].password !== password) throw Error('帳密錯誤');
  res.json({ ok: true, token: username });
}));

/* ==== Socket.io ==== */
io.use((socket, next) => {
  const username = socket.handshake.auth.token;
  if (!users[username]) return next(new Error('未授權'));
  socket.username = username;
  next();
});

io.on('connection', (socket) => {
  const me = socket.username;
  users[me].sockets.add(socket.id);

  // 發送好友列表跟房間列表給用戶
  emitFriends(me);
  emitRooms(me);

  socket.on('addFriend', friend => {
    if (users[friend] && friend !== me) {
      users[me].friends.add(friend);
      users[friend].friends.add(me);
      emitFriends(me);
      emitFriends(friend);
    }
  });

  socket.on('createRoom', name => {
    const id = genRoomId();
    rooms[id] = { name, members: new Set([me]) };
    emitRooms(me);
  });

  socket.on('joinRoom', id => {
    if (rooms[id] && rooms[id].members.has(me)) {
      socket.join(id);
      socket.emit('system', `已進入房間 ${rooms[id].name}`);
    }
  });

  socket.on('invite', ({ roomId, friend }) => {
    if (rooms[roomId] && rooms[roomId].members.has(me) && users[friend]) {
      rooms[roomId].members.add(friend);
      emitRooms(friend);
      notifyUser(friend, 'system', `${me} 邀請你加入房間「${rooms[roomId].name}」`);
    }
  });

  socket.on('chat', ({ roomId, text }) => {
    if (rooms[roomId] && rooms[roomId].members.has(me)) {
      io.to(roomId).emit('message', { room: roomId, from: me, text });
    }
  });

  // 管理員功能
  socket.on('adminAdd', ({ username, password }) => {
    if (me !== 'admin') return;
    if (!users[username]) {
      users[username] = { password, friends: new Set(), sockets: new Set() };
      notifyAdmins(`新增帳號 ${username}`);
    }
  });

  socket.on('adminDel', username => {
    if (me !== 'admin' || username === 'admin') return;
    if (users[username]) {
      users[username].sockets.forEach(sid => io.sockets.sockets.get(sid)?.disconnect());
      delete users[username];
      notifyAdmins(`刪除帳號 ${username}`);
    }
  });

  socket.on('disconnect', () => {
    users[me].sockets.delete(socket.id);
  });
});

/* ==== 公用推播 ==== */
function emitFriends(u) {
  const list = [...users[u].friends];
  users[u].sockets.forEach(sid => io.to(sid).emit('friends', list));
}
function emitRooms(u) {
  const list = [];
  for (const [id, r] of Object.entries(rooms)) {
    if (r.members.has(u)) list.push({ id, name: r.name });
  }
  users[u].sockets.forEach(sid => io.to(sid).emit('rooms', list));
}
function notifyUser(u, evt, ...args) {
  users[u]?.sockets.forEach(sid => io.to(sid).emit(evt, ...args));
}
function notifyAdmins(msg) {
  notifyUser('admin', 'system', msg);
}

/* ==== 啟動 ==== */
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
