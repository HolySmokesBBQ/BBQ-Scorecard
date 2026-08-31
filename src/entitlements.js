// Entitlements — the 4.0 free-tier gate.
//
// BBQ Scorecard is free to download on iOS as of 4.0.0. You get
// FREE_REVIEW_LIMIT saved reviews, then a one-time $3.99 unlock for
// unlimited. Before 4.0 the iOS app was a paid $3.99 download.
//
// Hard rules baked in here:
//
//  1. **iOS only.** Android is free forever (Joel, 2026-08-31) and so is
//     the web/PWA build. The gate is off everywhere except native iOS.
//
//  2. **Never lock data the user already made.** The limit blocks
//     CREATING a new review. Every existing review stays fully readable,
//     editable, exportable, and printable no matter the count. Holding
//     created content hostage is an App Review rejection risk and is
//     wrong on its own terms.
//
//  3. **Paid-era buyers are grandfathered.** The app sold for $3.99 up
//     until 4.0, so anyone who arrived before it is entitled to
//     unlimited, permanently, without paying twice. See grandfather()
//     below for how we detect them.

const UNLOCK_KEY = 'bbq-scorecard-unlocked';
const INIT_KEY = 'bbq-scorecard-entitlements-init';

export const FREE_REVIEW_LIMIT = 5;

// Non-consumable product. Must match the Product ID created in App Store
// Connect exactly, or the paywall renders with no price and purchase fails.
export const UNLOCK_PRODUCT_ID = 'com.holysmokesbbq.scorecard.unlimited';

export const UNLOCK_PRICE_FALLBACK = '$3.99';

function platform() {
  if (typeof window === 'undefined') return 'web';
  return window.Capacitor?.getPlatform?.() || 'web';
}

/**
 * The paywall exists only on native iOS. Everywhere else is unlimited.
 *
 * The force flag lets us exercise the paywall on a desktop browser, where
 * there's no StoreKit. It can only ever turn the gate ON, never off, so
 * it is not a bypass: nobody can unlock the app by setting it.
 */
export function isGateEnabled() {
  if (platform() === 'ios') return true;
  try {
    return localStorage.getItem('bbq-scorecard-force-gate') === '1';
  } catch {
    return false;
  }
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — treated as "not unlocked", never as a crash */
  }
}

/** True once the user has bought (or been granted) the unlock. */
export function isUnlocked() {
  if (!isGateEnabled()) return true;
  return read(UNLOCK_KEY) === '1';
}

/** Grant permanently. Used by purchase, restore, and grandfathering. */
export function grantUnlock(reason = 'purchase') {
  write(UNLOCK_KEY, '1');
  write(`${UNLOCK_KEY}-reason`, reason);
}

/**
 * One-time migration run at app start.
 *
 * Every iOS user who existed before 4.0 paid $3.99, so the presence of
 * reviews on a device that has never seen 4.0 means "paid customer" —
 * grant them unlimited and never ask again. A genuinely new 4.0 install
 * runs this with zero reviews, gets no grant, and starts on the free tier.
 *
 * This covers the in-place upgrade path, which is the overwhelming
 * majority. A paid customer who deletes and reinstalls after 4.0 lands
 * here with no local data, so they're caught by the receipt check in
 * restorePurchases() instead (originalAppVersion predates 4.0).
 */
export function initEntitlements(existingReviewCount = 0) {
  if (read(INIT_KEY) === '1') return;
  write(INIT_KEY, '1');
  if (isGateEnabled() && existingReviewCount > 0 && !isUnlocked()) {
    grantUnlock('grandfathered');
  }
}

/** Was this unlock a grandfather grant rather than a purchase? */
export function unlockReason() {
  return read(`${UNLOCK_KEY}-reason`) || null;
}

/**
 * Can the user save a NEW review right now? Editing an existing one is
 * always allowed — see rule 2 above.
 */
export function canCreateReview(reviewCount) {
  if (!isGateEnabled()) return true;
  if (isUnlocked()) return true;
  return reviewCount < FREE_REVIEW_LIMIT;
}

/** Reviews left on the free tier; Infinity when unlimited. */
export function reviewsRemaining(reviewCount) {
  if (!isGateEnabled() || isUnlocked()) return Infinity;
  return Math.max(0, FREE_REVIEW_LIMIT - reviewCount);
}
