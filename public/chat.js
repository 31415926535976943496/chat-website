// chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// 你的 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyD3XTaKssKVVXnSr94WQxeFl54zqcKoIjQ",
  authDomain: "xion-chatwebsite.firebaseapp.com",
  projectId: "xion-chatwebsite",
  storageBucket: "xion-chatwebsite.firebasestorage.app",
  messagingSenderId: "27563897214",
  appId: "1:27563897214:web:e42657a6e186a95c7c432f",
  measurementId: "G-90NYJ4C81J"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const messagesRef = collection(db, "messages");

// DOM 元素
const messagesList = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");

let currentUser = null;

// 監聽登入狀態變化
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    userInfo.textContent = `歡迎，${user.displayName}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    input.disabled = false;
    input.placeholder = "輸入訊息...";
    form.querySelector("button").disabled = false;
  } else {
    userInfo.textContent = "尚未登入";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    input.disabled = true;
    input.placeholder = "請先登入才能發言";
    form.querySelector("button").disabled = true;
  }
});

// Google 登入
loginBtn.onclick = () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).catch(console.error);
};

// 登出
logoutBtn.onclick = () => {
  signOut(auth);
};

// 送出訊息
form.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const text = input.value.trim();
  if (text === "") return;

  await addDoc(messagesRef, {
    uid: currentUser.uid,
    name: currentUser.displayName,
    message: text,
    timestamp: serverTimestamp()
  });

  input.value = "";
};

// 監聽訊息變動（即時更新）
const q = query(messagesRef, orderBy("timestamp", "asc"));
onSnapshot(q, snapshot => {
  messagesList.innerHTML = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    const li = document.createElement("li");
    li.textContent = `${data.name}: ${data.message}`;
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
  });
});
