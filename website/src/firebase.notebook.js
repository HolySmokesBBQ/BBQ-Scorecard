// Firebase config for BBQ Notebook — dedicated project split off from
// the shared holy-smokes-bbq-scorecard project on 2026-07-14 so Notebook
// could have its own GA4 Android data stream (Firebase links only one
// GA4 property per project).
//
// This file is the SOURCE OF TRUTH for the Notebook-side Firebase config.
// The shared src/firebase.js reads this and switches to it at runtime
// when VITE_NOTEBOOK_BUILD is set (i.e., inside the Notebook web + native
// builds). Every downstream import — CookContext, AppContext, Home,
// Profile, Leaderboard, NotebookHome, firebaseSync — flows through
// firebase.js's dispatch and lands here automatically. That means the
// shared components don't need to be forked or refactored.
//
// See FIREBASE-SPLIT-BRIEFING-NOTEBOOK.md at the repo root for the
// full migration context (data migration, console tasks, App Check).

export const NOTEBOOK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAOtH5QcYAyxM0ojfHiACGarhH0c8KSNU8',
  authDomain: 'holy-smokes-bbq-notebook.firebaseapp.com',
  projectId: 'holy-smokes-bbq-notebook',
  storageBucket: 'holy-smokes-bbq-notebook.firebasestorage.app',
  messagingSenderId: '551596530818',
  appId: '1:551596530818:web:40c810a76f066b55c4289b',
};
