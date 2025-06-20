const express = require('express');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const PORT = process.env.PORT || 10000; // ⚠️ Render 需要使用 process.env.PORT

const users = {};

app.use(express.static(__dirname)); // 讓 index.html 被訪問到

io.on('connection', (socket) => {
  socket.on('join', (name) => {
    users[socket.id] = name;
    socket.broadcast.emit('system', `${name} 加入了聊天室`);
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', { name: users[socket.id], msg });
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      io.emit('system', `${users[socket.id]} 離開了聊天室`);
      delete users[socket.id];
    }
  });
});

server.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`);
});

