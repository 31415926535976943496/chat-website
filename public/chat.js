const socket = io();

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

// 產生一個隨機的使用者名稱（你也可以用 prompt() 或登入機制）
const username = '用戶' + Math.floor(Math.random() * 10000);

// 送出訊息
form.addEventListener('submit', function (e) {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', { user: username, text: input.value });
    input.value = '';
  }
});

// 接收訊息
socket.on('chat message', function (msg) {
  const item = document.createElement('li');
  item.textContent = `${msg.user}: ${msg.text}`;
  // 根據發話者分類樣式
  if (msg.user === username) {
    item.classList.add('self');
  } else {
    item.classList.add('other');
  }
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});
