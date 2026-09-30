# Board OCR bundle size: design

**Date:** 2026-09-29
**App:** BBQ Board
**Greenlit by:** BBQ Security auditor (acting for Joel), 2026-09-29, with non-negotiable
security constraints (below).
**Status:** awaiting the auditor's review of this spec before implementation.

## 1. Why

Board's Android AAB is **29.3 MB**. Two costs follow:

- **Every install downloads it.** A price-lookup app has no business being 29 MB.
- **Board can't self-serve its releases.** The Chrome `file_upload` tool that sessions
  use to put AABs into Play has a 10 MB cap, so every Board release waits on Joel
  uploading by hand. Scorecard (9.93 MB) self-serves; Board doesn't.

**19.9 MB (68%) of the AAB is the Tesseract OCR engine** behind "scan a weekly ad."

## 2. What the OCR engine actually loads

Read from `node_modules/tesseract.js/src/worker-script/browser/getCore.js` (tesseract.js
7.0.0 / core 7.0.0), not assumed:

- The worker loads exactly **one** core file with `importScripts(...)`, always a
  **`.wasm.js`**. The `.wasm.js` embeds the WebAssembly binary: it references no
  sibling `.wasm`, and at 3.9 MB against the 2.86 MB `.wasm` it carries base64 overhead
  (about 1.36x). **The standalone `.wasm` files are never requested.**
- The variant is chosen by CPU capability: relaxed-SIMD, else SIMD, else baseline.
- Board creates the worker with `createWorker('eng', 1, ...)`. OEM `1` is **LSTM-only**,
  so `lstmOnly` is true and **only the three `-lstm.wasm.js` variants can ever load**.

So of the 20 Tesseract files shipped today:

| Group | AAB cost | Ever loaded? |
|---|---|---|
| `-lstm.wasm.js` × 3 (relaxedsimd / simd / baseline) | 4.4 MB | yes, one per device |
| `eng.traineddata` | 2.9 MB | yes |
| `worker.min.js` | <0.1 MB | yes |
| non-LSTM `.wasm.js` × 3 | 5.3 MB | **never** |
| standalone `.wasm` × 6 | 7.1 MB | **never** |

**12.4 MB is dead weight.**

## 3. Two tiers

The auditor greenlit a remote-load design. Measuring first shows most of the win needs
no remote loading at all, so this spec splits it. **Tier A ships first and on its own.**
Tier B only exists to cross the 10 MB line.

### Tier A: stop shipping files that are never loaded (zero new risk)

1. Stop copying the 9 dead Tesseract files (3 non-LSTM `.wasm.js`, 6 `.wasm`) into the
   native build. Remove them from `KNOWN_LARGE` in `scripts/sync-board.mjs` and add
   them to its `DEAD_ASSETS` prune list, so a stray copy can't creep back in.
2. Stop shipping other apps' assets that leak in through `publicDir: 'public'`:
   Notebook/Scorecard/Calculator logos, `CNAME`, and the Google site-verification file
   (~2.0 MB, measured). Add them to `DEAD_ASSETS`.

**Result: ~14.9 MB.** That's roughly half of today's size, with **no change to what code
runs or where it comes from**. The engine still loads from the APK, exactly as the H-1
fix intended. Every Board user gets a download half the size. It still doesn't cross
10 MB, so uploads stay manual until Tier B.

**Why it's safe:** the removed files are unreachable by construction. Tier A is verified
by running a real scan (see §6) with only the used files present.

### Tier B: load the OCR engine from our own origin, verified (the auditor's design)

Move the three `-lstm.wasm.js` variants and `eng.traineddata` (7.3 MB) out of the APK,
fetch them on first scan, and verify them before executing.

**Result: ~7.6 MB.** That's under the upload cap, so Board releases can self-serve.

The auditor's constraints are **non-negotiable**, because a naive remote load
reintroduces a confirmed finding (SECURITY-AUDIT-INFRA-DEEP.md I-3; the H-1 comment at
`App.board.jsx:1427`): executable OCR code from a third party running inside a native
WebView with no CSP is a remote-code path.

1. **Host on our origin.** Serve the assets from `holysmokesbbqco.com` via Netlify, never
   `cdn.jsdelivr.net`. `workerPath`/`corePath`/`langPath` keep pointing at our own URLs,
   so tesseract.js's built-in jsdelivr fallback can never trigger.
2. **Pin exact versions in the path**: `/ocr/tesseract-7.0.0/...`. A new engine version
   gets a new path. Nothing is ever overwritten in place, so a cached file and a live
   file with the same name can't disagree.
3. **Verify integrity in code, before execution.** The WebView enforces neither CSP nor
   SRI, so the app does it itself:
   - SHA-256 of each file is a **constant compiled into the app bundle**, generated at
     build time from the pinned files and committed. It is not fetched, since a hash
     served by the server it's meant to check proves nothing.
   - The app `fetch`es each file, computes `crypto.subtle.digest('SHA-256', bytes)`, and
     compares. **Any mismatch aborts the scan**: nothing is handed to `importScripts`.
   - Verified bytes are passed to tesseract.js as **blob URLs** built from the verified
     `ArrayBuffer`. The worker then executes exactly the bytes that were checked, closing
     the window where a second fetch could return something different.
   - Only the variant this device will use is fetched and verified. Selection reuses
     `wasm-feature-detect`, the same logic getCore uses, so no extra 3 MB is downloaded.
4. **Cache after first download; fail gracefully offline.**
   - Store verified bytes in IndexedDB keyed by `version + sha256`. **Re-verify the hash
     on every load from cache**, not just after download, since the cache is also storage
     an attacker with device access could write to.
   - No Cache API service worker. Board removed its service worker on purpose in 2.4.1
     (see the capacitor-service-worker-stale-bundle memory), and this doesn't bring one
     back.
   - Offline with no cached copy: the scan shows *"Scanning a weekly ad needs a
     connection the first time. Try again once you're online."* The rest of the app is
     unaffected. That's no worse than today for a feature that already needs the network
     to submit its results.

## 4. Open questions for the auditor

1. **Play policy.** H-1 called remote OCR a "Google Play policy risk." Play's Device and
   Network Abuse policy bars downloading executable code from outside Play, but it
   explicitly exempts code that runs in "a virtual machine or an interpreter ... such as
   JavaScript in a webview." WASM run by the WebView's JS engine appears to fall under
   that exemption. **Does the audit accept that reading, or treat H-1 as still binding?**
2. **iOS: recommend Tier A only, not Tier B.** The 10 MB problem is Android-only, since
   iOS builds go through Codemagic, which has no upload cap. App Store Guideline 2.5.2
   ("may not download, install, or execute code which introduces or changes features")
   is stricter than Play's, and Board hasn't yet passed App Review. Tier B on iOS takes
   that risk for no release-pipeline benefit. **Recommend iOS keeps bundling the three
   LSTM variants and gets Tier A's cut only.** Needs a per-platform build flag; covered
   in §5.
3. **Netlify hosting is the Website session's deploy.** Tier B needs `/ocr/tesseract-7.0.0/`
   deployed to holysmokesbbqco.com before any Board build that depends on it ships.
   Ordering: website deploy → verify files and hashes live → then Board release.

## 5. Components (Tier B)

- `src/board/ocrAssets.js`: pinned version, the four hash constants, a `loadVerified(name)`
  that returns a verified blob URL (checking the cache, then fetching and verifying),
  and `pickCoreVariant()`.
- `scripts/gen-ocr-hashes.mjs`: hashes the pinned files from `node_modules`, writes the
  constants, and fails CI if the committed constants don't match.
- `CircularScrubPanel` (App.board.jsx:1422): `createWorker` gets the verified blob URLs
  instead of `tessBase` paths. The offline message replaces today's generic catch.
- Build flag `VITE_OCR_REMOTE`: true for the Android native build, false for iOS and web.
  When false, today's local `tessBase` path is used unchanged.

## 6. Testing

**Tier A**
- Real OCR run in the dev browser with only the used files present: a known weekly-ad
  image produces the same `extractPricedPhrases` output as today.
- Per-variant: force each of the three `-lstm` variants via an explicit `corePath` file
  and confirm each loads and recognizes. This proves no dead file was secretly needed.
- AAB inspection: none of the 9 dead files present; size measured.

**Tier B**
- **Tamper tests, the ones that matter:** flip one byte in a served file → scan aborts
  and nothing reaches `importScripts`. Serve a correct file under a wrong-version path →
  rejected. Corrupt the IndexedDB copy → re-verify catches it and re-fetches.
- Wrong-origin guard: assert every fetched URL starts with `https://holysmokesbbqco.com/ocr/`.
- Offline: no network and no cache gives the offline message; no network with a cache
  still scans.
- Real-device check on Android before Production, since WebView `crypto.subtle` and blob
  `importScripts` behavior must be confirmed on-device, not just in desktop Chrome.

## 7. Sequencing

1. **Tier A → Board 2.4.5.** Self-contained, no website dependency. (2.4.4 is waiting on
   Joel's upload and is not reopened.)
2. Website session deploys `/ocr/tesseract-7.0.0/` and I verify the hashes live.
3. **Tier B → the following Board release**, Android only. First release Board can
   upload itself.
