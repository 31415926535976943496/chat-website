// public/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3XTaKssKVVXnSr94WQxeFl54zqcKoIjQ",
  authDomain: "xion-chatwebsite.firebaseapp.com",
  projectId: "xion-chatwebsite",
  storageBucket: "xion-chatwebsite.firebasestorage.app",
  messagingSenderId: "27563897214",
  appId: "1:27563897214:web:e42657a6e186a95c7c432f",
  measurementId: "G-90NYJ4C81J"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

async function signIn() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("登入失敗:", error);
  }
}

async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("登出失敗:", error);
  }
}

export { auth, db, signIn, signOutUser, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp };
