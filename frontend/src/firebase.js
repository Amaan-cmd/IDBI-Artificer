import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBH_ULTo5WJ8LAy-G-50o4rbg1MrbjK7QY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "idbi-innovate.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "idbi-innovate",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "idbi-innovate.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "900490257588",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:900490257588:web:0e7ca8693b0c2a255ee3e1"
};

let app;
let auth = null;
let googleProvider = null;
let appleProvider = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  appleProvider = new OAuthProvider('apple.com');
  appleProvider.addScope('email');
  appleProvider.addScope('name');
} catch (e) {
  console.warn('[Firebase Auth] Initialization deferred:', e);
}

export { 
  app, 
  auth, 
  googleProvider, 
  appleProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  signOut 
};
export default auth;
