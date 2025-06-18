// public/chat.js
import { auth, db, signIn, signOutUser, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase.js';

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const messagesList = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');

let currentUser = null;

// 監聽登入狀態變化
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    userInfo.textContent = `你好，${user.displayName}`;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    input.disabled = false;
  } else {
    currentUser = null;
    userInfo.textContent = '尚未登入';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    input.disabled = true;
    messagesList.innerHTML = '';
  }
});

// 登入按鈕
loginBtn.onclick = async () => {
  await signIn();
};

// 登出按鈕
logoutBtn.onclick = async () => {
  await signOutUser();
};

// 監聽 Firestore 中 messages 集合的資料變動
const messagesCol = collection(db, 'messages');
const q = query(messagesCol, orderBy('createdAt'));

onSnapshot(q, snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      const msg = change.doc.data();
      const li = document.createElement('li');
      li.textContent = `${msg.user}: ${msg.text}`;
      messagesList.appendChild(li);
      messagesList.scrollTop = messagesList.scrollHeight;
    }
  });
});

// 傳送訊息
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!input.value.trim() || !currentUser) return;

  await addDoc(messagesCol, {
    text: input.value.trim(),
    user: currentUser.displayName,
    createdAt: serverTimestamp()
  });

  input.value = '';
});
