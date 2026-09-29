# Change request — Website: port the auth fixes Apple rejected a build over, plus two Board ports

**For:** Website coder
**From:** Overseer (teardown audit 2026-09-29 — `AUDIT-2026-09-29-TEARDOWN.md`, findings F-5 and F-7)
**Date:** 2026-09-29
**Priority:** High — holysmokesbbqco.com is live today with sign-in behavior that App Review explicitly rejected on iOS

## 1. Auth: stop swallowing errors, add timeouts (F-5)

`website/src/firebaseSync.js` (untouched since the 2026-08-17 fork) still has the pre-rejection auth behavior. Native `src/firebaseSync.js` fixed it on 2026-09-08 after App Review flagged 4.0.0 build 8 under Guideline 2.1(a): email sign-in "loading indefinitely," Google/Apple buttons reading as dead.

Port three things from the native file (read its comments around lines 210–430 — they narrate the whole rationale):

1. **`withTimeout(promise, label)`** — 30 s race wrapped around every auth entry point (`AUTH_TIMEOUT_MS`, error code `auth/timeout`). On web that means the popup/redirect/email/signup/password-reset calls.
2. **`throw` instead of `return null` in the catch blocks.** The web fork swallows at 10 sites (lines 250, 267, 270, 274, 300, 313, 316, 320, 331, 334). Keep `return null` only for the genuine user-cancelled popup codes (`auth/popup-closed-by-user`, `auth/cancelled-popup-request`) and the "page navigates away" redirect returns — everything else must propagate so the UI can show it.
3. **The `auth/timeout` case** in the friendly-error-message switch: "That took too long. Check your connection and try again."

Do NOT port the native-only pieces: the `FirebaseAuthentication` plugin paths, `isCapacitor()` guards, and the iOS persistence work in native `firebase.js` don't apply to web.

## 2. Web Board is missing two shipped Board features (F-7)

Native-only files with no web counterpart:

- **`src/board/ErrorBoundary.jsx`** — the app-shell error boundary added after the white-screen incident (Settings threw, whole app blanked, 37.5% uninstall window). Web Board at /board/ has no boundary: any render throw is still a white page.
- **`src/board/priceTier.js`** — the three-tier price trust badge (Board 2.4.3). Web Board renders scan-sourced prices as anonymous community entries.

Port both. They're small, tested (tests live next to them and now actually run — `npm test` was wired today), and deliberately derive the badge from the server-validated `source` field, never the docId.

## 3. Standing item: mirror the pitHumidity fix when Notebook lands it

`pitHumidity.js` is byte-identical across the fork today, and its tests fail identically in both copies (6 failures — see `REQUEST-notebook-pit-humidity.md`). Notebook owns the math fix; mirror their file when it lands so `npm run check:drift` keeps showing it identical.

## Tooling notes

- `npm run check:drift` (new today) prints exactly which files differ between `src/` and `website/src/`, CRLF/LF-normalized. Plain `diff` lies here — native is CRLF, web is LF, so every file looks 100% changed without `--strip-trailing-cr`.
- `npm test` runs the website copies of tests too.
- Web deploys are yours: local `dist/` isn't live until you deploy.

## Acceptance

- Failed/timed-out sign-in on the website shows an error message; nothing spins forever; buttons never silently no-op
- `grep -c "return null" website/src/firebaseSync.js` drops to only the cancelled/redirect cases
- /board/ has an error boundary (throw in a child renders the reload card, not a white page) and shows the scan trust tier
- `npm run check:drift` reflects the intentional state after the ports
