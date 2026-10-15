// Firebase implementation of the operations accountDeletion.js orchestrates.
// Kept separate so the order and failure rules stay testable without
// Firebase. Each op is a thin wrapper; anything that decides WHAT to delete
// or WHEN lives in accountDeletion.js.

import { auth, db, storage, googleProvider, appleProvider } from './firebase.js';
import {
  GoogleAuthProvider, OAuthProvider, EmailAuthProvider,
  reauthenticateWithCredential, reauthenticateWithPopup, deleteUser, signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, listAll, deleteObject } from 'firebase/storage';
import { wipeLocalAppData } from './accountDeletion.js';

const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
const docRef = (path) => doc(db, ...path.split('/'));

async function nativeAuth() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  return FirebaseAuthentication;
}

export const firebaseDeletionOps = {
  currentUser() {
    const u = auth.currentUser;
    if (!u) return null;
    return { uid: u.uid, email: u.email, providerIds: (u.providerData || []).map((p) => p.providerId) };
  },

  // Re-auth with whichever provider the account uses. Choosing a different
  // Google/Apple account here fails with auth/user-mismatch, which aborts
  // the deletion before anything is touched.
  async reauthenticate(user, { password } = {}) {
    const current = auth.currentUser;
    const ids = user.providerIds || [];
    if (ids.includes('password') && !ids.includes('google.com') && !ids.includes('apple.com')) {
      if (!password) throw Object.assign(new Error('Password required'), { code: 'auth/missing-password' });
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
      return {};
    }
    if (ids.includes('apple.com')) {
      if (isNative()) {
        const result = await (await nativeAuth()).signInWithApple();
        const cred = new OAuthProvider('apple.com').credential({
          idToken: result.credential?.idToken,
          rawNonce: result.credential?.nonce,
        });
        await reauthenticateWithCredential(current, cred);
        return { appleAuthorizationCode: result.credential?.authorizationCode || null };
      }
      await reauthenticateWithPopup(current, appleProvider);
      return {};
    }
    // Google (also the fallback for any other single provider).
    if (isNative()) {
      const result = await (await nativeAuth()).signInWithGoogle();
      await reauthenticateWithCredential(current, GoogleAuthProvider.credential(result.credential?.idToken));
      return {};
    }
    await reauthenticateWithPopup(current, googleProvider);
    return {};
  },

  async listOwnedDocs(collectionName, uid) {
    const snap = await getDocs(query(collection(db, collectionName), where('userId', '==', uid)));
    return snap.docs.map((d) => ({ id: d.id, itemId: d.data()?.id || null }));
  },

  async deleteStorageFolder(path) {
    try {
      const list = await listAll(storageRef(storage, path));
      await Promise.all(list.items.map((item) => deleteObject(item)));
    } catch (e) {
      if (e?.code !== 'storage/object-not-found') throw e;
    }
  },

  deleteDocAt: (path) => deleteDoc(docRef(path)),

  async listIds(path) {
    const snap = await getDocs(collection(db, ...path.split('/')));
    return snap.docs.map((d) => d.id);
  },

  async readProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },

  async revokeApple(authorizationCode) {
    if (!isNative()) return;
    await (await nativeAuth()).revokeAccessToken({ token: authorizationCode });
  },

  deleteUser: () => deleteUser(auth.currentUser),

  async nativeSignOut() {
    if (isNative()) { try { await (await nativeAuth()).signOut(); } catch {} }
    try { await signOut(auth); } catch {}
  },

  wipeLocal: () => wipeLocalAppData(),
};

// Scorecard's owned data. Notebook would pass cooks/recipes (storage
// prefix 'cooks'); Board its own collections.
export const SCORECARD_OWNED = [{ name: 'reviews', storagePrefix: 'reviews' }];
