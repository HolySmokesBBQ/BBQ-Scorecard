// Firebase init for BBQ Board — Auth (Google sign-in for submissions)
// + Firestore (board_prices collection).

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInAnonymously as fbSignInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDwWqnzgrXF9JL2p2AZ1QhuGLfQOaVS4Sw',
  authDomain: 'holy-smokes-bbq-board.firebaseapp.com',
  projectId: 'holy-smokes-bbq-board',
  storageBucket: 'holy-smokes-bbq-board.firebasestorage.app',
  messagingSenderId: '641836204823',
  appId: '1:641836204823:web:2baae31d20777f40fb6d52',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const signInAnonymously = () => fbSignInAnonymously(auth);
