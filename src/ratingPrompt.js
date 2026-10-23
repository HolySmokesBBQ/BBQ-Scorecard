// Store rating prompt (ASO audit 2026-10-23: zero ratings on both stores
// and nothing in the app ever asked). Asks once per install, right after
// the user saves their 3rd new review. By then they've used the app for
// real, and on iOS it lands well before the 5-review paywall, so it
// never follows a paywall. Edits never trigger it.
//
// Apple and Google each decide whether their sheet actually appears
// (Apple caps it at 3 per year), so requestReview() resolving says
// nothing about whether the user saw it. We just record that we asked.
// The key starts with 'bbq-', so account deletion's local wipe clears it.

export const RATING_PROMPT_AT = 3;
export const RATING_ASKED_KEY = 'bbq-scorecard-rating-asked';

export function shouldAskForRating({ isNative, isNew, reviewCount, alreadyAsked }) {
  return Boolean(isNative && isNew && !alreadyAsked && reviewCount >= RATING_PROMPT_AT);
}

const defaultIsNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

async function defaultRequest() {
  const { InAppReview } = await import('@capacitor-community/in-app-review');
  await InAppReview.requestReview();
}

export async function maybeAskForRating({
  isNew,
  reviewCount,
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
  isNative = defaultIsNative(),
  request = defaultRequest,
}) {
  let alreadyAsked = false;
  try { alreadyAsked = storage?.getItem(RATING_ASKED_KEY) === '1'; } catch {}
  if (!shouldAskForRating({ isNative, isNew, reviewCount, alreadyAsked })) return false;
  // Record first, so a slow or failing native call can't re-ask on the next save.
  try { storage?.setItem(RATING_ASKED_KEY, '1'); } catch {}
  try { await request(); } catch {}
  return true;
}
