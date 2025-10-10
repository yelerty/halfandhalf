import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 설정 (Firebase Console에서 가져온 값으로 교체하세요)
const firebaseConfig = {
  apiKey: "AIzaSyAqgzjlx_vWF3qR3K-wbbs2PlxA8ltS9_Q",
  authDomain: "halfandhalf-15e51.firebaseapp.com",
  projectId: "halfandhalf-15e51",
  storageBucket: "halfandhalf-15e51.firebasestorage.app",
  messagingSenderId: "524745831883",
  appId: "1:524745831883:web:0e92c76e9133e70ebbb24e"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Firebase 서비스
export const auth = getAuth(app);
export const db = getFirestore(app);
