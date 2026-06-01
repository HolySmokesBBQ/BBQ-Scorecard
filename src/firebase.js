import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBKp1ISJyMuGdKRAcsO4KfkeTzu9N9VthE",
  authDomain: "holy-smokes-bbq-scorecard.firebaseapp.com",
  projectId: "holy-smokes-bbq-scorecard",
  storageBucket: "holy-smokes-bbq-scorecard.firebasestorage.app",
  messagingSenderId: "582963363646",
  appId: "1:582963363646:web:03a93beae0b2f5b72db66f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
