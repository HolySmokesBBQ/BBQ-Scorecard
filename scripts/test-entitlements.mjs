// Stub a browser-ish environment BEFORE importing the module.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
let PLATFORM = 'ios';
globalThis.window = { Capacitor: { getPlatform: () => PLATFORM } };

const m = await import('../src/entitlements.js');
const { compareVersions } = await import('../src/purchases.js');

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

// --- iOS, brand-new install (no prior reviews) ---
m.initEntitlements(0);
t('new iOS user is gated',            m.isGateEnabled(), true);
t('new iOS user NOT unlocked',        m.isUnlocked(), false);
t('can create #1 (0 saved)',          m.canCreateReview(0), true);
t('can create #5 (4 saved)',          m.canCreateReview(4), true);
t('BLOCKED at #6 (5 saved)',          m.canCreateReview(5), false);
t('BLOCKED beyond (9 saved)',         m.canCreateReview(9), false);
t('remaining at 0 saved',             m.reviewsRemaining(0), 5);
t('remaining at 5 saved',             m.reviewsRemaining(5), 0);

// --- purchase unlocks ---
m.grantUnlock('purchase');
t('unlocked after purchase',          m.isUnlocked(), true);
t('can create past limit once paid',  m.canCreateReview(99), true);
t('remaining is Infinity when paid',  m.reviewsRemaining(99) === Infinity, true);

// --- Android is free forever ---
store.clear(); PLATFORM = 'android';
m.initEntitlements(0);
t('android gate OFF',                 m.isGateEnabled(), false);
t('android unlimited at 999',         m.canCreateReview(999), true);

// --- web/PWA also open ---
store.clear(); PLATFORM = 'web';
t('web gate OFF',                     m.isGateEnabled(), false);
t('web unlimited',                    m.canCreateReview(999), true);

// --- grandfathering: paid-era iOS user upgrading in place ---
store.clear(); PLATFORM = 'ios';
m.initEntitlements(12);               // had 12 reviews before 4.0
t('paid-era user grandfathered',      m.isUnlocked(), true);
t('grandfather reason recorded',      m.unlockReason(), 'grandfathered');
t('grandfathered can keep creating',  m.canCreateReview(12), true);

// --- migration runs once only ---
store.clear(); PLATFORM = 'ios';
m.initEntitlements(0);                // new user, no grant
m.initEntitlements(50);               // later call must NOT retro-grant
t('init is one-shot (no late grant)', m.isUnlocked(), false);

// --- receipt version comparison used for reinstall grandfathering ---
t('3.6.4 < 4.0.0',                    compareVersions('3.6.4','4.0.0') < 0, true);
t('4.0.0 == 4.0.0',                   compareVersions('4.0.0','4.0.0'), 0);
t('4.1 > 4.0.0',                      compareVersions('4.1','4.0.0') > 0, true);
t('3.6 < 4.0.0 (short form)',         compareVersions('3.6','4.0.0') < 0, true);
t('1.0 < 4.0.0',                      compareVersions('1.0','4.0.0') < 0, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
