import { auth, db } from "./firebase.js";
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const userInfo = document.getElementById('userInfo');

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userInfo.textContent = `👤 ${user.displayName}`;
    startListening();
  } else {
    alert("請先登入");
    window.location.href = "/index.html";
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!input.value.trim()) return;

  const msg = {
    name: currentUser.displayName,
    text: input.value,
    timestamp: serverTimestamp()
  };

  // 存到 Firebase
  await addDoc(collection(db, "messages"), msg);

  // 發送 socket 給其他使用者
  socket.emit('chat message', msg);

  input.value = '';
});

// 接收即時訊息
socket.on('chat message', (msg) => {
  appendMessage(msg);
});

// 從 Firebase 讀訊息
function startListening() {
  const q = query(collection(db, "messages"), orderBy("timestamp"));
  onSnapshot(q, (snapshot) => {
    messages.innerHTML = "";
    snapshot.forEach(doc => {
      appendMessage(doc.data());
    });
  });
}

function appendMessage(msg) {
  const li = document.createElement("li");
  li.textContent = `${msg.name}: ${msg.text}`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}
