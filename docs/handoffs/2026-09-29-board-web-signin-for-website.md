# Handoff: web Board sign-in fix + your untracked port

**From:** BBQ Board coder, 2026-09-29
**To:** BBQ Website coder (you had closed by the time this was ready)
**Status:** waiting in your working tree, uncommitted, not deployed

## 1. Your web Board port is live but not in git

These are **untracked**, yet deployed on holysmokesbbqco.com/board/:

- `website/src/board/priceTier.js` + `priceTier.test.js`
- `website/src/board/ErrorBoundary.jsx` + `ErrorBoundary.test.js`
- `website/src/main.board.jsx`

Your priceTier/ScanBadge edits in `website/src/App.board.jsx` are uncommitted too.
Production web is running code that exists nowhere in git. Please commit them.

**How I found out, since it's my mistake.** My first commit of the sign-in fix
included `website/src/App.board.jsx` and swept your uncommitted port in under my
message. `git commit -- <paths>` scopes by file, not by hunk, so it can't separate
two sessions' edits inside a shared file. I caught it before pushing and undid it
with `git reset --soft`. Nothing of yours was lost and nothing reached origin. I
then committed only the native half (`081007e`).

## 2. My sign-in fix, layered on top of your port

This is the Security audit AUDIT-2026-09-29-TEARDOWN.md F-5 residual, web half,
now in your working tree:

- `website/src/board/signIn.js` + `signIn.test.js`: **new**, byte-identical to native
- `website/src/App.board.jsx`:
  - `handleSignIn` rethrows (it swallowed every failure), bounded by a 30s timeout
  - `AuthGate` takes an `error` prop and renders it on the gate
  - gate handlers show `signInErrorMessage(e)`; a user cancel stays silent
  - **`AuthGate` root gets `onClick={(e) => e.stopPropagation()}`**. This is the
    one that matters most: see below
- `website/src/board/Settings.jsx`: the sign-in button catches and shows the error

### Why the stopPropagation matters

`SubmitModal` renders `AuthGate` as a sibling of its `<form>`, directly under a
backdrop with `onClick={onClose}`. The form stops propagation; the gate didn't.
So **every click on the gate** (Google, "Continue without an account", even
Cancel) bubbled up and closed the whole submit modal, discarding the price the
user had typed. A signed-out user could not submit a price from the day the gate
shipped. The last community price in Firestore is Aug 6, just before it. This is
live on web right now.

## Checks already run

- Web: 27 tests pass, `npm run build:board` clean
- `npm run check:drift`: `signIn.js` identical native/web; remaining App/Settings
  drift predates this
- Native equivalent verified at runtime: gate Cancel keeps the modal and the typed
  price; a failed sign-in shows the error on the gate; a cancelled sign-in is silent

## Ask

1. Commit your port under your own message.
2. Commit the sign-in fix on top. Split it however reads best, but keep your
   port's attribution separate from mine.
3. Deploy, then verify the live bundle contains `Signing in…` and
   `stopPropagation` in AuthGate.

Delete this file once done.
