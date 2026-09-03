import { auth, db, storage, googleProvider, appleProvider } from './firebase.js';
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged, GoogleAuthProvider, OAuthProvider, signInWithCredential,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, getDocs, collection,
  query, where, writeBatch, deleteDoc,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadString, getDownloadURL, deleteObject, listAll,
} from 'firebase/storage';

/* ── Friend Code Generator ──
   Crypto-secure 6-char code (32^6 ≈ 1B combinations) gates friend
   discovery. Math.random was predictable from V8's xorshift128+ state and
   the previous 4-char space (~1M) was fully enumerable. Existing 4-char
   codes still validate via rule regex and continue to work for current
   users — only NEW codes get the longer length.
*/
function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous: no I/L/O/0/1
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[buf[i] % chars.length];
  }
  return `BBQ-${code}`;
}

/* ── Restaurant key for matching across users ── */
function restaurantKey(name, location) {
  return `${(name || '').trim().toLowerCase()}|${(location || '').trim().toLowerCase()}`;
}

/* Strip any local-only or unexpected fields before writing to Firestore.
   Firestore rules now enforce a strict field whitelist (hasOnly). Common
   offenders we need to drop:
   - `_docId` — added by loadMyCloudReviews on read; not a real field
   - any other field starting with `_` — convention for transient/local-only
   - `undefined` values — Firestore rejects them outright
*/
function stripForFirestore(review) {
  const out = {};
  for (const k of Object.keys(review)) {
    if (k.startsWith('_')) continue;
    const v = review[k];
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/* ── Prepare review for Firestore ──
   Two variants:
   - `prepForFirestoreFull` — used by `syncReviewWithPhotos` after explicit
     save. Includes photo URLs (base64 stripped — those should have already
     been uploaded by uploadReviewPhotos and replaced with URLs).
   - `prepForFirestoreMetadata` — used by `syncReviewsUp` for routine bulk
     syncs. EXCLUDES photo fields entirely; combined with `merge: true` this
     means cloud photo URLs are never destroyed by a background sync that
     happens to have local with empty photos (e.g. after app update wiped
     localStorage). Photos can only be modified through the explicit save
     flow which uploads first.
*/
function prepForFirestoreFull(review, userId) {
  const { photo, photos, ...rest } = stripForFirestore(review);
  const cloudPhotos = (photos || []).filter(p => typeof p === 'string' && p.startsWith('https://'));
  return {
    ...rest,
    userId,
    restaurantKey: restaurantKey(review.restaurant, review.location),
    syncedAt: new Date().toISOString(),
    photo: cloudPhotos[0] || null,
    photos: cloudPhotos,
  };
}

function prepForFirestoreMetadata(review, userId) {
  const { photo, photos, ...rest } = stripForFirestore(review);
  return {
    ...rest,
    userId,
    restaurantKey: restaurantKey(review.restaurant, review.location),
    syncedAt: new Date().toISOString(),
  };
}

/* ══════════════════════════════════════════
   PHOTO STORAGE
   ══════════════════════════════════════════ */

/* Upload base64 photos → Firebase Storage, return download URLs */
const MAX_PHOTOS_PER_REVIEW = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB hard cap per photo

export async function uploadReviewPhotos(userId, reviewId, photos) {
  if (!photos || photos.length === 0) return [];

  // Enforce cap — only upload first 3
  const capped = photos.slice(0, MAX_PHOTOS_PER_REVIEW);

  const urls = [];
  for (let i = 0; i < capped.length; i++) {
    const p = capped[i];
    // Already a cloud URL — keep it
    if (typeof p === 'string' && p.startsWith('https://')) {
      urls.push(p);
      continue;
    }
    // Base64 data URI — upload it
    if (typeof p === 'string' && p.startsWith('data:')) {
      // Check size before uploading (base64 ≈ 1.37x raw bytes)
      const sizeBytes = Math.round((p.length - p.indexOf(',') - 1) * 0.75);
      if (sizeBytes > MAX_PHOTO_BYTES) {
        console.warn(`Photo ${i} too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB), skipping upload`);
        urls.push(p); // keep base64 locally
        continue;
      }
      try {
        const path = `reviews/${userId}/${reviewId}/${i}.jpg`;
        const sRef = storageRef(storage, path);
        await uploadString(sRef, p, 'data_url');
        const url = await getDownloadURL(sRef);
        urls.push(url);
      } catch (e) {
        console.error(`Failed to upload photo ${i}:`, e);
        // Keep the base64 as fallback so it's not lost
        urls.push(p);
      }
    }
  }
  return urls;
}

/* Delete all photos for a review from Storage */
export async function deleteReviewPhotos(userId, reviewId) {
  try {
    const folderRef = storageRef(storage, `reviews/${userId}/${reviewId}`);
    const list = await listAll(folderRef);
    await Promise.all(list.items.map(item => deleteObject(item)));
  } catch (e) {
    // Folder might not exist — that's fine
    if (e.code !== 'storage/object-not-found') {
      console.error('Failed to delete review photos:', e);
    }
  }
}

/* Cook photo upload — base64 → Firebase Storage → cloud URLs.
   Added per security audit finding N-3. Mirrors uploadReviewPhotos. */
const MAX_PHOTOS_PER_COOK = 3;

export async function uploadCookPhotos(userId, cookId, photos) {
  if (!photos || photos.length === 0) return [];
  const capped = photos.slice(0, MAX_PHOTOS_PER_COOK);
  const urls = [];
  for (let i = 0; i < capped.length; i++) {
    const p = capped[i];
    // Already a cloud URL — keep it.
    if (typeof p === 'string' && p.startsWith('https://')) {
      urls.push(p);
      continue;
    }
    // Base64 data URI — upload it.
    if (typeof p === 'string' && p.startsWith('data:')) {
      const sizeBytes = Math.round((p.length - p.indexOf(',') - 1) * 0.75);
      if (sizeBytes > MAX_PHOTO_BYTES) {
        console.warn(`Cook photo ${i} too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB), skipping upload`);
        urls.push(p);
        continue;
      }
      try {
        const path = `cooks/${userId}/${cookId}/${i}.jpg`;
        const sRef = storageRef(storage, path);
        await uploadString(sRef, p, 'data_url');
        const url = await getDownloadURL(sRef);
        urls.push(url);
      } catch (e) {
        console.error(`Failed to upload cook photo ${i}:`, e);
        urls.push(p);
      }
    }
  }
  return urls;
}

export async function deleteCookPhotos(userId, cookId) {
  try {
    const folderRef = storageRef(storage, `cooks/${userId}/${cookId}`);
    const list = await listAll(folderRef);
    await Promise.all(list.items.map(item => deleteObject(item)));
  } catch (e) {
    if (e.code !== 'storage/object-not-found') {
      console.error('Failed to delete cook photos:', e);
    }
  }
}

/* ══════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════ */

/* Never let an auth call hang forever.

   App Review rejected 4.0.0 build 8 partly because email sign-in sat
   "loading indefinitely" (Guideline 2.1(a)). The underlying cause is
   fixed in firebase.js (IndexedDB persistence hanging in the iOS
   WKWebView), but a spinner that can never stop is a bad failure mode
   whatever the cause — offline, a wedged plugin, a stalled network. So
   every auth entry point below races a timeout and surfaces an error the
   user can act on instead of spinning. */
const AUTH_TIMEOUT_MS = 30000;

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label} timed out. Check your connection and try again.`);
      e.code = 'auth/timeout';
      reject(e);
    }, AUTH_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* Detect Capacitor native shell */
function isCapacitor() {
  return window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() === 'android';
}

/* Detect environments where popups won't work */
export function isInAppBrowser() {
  if (isCapacitor()) return false; // Capacitor WebView is ours, not an in-app browser
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|Instagram|Twitter|LinkedInApp|Line\//i.test(ua)) return true;
  if (/wv|WebView/i.test(ua)) return true;
  return false;
}

function shouldUseRedirect() {
  // Capacitor uses its own WebView — use redirect flow
  if (isCapacitor()) return true;
  const ua = navigator.userAgent || '';
  // In-app browsers (FB Messenger, Instagram, Twitter, LinkedIn, etc.)
  if (/FBAN|FBAV|Instagram|Twitter|LinkedInApp|Line\//i.test(ua)) return true;
  // WebView on Android/iOS (but NOT TWA — TWAs include "wv" but work fine with popups)
  if (/wv/i.test(ua) && !/Chrome\/\d/.test(ua)) return true;
  // Safari — ITP blocks third-party cookies from popup auth flow
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  if (isSafari) return true;
  // NOTE: Standalone PWA and TWA should use popup, not redirect.
  // Redirects can't navigate back into a TWA/standalone app.
  return false;
}

export async function firebaseSignIn() {
  try {
    // Capacitor native app — use native Google Sign-In
    if (isCapacitor()) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await withTimeout(FirebaseAuthentication.signInWithGoogle(), 'Google sign-in');
        // Use the credential to sign in with Firebase Auth web SDK
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        const userCredential = await withTimeout(signInWithCredential(auth, credential), 'Sign-in');
        return userCredential.user;
      } catch (nativeError) {
        // Do NOT swallow this. Returning null here made the button look
        // dead to the user (and to App Review) — the caller cannot tell
        // "cancelled" from "broken". Let it propagate so the UI shows it.
        console.error('Native Google Sign-In failed:', nativeError);
        throw nativeError;
      }
    }
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
    // Anything else is a genuine failure the user needs to see. Returning
    // null here would leave the caller with no way to tell success from
    // failure, which is how a broken sign-in reads as a dead button.
    console.error('Firebase sign-in failed:', error);
    throw error;
  }
}

/* Sign in with Apple. Mirrors firebaseSignIn's Google flow: native
   Capacitor path uses the @capacitor-firebase/authentication plugin and
   exchanges the returned Apple credential for a Firebase credential; web
   path uses popup with redirect fallback. Required for App Store review
   (Guideline 4.8) since the app also offers Google sign-in. */
export async function firebaseSignInWithApple() {
  try {
    if (isCapacitor()) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await withTimeout(FirebaseAuthentication.signInWithApple(), 'Apple sign-in');
        // Apple returns an idToken and a rawNonce; build the Firebase
        // credential from them via the apple.com OAuth provider.
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: result.credential?.idToken,
          rawNonce: result.credential?.nonce,
        });
        const userCredential = await withTimeout(signInWithCredential(auth, credential), 'Sign-in');
        return userCredential.user;
      } catch (nativeError) {
        // Same as the Google path: surface it. A missing Sign in with
        // Apple entitlement (which is what shipped in build 8) rejects
        // here, and swallowing it is exactly why the button appeared
        // unresponsive during review.
        console.error('Native Apple Sign-In failed:', nativeError);
        throw nativeError;
      }
    }
    if (shouldUseRedirect()) {
      await signInWithRedirect(auth, appleProvider);
      return null; // page navigates away
    }
    const result = await signInWithPopup(auth, appleProvider);
    return result.user;
  } catch (error) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-browser') {
      try {
        await signInWithRedirect(auth, appleProvider);
        return null;
      } catch (redirectError) {
        console.error('Apple redirect sign-in failed:', redirectError);
        return null;
      }
    }
    console.error('Firebase Apple sign-in failed:', error);
    throw error;
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

/* ── Email / password auth ──
   Returns { user } on success or { error } with a user-readable message.
   Errors normalize Firebase's auth/* codes into plain English. */
export async function firebaseEmailSignIn(email, password) {
  try {
    const result = await withTimeout(signInWithEmailAndPassword(auth, email.trim(), password), 'Sign-in');
    return { user: result.user };
  } catch (error) {
    return { error: humanizeAuthError(error) };
  }
}

export async function firebaseEmailSignUp(email, password) {
  try {
    const result = await withTimeout(createUserWithEmailAndPassword(auth, email.trim(), password), 'Sign-up');
    // Fire a verification email so the user can confirm ownership. Non-blocking —
    // if it fails (rate limit, network) the account still works.
    try { await sendEmailVerification(result.user); } catch {}
    return { user: result.user };
  } catch (error) {
    return { error: humanizeAuthError(error) };
  }
}

export async function firebaseSendPasswordReset(email) {
  try {
    await withTimeout(sendPasswordResetEmail(auth, email.trim()), 'Password reset');
    return { ok: true };
  } catch (error) {
    return { error: humanizeAuthError(error) };
  }
}

function humanizeAuthError(error) {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-email':         return 'That email address doesn\'t look right.';
    case 'auth/user-disabled':         return 'That account has been disabled.';
    case 'auth/user-not-found':        return 'No account with that email. Try signing up instead.';
    case 'auth/wrong-password':        return 'Wrong password. Try again or use "Forgot password".';
    case 'auth/invalid-credential':    return 'Email or password is wrong. Try again.';
    case 'auth/email-already-in-use':  return 'An account already exists for that email. Sign in instead.';
    case 'auth/weak-password':         return 'Password is too weak — use at least 6 characters.';
    case 'auth/too-many-requests':     return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':return 'Network error. Check your connection and try again.';
    case 'auth/timeout':               return 'That took too long. Check your connection and try again.';
    default:                            return error?.message?.replace(/^Firebase: /, '') || 'Sign-in failed. Try again.';
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
    // Update display name / photo if changed.
    // Explicitly enumerate fields rather than spreading ...existing —
    // Firestore rules now enforce a hasOnly() whitelist, and the existing
    // doc may carry stale extra fields from past code versions that would
    // be rejected on write.
    const existing = snap.data();
    if (existing.displayName !== user.displayName || existing.photoURL !== user.photoURL) {
      try {
        // SECURITY (audit F9): stop persisting `email` back into the
        // public user profile. Firebase Auth already holds the address;
        // duplicating it into Firestore just widens the surface where
        // one authenticated user can read another's email by UID. New
        // writes drop the field. Existing docs still carry it until a
        // migration cleans them up.
        await setDoc(ref, {
          displayName: user.displayName || existing.displayName,
          photoURL: user.photoURL || existing.photoURL,
          friendCode: existing.friendCode,
          createdAt: existing.createdAt,
        });
      } catch (e) {
        // Profile update is non-essential; don't fail sign-in if rules reject
        console.warn('Profile refresh failed (rules):', e?.code);
      }
    }
    return { ...existing, displayName: user.displayName || existing.displayName, photoURL: user.photoURL || existing.photoURL };
  }

  // New user — generate unique friend code.
  // Race-safe: rely on Firestore rules to deny `update` on existing codes,
  // so a concurrent claim of the same random code fails with permission
  // denied. Catch and retry with a fresh code rather than pre-checking
  // (which had a TOCTOU gap between getDoc and setDoc).
  let friendCode = null;
  let attempts = 0;
  while (attempts < 20 && !friendCode) {
    const candidate = generateFriendCode();
    try {
      await setDoc(doc(db, 'friendCodes', candidate), { userId: user.uid });
      friendCode = candidate;
    } catch (e) {
      // Code taken by a concurrent signup (rules deny update). Try again.
      attempts++;
    }
  }
  if (!friendCode) {
    throw new Error('Could not allocate a friend code after 20 attempts');
  }

  // SECURITY (audit F9): new profiles no longer carry `email` in the
  // public users/{uid} doc. Firebase Auth is the sole store for the
  // address; leaking it via a signed-in-user read of another's profile
  // is exactly the "everyone can enumerate emails" hole flagged in the
  // June audit.
  const profile = {
    displayName: user.displayName || 'BBQ Fan',
    photoURL: user.photoURL || null,
    friendCode,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, profile);

  return profile;
}

export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? { id: userId, ...snap.data() } : null;
}

/* ══════════════════════════════════════════
   REVIEWS SYNC
   ══════════════════════════════════════════ */

/* Routine bulk sync — runs on sign-in, online recovery, pull-refresh,
   and the Sync button. NEVER modifies photo fields (those are owned by the
   explicit save flow). Uses merge:true so cloud-only fields like photo URLs
   are preserved when local has empty/missing photo state. */
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
      batch.set(ref, prepForFirestoreMetadata(review, userId), { merge: true });
    }
    await batch.commit();
  }
}

/* Explicit single-review write with photos — called from saveCurrentReview
   AFTER uploadReviewPhotos has converted base64 → cloud URLs. This is the
   only place that writes photo fields to Firestore. */
export async function syncReviewWithPhotos(userId, review) {
  const ref = doc(db, 'reviews', `${userId}_${review.id}`);
  await setDoc(ref, prepForFirestoreFull(review, userId), { merge: true });
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

/* ── Merge local + cloud reviews ──
   Rule: local overrides cloud for editable text fields (notes, scores, etc.)
   but photos are special — cloud is the source of truth for cloud URLs.
   This protects against Android app updates that wipe WebView localStorage:
   without this, local's empty photos array would overwrite cloud's URLs and
   the photos would disappear until the user manually re-synced.
*/
function pickPhotos(localR, cloudR) {
  const localUrls  = (localR.photos || []).filter(p => typeof p === 'string' && p.startsWith('https://'));
  const cloudUrls  = (cloudR.photos || []).filter(p => typeof p === 'string' && p.startsWith('https://'));
  const localBase64 = (localR.photos || []).filter(p => typeof p === 'string' && p.startsWith('data:'));

  // If local has base64 (pending upload), keep all local photos so the
  // upload-on-next-save flow still works.
  if (localBase64.length > 0) {
    return { photos: localR.photos, photo: localR.photo };
  }
  // If cloud has any URLs we don't already have locally, prefer cloud
  // (covers the wiped-localStorage / stale-merge case).
  if (cloudUrls.length > localUrls.length) {
    return { photos: cloudR.photos, photo: cloudR.photo };
  }
  // Otherwise local wins (it has at least as many URLs, or both are empty).
  return { photos: localR.photos, photo: localR.photo };
}

export function mergeReviews(local, cloud) {
  const map = new Map();

  // Cloud first (base)
  for (const r of cloud) {
    map.set(r.id, r);
  }

  for (const r of local) {
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
      continue;
    }
    // Local overrides for non-photo fields, then re-apply photo decision.
    const photoFields = pickPhotos(r, existing);
    map.set(r.id, { ...existing, ...r, ...photoFields });
  }

  return Array.from(map.values())
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/* ══════════════════════════════════════════
   FRIENDS — mutual-consent request/accept flow
   ══════════════════════════════════════════
   Previous design: addFriendByCode wrote to BOTH users' friend lists
   immediately, allowing any signed-in user who knew (or enumerated) a
   target's UID to forcibly add themselves and read all reviews (audit
   Finding #1, IDOR).

   New design: requester writes ONE doc into the target's friendRequests
   inbox. Target reviews the request and accepts or rejects. Friendship
   docs are only created after the target accepts. Firestore rules enforce
   that friend docs can only be created when a matching request exists.
*/

/* Normalize input: uppercase, auto-insert dash, trim. */
function normalizeFriendCode(code) {
  let c = (code || '').toUpperCase().trim();
  if (c.length >= 7 && !c.includes('-') && c.startsWith('BBQ')) {
    c = 'BBQ-' + c.slice(3);
  }
  return c;
}

/* Look up a code → user profile + uid. Shared by send/accept paths. */
async function resolveFriendCode(code) {
  const codeUpper = normalizeFriendCode(code);
  const codeSnap = await getDoc(doc(db, 'friendCodes', codeUpper));
  if (!codeSnap.exists()) {
    return { ok: false, error: 'Friend code not found. Check the code and try again.' };
  }
  const uid = codeSnap.data().userId;
  return { ok: true, uid };
}

/* Send a friend request. Writes one doc to the target's inbox.
   Replaces the old forced-add `addFriendByCode`.
*/
export async function sendFriendRequest(myUserId, code) {
  const resolved = await resolveFriendCode(code);
  if (!resolved.ok) return resolved;
  const targetUid = resolved.uid;
  if (targetUid === myUserId) {
    return { ok: false, error: "That's your own code!" };
  }
  // Already friends?
  const existingSnap = await getDoc(doc(db, 'users', myUserId, 'friends', targetUid));
  if (existingSnap.exists()) {
    return { ok: false, error: 'Already friends!' };
  }
  // Already requested?
  const pendingSnap = await getDoc(doc(db, 'users', targetUid, 'friendRequests', myUserId));
  if (pendingSnap.exists()) {
    return { ok: false, error: 'Request already sent — waiting for them to accept.' };
  }
  const myProfile = await getUserProfile(myUserId);
  if (!myProfile) return { ok: false, error: 'Profile lookup failed. Try again.' };

  try {
    await setDoc(doc(db, 'users', targetUid, 'friendRequests', myUserId), {
      displayName: myProfile.displayName,
      photoURL: myProfile.photoURL || null,
      friendCode: myProfile.friendCode,
      requestedAt: new Date().toISOString(),
    });
    return { ok: true, sent: true };
  } catch (e) {
    return { ok: false, error: 'Could not send request. The other user may have left.' };
  }
}

/* Accept an incoming request. Atomically:
   1. Read requester's profile from the inbox doc
   2. Write users/{me}/friends/{requester}   (rule: owner + request exists in my inbox)
   3. Write users/{requester}/friends/{me}   (rule: I am `friendId` and request exists in MY inbox)
   4. Delete users/{me}/friendRequests/{requester}
   Steps 2-4 are in a single writeBatch so they atomically commit. Rules
   evaluate against the pre-batch state, so the request still exists for
   both create checks even though step 4 deletes it.
*/
export async function acceptFriendRequest(myUserId, requesterUid) {
  const reqRef = doc(db, 'users', myUserId, 'friendRequests', requesterUid);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) {
    return { ok: false, error: 'Request not found (may have been cancelled).' };
  }
  const requesterProfile = reqSnap.data();
  const myProfile = await getUserProfile(myUserId);
  if (!myProfile) return { ok: false, error: 'Profile lookup failed. Try again.' };

  const batch = writeBatch(db);
  // My friends list ← them
  batch.set(doc(db, 'users', myUserId, 'friends', requesterUid), {
    displayName: requesterProfile.displayName || 'BBQ Fan',
    photoURL: requesterProfile.photoURL || null,
    friendCode: requesterProfile.friendCode || null,
    addedAt: new Date().toISOString(),
  });
  // Their friends list ← me
  batch.set(doc(db, 'users', requesterUid, 'friends', myUserId), {
    displayName: myProfile.displayName,
    photoURL: myProfile.photoURL || null,
    friendCode: myProfile.friendCode,
    addedAt: new Date().toISOString(),
  });
  // Clean up request
  batch.delete(reqRef);

  try {
    await batch.commit();
    return { ok: true, friend: { id: requesterUid, ...requesterProfile } };
  } catch (e) {
    return { ok: false, error: 'Could not complete acceptance. Try again.' };
  }
}

/* Reject (target deletes their own inbox doc). */
export async function rejectFriendRequest(myUserId, requesterUid) {
  try {
    await deleteDoc(doc(db, 'users', myUserId, 'friendRequests', requesterUid));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not reject request.' };
  }
}

/* Cancel my own outgoing request (requester deletes from target's inbox). */
export async function cancelFriendRequest(myUserId, targetUid) {
  try {
    await deleteDoc(doc(db, 'users', targetUid, 'friendRequests', myUserId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not cancel request.' };
  }
}

/* List incoming requests in my inbox. Used by Profile UI. */
export async function getIncomingFriendRequests(myUserId) {
  const snap = await getDocs(collection(db, 'users', myUserId, 'friendRequests'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* Back-compat alias — old call sites that imported addFriendByCode should
   migrate to sendFriendRequest. This wrapper keeps the same return shape
   so existing UI can show the "request sent" status without immediate
   refactor. */
export async function addFriendByCode(myUserId, code) {
  const result = await sendFriendRequest(myUserId, code);
  if (!result.ok) return result;
  return {
    ok: true,
    requested: true,
    friend: { displayName: 'request sent' },
  };
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

/* ══════════════════════════════════════════
   COOKS SYNC (Notebook)
   ══════════════════════════════════════════ */

// Firestore rules whitelist these fields on cook docs. Any local-only
// fields (`recipeIds`, `_isExample`, anything starting with `_`) is
// dropped here before the write. Photo fields stay in this list because
// the metadata sync needs to preserve cloud URLs that the local copy
// may already hold — we only strip base64 (data:) entries that haven't
// been uploaded yet, so we don't write huge blobs into Firestore.
const COOK_FIELD_WHITELIST = [
  'id', 'userId', 'name', 'date', 'meatType', 'cut', 'weight',
  'rub', 'rubRecipeId', 'sauce', 'sauceRecipeId', 'woodType',
  'smokerType', 'fuelSource', 'cookTemp', 'wrapMethod', 'wrapTemp',
  'targetInternalTemp', 'cookTimeHours', 'cookTimeMinutes', 'restTime',
  'weatherTemp', 'weatherWind', 'weatherHumidity', 'photos',
  'notes', 'notesLog', 'rating', 'tags', 'shared', 'whatIdChange',
  'createdAt', 'lastEdited', 'syncedAt',
];

function prepCookForFirestore(cook, userId) {
  const out = { userId, syncedAt: new Date().toISOString() };
  for (const key of COOK_FIELD_WHITELIST) {
    if (key === 'userId' || key === 'syncedAt') continue;
    const v = cook[key];
    if (v === undefined) continue;
    // Drop base64 photos from the metadata sync — they belong to the
    // explicit photo-upload flow. Keep already-cloud URLs.
    if (key === 'photos' && Array.isArray(v)) {
      out[key] = v.filter(p => typeof p === 'string' && p.startsWith('https://'));
      continue;
    }
    out[key] = v;
  }
  return out;
}

export async function syncCooksUp(userId, cooks) {
  const chunks = [];
  for (let i = 0; i < cooks.length; i += 450) chunks.push(cooks.slice(i, i + 450));

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const c of chunk) {
      // Skip example seed data — never push it to the cloud.
      if (c._isExample) continue;
      const ref = doc(db, 'cooks', `${userId}_${c.id}`);
      batch.set(ref, prepCookForFirestore(c, userId), { merge: true });
    }
    await batch.commit();
  }
}

/* Explicit single-cook write with photos — called from saveCookEntry
   after uploadCookPhotos has converted base64 → cloud URLs. Mirror of
   syncReviewWithPhotos. This is the only write path that includes
   photo URLs; the bulk syncCooksUp strips them so it never overwrites
   cloud photo state with empty arrays. */
export async function syncCookWithPhotos(userId, cook) {
  if (cook._isExample) return;
  const ref = doc(db, 'cooks', `${userId}_${cook.id}`);
  await setDoc(ref, prepCookForFirestore(cook, userId), { merge: true });
}

export async function loadMyCloudCooks(userId) {
  const q = query(collection(db, 'cooks'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data() }));
}

export async function deleteCloudCook(userId, cookId) {
  try {
    await deleteDoc(doc(db, 'cooks', `${userId}_${cookId}`));
  } catch (e) {
    console.error('Failed to delete cloud cook:', e);
  }
}

export function mergeCooks(local, cloud) {
  const map = new Map();
  // Cloud first
  for (const c of cloud) map.set(c.id, c);
  // Local overrides for non-photo fields; photos use the same precedence
  // logic as reviews — never let an empty local photos array clobber
  // cloud URLs after a wiped localStorage.
  for (const c of local) {
    const existing = map.get(c.id);
    if (!existing) { map.set(c.id, c); continue; }
    const localUrls  = (c.photos || []).filter(p => typeof p === 'string' && p.startsWith('https://'));
    const cloudUrls  = (existing.photos || []).filter(p => typeof p === 'string' && p.startsWith('https://'));
    const localBase64 = (c.photos || []).filter(p => typeof p === 'string' && p.startsWith('data:'));
    const photos = localBase64.length > 0
      ? c.photos
      : (cloudUrls.length > localUrls.length ? existing.photos : c.photos);
    map.set(c.id, { ...existing, ...c, photos });
  }
  return Array.from(map.values())
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function getAllFriendCooks(friendIds) {
  if (!friendIds.length) return [];
  const results = [];
  for (let i = 0; i < friendIds.length; i += 30) {
    const chunk = friendIds.slice(i, i + 30);
    // Firestore rules only return shared cooks for the friend reader,
    // so filtering on shared==true is enforced server-side too.
    const q = query(
      collection(db, 'cooks'),
      where('userId', 'in', chunk),
      where('shared', '==', true),
    );
    const snap = await getDocs(q);
    results.push(...snap.docs.map(d => d.data()));
  }
  return results;
}

/* ══════════════════════════════════════════
   RECIPES SYNC (Notebook)
   ══════════════════════════════════════════ */

const RECIPE_FIELD_WHITELIST = [
  'id', 'userId', 'type', 'name', 'ingredients', 'cookMethod',
  'meatType', 'instructions', 'rubRecipeId', 'sauceRecipeId',
  'woodRecommendation', 'tempGuidelines', 'timeGuidelines',
  'notes', 'rating', 'shared', 'createdAt', 'lastEdited', 'syncedAt',
];

function prepRecipeForFirestore(recipe, userId) {
  const out = { userId, syncedAt: new Date().toISOString() };
  for (const key of RECIPE_FIELD_WHITELIST) {
    if (key === 'userId' || key === 'syncedAt') continue;
    const v = recipe[key];
    if (v === undefined) continue;
    out[key] = v;
  }
  return out;
}

export async function syncRecipesUp(userId, recipes) {
  const chunks = [];
  for (let i = 0; i < recipes.length; i += 450) chunks.push(recipes.slice(i, i + 450));

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const r of chunk) {
      if (r._isExample) continue;
      const ref = doc(db, 'recipes', `${userId}_${r.id}`);
      batch.set(ref, prepRecipeForFirestore(r, userId), { merge: true });
    }
    await batch.commit();
  }
}

export async function loadMyCloudRecipes(userId) {
  const q = query(collection(db, 'recipes'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data() }));
}

export async function deleteCloudRecipe(userId, recipeId) {
  try {
    await deleteDoc(doc(db, 'recipes', `${userId}_${recipeId}`));
  } catch (e) {
    console.error('Failed to delete cloud recipe:', e);
  }
}

export function mergeRecipes(local, cloud) {
  const map = new Map();
  for (const r of cloud) map.set(r.id, r);
  for (const r of local) {
    const existing = map.get(r.id);
    if (!existing) { map.set(r.id, r); continue; }
    // Local wins — recipes are pure text/numbers, no photo merge needed.
    map.set(r.id, { ...existing, ...r });
  }
  return Array.from(map.values())
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getAllFriendRecipes(friendIds) {
  if (!friendIds.length) return [];
  const results = [];
  for (let i = 0; i < friendIds.length; i += 30) {
    const chunk = friendIds.slice(i, i + 30);
    const q = query(
      collection(db, 'recipes'),
      where('userId', 'in', chunk),
      where('shared', '==', true),
    );
    const snap = await getDocs(q);
    results.push(...snap.docs.map(d => d.data()));
  }
  return results;
}
