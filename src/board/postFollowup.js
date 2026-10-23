// What happens after a price is posted (onboarding, ASO and referrals
// audits, 2026-10-23; scope approved by the auditor):
//   - recordPost counts posts on this install.
//   - maybeAskForReview asks for a store rating once, after the 2nd post.
//     Neutral and unconditional: no "enjoying Board?" gate in front of it,
//     which Play, Apple and the FTC review rule all forbid. Each platform
//     decides whether its sheet actually shows, so we only record that we
//     asked. Same shape as Scorecard's src/ratingPrompt.js.
//   - shareBoard sends a friend the shop and the community, never a price
//     (Joel 10/12: no price callouts). The link is the web app, which works
//     on any phone and names no app store.
// Keys start with 'board', so account deletion's local wipe clears them.

export const POSTED_COUNT_KEY = 'board:posted-count';
export const REVIEW_ASKED_KEY = 'board:rating-asked';
export const REVIEW_AT = 2;

const BOARD_URL = 'https://holysmokesbbqco.com/board/';

const defaultStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const defaultIsNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export function recordPost(storage = defaultStorage()) {
  let n = 0;
  try { n = parseInt(storage?.getItem(POSTED_COUNT_KEY), 10) || 0; } catch {}
  n += 1;
  try { storage?.setItem(POSTED_COUNT_KEY, String(n)); } catch {}
  return n;
}

async function defaultRequestReview() {
  const { InAppReview } = await import('@capacitor-community/in-app-review');
  await InAppReview.requestReview();
}

export async function maybeAskForReview({
  postCount,
  storage = defaultStorage(),
  isNative = defaultIsNative(),
  request = defaultRequestReview,
}) {
  let asked = false;
  try { asked = storage?.getItem(REVIEW_ASKED_KEY) === '1'; } catch {}
  if (!isNative || asked || postCount < REVIEW_AT) return false;
  // Record first, so a slow or failing native call can't re-ask next time.
  try { storage?.setItem(REVIEW_ASKED_KEY, '1'); } catch {}
  try { await request(); } catch {}
  return true;
}

export function shareMessage({ source, shopName }) {
  const url = `${BOARD_URL}?utm_source=board_share&utm_medium=app&utm_campaign=${source}`;
  const text = source === 'post_confirm'
    ? `I just posted what I paid at ${shopName} on BBQ Board, where cooks share what they pay at the butchers and meat counters near them. Post yours too.`
    : `${shopName} is on BBQ Board. Cooks post what they paid there.`;
  return { title: 'BBQ Board', text, url };
}

async function defaultNativeShare(opts) {
  const { Share } = await import('@capacitor/share');
  await Share.share({ ...opts, dialogTitle: 'Share BBQ Board' });
}

const defaultWebShare = () =>
  (typeof navigator !== 'undefined' && navigator.share ? (o) => navigator.share(o) : null);
const defaultCopy = (t) => navigator.clipboard.writeText(t);

// Returns 'native' | 'web' | 'copied' | 'cancelled' | 'failed'.
export async function shareBoard(target, {
  isNative = defaultIsNative(),
  nativeShare = defaultNativeShare,
  webShare = defaultWebShare(),
  copy = defaultCopy,
} = {}) {
  const msg = shareMessage(target);
  if (isNative) {
    try { await nativeShare(msg); return 'native'; }
    catch { return 'cancelled'; }
  }
  if (webShare) {
    try { await webShare(msg); return 'web'; }
    catch { return 'cancelled'; }
  }
  try { await copy(`${msg.text} ${msg.url}`); return 'copied'; }
  catch { return 'failed'; }
}
