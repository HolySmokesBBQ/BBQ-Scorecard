// Purchase layer for the 4.0 unlock (iOS only).
//
// Backed by @capgo/native-purchases (StoreKit 2 on iOS). The plugin must be
// imported for Capacitor to register it, so the import is static — on web
// and Android the calls simply never happen, because every entry point here
// is guarded by isGateEnabled(), which is false off native iOS.

import { NativePurchases } from '@capgo/native-purchases';
import {
  UNLOCK_PRODUCT_ID,
  UNLOCK_PRICE_FALLBACK,
  isGateEnabled,
  grantUnlock,
  isUnlocked,
} from './entitlements.js';

// Non-consumable, not a subscription.
const INAPP = 'inapp';

// The first build that ships the free tier. StoreKit's originalAppVersion
// on iOS is the BUILD NUMBER (CFBundleVersion), not the marketing version —
// so the paid era is every build below this one.
//   build 6 = 3.6.0 (the paid App Store release)
//   build 7 = 3.6.4 (TestFlight only)
//   build 8 = 4.0.0 (rejected in review, never public)
//   build 9 = 4.0.0 (rejected in review, never public)
//   build 10 = 4.0.0 (first build actually available for free)
const FIRST_FREE_BUILD = '10';
const FIRST_FREE_VERSION = '4.0.0';

function available() {
  return isGateEnabled() && !!NativePurchases;
}

/** Localized price for the paywall, e.g. "$3.99" or "£3.49". */
export async function getUnlockPrice() {
  if (!available()) return UNLOCK_PRICE_FALLBACK;
  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [UNLOCK_PRODUCT_ID],
      productType: INAPP,
    });
    const p = products?.[0];
    // Fall back to the US price rather than render an empty button.
    return p?.priceString || (p?.price != null ? `$${p.price}` : UNLOCK_PRICE_FALLBACK);
  } catch {
    return UNLOCK_PRICE_FALLBACK;
  }
}

/**
 * Buy the unlock. Never throws — returns { ok, cancelled, error } so the
 * paywall can always show something sensible.
 */
export async function purchaseUnlock() {
  if (!available()) {
    return { ok: false, cancelled: false, error: 'Purchases are unavailable on this device.' };
  }
  try {
    await NativePurchases.purchaseProduct({
      productIdentifier: UNLOCK_PRODUCT_ID,
      productType: INAPP,
    });
    grantUnlock('purchase');
    return { ok: true, cancelled: false, error: null };
  } catch (e) {
    // StoreKit surfaces a user cancel as an error; that isn't a failure
    // worth showing an alarming message for.
    const msg = String(e?.message || e || '');
    const cancelled = /cancel/i.test(msg);
    return { ok: false, cancelled, error: cancelled ? null : (msg || 'Purchase failed.') };
  }
}

/**
 * Restore. Apple requires this button to exist, and it covers both kinds of
 * entitled user:
 *
 *   1. Someone who already bought the 4.0 unlock — it comes back in their
 *      current entitlements.
 *   2. Someone who bought the APP back when it cost $3.99. That was never an
 *      IAP, so there is nothing to "restore" in the normal sense; instead we
 *      ask StoreKit which build they originally downloaded. Anything before
 *      the first free build means they already paid, so they're unlocked.
 */
export async function restorePurchases() {
  if (!available()) {
    return { ok: false, restored: false, error: 'Purchases are unavailable on this device.' };
  }
  try {
    await NativePurchases.restorePurchases();

    const { purchases } = await NativePurchases.getPurchases({
      productType: INAPP,
      onlyCurrentEntitlements: true,
    });
    const owned = (purchases || []).some(
      t => (t?.productIdentifier || t?.productId) === UNLOCK_PRODUCT_ID
    );
    if (owned) {
      grantUnlock('restore');
      return { ok: true, restored: true, error: null };
    }

    if (await boughtBeforeFree()) {
      grantUnlock('grandfathered-receipt');
      return { ok: true, restored: true, error: null };
    }

    return { ok: true, restored: isUnlocked(), error: null };
  } catch (e) {
    return { ok: false, restored: false, error: String(e?.message || e || 'Restore failed.') };
  }
}

/**
 * Did this Apple ID first download a paid-era build?
 *
 * Runs on app start too, so a paid customer who deletes and reinstalls after
 * 4.0 is unlocked without having to find the Restore button.
 */
export async function boughtBeforeFree() {
  if (!available()) return false;
  try {
    const res = await NativePurchases.isEntitledToOldBusinessModel({
      targetBuildNumber: FIRST_FREE_BUILD,   // iOS compares build numbers
      targetVersion: FIRST_FREE_VERSION,     // Android (unused: Android is free)
    });
    return !!res?.isOlderVersion;
  } catch {
    // iOS 15 and earlier can't read AppTransaction. Not fatal: the local
    // migration in entitlements.js already covers in-place upgrades.
    return false;
  }
}

/** Silent check at startup; unlocks paid-era reinstalls with no user action. */
export async function reconcileEntitlementOnLaunch() {
  if (!available() || isUnlocked()) return false;
  if (await boughtBeforeFree()) {
    grantUnlock('grandfathered-receipt');
    return true;
  }
  return false;
}

/** -1 / 0 / 1. Kept for the entitlement tests. */
export function compareVersions(a, b) {
  const parse = (v) => String(v).split(/[^0-9]+/).filter(Boolean).map(Number);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
