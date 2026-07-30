import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getPerformance } from 'firebase/performance';
import { NOTEBOOK_FIREBASE_CONFIG } from './firebase.notebook.js';

// NOTE: This config is intentionally hard-coded. Firebase web API keys are
// public identifiers, not secrets — security is enforced by Firestore rules,
// Storage rules, and App Check (below). Do not "fix" this by moving it to
// an env var. Reference: https://firebase.google.com/docs/projects/api-keys
const SCORECARD_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBKp1ISJyMuGdKRAcsO4KfkeTzu9N9VthE",
  authDomain: "holy-smokes-bbq-scorecard.firebaseapp.com",
  projectId: "holy-smokes-bbq-scorecard",
  storageBucket: "holy-smokes-bbq-scorecard.firebasestorage.app",
  messagingSenderId: "582963363646",
  appId: "1:582963363646:web:03a93beae0b2f5b72db66f"
};

// Dispatch to the right project's config based on the build flag. Set by
// vite.config.notebook.js and vite.config.native.notebook.js for both web
// and Android Notebook builds. Split done 2026-07-14 so Notebook gets its
// own GA4 Android stream — see FIREBASE-SPLIT-BRIEFING-NOTEBOOK.md.
const firebaseConfig = import.meta.env.VITE_NOTEBOOK_BUILD
  ? NOTEBOOK_FIREBASE_CONFIG
  : SCORECARD_FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);

// ─────────────────────────────────────────────────────────────
// App Check — protects backend resources from abuse by non-app
// traffic (script kiddies running their own client against your
// public Firebase config). Enforced once `VITE_FIREBASE_APPCHECK_SITE_KEY`
// is set in the Netlify environment.
//
// One-time setup steps (when ready):
//   1. Firebase Console → App Check → Apps → register the web app
//      using reCAPTCHA v3.
//   2. Copy the site key it generates.
//   3. Add to Netlify env: VITE_FIREBASE_APPCHECK_SITE_KEY=<key>
//      and to .env.local for local dev.
//   4. (Optional) Enable enforcement in console only after testing
//      that auth + Firestore + Storage still work.
//   5. For Capacitor / Android, set up Play Integrity provider
//      separately via the native plugin.
//
// Until the env var is set, this block is a no-op — App Check is
// not initialized and the app behaves exactly as before.
// ─────────────────────────────────────────────────────────────
const isCapacitorNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

if (isCapacitorNative) {
  // Native (Android via Capacitor): use the Capacitor Firebase App Check
  // plugin, which talks to the Play Integrity API. Configuration of the
  // attestation provider lives in Firebase Console; the plugin attaches
  // tokens to subsequent Firebase calls automatically.
  // Import dynamically so this code path is tree-shaken from the web bundle.
  import('@capacitor-firebase/app-check')
    .then(({ FirebaseAppCheck }) => FirebaseAppCheck.initialize({ isTokenAutoRefreshEnabled: true }))
    .catch((e) => { if (import.meta.env.DEV) console.warn('App Check (native) init failed:', e); });
} else if (appCheckSiteKey && typeof window !== 'undefined') {
  // Web: use reCAPTCHA v3 provider with the site key from build-time env.
  // Dev debug-token support — set VITE_APPCHECK_DEBUG=1 in .env.local
  // to bypass App Check during local dev. Pair with a debug token
  // registered in Firebase Console → App Check → Apps → Manage debug tokens.
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG) {
    // eslint-disable-next-line no-restricted-globals
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // Initialization failure shouldn't break the app — log and continue.
    if (import.meta.env.DEV) console.warn('App Check init failed:', e);
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Sign in with Apple. Required by App Store Review Guideline 4.8: any
// app offering a third-party login (we offer Google) must also offer
// Sign in with Apple. Apple's provider id is the OAuth id 'apple.com'.
// Request name + email scopes so the first sign-in returns them (Apple
// only sends the full name once, on the very first authorization).
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// ─────────────────────────────────────────────────────────────
// Firebase Performance Monitoring — Real User Monitoring (RUM).
// Auto-captures page-load events (FCP, DCL, network requests, route
// transitions) and reports them to Firebase Console → Performance.
// Pairs with Lighthouse synthetic numbers: Lighthouse tells us what
// a controlled emulated Moto G sees; Performance Monitoring tells us
// what real users on real devices and real networks actually get.
//
// Initialization is intentionally side-effect-only — the returned
// object isn't needed unless we add custom traces later (e.g.
// `trace(perf, 'review-save').start() / .stop()` around save flows).
//
// Skipped on Capacitor native: the web SDK is for web pages; Android
// uses the @capacitor-firebase/performance plugin (or Firebase
// Crashlytics for stability monitoring) which integrates with the
// native runtime properly.
// ─────────────────────────────────────────────────────────────
if (!isCapacitorNative && typeof window !== 'undefined') {
  try {
    getPerformance(app);
  } catch (e) {
    // Don't crash the app if Performance SDK fails to init (rare —
    // usually an extension blocking the Firebase telemetry endpoint).
    if (import.meta.env.DEV) console.warn('Performance Monitoring init failed:', e);
  }
}
