// Firebase implementation of the operations accountDeletion.board.js
// orchestrates, on Board's own auth and Firestore instances
// (firebase.board.js). Thin wrappers only: what to delete and when lives in
// accountDeletion.board.js.

import {
  GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
  deleteUser, signOut,
} from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase.board.js';
import { fetchMySubmissions, deleteSubmission } from './mySubmissions.js';
import { withTimeout } from './signIn.js';
import { wipeBoardLocal } from './accountDeletion.board.js';

const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

async function nativeAuth() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  return FirebaseAuthentication;
}

export const boardDeletionOps = {
  currentUser() {
    const u = auth.currentUser;
    return u ? { uid: u.uid, isAnonymous: u.isAnonymous === true } : null;
  },

  // Board signs in with Google only (plus anonymous, which never gets
  // here). Picking a different Google account fails with
  // auth/user-mismatch, which stops the deletion before anything is touched.
  async reauthenticate() {
    const current = auth.currentUser;
    if (isNative()) {
      const result = await withTimeout((await nativeAuth()).signInWithGoogle(), 'Google sign-in');
      await withTimeout(
        reauthenticateWithCredential(current, GoogleAuthProvider.credential(result.credential?.idToken)),
        'Sign-in',
      );
      return;
    }
    await withTimeout(reauthenticateWithPopup(current, googleProvider), 'Sign-in');
  },

  async listOwnedPriceIds(uid) {
    return (await fetchMySubmissions(db, uid)).map((r) => r.id);
  },

  deletePrice: (id) => deleteSubmission(db, id),

  deleteUser: () => deleteUser(auth.currentUser),

  async signOut() {
    if (isNative()) { try { await (await nativeAuth()).signOut(); } catch {} }
    try { await signOut(auth); } catch {}
  },

  wipeLocal: () => wipeBoardLocal(),
};
