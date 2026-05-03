import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCUTXCTOrO6BqtPw3fm1T16FQa2vdr-Pzw',
  authDomain: 'rentmate-45910.firebaseapp.com',
  projectId: 'rentmate-45910',
  storageBucket: 'rentmate-45910.firebasestorage.app',
  messagingSenderId: '904474675960',
  appId: '1:904474675960:web:e857f1f10c5b60fc3f090d',
  measurementId: 'G-X7ETWKZR2P',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'he';

export { signInWithEmailAndPassword, createUserWithEmailAndPassword };
