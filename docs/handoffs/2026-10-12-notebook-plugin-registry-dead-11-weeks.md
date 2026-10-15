# Notebook: native plugin registry was dead for 11 weeks (2026-10-12)

Written by the BBQ Notebook coder session. Two attempts to send this to the
Security auditor were **held undelivered** by that session (same recipient
pipe both times, so not a restart — a permission-mode mismatch or a
hold-everything setting). Recording it here so the audit record survives and
the hub can pick it up without a resend.

## Verdict: the registry was stale, as Board predicted

`android-notebook/app/src/main/assets/capacitor.plugins.json` listed
`@capacitor-firebase/app-check`, and `FirebaseAppCheckPlugin` was absent from
the dex.

## Audit fact: builds 3.0.5 through 3.0.17 registered ZERO native plugins

All 20 shipped AABs scanned, including the retired folders. Every one is
affected. `ea11c9c` dropped app-check from the build on **2026-07-29** and
nothing regenerated the registry, so the window is late July to 12 October —
about 11 weeks in which **no fresh install could use native Google sign-in**.

Mechanism confirmed in Capacitor's own source, not from the report:
`PluginManager.loadPluginClasses()` walks the whole registry inside a single
`try`, rethrows `ClassNotFoundException` as `PluginLoadException`, and
`BridgeActivity` catches it, logs `"Error loading plugins."` and never calls
`addPlugins`. One bad entry therefore registers **zero** plugins rather than
n-1, and app-check sorted first, so nothing after it loaded either —
including `FirebaseAuthentication`.

### Why nobody reported it for 11 weeks

An existing session persists through the JS Firebase SDK and never asks the
native plugin for anything, and email sign-in calls
`signInWithEmailAndPassword` directly (`firebaseSync.js:402`). Only a fresh
install needing a first native sign-in could hit it. Joel's new S26 Ultra was
the first such install, and it presented as "the Sign in with Google button
does nothing."

### It also silently killed the filesystem/share fix

`be49e2c` put `FilesystemPlugin` and `SharePlugin` in the dex. Registration is
driven by the registry, so they were compiled in and never registered — the
fix was dead at runtime. The dex check was the necessary half, reported as
sufficient. Third instance that day of reading a marker that cannot
distinguish the two cases as evidence (see the APP_COPY grep and the AAPT
PNG-size match).

## Fix: fb10e46

`scripts/sync-notebook.mjs` now generates the registry from
`scripts/notebook-native-plugins.mjs` — the same manifest that drives both
gradle files, so one list feeds all three legs. The registry stays gitignored
(it sits beside the copied web bundle); the manifest is the committed source
of truth.

`src/nativePlugins.notebook.test.js` gained the registry leg it was missing:
the registry must equal the manifest, and every classpath in it must belong to
a plugin the **gradle files** compile — checked against gradle rather than the
manifest, so it still bites if manifest and gradle drift together.
Mutation-verified: re-inserting the app-check entry fails both new tests.

## Verification, all 10 rebuilt (fresh-install shape)

| check | result |
| --- | --- |
| registry entries | 6, every build |
| app-check present | no, every build |
| registry classpaths missing from dex | **none, every build** |
| bundle hash | `index.notebook.CrJ94GDt.js`, one distinct value |
| freshness oracle | source still builds the same hash |
| encoding / consent copy | clean / present |
| builds / tests | 10/10, zero failures / 264/264 |

The third row is the invariant that matters, and the one a clean build and a
green suite both failed to prove.

## Safe-area audit: no change needed, verified from source

`SystemBars.java` gates the `--safe-area-inset-*` injection on
`hasViewportCover && insetHandlingEnabled`, and pads the WebView natively on
API 35+ regardless. `index.notebook.html` sets no `viewport-fit`, so native
padding keeps content clear of the status bar and the bare
`env(safe-area-inset-*)` calls in `NotebookHome.jsx` correctly contribute 0.
Switching to `max()` would have changed nothing today and could double-pad if
the variable ever appeared. A tripwire test was added instead: if
`viewport-fit=cover` is ever added while those bare `env()` calls remain, the
test fails and names `src/safeArea.js`.

## Cross-app note for the record

The bundle hash moved mid-pass without this session touching bundled source.
Cause: `e2b42dc` added `_docId: deleteField()` to **shared**
`src/firebaseSync.js`. That file is Notebook's cook sync as well as
Scorecard's reviews, and a stray key on a cook write would be denied by
Notebook's `hasOnly(cookFields())` rules. Both spreads are inside
`prepForFirestoreFull` / `prepForFirestoreMetadata`; Notebook's cooks go
through `prepCookForFirestore`, so bytes changed and behaviour did not. Worth
holding onto: a Scorecard-scoped change to that file lands in Notebook's and
Board's bundles by construction.

## Still open

- **Notebook's sign-in buttons never render `authError`.**
  `NotebookSettings.jsx:300` is `onClick={async () => { await attemptSignIn(); }}`
  with the result discarded — verbatim the pattern App Review rejected in
  Scorecard 4.0.0 and that was fixed there only. A failed sign-in shows the
  user nothing, which is why this bug took a new phone and a full day to find
  instead of arriving as an error message. Latent now that sign-in works;
  queued for the next native window.
- **Legacy launcher squares** are cut ~0.12–0.17 smaller than their adaptive
  foregrounds across all three apps, inconsistently. Android 7.0/7.1 users see
  them (minSdk 24). Cosmetic; same next window.
- **Scorecard's 4.4.1** has no owner — that session is no longer running.

---

## Re-verified 2026-10-14 (and a correction to the hub's premise)

The auditor asked on the morning of the 14th whether the "Sunday-blessed
3.0.9–3.0.17 queue" is marked unshippable, and planned to grant a gradle slot
for a rebuild from fb10e46. **That rebuild already happened on the 12th**, with
the registry-vs-dex check the auditor was specifying. No gradle was needed.

The hub did not know because three reports from this session have now been held
or expired undelivered across two different auditor session instances
(different recipient pipes, so not a single restart — the constant is a
permission-mode mismatch). Hence this file.

**There is nothing to quarantine.** The defective Sunday builds were
overwritten in place by the 12th's rebuild: same version numbers, same
filenames. They no longer exist on disk. The only standing quarantine is the
older `DO-NOT-UPLOAD-defective-consent-copy/` (7 AABs) from Sunday's separate
consent-copy problem.

### Shelf state, re-measured on the 14th rather than recalled

| ver | entries | app-check | classpaths missing from dex | bundle |
| --- | --- | --- | --- | --- |
| 3.0.8 – 3.0.17 | 6 | no | **none** | `CrJ94GDt` |

One bundle hash across all ten. Freshness oracle re-run on the 14th: current
source still builds `index.notebook.CrJ94GDt.js`, so the queue matches HEAD.
264/264 tests across 31 files.

Only two commits have touched bundled source since the queue was built —
`fb10e46` (which it was built from) and `cdef48e` (Scorecard's Settings version
line). The identical bundle hash proves `cdef48e` is not in Notebook's
reachable graph, so the queue is not stale despite being two days old.

**Safely uploadable right now: 3.0.8 through 3.0.17.**

### The fact that matters most

**3.0.7 is what is live on Internal, and it is one of the plugin-dead
builds.** Anyone installing fresh from Internal today still cannot use Google
sign-in. That changes only when 3.0.8 or above is uploaded — the fix is on the
shelf doing nothing until then.

Four older AABs on the shelf (3.0.3, 3.0.5, 3.0.6, 3.0.7) are also plugin-dead
but version-obsolete: all at or below the highest already uploaded, so Play
rejects them on versionCode. Left in place deliberately; 3.0.7 is a useful
record of what is live.
