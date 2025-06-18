// public/firebase.js

// Firebase CDN v9 模組化 SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// TODO: 換成你自己的 firebaseConfig
const firebaseConfig = {
  apiKey: "AIzaSyD3XTaKssKVVXnSr94WQxeFl54zqcKoIjQ",
  authDomain: "xion-chatwebsite.firebaseapp.com",
  projectId: "xion-chatwebsite",
  storageBucket: "xion-chatwebsite.appspot.com",
  messagingSenderId: "27563897214",
  appId: "1:27563897214:web:e42657a6e186a95c7c432f",
  measurementId: "G-90NYJ4C81J"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

// 匯出所有模組供其他檔案使用
export { app, auth, db, provider, signInWithPopup, onAuthStateChanged, doc, setDoc, getDoc, onSnapshot, collection, addDoc, query, where, getDocs, updateDoc };

