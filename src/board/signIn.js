// Sign-in failure handling for BBQ Board.
//
// Board keeps its own auth instance (firebase.board.js), so it can't share
// firebaseSync's helpers. These mirror them: the same 30s timeout, the same
// cancel heuristic as the web AppContext's runSignIn. See signIn.test.js for
// why they exist.

// Matches AUTH_TIMEOUT_MS in src/firebaseSync.js.
export const AUTH_TIMEOUT_MS = 30000;

// A hung native sheet or a stalled network call would otherwise leave the
// button busy forever. Rejects with code 'auth/timeout' so callers can tell
// "slow" from "broken".
export function withTimeout(promise, label) {
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

// Backing out of the Google sheet is a normal thing to do, not an error
// worth shouting about. The web SDK reports it by code; the Capacitor plugin
// on Android reports it in the message.
export function isUserCancel(err) {
  if (!err || typeof err !== 'object') return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return /cancel/i.test(code) || /cancel/i.test(msg)
    || code === 'auth/popup-closed-by-user';
}

// User-facing text for a failed sign-in, or null when the user cancelled
// and the caller should show nothing at all.
export function signInErrorMessage(err) {
  if (isUserCancel(err)) return null;
  if (err?.code === 'auth/timeout') {
    return 'Sign-in took too long. Check your connection and try again.';
  }
  const detail = String(err?.message || '').replace(/^Firebase:\s*/, '').trim();
  return detail ? `Sign-in failed. ${detail}` : 'Sign-in failed. Try again.';
}
