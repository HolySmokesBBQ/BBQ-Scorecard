import { auth, db, googleProvider } from './firebase.js';
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, getDocs, collection,
  query, where, writeBatch, deleteDoc,
} from 'firebase/firestore';

/* ── Friend Code Generator ── */
function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BBQ-${code}`;
}

/* ── Restaurant key for matching across users ── */
function restaurantKey(name, location) {
  return `${(name || '').trim().toLowerCase()}|${(location || '').trim().toLowerCase()}`;
}

/* ── Strip large fields before syncing to Firestore ── */
function prepForFirestore(review, userId) {
  const { photo, photos, ...rest } = review;
  return {
    ...rest,
    userId,
    restaurantKey: restaurantKey(review.restaurant, review.location),
    syncedAt: new Date().toISOString(),
    photo: null,
    photos: [],
  };
}

/* ══════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════ */

/* Detect environments where popups won't work */
export function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|Instagram|Twitter|LinkedInApp|Line\//i.test(ua)) return true;
  if (/wv|WebView/i.test(ua)) return true;
  return false;
}

function shouldUseRedirect() {
  const ua = navigator.userAgent || '';
  // In-app browsers (FB Messenger, Instagram, Twitter, LinkedIn, etc.)
  if (/FBAN|FBAV|Instagram|Twitter|LinkedInApp|Line\//i.test(ua)) return true;
  // WebView on Android/iOS
  if (/wv|WebView/i.test(ua)) return true;
  // Safari — ITP blocks third-party cookies from popup auth flow
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  if (isSafari) return true;
  // Standalone PWA (installed to home screen)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

export async function firebaseSignIn() {
  try {
    if (shouldUseRedirect()) {
      // Redirect flow — page navigates away, comes back after auth
      await signInWithRedirect(auth, googleProvider);
      return null; // Won't reach here — page navigates away
    }
    // Popup flow — works on regular desktop browsers
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    // If popup was blocked, fall back to redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-browser') {
      console.warn('Popup blocked, falling back to redirect');
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectError) {
        console.error('Redirect sign-in failed:', redirectError);
        return null;
      }
    }
    console.error('Firebase sign-in failed:', error);
    return null;
  }
}

/* Handle redirect result on page load */
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      return result.user;
    }
    return null;
  } catch (error) {
    console.error('Redirect result error:', error);
    return null;
  }
}

export async function firebaseSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Firebase sign-out failed:', error);
  }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

/* ══════════════════════════════════════════
   USER PROFILE
   ══════════════════════════════════════════ */

export async function getOrCreateProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Update display name / photo if changed
    const existing = snap.data();
    if (existing.displayName !== user.displayName || existing.photoURL !== user.photoURL) {
      await setDoc(ref, {
        ...existing,
        displayName: user.displayName || existing.displayName,
        photoURL: user.photoURL || existing.photoURL,
      });
    }
    return { ...existing, displayName: user.displayName || existing.displayName, photoURL: user.photoURL || existing.photoURL };
  }

  // New user — generate unique friend code
  let friendCode = generateFriendCode();
  let attempts = 0;
  while (attempts < 20) {
    const codeSnap = await getDoc(doc(db, 'friendCodes', friendCode));
    if (!codeSnap.exists()) break;
    friendCode = generateFriendCode();
    attempts++;
  }

  const profile = {
    displayName: user.displayName || 'BBQ Fan',
    email: user.email,
    photoURL: user.photoURL || null,
    friendCode,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, profile);
  await setDoc(doc(db, 'friendCodes', friendCode), { userId: user.uid });

  return profile;
}

export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? { id: userId, ...snap.data() } : null;
}

/* ══════════════════════════════════════════
   REVIEWS SYNC
   ══════════════════════════════════════════ */

export async function syncReviewsUp(userId, reviews) {
  // Batch writes (Firestore limit: 500 per batch)
  const chunks = [];
  for (let i = 0; i < reviews.length; i += 450) {
    chunks.push(reviews.slice(i, i + 450));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const review of chunk) {
      const ref = doc(db, 'reviews', `${userId}_${review.id}`);
      batch.set(ref, prepForFirestore(review, userId));
    }
    await batch.commit();
  }
}

export async function loadMyCloudReviews(userId) {
  const q = query(collection(db, 'reviews'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
}

export async function deleteCloudReview(userId, reviewId) {
  try {
    await deleteDoc(doc(db, 'reviews', `${userId}_${reviewId}`));
  } catch (e) {
    console.error('Failed to delete cloud review:', e);
  }
}

/* ── Merge local + cloud reviews ── */
export function mergeReviews(local, cloud) {
  const map = new Map();

  // Cloud first (base)
  for (const r of cloud) {
    map.set(r.id, r);
  }

  // Local overwrites (has photos, more recent edits)
  for (const r of local) {
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
    } else {
      // Keep local version (it has photos + latest edits)
      // But merge any cloud-only fields
      map.set(r.id, { ...existing, ...r });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/* ══════════════════════════════════════════
   FRIENDS
   ══════════════════════════════════════════ */

export async function addFriendByCode(myUserId, code) {
  let codeUpper = code.toUpperCase().trim();
  // Auto-insert dash if missing (BBQ5UNL → BBQ-5UNL)
  if (codeUpper.length >= 7 && !codeUpper.includes('-') && codeUpper.startsWith('BBQ')) {
    codeUpper = 'BBQ-' + codeUpper.slice(3);
  }
  const codeRef = doc(db, 'friendCodes', codeUpper);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) {
    return { ok: false, error: 'Friend code not found. Check the code and try again.' };
  }

  const friendUserId = codeSnap.data().userId;
  if (friendUserId === myUserId) {
    return { ok: false, error: "That's your own code!" };
  }

  // Check if already friends
  const existingSnap = await getDoc(doc(db, 'users', myUserId, 'friends', friendUserId));
  if (existingSnap.exists()) {
    return { ok: false, error: 'Already friends!' };
  }

  // Get friend profile
  const friendProfile = await getUserProfile(friendUserId);
  if (!friendProfile) {
    return { ok: false, error: 'User not found.' };
  }

  // Get my profile
  const myProfile = await getUserProfile(myUserId);

  // Bidirectional: add each other
  await setDoc(doc(db, 'users', myUserId, 'friends', friendUserId), {
    displayName: friendProfile.displayName,
    photoURL: friendProfile.photoURL || null,
    friendCode: friendProfile.friendCode,
    addedAt: new Date().toISOString(),
  });

  await setDoc(doc(db, 'users', friendUserId, 'friends', myUserId), {
    displayName: myProfile.displayName,
    photoURL: myProfile.photoURL || null,
    friendCode: myProfile.friendCode,
    addedAt: new Date().toISOString(),
  });

  return { ok: true, friend: friendProfile };
}

export async function removeFriendConnection(myUserId, friendUserId) {
  await deleteDoc(doc(db, 'users', myUserId, 'friends', friendUserId));
  await deleteDoc(doc(db, 'users', friendUserId, 'friends', myUserId));
}

export async function getFriendsList(userId) {
  const snap = await getDocs(collection(db, 'users', userId, 'friends'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ══════════════════════════════════════════
   FRIEND REVIEWS (for detail + leaderboard)
   ══════════════════════════════════════════ */

export async function getFriendReviewsForRestaurant(friendIds, restaurant, location) {
  if (!friendIds.length) return [];
  const key = restaurantKey(restaurant, location);

  // Firestore 'in' limited to 30 values
  const results = [];
  for (let i = 0; i < friendIds.length; i += 30) {
    const chunk = friendIds.slice(i, i + 30);
    const q = query(
      collection(db, 'reviews'),
      where('userId', 'in', chunk),
      where('restaurantKey', '==', key)
    );
    const snap = await getDocs(q);
    results.push(...snap.docs.map(d => d.data()));
  }

  return results;
}

export async function getAllFriendReviews(friendIds) {
  if (!friendIds.length) return [];

  const results = [];
  for (let i = 0; i < friendIds.length; i += 30) {
    const chunk = friendIds.slice(i, i + 30);
    const q = query(collection(db, 'reviews'), where('userId', 'in', chunk));
    const snap = await getDocs(q);
    results.push(...snap.docs.map(d => d.data()));
  }

  return results;
}
