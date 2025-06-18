import { auth, provider } from './firebase.js';
import { signInWithPopup } from "firebase/auth";

const loginBtn = document.getElementById('loginBtn');

loginBtn.addEventListener('click', () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log('登入成功：', user.displayName);
      // 登入成功後導向聊天室
      window.location.href = '/chat.html';
    })
    .catch((error) => {
      console.error('登入失敗：', error.message);
      alert('登入失敗，請稍後再試');
    });
});
