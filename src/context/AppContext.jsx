import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadLocal, saveLocal } from '../storage.js';

// Firebase loads lazily AFTER the landing page paints. The Site.jsx hero
// (LCP element) doesn't need Firebase to render — only the sign-in badge
// and authenticated UI do, and those can update once auth settles.
//
// Two load paths:
//   1) `getFirebaseSync()` — loads the firebase chunk IMMEDIATELY.
//      Used by user-initiated actions (sign in, save review). The user
//      tapping a button is a clear signal we need firebase now.
//   2) `scheduleFirebaseLoad()` — arms the load to fire after the
//      browser `load` event AND a `requestIdleCallback` slot. Used by
//      passive setup (auth listener, redirect resolution). Keeps the
//      firebase chunk out of the LCP / TBT measurement window on
//      simulated mobile, since neither fetching nor parsing happens
//      until well after first contentful paint.
//
// Both paths return a promise resolving to the same loaded module.
let _firebaseSyncPromise = null;
let _resolveDeferred = null;
const _deferredPromise = new Promise((resolve) => { _resolveDeferred = resolve; });

function getFirebaseSync() {
  if (!_firebaseSyncPromise) {
    _firebaseSyncPromise = import('../firebaseSync.js');
    // Any callers waiting on scheduleFirebaseLoad() get unblocked too.
    _firebaseSyncPromise.then((m) => _resolveDeferred(m));
  }
  return _firebaseSyncPromise;
}

function scheduleFirebaseLoad() {
  if (_firebaseSyncPromise) return _firebaseSyncPromise;
  const trigger = () => {
    const ric = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    ric(() => { getFirebaseSync(); }, { timeout: 3000 });
  };
  if (document.readyState === 'complete') {
    trigger();
  } else {
    window.addEventListener('load', trigger, { once: true });
  }
  return _deferredPromise;
}

// Proxy each firebase function as `(...args) => Promise`. Two flavors:
//   `_fbProxy`  — forces load now, used for user-initiated calls.
//   `_fbDefer` — waits for the scheduled load, used for passive setup.
// Sync usages (e.g. `mergeReviews`) gain an `await` at the call site.
// UA-based `isInAppBrowser` is implemented inline so it never triggers
// the firebase chunk load.
// Blob → raw base64 (no data: prefix) for Capacitor Filesystem writes.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const _fbProxy = (name) => (...args) => getFirebaseSync().then((m) => m[name](...args));
const _fbDefer = (name) => (...args) => scheduleFirebaseLoad().then((m) => m[name](...args));

// Active (user-initiated) — load firebase now.
const firebaseSignIn = _fbProxy('firebaseSignIn');
const firebaseSignInWithApple = _fbProxy('firebaseSignInWithApple');
const firebaseEmailSignIn = _fbProxy('firebaseEmailSignIn');
const firebaseEmailSignUp = _fbProxy('firebaseEmailSignUp');
const firebaseSendPasswordReset = _fbProxy('firebaseSendPasswordReset');
const getOrCreateProfile = _fbProxy('getOrCreateProfile');
const syncReviewsUp = _fbProxy('syncReviewsUp');
const syncReviewWithPhotos = _fbProxy('syncReviewWithPhotos');
const loadMyCloudReviews = _fbProxy('loadMyCloudReviews');
const mergeReviews = _fbProxy('mergeReviews');
const getIncomingFriendRequests = _fbProxy('getIncomingFriendRequests');
const getFriendsList = _fbProxy('getFriendsList');
const getFriendReviewsForRestaurant = _fbProxy('getFriendReviewsForRestaurant');
const uploadReviewPhotos = _fbProxy('uploadReviewPhotos');
const deleteReviewPhotos = _fbProxy('deleteReviewPhotos');
const deleteCloudReview = _fbProxy('deleteCloudReview');

// Review tombstones. Persist a Set of deleted review IDs in localStorage
// so a delete on Device A survives a fresh cloud pull on Device B (or
// on the same device after the app is closed) even if the initial
// Firestore delete failed (e.g. offline delete). Every cloud-merge path
// filters through applyTombstones, and any ID still present in cloud
// but tombstoned locally triggers a retry delete — tombstones drain
// once the backend confirms the doc is gone.
//
// Before this landed (audit finding S-2), deleteReview only removed
// local state + Storage photos. The Firestore doc persisted, and the
// next cloud pull re-inserted the "deleted" review, silently violating
// the deletion promise in delete-account.html.
const TOMBSTONE_KEY = 'bbq-deleted-review-ids';
function loadTombstones() {
  try { return new Set(JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveTombstones(set) {
  try { localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...set])); } catch {}
}
function addTombstone(id) {
  const t = loadTombstones();
  t.add(id);
  saveTombstones(t);
}
function applyTombstones(reviews, uidForCleanup) {
  const t = loadTombstones();
  if (t.size === 0) return reviews;
  if (uidForCleanup) {
    for (const r of reviews) {
      if (t.has(r.id)) deleteCloudReview(uidForCleanup, r.id).catch(() => {});
    }
  }
  return reviews.filter(r => !t.has(r.id));
}

// Passive — wait for the scheduled (post-LCP) load.
const handleRedirectResult = _fbDefer('handleRedirectResult');

function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|FB_IAB|FBIOS|Twitter|TikTok|Snapchat|Line\//i.test(ua);
}

// onAuthChange needs a synchronous unsubscribe return. The listener
// registers only after the scheduled firebase load fires, keeping the
// chunk out of the LCP window. Unmounting before then sets the flag,
// so the listener is never registered.
function onAuthChange(callback) {
  let realUnsub = null;
  let unsubscribed = false;
  scheduleFirebaseLoad().then((m) => {
    if (unsubscribed) return;
    realUnsub = m.onAuthChange(callback);
  });
  return () => {
    unsubscribed = true;
    if (realUnsub) realUnsub();
  };
}

import {
  CATEGORIES, DESCRIPTORS, MEATS, SIDES_LIST, SAUCE_DEP_OPTIONS,
  RETURN_OPTIONS, THEMES, STAR_COLORS, GEOCODE_CACHE_KEY,
} from '../constants.js';
import {
  calcScores, genId, emptyReview, migrateReview, compressPhoto,
  track, trackPageView, setGaContext,
  generateShareCard, generateGoogleDraft, exportCSV,
} from '../scoring.js';
import { generateReviewStoryCard } from '../reviewShareCard.js';

const AppContext = createContext(null);

export function useAppContext() {
  return useContext(AppContext);
}

export default function AppProvider({ children }) {
  const [reviews, setReviews] = useState([]);
  // Default landing view is 'home' — the actual app.
  // Marketing/story content lives on the brand landing at /, not inside
  // the app's own URL. If a user comes through holysmokesbbqco.com/scorecard
  // or /notebook, they've already chosen the app and want to use it.
  //
  // The 'site' view (and 'about' equivalents in the Notebook) is still
  // reachable by explicit navigation (e.g. via menu or footer link),
  // but is no longer the default landing.
  const [view, setView] = useState('home');
  const [currentReview, setCurrentReview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  // Filter state — persisted to localStorage so a refresh, app relaunch,
  // or browser navigation away-and-back keeps the user's filter context.
  // The `search` field intentionally does NOT persist (typing-in-progress
  // text shouldn't survive a restart), but sort + trip + city do.
  const [sort, setSort] = useState(() => localStorage.getItem('bbq-sort') || 'date');
  const [search, setSearch] = useState('');
  const [tripFilter, setTripFilter] = useState(() => localStorage.getItem('bbq-trip-filter') || '');
  const [cityFilter, setCityFilter] = useState(() => localStorage.getItem('bbq-city-filter') || '');
  // Quick filter chip — one at a time. Values: '', 'top', 'recent', 'photos'.
  const [quickFilter, setQuickFilter] = useState(() => localStorage.getItem('bbq-quick-filter') || '');
  const [dirty, setDirty] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  // Review pending an in-app delete confirmation (null = none). See
  // deleteReview / DeleteConfirmModal.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // localStorage flag set when the user ticks "never ask again" in the
  // delete confirmation — lets a mass-delete run skip the prompt.
  const DELETE_CONFIRM_SKIP_KEY = 'bbq-scorecard-skip-delete-confirm';
  const [themePref, setThemePref] = useState(() => localStorage.getItem('muiller-bbq-theme') || 'system');
  const [systemTheme, setSystemTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const theme = themePref === 'system' ? systemTheme : themePref;
  const [draftText, setDraftText] = useState('');
  const [mapLoading, setMapLoading] = useState(false);
  const [publishedReviews, setPublishedReviews] = useState([]);
  const [expandedPublic, setExpandedPublic] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [friendName, setFriendName] = useState('');
  const [friendsList, setFriendsList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('muiller-bbq-friends') || '[]'); } catch { return []; }
  });
  const [shareGenerating, setShareGenerating] = useState(false);
  // Separate flag for the Story Card so generating one card doesn't flip
  // the other button's label/disabled state (they are distinct exports).
  const [storyGenerating, setStoryGenerating] = useState(false);
  const [fbUser, setFbUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [fbFriends, setFbFriends] = useState([]);
  const [friendCodeInput, setFriendCodeInput] = useState('BBQ-');
  const [friendMsg, setFriendMsg] = useState('');
  const [friendReviewsMap, setFriendReviewsMap] = useState({});
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardSort, setLeaderboardSort] = useState('reviews');
  const [fbSyncing, setFbSyncing] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  // appMode used to switch the app between 'restaurants' (Scorecard) and
  // 'cooks' (legacy Notebook within Scorecard) modes. As of v3.1.12 the
  // Notebook is its own standalone Play Store app, and this app is
  // permanently Scorecard-only. The state is pinned to 'restaurants' so
  // any remaining `appMode === 'cooks'` reads in the codebase never
  // become true. setAppMode is a no-op kept as a safe stub for callers
  // that haven't been cleaned up yet.
  const [appMode] = useState('restaurants');
  const setAppMode = () => {};
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('bbq-onboarded'));
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [nearbyStatus, setNearbyStatus] = useState('locating');
  const [nearbyResults, setNearbyResults] = useState([]);
  const [nearbyRadius, setNearbyRadius] = useState(40000);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const addPhotoInputRef = useRef(null);
  const importInputRef = useRef(null);
  const savedSnapshot = useRef(null);
  const mapRef = useRef(null);
  const nearbyMapRef = useRef(null);

  const S = THEMES[theme] || THEMES.dark;

  /* ── Style functions ── */
  const sBtn = (active, small) => ({
    padding: small ? '6px 12px' : '10px 16px',
    background: active ? S.accent : S.card,
    color: active ? '#fff' : S.muted,
    border: `1px solid ${active ? S.accent : S.border}`,
    borderRadius: '6px', cursor: 'pointer',
    fontSize: small ? '12px' : '13px', fontWeight: '600',
    transition: 'all 0.15s',
  });

  const sInput = () => ({
    width: '100%', padding: '10px', background: S.card, border: `1px solid ${S.border}`,
    borderRadius: '6px', color: S.text, fontFamily: 'inherit', fontSize: '14px', boxSizing: 'border-box',
  });

  const sLabel = () => ({
    display: 'block', fontSize: '11px', color: S.muted, marginBottom: '4px', letterSpacing: '1px',
  });

  const attemptSignIn = async () => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
      track('signin_failed', { method: 'google', reason: 'in_app_browser' });
      return null;
    }
    try {
      return await firebaseSignIn();
    } catch (e) {
      track('signin_failed', { method: 'google', reason: (e?.code || e?.message || 'unknown').toString().slice(0, 80) });
      throw e;
    }
  };

  const attemptAppleSignIn = async () => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
      track('signin_failed', { method: 'apple', reason: 'in_app_browser' });
      return null;
    }
    try {
      return await firebaseSignInWithApple();
    } catch (e) {
      track('signin_failed', { method: 'apple', reason: (e?.code || e?.message || 'unknown').toString().slice(0, 80) });
      throw e;
    }
  };

  // Inject responsive CSS (once)
  useEffect(() => {
    const id = 'bbq-responsive-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      /* ── Prevent white background bleed (Leaflet / scroll bounce) ── */
      html, body, #root { min-height: 100vh !important; }
      .leaflet-container { background: #111 !important; }

      /* ── Desktop Responsive Layout ── */
      .bbq-container { max-width: 480px; margin: 0 auto; padding: 0; }
      .bbq-container-wide { max-width: 720px; margin: 0 auto; padding: 0; }
      .bbq-container-form { max-width: 480px; margin: 0 auto; padding: 16px; padding-bottom: 100px; }
      .bbq-review-grid { display: flex; flex-direction: column; }
      .bbq-detail-layout { }
      .bbq-detail-hero { }
      .bbq-detail-scores { }
      .bbq-score-tracks { }
      .bbq-landing-reviews { }
      .bbq-landing-hero { padding: 32px 0 24px; }
      .bbq-landing-story { }
      .bbq-profile-grid { }
      .bbq-leaderboard-grid { }
      .bbq-form-tracks { }
      .bbq-form-fields { }
      .bbq-stats-grid { display: flex; justify-content: space-around; text-align: center; }
      .bbq-form-selects { }

      @media (min-width: 768px) {
        .bbq-container { max-width: 900px; }
        .bbq-container-wide { max-width: 1100px; }
        .bbq-container-form { max-width: 860px; }
        .bbq-review-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .bbq-review-grid > div { margin-bottom: 0 !important; }
        .bbq-detail-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: start;
        }
        .bbq-detail-hero { position: sticky; top: 16px; }
        .bbq-score-tracks {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .bbq-landing-reviews {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .bbq-landing-reviews > div { margin-bottom: 0 !important; }
        .bbq-landing-hero { padding: 48px 0 36px; }
        .bbq-hero-logo { width: 260px !important; height: 260px !important; }
        .bbq-landing-hero h1 { font-size: 42px !important; }
        .bbq-landing-story { }
        .bbq-profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .bbq-profile-grid > div { margin-bottom: 0 !important; }
        .bbq-leaderboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .bbq-form-tracks {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .bbq-form-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 16px;
        }
        .bbq-form-fields > div { margin-bottom: 0 !important; }
        .bbq-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .bbq-form-selects {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
      }

      @media (min-width: 1200px) {
        .bbq-container { max-width: 1100px; }
        .bbq-container-wide { max-width: 1300px; }
        .bbq-container-form { max-width: 1000px; }
        .bbq-review-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        .bbq-landing-reviews {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const raw = loadLocal();
    const migrated = raw.map(migrateReview);
    setReviews(migrated);
    setLoaded(true);
    fetch(`${import.meta.env.BASE_URL}published-reviews.json`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPublishedReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
    // Kick off the Firebase chunk fetch during browser idle, so it's ready
    // by the time the user signs in or navigates to an authenticated view.
    // This keeps the firebase chunk out of the initial preload graph entirely.
    scheduleFirebaseLoad();
    // Handle Firebase redirect result (mobile sign-in flow) — proxied,
    // will await firebase load before running.
    handleRedirectResult().catch(() => {});
    // Track PWA install funnel: prompt-shown (browser eligible to install)
    // → app_installed (user accepted). Conversion rate between the two
    // is the prompt-acceptance KPI.
    window.addEventListener('beforeinstallprompt', () => track('app_install_prompt_shown'));
    window.addEventListener('appinstalled', () => track('app_installed'));
  }, []);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      if (fbUser) {
        syncReviewsUp(fbUser.uid, reviews).then(() => {
          setSyncStatus('done');
          setTimeout(() => setSyncStatus(''), 2000);
        }).catch(() => {});
      }
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [reviews, fbUser]);

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      const wasSignedOut = !fbUser;
      setFbUser(user);
      if (user) {
        if (wasSignedOut) track('sign_in', { method: 'google' });
        try {
          const profile = await getOrCreateProfile(user);
          setUserProfile(profile);
          const friends = await getFriendsList(user.uid);
          setFbFriends(friends);

          // Load any pending incoming friend requests so the UI can
          // surface them. Failure here is non-fatal — log and continue.
          try {
            const reqs = await getIncomingFriendRequests(user.uid);
            setIncomingRequests(reqs);
          } catch (e) { console.warn('friend requests load failed:', e); }

          // Merge cloud reviews with local, then drop anything the user
          // has locally tombstoned (retrying the cloud delete for docs
          // that came back because the original delete raced or failed).
          const cloudReviews = await loadMyCloudReviews(user.uid);
          const local = loadLocal();
          const merged = await mergeReviews(local, cloudReviews);
          const kept = applyTombstones(merged, user.uid);
          setReviews(kept);
          saveLocal(kept);

          // Push merged set back to cloud
          await syncReviewsUp(user.uid, kept);

          // Photo repair loop. Any review with base64 photos still sitting
          // locally means saveCurrentReview happened while offline or
          // signed out. Now that we HAVE fbUser, upload those base64
          // blobs to Storage and replace them with cloud URLs so the
          // next WebView clear or app update can't wipe them.
          //
          // This is the primary fix for the "I keep losing photos on
          // every app update" bug — the cloud is the only durable copy,
          // and until this loop existed, an offline-at-save-time photo
          // never made it there.
          const repaired = [];
          for (const rev of kept) {
            const photos = rev.photos || [];
            const hasBase64 = photos.some(p => typeof p === 'string' && p.startsWith('data:'));
            if (!hasBase64) continue;
            try {
              const urls = await uploadReviewPhotos(user.uid, rev.id, photos);
              const stillHasBase64 = urls.some(p => typeof p === 'string' && p.startsWith('data:'));
              if (stillHasBase64) continue; // upload cap or transient failure — try again next start
              const patched = { ...rev, photos: urls, photo: urls[0] || null };
              repaired.push(patched);
              try { await syncReviewWithPhotos(user.uid, patched); } catch {}
            } catch (e) {
              console.error(`Photo repair failed for review ${rev.id}:`, e);
            }
          }
          if (repaired.length) {
            const patchedIds = new Set(repaired.map(r => r.id));
            const nextLocal = kept.map(r => patchedIds.has(r.id) ? repaired.find(x => x.id === r.id) : r);
            setReviews(nextLocal);
            saveLocal(nextLocal);
            track('photo_repair_ran', { restored: repaired.length });
          }
        } catch (e) {
          console.error('Firebase init error:', e);
        }
      } else {
        setUserProfile(null);
        setFbFriends([]);
        setIncomingRequests([]);
      }
    });
    return unsub;
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // App-mode persistence removed — Scorecard is now permanently
  // restaurants-only. The bbq-app-mode localStorage key is left in
  // place for any user updating from a dual-mode version, but no
  // longer written.

  // Persist sort + trip + city filters. Paired with the lazy initializers
  // above so the user's last filter context survives across sessions.
  useEffect(() => { localStorage.setItem('bbq-sort', sort); }, [sort]);
  useEffect(() => { localStorage.setItem('bbq-trip-filter', tripFilter); }, [tripFilter]);
  useEffect(() => { localStorage.setItem('bbq-city-filter', cityFilter); }, [cityFilter]);
  useEffect(() => { localStorage.setItem('bbq-quick-filter', quickFilter); }, [quickFilter]);

  // ── Review-form draft persistence ──
  // Auto-save in-progress reviews to localStorage so an accidental tab
  // close, browser crash, or app kill doesn't lose the user's work. The
  // draft is written whenever currentReview changes while the user is
  // actively on the new/edit form, and cleared on successful save or
  // explicit cancel. On app mount, if a draft is found, the user is
  // prompted to restore it.
  const DRAFT_KEY = 'bbq-review-draft';
  useEffect(() => {
    if ((view === 'new' || view === 'edit') && currentReview) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ view, review: currentReview })); } catch {}
    } else if (view === 'home') {
      // Clean up when the user navigates back to home (save or cancel)
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
  }, [currentReview, view]);

  // On initial mount, look for a saved draft. If one exists, offer to
  // restore. Skipped during onboarding so first-time users don't get a
  // confusing prompt. Runs once via the loaded-gate.
  useEffect(() => {
    if (!loaded) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.review || !draft?.view) return;
      const restaurantName = draft.review.restaurant || 'Untitled review';
      const ok = window.confirm(
        `You have an unsaved review draft for "${restaurantName}". Restore it?`
      );
      if (ok) {
        setCurrentReview(draft.review);
        setView(draft.view);
        savedSnapshot.current = JSON.stringify(draft.review);
        setDirty(true);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // Bad draft — drop it
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    }
    // Only run once after initial load completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* ── GA4 user properties + user_id ──
     Keep the analytics context in sync with auth/state changes so every
     event can be segmented by app_mode, signed_in, friend_count, etc.
     User properties are user-scoped (sticky until changed) — registered
     in GA4 Console as custom dimensions to use them in reports. */
  useEffect(() => {
    setGaContext({
      user_id: fbUser?.uid || null,
      signed_in: !!fbUser,
    });
  }, [fbUser]);

  useEffect(() => {
    setGaContext({ app_mode: appMode });
  }, [appMode]);

  useEffect(() => {
    setGaContext({ review_count: reviews.length });
  }, [reviews.length]);

  useEffect(() => {
    setGaContext({ friend_count: fbFriends.length });
  }, [fbFriends.length]);

  useEffect(() => {
    setGaContext({ theme: themePref });
  }, [themePref]);

  useEffect(() => {
    localStorage.setItem('muiller-bbq-theme', themePref);
    // Apply background via style tag with !important so nothing can override it
    let themeStyle = document.getElementById('bbq-theme-bg');
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'bbq-theme-bg';
      document.head.appendChild(themeStyle);
    }
    themeStyle.textContent = `html, body, #root { background: ${S.bg} !important; color: ${S.text}; }`;
    document.body.style.color = S.text;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', S.bg);
  }, [theme, themePref, view]);

  useEffect(() => {
    const handler = (e) => {
      if (view === 'site') return; // Let Android handle it (minimize app)
      e.preventDefault();
      if (view !== 'home' && view !== 'site') {
        if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) {
          window.history.pushState(null, '', '');
          return;
        }
        setView('home');
        setCurrentReview(null);
        setDirty(false);
        setDraftText('');
      } else if (view === 'home') {
        setView('site');
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [view, dirty]);

  /* Capacitor Android hardware back button */
  useEffect(() => {
    if (!window.Capacitor) return;
    let cleanup;
    import('@capacitor/app').then(({ App }) => {
      const listener = App.addListener('backButton', ({ canGoBack }) => {
        if (view === 'site') {
          App.minimizeApp();
        } else if (view === 'home') {
          setView('site');
        } else {
          if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
          setView('home');
          setCurrentReview(null);
          setDirty(false);
          setDraftText('');
        }
      });
      cleanup = () => listener.then(l => l.remove());
    });
    return () => { if (cleanup) cleanup(); };
  }, [view, dirty]);

  /* Pull-to-refresh for mobile */
  useEffect(() => {
    if (view !== 'home' || !fbUser) return;
    let startY = 0;
    let pulling = false;
    const onTouchStart = (e) => {
      if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
    };
    const onTouchEnd = async (e) => {
      if (!pulling) return;
      const diff = e.changedTouches[0].clientY - startY;
      pulling = false;
      if (diff > 100) {
        setPullRefreshing(true);
        track('pull_refresh_sync');
        try {
          const cloud = await loadMyCloudReviews(fbUser.uid);
          const merged = await mergeReviews(reviews, cloud);
          const kept = applyTombstones(merged, fbUser.uid);
          setReviews(kept);
          saveLocal(kept);
          await syncReviewsUp(fbUser.uid, kept);
          const friends = await getFriendsList(fbUser.uid);
          setFbFriends(friends);
        } catch (e) { console.error('Pull refresh error:', e); }
        setPullRefreshing(false);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [view, fbUser, reviews]);

  function navigateTo(v) {
    window.history.pushState(null, '', '');
    setView(v);
    setDraftText('');
    // Fire SPA page_view so funnels and per-screen reports work in GA4.
    // Also updates the analytics context so subsequent custom events
    // know which screen they were fired from.
    trackPageView(v);
    const viewEvents = {
      stats: 'view_stats', map: 'view_map', leaderboard: 'view_leaderboard', mvp: 'view_mvp',
      compare: 'comparison_viewed',
      import: 'view_import', recipes: 'view_recipes', calculator: 'view_calculator', profile: 'view_profile',
      rewards: 'view_rewards',
      home: 'scorecard_launched',
    };
    if (viewEvents[v]) track(viewEvents[v]);
  }

  const save = useCallback((updated) => {
    setReviews(updated);
    saveLocal(updated);
  }, []);

  const startNew = () => {
    const nr = emptyReview();
    setCurrentReview(nr);
    savedSnapshot.current = JSON.stringify(nr);
    setDirty(false);
    navigateTo('new');
  };

  const editReview = (r) => {
    const migrated = migrateReview(r);
    setCurrentReview({ ...migrated });
    savedSnapshot.current = JSON.stringify(migrated);
    setDirty(false);
    navigateTo('edit');
  };

  const viewDetail = async (r) => {
    setCurrentReview(migrateReview(r));
    setGalleryIndex(0);
    setDirty(false);
    navigateTo('detail');
    // Fetch friend reviews for this restaurant
    if (fbUser && fbFriends.length > 0 && r.restaurant && r.location) {
      try {
        const friendIds = fbFriends.map(f => f.id);
        const fReviews = await getFriendReviewsForRestaurant(friendIds, r.restaurant, r.location);
        // Group by userId and attach display name
        const byUser = {};
        for (const fr of fReviews) {
          const friend = fbFriends.find(f => f.id === fr.userId);
          if (friend) {
            byUser[fr.userId] = { ...fr, displayName: friend.displayName };
          }
        }
        setFriendReviewsMap(byUser);
      } catch { setFriendReviewsMap({}); }
    } else {
      setFriendReviewsMap({});
    }
  };

  // "Review this place again" — clones the existing review with a fresh
  // date so the user can score a return visit. Keeps restaurant + location
  // + trip + price + sauce + return preferences. Resets photos, friend
  // scores, notes, and notesLog so the new visit gets its own data. The
  // previous "(copy)" suffix on restaurant name was confusing — users
  // returning to Joe's BBQ aren't reviewing "Joe's BBQ (copy)", they're
  // reviewing Joe's BBQ again.
  const duplicateReview = (r) => {
    const dup = {
      ...r,
      id: genId(),
      date: new Date().toISOString().split('T')[0],
      photo: null,
      photos: [],
      friends: [],
      lastEdited: null,
      notesLog: [],
      notes: '',
    };
    setCurrentReview(dup);
    savedSnapshot.current = JSON.stringify(dup);
    setDirty(false);
    navigateTo('new');
  };

  const update = (key, val) => {
    const updated = { ...currentReview, [key]: val };
    setCurrentReview(updated);
    setDirty(JSON.stringify(updated) !== savedSnapshot.current);
  };

  const updateScore = (key, val) => {
    const scores = { ...currentReview.scores, [key]: val };
    const updated = { ...currentReview, scores };
    setCurrentReview(updated);
    setDirty(JSON.stringify(updated) !== savedSnapshot.current);
  };

  const toggleChip = (key, val) => {
    const arr = currentReview[key] || [];
    const updated = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    update(key, updated);
  };

  const saveCurrentReview = async () => {
    if (!currentReview.restaurant.trim()) return;
    const exists = reviews.find(r => r.id === currentReview.id);
    let reviewToSave = exists
      ? { ...currentReview, lastEdited: new Date().toISOString().split('T')[0] }
      : currentReview;

    // Save-time gate. If there are photos and the user is NOT signed in,
    // those photos live only in localStorage as base64. Any WebView
    // clear or app update deletes them. Warn once, honestly, so the
    // user can either sign in first or knowingly proceed. Not a hard
    // block — some people genuinely want offline-only.
    const localPhotos = (reviewToSave.photos || []).filter(
      p => typeof p === 'string' && p.startsWith('data:')
    );
    if (!fbUser && localPhotos.length > 0) {
      const proceed = window.confirm(
        'These photos will only be saved on this device. '
        + 'If the app is updated or reinstalled they will be lost. '
        + 'Sign in to keep them safe in the cloud. Save anyway?'
      );
      if (!proceed) return;
      track('photo_save_unsigned', { count: localPhotos.length });
    }

    // Upload photos to Firebase Storage if signed in
    if (fbUser && reviewToSave.photos?.length > 0) {
      try {
        setSyncStatus('uploading');
        const cloudUrls = await uploadReviewPhotos(fbUser.uid, reviewToSave.id, reviewToSave.photos);
        const uploadedAny = cloudUrls.some(p => typeof p === 'string' && p.startsWith('https://'));
        const stillBase64 = cloudUrls.some(p => typeof p === 'string' && p.startsWith('data:'));
        reviewToSave = { ...reviewToSave, photos: cloudUrls, photo: cloudUrls[0] || null };
        // Surface partial failure so the Detail page can show a retry.
        if (stillBase64) {
          setSyncStatus('photos-failed');
          track('photo_upload_partial', { restaurant: reviewToSave.restaurant });
        }
        void uploadedAny;
      } catch (e) {
        console.error('Photo upload failed:', e);
        setSyncStatus('photos-failed');
        track('photo_upload_failed', { restaurant: reviewToSave.restaurant, message: e?.message || 'unknown' });
      }
    }

    const updated = exists
      ? reviews.map(r => r.id === currentReview.id ? reviewToSave : r)
      : [reviewToSave, ...reviews];
    save(updated);
    const sc = calcScores(reviewToSave.scores);
    if (exists) {
      track('review_edited', { restaurant: reviewToSave.restaurant, location: reviewToSave.location || '', stars: sc.stars, composite: sc.composite.toFixed(2) });
    } else {
      track('review_created', { restaurant: reviewToSave.restaurant, location: reviewToSave.location || '', stars: sc.stars, composite: sc.composite.toFixed(2), review_count: updated.length });
    }
    setDirty(false);
    setView('home');
    setCurrentReview(null);
    if (fbUser) {
      // Write the single saved review (including any new photo URLs) to
      // cloud explicitly. This is the ONLY path that writes photo fields.
      // Routine bulk sync (syncReviewsUp) intentionally skips photos to
      // avoid wiping cloud URLs when local has empty state.
      syncReviewWithPhotos(fbUser.uid, reviewToSave).then(() => {
        setSyncStatus('done');
        setTimeout(() => setSyncStatus(''), 2000);
      }).catch(() => {});
    }
  };

  // The actual removal, with no confirmation. Both the confirm modal and
  // the "never ask again" fast-path call this.
  const performDelete = (id) => {
    const removed = reviews.find(r => r.id === id);
    save(reviews.filter(r => r.id !== id));
    setView('home');
    setCurrentReview(null);
    setDirty(false);
    track('review_deleted', { restaurant: removed?.restaurant || '', location: removed?.location || '' });
    // Tombstone locally so a cross-device merge won't resurrect this.
    addTombstone(id);
    // Clean up cloud state — Firestore doc + Storage photos. Both are
    // best-effort; if either fails while offline the tombstone survives
    // and applyTombstones retries the doc delete on next cloud pull.
    if (fbUser) {
      deleteReviewPhotos(fbUser.uid, id).catch(() => {});
      deleteCloudReview(fbUser.uid, id).catch(() => {});
    }
  };

  // Deleting a review opens an in-app "are you sure?" (DeleteConfirmModal),
  // NOT a native confirm — unless the user has ticked "never ask again",
  // which stores DELETE_CONFIRM_SKIP_KEY so a mass-delete run isn't
  // interrupted on every review.
  const deleteReview = (id) => {
    let skip = false;
    try { skip = localStorage.getItem(DELETE_CONFIRM_SKIP_KEY) === '1'; } catch {}
    if (skip) { performDelete(id); return; }
    setPendingDeleteId(id);
  };

  const confirmPendingDelete = (neverAskAgain) => {
    if (neverAskAgain) { try { localStorage.setItem(DELETE_CONFIRM_SKIP_KEY, '1'); } catch {} }
    if (pendingDeleteId != null) performDelete(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const cancelPendingDelete = () => setPendingDeleteId(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cloud-first photo policy. Photos in localStorage vanish whenever
    // the Android WebView storage gets wiped (app update, Capacitor
    // version bump, "Clear data"). The only durable copy lives in
    // Firebase Storage, which requires sign-in. Rather than let people
    // add photos that will silently disappear, require sign-in at the
    // capture point — with an offer to sign in inline.
    if (!fbUser) {
      const wantsIn = window.confirm(
        'Adding photos needs sign-in.\n\n'
        + 'Photos are stored in the cloud so they survive app updates. '
        + 'Without sign-in, any photo you add will be lost the next time '
        + 'the app updates.\n\n'
        + 'Sign in now?'
      );
      e.target.value = ''; // clear the file input either way
      if (!wantsIn) {
        track('photo_signin_declined');
        return;
      }
      track('photo_signin_accepted');
      try {
        setSyncStatus('connecting');
        await attemptSignIn();
        setSyncStatus('');
      } catch {
        setSyncStatus('');
      }
      // After sign-in, don't try to continue with the file — the input
      // is already cleared. User needs to tap the photo button again
      // (the intent is clearer, and it avoids saving a stale File ref).
      return;
    }

    const compressed = await compressPhoto(file);
    // Add to photos array (cap at 3 photos per review)
    const photos = [...(currentReview.photos || [])];
    if (photos.length >= 3) {
      alert('Maximum 3 photos per review.');
      return;
    }
    photos.push(compressed);
    const updated = { ...currentReview, photos, photo: photos[0] };
    setCurrentReview(updated);
    setDirty(true);
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    const photos = [...(currentReview.photos || [])];
    photos.splice(idx, 1);
    const updated = { ...currentReview, photos, photo: photos[0] || null };
    setCurrentReview(updated);
    setDirty(true);
  };

  // Friends management
  const addFriend = () => {
    const name = friendName.trim();
    if (!name) return;
    const friends = [...(currentReview.friends || [])];
    if (friends.find(f => f.name.toLowerCase() === name.toLowerCase())) return;
    friends.push({ name, scores: {} });
    const updated = { ...currentReview, friends };
    setCurrentReview(updated);
    setDirty(true);
    setFriendName('');
    // Save to master friends list
    if (!friendsList.includes(name)) {
      const newList = [...friendsList, name];
      setFriendsList(newList);
      localStorage.setItem('muiller-bbq-friends', JSON.stringify(newList));
    }
  };

  const removeFriend = (name) => {
    const friends = (currentReview.friends || []).filter(f => f.name !== name);
    const updated = { ...currentReview, friends };
    setCurrentReview(updated);
    setDirty(true);
  };

  const updateFriendScore = (friendName, key, val) => {
    const friends = (currentReview.friends || []).map(f => {
      if (f.name === friendName) return { ...f, scores: { ...f.scores, [key]: val } };
      return f;
    });
    const updated = { ...currentReview, friends };
    setCurrentReview(updated);
    setDirty(true);
  };

  const exportBackup = () => {
    track('backup_exported', { review_count: reviews.length });
    const json = JSON.stringify(reviews, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bbq-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid');
        const merged = new Map();
        for (const r of reviews) merged.set(r.id, r);
        for (const r of data) merged.set(r.id, r);
        const latest = Array.from(merged.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        save(latest);
        track('backup_imported', { review_count: latest.length });
        alert(`Imported! ${latest.length} total reviews.`);
      } catch {
        alert('Import failed — invalid file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const publishReviews = () => {
    const pubData = reviews.map(r => {
      const { photo, photos, ...rest } = r;
      return { ...rest, photo: photo ? '(photo)' : null, photos: (photos || []).length > 0 ? ['(photos)'] : [] };
    });
    const json = JSON.stringify(pubData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'published-reviews.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addTimestampedNote = () => {
    if (!currentReview.notes.trim()) return;
    const stamp = new Date().toISOString().split('T')[0];
    const entry = `${stamp}: ${currentReview.notes.trim()}`;
    const log = [...(currentReview.notesLog || []), entry];
    const updated = { ...currentReview, notesLog: log, notes: '' };
    setCurrentReview(updated);
    setDirty(true);
  };

  /* ── Derived data ── */
  const ranked = useMemo(() => {
    let list = [...reviews];
    if (search) {
      const q = search.toLowerCase();
      // Now also matches on trip name and notes — so typing "birthday"
      // finds every review from the birthday trip, and typing a phrase
      // from your notes ("brisket dry") pulls up the specific review.
      list = list.filter(r =>
        r.restaurant.toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q) ||
        (r.trip || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    if (tripFilter) list = list.filter(r => r.trip === tripFilter);
    if (cityFilter) list = list.filter(r => r.location === cityFilter);
    // Quick filters — mutually exclusive so the UI can render them as
    // chips where tapping the active one clears it.
    if (quickFilter === 'top') {
      list = list.filter(r => calcScores(r.scores).composite >= 4.5);
    } else if (quickFilter === 'recent') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      list = list.filter(r => (r.date || '') >= cutoffStr);
    } else if (quickFilter === 'photos') {
      list = list.filter(r => (r.photos?.length || 0) > 0 || !!r.photo);
    }
    if (sort === 'score') list.sort((a, b) => calcScores(b.scores).composite - calcScores(a.scores).composite);
    else list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [reviews, search, tripFilter, cityFilter, quickFilter, sort]);

  const rankMap = useMemo(() => {
    const byScore = [...reviews].sort((a, b) => calcScores(b.scores).composite - calcScores(a.scores).composite);
    const map = {};
    byScore.forEach((r, i) => { map[r.id] = i + 1; });
    return map;
  }, [reviews]);

  const trips = useMemo(() => [...new Set(reviews.map(r => r.trip).filter(Boolean))], [reviews]);
  const cities = useMemo(() => [...new Set(reviews.map(r => r.location).filter(Boolean))], [reviews]);

  const meatMvps = useMemo(() => {
    const allMeats = new Set();
    reviews.forEach(r => {
      (r.meats || []).forEach(m => allMeats.add(m));
      if (r.meatOther) r.meatOther.split(',').map(m => m.trim()).filter(Boolean).forEach(m => allMeats.add(m));
    });
    const mvps = [];
    for (const meat of allMeats) {
      const matching = reviews.filter(r =>
        (r.meats || []).includes(meat) ||
        (r.meatOther || '').split(',').map(m => m.trim()).includes(meat)
      );
      if (matching.length === 0) continue;
      const best = matching.reduce((a, b) =>
        calcScores(a.scores).bbqAvg > calcScores(b.scores).bbqAvg ? a : b
      );
      mvps.push({ meat, restaurant: best.restaurant, review: best, score: calcScores(best.scores), count: matching.length });
    }
    return mvps.sort((a, b) => b.score.bbqAvg - a.score.bbqAvg);
  }, [reviews]);

  const shareReview = async (r) => {
    const sc = calcScores(r.scores);
    const text = `${r.restaurant} — ${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)} (${sc.composite.toFixed(2)})\n${r.location || ''}${r.wouldReturn ? `\nWould return: ${r.wouldReturn}` : ''}`;

    setShareGenerating(true);
    try {
      // Compute this review's rank among all of the user's reviews so
      // the share card can show "#3 of 47" — organic brag material,
      // and it also implicitly explains the composite score.
      const byScore = [...reviews].sort((a, b) =>
        calcScores(b.scores).composite - calcScores(a.scores).composite);
      const idx = byScore.findIndex(x => x.id === r.id);
      const rankInfo = idx >= 0 && byScore.length > 1
        ? { rank: idx + 1, total: byScore.length }
        : null;
      const blob = await generateShareCard(r, { rankInfo });
      const file = new File([blob], `${r.restaurant.replace(/[^a-zA-Z0-9]/g, '-')}-review.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: r.restaurant, text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: r.restaurant, text });
      } else {
        // Desktop fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        navigator.clipboard?.writeText(text);
      }
    } catch {
      // Fallback to text-only share
      if (navigator.share) navigator.share({ title: r.restaurant, text });
      else navigator.clipboard?.writeText(text);
    }
    setShareGenerating(false);
    track('share_card_generated', { restaurant: r.restaurant });
  };

  // Story-format share card (1080×1920) — the social-flywheel format.
  // Same share/download plumbing as shareReview, different canvas.
  const shareReviewStory = async (r) => {
    const sc = calcScores(r.scores);
    const text = `${r.restaurant} — ${sc.composite.toFixed(2)} on the Scorecard${r.location ? ` (${r.location})` : ''}`;

    const filename = `${r.restaurant.replace(/[^a-zA-Z0-9]/g, '-')}-story.png`;

    setStoryGenerating(true);
    try {
      const byScore = [...reviews].sort((a, b) =>
        calcScores(b.scores).composite - calcScores(a.scores).composite);
      const idx = byScore.findIndex(x => x.id === r.id);
      const rankInfo = idx >= 0 && byScore.length > 1
        ? { rank: idx + 1, total: byScore.length }
        : null;
      const blob = await generateReviewStoryCard(r, { rankInfo });

      const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
      if (isNative) {
        // Native (Capacitor Android/iOS): a blob download is a dead-end
        // in the webview — the old path silently did nothing. Write the
        // PNG to disk and open the OS share sheet with it attached, the
        // same pattern the PDF export uses.
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import('@capacitor/filesystem'),
          import('@capacitor/share'),
        ]);
        const b64 = await blobToBase64(blob);
        const written = await Filesystem.writeFile({
          path: filename, data: b64, directory: Directory.Documents, recursive: true,
        });
        await Share.share({ title: r.restaurant, text, url: written.uri, dialogTitle: 'Share Story Card' });
      } else {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: r.restaurant, text, files: [file] });
        } else if (navigator.share) {
          // Browsers with share but not file-share: send the text, don't
          // silently drop to a download the user may not expect.
          await navigator.share({ title: r.restaurant, text });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          navigator.clipboard?.writeText(text);
        }
      }
      // Log success only after the card actually generated AND shared.
      track('story_card_generated', { restaurant: r.restaurant });
    } catch (e) {
      // AbortError = the user dismissed the share sheet; that's not a
      // failure and shouldn't be logged as one.
      if (e?.name !== 'AbortError') {
        track('story_card_failed', { reason: (e?.message || 'unknown').toString().slice(0, 80) });
      }
    } finally {
      setStoryGenerating(false);
    }
  };

  const exportText = (r) => {
    const sc = calcScores(r.scores);
    const friendNames = (r.friends || []).map(f => f?.name).filter(Boolean);
    const meatsAll = [...(r.meats || []), r.meatOther].filter(Boolean);
    const sidesAll = [...(r.sides || []), r.sideOther].filter(Boolean);
    const lines = [
      `═══ ${r.restaurant} ═══`,
      `Date: ${r.date}  |  Location: ${r.location || 'N/A'}`,
      r.trip ? `Trip: ${r.trip}` : '',
      // What was ordered and who was there — captured on the review but
      // previously omitted from the export, so anyone (or an AI) reading the
      // paste had to ask. Now every ordered detail rides along.
      r.orderStyle ? `Order style: ${r.orderStyle}` : '',
      meatsAll.length ? `Meats: ${meatsAll.join(', ')}` : '',
      sidesAll.length ? `Sides: ${sidesAll.join(', ')}` : '',
      r.dessert ? `Dessert: ${r.dessert}` : '',
      r.drinks ? `Drinks: ${r.drinks}` : '',
      friendNames.length ? `With: ${friendNames.join(', ')}` : '',
      `Price: $${r.price || '?'}${r.priceSplit > 1 ? ` ($${(r.price / r.priceSplit).toFixed(2)}/person × ${r.priceSplit})` : ''}`,
      '',
      '— BBQ Track —',
      ...CATEGORIES.bbq.map(c => `  ${c.label}: ${r.scores[c.key] || '-'}/9`),
      `  BBQ Average: ${sc.bbqAvg.toFixed(2)}`,
      '',
      '— Family Track —',
      ...CATEGORIES.family.map(c => `  ${c.label}: ${r.scores[c.key] || '-'}/9`),
      `  Family Average: ${sc.famAvg.toFixed(2)}  |  Bonus: +${sc.bonus.toFixed(2)}`,
      '',
      `COMPOSITE: ${sc.composite.toFixed(2)}  |  ${'★'.repeat(sc.stars)}${'☆'.repeat(5 - sc.stars)}`,
      '',
      r.sauceDep ? `Sauce: ${r.sauceDep}` : '',
      r.wouldReturn ? `Return: ${r.wouldReturn}` : '',
      ...(r.notesLog?.length ? ['', '— Notes —', ...r.notesLog] : []),
      ...(r.notes ? ['', '— Additional Notes —', r.notes] : []),
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(lines);
  };

  /* ── Offline Banner (shared across views) ── */
  const OfflineBanner = () => !isOnline ? (
    <div style={{
      background: '#7c2d12', color: '#fed7aa', padding: '8px 16px', textAlign: 'center',
      fontSize: '12px', fontWeight: '600', letterSpacing: '1px', position: 'sticky', top: 0, zIndex: 100,
      borderBottom: `1px solid #9a3412`,
    }}>
      Offline — changes saved locally
    </div>
  ) : syncStatus === 'done' ? (
    <div style={{
      background: '#14532d', color: '#bbf7d0', padding: '6px 16px', textAlign: 'center',
      fontSize: '12px', fontWeight: '600', letterSpacing: '1px', position: 'sticky', top: 0, zIndex: 100,
    }}>
      {'✓'} Synced to Google Drive
    </div>
  ) : null;

  const value = {
    // State
    appMode, setAppMode,
    reviews, setReviews,
    view, setView,
    currentReview, setCurrentReview,
    loaded,
    syncStatus, setSyncStatus,
    sort, setSort,
    search, setSearch,
    tripFilter, setTripFilter,
    cityFilter, setCityFilter,
    quickFilter, setQuickFilter,
    dirty, setDirty,
    compareIds, setCompareIds,
    compareMode, setCompareMode,
    themePref, setThemePref,
    theme,
    draftText, setDraftText,
    mapLoading, setMapLoading,
    publishedReviews,
    expandedPublic, setExpandedPublic,
    isOnline,
    galleryIndex, setGalleryIndex,
    friendName, setFriendName,
    friendsList,
    shareGenerating, storyGenerating,
    fbUser, setFbUser,
    userProfile,
    fbFriends, setFbFriends,
    friendCodeInput, setFriendCodeInput,
    friendMsg, setFriendMsg,
    friendReviewsMap,
    leaderboardData, setLeaderboardData,
    leaderboardSort, setLeaderboardSort,
    fbSyncing, setFbSyncing,
    incomingRequests, setIncomingRequests,
    showOnboarding, setShowOnboarding,
    showInAppWarning, setShowInAppWarning,
    nearbyStatus, setNearbyStatus,
    nearbyResults, setNearbyResults,
    nearbyRadius, setNearbyRadius,
    pullRefreshing,
    // Refs
    fileInputRef, galleryInputRef, addPhotoInputRef, importInputRef,
    savedSnapshot, mapRef, nearbyMapRef,
    // Theme / styles
    S, sBtn, sInput, sLabel,
    // Functions
    navigateTo, save, startNew, editReview, viewDetail, duplicateReview,
    update, updateScore, toggleChip, saveCurrentReview, deleteReview,
    pendingDeleteId, confirmPendingDelete, cancelPendingDelete,
    handlePhoto, removePhoto, addFriend, removeFriend, updateFriendScore,
    exportBackup, handleImport, publishReviews, addTimestampedNote,
    shareReview, shareReviewStory, exportText, attemptSignIn, attemptAppleSignIn,
    attemptEmailSignIn: firebaseEmailSignIn,
    attemptEmailSignUp: firebaseEmailSignUp,
    sendPasswordReset: firebaseSendPasswordReset,
    // Derived
    ranked, rankMap, trips, cities, meatMvps,
    // Component
    OfflineBanner,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
