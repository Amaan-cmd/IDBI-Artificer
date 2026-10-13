import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Enterprise Firebase Configuration (idbi-innovate)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBH_ULTo5WJ8LAy-G-50o4rbg1MrbjK7QY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "idbi-innovate.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "idbi-innovate",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "idbi-innovate.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "900490257588",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:900490257588:web:0e7ca8693b0c2a255ee3e1"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
