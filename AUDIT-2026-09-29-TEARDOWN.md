# Teardown Audit — 2026-09-29

**Auditor**: Overseer
**Brief**: "Expose these apps as vibecoding. Test everything. Let's break some apps."
**Scope**: Scorecard, Notebook, Board (native `src/`) + the forked web source (`website/src/`), build configs, test/CI infrastructure.
**Method**: Static import-graph and fork-diff analysis, plus **actually executing the test suite for the first time** and running the math engine against its own spec fixtures. Every claim below is reproducible with the commands given.

---

## The thesis, in one line

**This codebase has every artifact of engineering rigor and none of the mechanisms.** Specs, digitized chart fixtures, tests that cite prior audit findings by number, paragraph-long rationale comments explaining exactly why each fix exists. But no test runner, no CI, and no discipline for propagating a fix past the one place the pain was felt. Fixes land where someone got burned and rot everywhere else.

Three separate times in this audit, the same pattern appeared: **a real bug was correctly diagnosed, correctly fixed in one location, and left live in one to three other locations.**

---

## Findings

### F-1 — HIGH: 430 lines of tests have never executed. Six fail the moment they do.

Five test files, 430 lines, written against `vitest`. **`vitest` is not installed. There is no `test` script. There is no CI.**

```
npm test          → npm error Missing script: "test"
ls .github/workflows → does not exist
node_modules/vitest → absent
```

Test files:
| File | Lines |
|---|---|
| `src/pitHumidity.test.js` | 108 |
| `website/src/pitHumidity.test.js` | 108 |
| `src/board/ErrorBoundary.test.js` | 94 |
| `src/board/priceTier.test.js` | 63 |
| `src/rematch.test.js` | 57 |

These aren't throwaway stubs. `priceTier.test.js` names **"SECURITY-AUDIT-BOARD-DEEP.md Finding B-2"** as the reason the trust badge must not derive from a client-mintable docId. `ErrorBoundary.test.js` documents a real outage — Settings threw `STATES.map is not a function`, the app went white, GA logged `app_exception` across 6 users against a 37.5% uninstall rate. Tests were written to guard a security fix and a production incident, and **neither guard has ever fired.**

**Result of the first-ever run** (vitest 2.x installed with `--no-save`; `package.json` untouched):

```
Test Files  2 failed | 3 passed (5)
     Tests  6 failed | 50 passed (56)
```

Reproduce:
```bash
npm install --no-save "vitest@^2"
npx vitest run src/pitHumidity.test.js src/board/priceTier.test.js src/rematch.test.js src/board/ErrorBoundary.test.js
```

> Note on the 50 passes: the tests that exist are mostly good and the code they cover is mostly correct. `priceTier`, `rematch`, and `ErrorBoundary` all pass clean. The failures are concentrated entirely in one engine — see F-2.

---

### F-2 — HIGH: The Pit Humidity engine disagrees with its own spec by up to 2.67 RH points, in the band the spec calls the operating zone.

All six failures are `pitHumidity.test.js` (three unique cases, mirrored in both source copies). Measured against the spec's own digitized psychrometric-chart fixtures:

| Elevation | Dry / Wet | Chart says | App says | Error | Tolerance |
|---|---|---|---|---|---|
| sea level | 220°F / 140°F | 12% | **14.67%** | **+2.67** | ±1 |
| 3,400 ft | 275°F / 160°F | 11% | **9.61%** | **−1.39** | ±1 |
| 3,400 ft | 300°F / 160°F | 8% | **6.39%** | **−1.61** | ±1 |

Passing cases for contrast (all sea level): 275/160 → 9.44 vs 9 ✓ · 250/150 → 11.02 vs 12 ✓ (0.98, barely) · 300/160 → 6.25 vs 7 ✓ · 225/150 → 17.95 vs 18 ✓ · 200/170 → 51.07 vs 51 ✓

Every failure sits in the 8–12% RH band. The test file's own comment calls 1–10% RH "the smoker operating zone" — so the errors cluster precisely where the feature gets used. The tolerance was already loosened once (±0.5 → ±1) to absorb chart read error; these miss the loosened bar by up to 2.7×.

Reproduce:
```bash
node --input-type=module -e "import {computeHumidity} from './src/pitHumidity.js'; console.log((computeHumidity({dryF:220,wetF:140,pressureKPa:101.325}).rh*100).toFixed(2))"
# → 14.67   (chart fixture says 12)
```

**Open question for the owning session:** is the math wrong or are the fixtures mis-digitized? `psychrolib` is a validated ASHRAE implementation, which argues for the fixtures. But F-3 shows the pressure path is genuinely broken, which argues for the math. Resolve F-3 first, then re-measure.

---

### F-3 — HIGH: The altitude/pressure correction is effectively inert.

`pressureResolver.js` is a careful 40-line module that resolves station pressure from four prioritized sources (manual → weather station → GPS elevation → default). Its output barely changes the answer.

Sweep at 275°F dry / 160°F wet:

| Pressure | ≈ Elevation | App RH |
|---|---|---|
| 101.325 kPa | sea level | 9.44% |
| 94.2 kPa | ~2,000 ft | 9.54% |
| 89.483 kPa | ~3,400 ft | 9.61% |
| 84.3 kPa | ~5,000 ft | 9.68% |
| 79.5 kPa | ~7,000 ft | **9.75%** |

**0.31 RH points across 7,000 feet.** The spec's chart expects sea level → 3,400 ft alone to move this case from 9% to 11% — about +2.0 points, roughly 10× the response the code produces. Note that the two 3,400 ft failures in F-2 are the *same dry/wet pairs* as passing sea-level cases: the chart moves with altitude and the app doesn't.

---

### F-4 — HIGH: The cook-logging humidity readout hardcodes Joel's hometown pressure for every user.

Three call sites compute humidity. Two of them throw away the resolved pressure:

| Call site | Pressure passed |
|---|---|
| `src/components/NotebookPitHumidity.jsx:122` | `pressure.valueKPa` ✅ resolved |
| `src/components/CookForm.jsx:349` | `DEFAULT_PRESSURE_KPA` ❌ hardcoded |
| `src/components/CookDetail.jsx:144` | `DEFAULT_PRESSURE_KPA` ❌ hardcoded |

`DEFAULT_PRESSURE_KPA = 98.3` — documented in `pressureResolver.js` as "Waukesha's typical station pressure at ~860 ft, chosen because it's the user's actual home location." So the humidity shown while **logging a cook** and while **viewing a logged cook** is computed as though every user in the world is in Waukesha, Wisconsin. Only the dedicated Pit Humidity screen respects where they actually are.

**These two bugs are hiding each other.** F-3 makes pressure nearly irrelevant, so F-4 currently produces a barely-visible discrepancy. Fix the math in F-3 without also fixing F-4 and the cook form will start visibly disagreeing with the Pit Humidity screen for anyone not at ~860 ft. **Fix them together or fix F-4 first.**

---

### F-5 — HIGH: The production website still carries the exact auth bug Apple rejected a build over.

`src/firebaseSync.js` (native, 2026-09-08) added, per its own comment:

> "App Review rejected 4.0.0 build 8 partly because email sign-in sat 'loading indefinitely' (Guideline 2.1(a))… a spinner that can never stop is a bad failure mode whatever the cause."

The fix has three parts: a 30 s `withTimeout` race on every auth entry point, an `auth/timeout` user-facing message, and — critically — **replacing `return null` with `throw`** in the Google and Apple catch blocks, with this comment:

> "Do NOT swallow this. Returning null here made the button look dead to the user (and to App Review) — the caller cannot tell 'cancelled' from 'broken'."

`website/src/firebaseSync.js` (2026-08-17) has **none of it**:

```
web fork:  withTimeout → 0 occurrences | auth/timeout → 0 | return null → 10 sites (250,267,270,274,300,313,316,320,331,334)
native:    withTimeout → 8 call sites   | auth/timeout → present | throw nativeError/throw error → 276,303,333,353
```

`website/` owns all web builds from this forked source, so **holysmokesbbqco.com is serving the dead-button, infinite-spinner behavior that got the iOS build rejected.** Same root cause, fixed on native only.

**Resolved 2026-09-29 (evening), verified live.** Website session ported `withTimeout`, throw-instead-of-swallow (cancel/redirect returns kept), and the `auth/timeout` message — plus caller hardening the change request missed: every web sign-in caller was `await attemptSignIn()` with no try/catch, so bare throws would have just moved the silence into unhandled rejections. They ported native's `runSignIn` state machine and the busy/error button UI along with it. Good catch. Independently verified on the live site: the scorecard auth chunk carries the timeout copy.

**Residual, routed to Board:** Board's own `handleSignIn` in `App.board.jsx` (its separate auth instance) still swallows failures with `console.error` + analytics track — identically on native and web. Same class as this finding, Board's file.

---

### F-6 — HIGH: The stale-bundle fix shipped to Board and was never propagated to Scorecard or Notebook.

Board 2.4.0 shipped and displayed 2.3.9's UI, because a precaching service worker inside the Capacitor WebView served the old bundle. `selfDestroying: true` was added in 2.4.1.

It is in exactly one config:

| Config | `registerType` | `selfDestroying` |
|---|---|---|
| `vite.config.native.board.js:73` | autoUpdate | **true** ✅ |
| `vite.config.native.js` (Scorecard) | autoUpdate | **absent** ❌ |
| `vite.config.native.notebook.js` | autoUpdate | **absent** ❌ |

Scorecard (4.2.0 in review on both stores — Android Internal→Closed, iOS Waiting for Review) and Notebook still bundle a precaching auto-update service worker into their native builds — the same configuration, with the same known failure mode, in the two apps that ship most often. This is the "I updated and the new feature isn't there" class of bug, and on Board it coincided with a 37.5% uninstall rate.

---

### F-7 — MEDIUM: Bidirectional fork drift across 26 files. Neither copy is authoritative.

`website/src/` was forked from `src/` on 2026-08-17 (per the migration note). Current divergence:

| File | Native | Web | Δ |
|---|---|---|---|
| `components/ReviewForm.jsx` | 673 | 440 | **+233** |
| `context/AppContext.jsx` | 1514 | 1392 | **+122** |
| `firebase.js` | 182 | 121 | +61 |
| `firebaseSync.js` | 1018 | 978 | +40 (see F-5) |
| `components/Detail.jsx` | 395 | 355 | +40 |
| `board/Settings.jsx` | 180 | 164 | +16 |
| `components/Profile.jsx` / `Settings.jsx` | 266 / 240 | 254 / 228 | +12 each |
| `App.board.jsx` | 2093 | 2102 | **−9 (web ahead)** |
| `components/Home.jsx` | 557 | 564 | **−7 (web ahead)** |
| `components/NotebookHome.jsx` | 257 | 261 | **−4 (web ahead)** |
| `components/Site.jsx` | 253 | 255 | **−2 (web ahead)** |

Native-only, never ported to web: `board/ErrorBoundary.jsx`, `board/priceTier.js`, `components/Paywall.jsx`, `entitlements.js`, `purchases.js`, `rematch.js` (+ their tests). Paywall/entitlements/purchases being native-only is correct — IAP is native. **`ErrorBoundary` and `priceTier` are not:** web Board has no app-shell error boundary (the white-screen guard) and no scan-price trust badge.

Four files are **longer on web**, so this isn't a simple "native is ahead" story — changes have been made independently on both sides. There is no sync script between `src/` and `website/src/` and no drift check.

Reproduce:
```bash
cd src && find . -name "*.jsx" -o -name "*.js" | sed 's|^\./||' | while read f; do
  w="../website/src/$f"; [ -f "$w" ] && ! diff --strip-trailing-cr -q "$f" "$w" >/dev/null && echo "DIFF $f"; done
```
(Use `--strip-trailing-cr` — native is CRLF, web is LF, so a plain `diff` reports every file as fully changed and tells you nothing.)

---

### F-8 — LOW: `package.json` hygiene

- **Duplicate script keys**: `sync:rules` and `check:rules` are each defined twice (lines 22/24 and 23/25). Valid JSON, last value silently wins — a merge artifact nobody noticed because nothing validates it.
- Root `version` is `4.0.0` while Scorecard ships 4.2.0; the field is vestigial now that one `package.json` serves three apps plus the website.
- Repo is pinned to `vite@5.4.21`; current `vitest` requires vite ≥6, which is why the runner install needs `vitest@^2`.

---

### F-9 — HIGH: /board/ on the live site has served a known-crashing bundle for 22 days after its fix landed on main.

*Contributed by the Board coder session in response to this audit's FYI; independently verified.*

holysmokesbbqco.com/board/ serves `index.board.web.D-nylADx.js` — the bundle diagnosed broken on Sep 7: Settings crashes (`STATES.map()` on an object), no error boundary, so the whole app white-screens; plus the raw-code state picker. The fix is commit `c7d0a28` (Sep 7, "Board web: apply yesterday's state-picker fixes to the website fork"), confirmed on main with identical content for all three touched files. **The code was fixed the next day and the site was simply never deployed.** Verified live on 2026-09-29:

```
curl -s https://holysmokesbbqco.com/board/ | grep -oE 'src="[^"]*\.js[^"]*"'
# → src="/board/index.board.web.D-nylADx.js"   (the Sep-7 broken bundle)
```

The systemic lesson goes beyond this incident: **every surface in this audit was implicitly treated as "committed on main = shipped," and that assumption was false for three weeks on a user-facing crash.** The commit message of `c7d0a28` itself records the same trap from the other direction (fixes shipped to Android while the website kept the broken build). Two mechanisms now exist to close this class:

- `npm run check:deploy` (added with this finding) — fetches each live surface, extracts its hashed bundle filenames, and reports whether they exist in the local `dist/` (build first for a meaningful comparison).
- The standing rule already in the working memory: local `dist/` is not live until the Website session deploys.

**Routing**: handed to the Website session by the Board session (they own the web deploy and are already porting F-5/F-7 items; the fix is on main, so their next build+deploy resolves it). Verify after deploy: the live `/board/` bundle hash must change from `D-nylADx`.

---

### F-10 — MEDIUM: iOS shell pass (added same day, after the "did we audit Apple?" question)

**Scope note first:** every JS-layer finding above (F-1..F-5, F-7) applies to iOS identically — Capacitor wraps the same bundle, and F-5's fix was itself born from an Apple rejection. What had never been audited was the iOS-native shell: `ios/`, `ios-board/`, and the Codemagic pipeline. That pass ran 2026-09-29.

**The finding: both `GoogleService-Info.plist` files are tracked in git, and `.gitignore:59` claims otherwise.**

```
git ls-files ios/App/App/GoogleService-Info.plist        → TRACKED
git ls-files ios-board/App/App/GoogleService-Info.plist  → TRACKED
grep -n "GoogleService" .gitignore                       → 59:GoogleService-Info.plist
```

Gitignore never applies to already-tracked files, so line 59 is decorative — the repo *says* these files are excluded while both sit in history on a GitHub remote. This is the iOS twin of the `google-services.json` file the Android side has guarded for months, with one real difference: **Codemagic builds iOS from the pushed repo, so the file being committed may be load-bearing for CI.** Untracking it without an env-var injection step would break iOS builds.

**Recommendation (Overseer): accept-and-document, don't untrack.** Firebase iOS config values are public-by-design — they ship inside every IPA and are extractable in minutes, so hiding them from the repo is theater. The dishonest part is the gitignore line. Delete `.gitignore:59`, add a comment noting the files are deliberately tracked because Codemagic needs them, and keep parity guards where they matter (real secrets: keystores, `.p8`, signing passwords).

**Advisory:** neither app target has an app-level `PrivacyInfo.xcprivacy`. Reviews have passed without it (4.0/4.1 approved), so it isn't blocking today, but it's the Apple requirement most likely to start rejecting builds without warning. Add one declaring the standard Capacitor required-reason APIs (UserDefaults/CA92.1 etc.) at the next quiet moment.

**Clean bill on the rest of the shell:** ATS secure defaults (no `NSAllowsArbitraryLoads`) in both apps · URL schemes limited to the required GoogleSignIn reversed-client-id · Scorecard's Sign-in-with-Apple entitlement present with documented rationale · both `codemagic*.yaml` handle secrets via `@env:` vars and the managed App Store Connect integration — nothing hardcoded.

---

## Credit where it's due

Several previously-flagged problems are genuinely fixed, and I verified each:

- **Board region allowlist is in sync** — 40 regions in `firestore.board.rules`, 40 in `src/board/schema.js`, 40 in `website/src/board/schema.js`, zero drift in any direction. This silently ate submissions from 13 metros twice; the `@sync:regions` marker plus sync script is holding.
- **CookContext stale-closure race is fixed** — `setCooks(prev => …)` functional setter, commented "(Audit v2.1.9)". That was my finding from the last pass.
- **Photo-upload failure is surfaced** — native `AppContext` sets `syncStatus='photos-failed'` so Detail can offer a retry, instead of silently dropping the photo.
- **`priceTier` derives from the server-validated `source` field, not the docId** — Finding B-2 from the last audit was respected, and there's a test asserting it (which, per F-1, has now actually run and passes).
- **50 of 56 tests pass.** The test-writing instinct is good. The gap is purely that nothing ever ran them.

---

## Routing

Per session ownership — Overseer does not edit app code.

| Finding | Owner | Priority |
|---|---|---|
| F-2, F-3, F-4 (Pit Humidity math + pressure + hardcoded call sites) | **Notebook** | 1 — fix F-4 with or before F-3 |
| F-6 (`selfDestroying` missing) | **Scorecard** ✅ done `3a906fe`, AAB 4.2.1 built+verified · **Notebook** pending | 1 — one-line config change each |
| F-5 (web fork auth swallowing) | **Website** ✅ ported + deployed + verified live (incl. caller hardening) | 1 — done |
| F-5 residual (Board `handleSignIn` swallows, native + web) | **Board** — independently confirmed by Board session (second source); proposed as Board 2.4.4 (timeout race + visible error state + web mirror); **awaiting Joel's go** | 2 |
| F-1 (wire vitest + `test` script + CI) | **Overseer → all** | 2 — nothing else holds without this |
| F-7 (fork drift + CRLF/LF mismatch) | **Overseer** decides policy | 2 |
| F-8 (`package.json`) | **Overseer** | 3 |
| F-9 (stale /board/ deploy — fix on main since Sep 7) | **Website** ✅ deployed; `check:deploy` all-MATCH confirmed by both Website session and Overseer; live bundle now `CMl-1BuI` | 1 — done |
| F-10 (iOS: tracked GoogleService plists vs lying gitignore; missing privacy manifest) | **Overseer** rec: accept-and-document + fix gitignore; privacy manifest to Scorecard/Board next quiet release | 2 |

**Repo state**: unchanged. `vitest` was installed with `--no-save`, so `package.json` and `package-lock.json` were not modified. Nothing was edited or deleted during this audit.
