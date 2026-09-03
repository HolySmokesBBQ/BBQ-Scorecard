> ## ⚠️ HISTORICAL — SNAPSHOT OF JUNE 5, 2026
>
> **Every "Current" line below is three months out of date.** As of 2026-09-03:
> Android Production is **3.6.4 (3604)**, live since Aug 31; iOS is **4.0.0
> build 9**, in the App Review cycle; `android/app/build.gradle` sits at
> **versionCode 4000 / versionName 4.0.0**.
>
> Do not use this file to decide what to ship next. It is kept as a record of
> where things stood in June.

# Deploy Status

This file tracks what's been uploaded to each channel.
**Check this before building a new version. Always increment from the latest uploaded.**

## Play Console — Internal Testing
- **Current**: v3.1.1 (versionCode 3101) — uploaded June 4, 2026
- Burned codes: 3004, 3005, 3007 (failed uploads from v3.0.x cycle)

## Play Console — Closed Testing
- **Current**: v3.0.8 (versionCode 3008) — uploaded June 3, 2026
- TWA wrapping holysmokesbbqco.com (production site)

## Production Website (holysmokesbbqco.com)
- **Current**: v3.1.3 — deployed June 5, 2026 (redeployed once to fix `_docId` strip)
- Serves closed testing via TWA
- Carries: friend request flow, photo bug fix, examples fix, share toggle, security headers, CSP changes, console stripping, crypto random IDs, dead Drive code removed
- **VERIFIED LIVE**: reviews load, friend request UI works, no console errors, all Firestore calls 200
- Note: This deploy carries website-side App Check init but env var `VITE_FIREBASE_APPCHECK_SITE_KEY` not yet set, so it's a no-op until you register the site key (see APP-CHECK-SETUP.md)

## Test Website (test.holysmokesbbqco.com)
- **Current**: v3.1.1 — deployed June 4, 2026 (now BEHIND production)
- Note: prod jumped ahead because `npm run deploy` ships to prod, not test. If you want test to catch up, deploy to it separately with `npx netlify deploy --alias=test --dir=dist` after linking the test site.

## Next Version
- **Built and signed, ready to upload**: v3.1.3 (versionCode 3103)
- AAB at: `BBQ-Scorecard-Android/BBQ Scorecard-signed.aab` (7.8 MB)
- Built June 5, 2026 (final iteration — includes corrected google-services.json with Android OAuth clients AND Capacitor Firebase App Check plugin with Play Integrity)
- Signed with `original-key/signing.keystore`, verified
- Old v3.1.2 AAB deleted to prevent accidental upload
- Changes since v3.1.2:
  - Friend request flow (mutual consent — replaces forced-add IDOR)
  - Photo sync bug fix (photos no longer disappear after app updates)
  - Crypto-secure random IDs + 6-char friend codes
  - Field-level Firestore write validation
  - Storage rules now check friendship for photo reads
  - CSP no longer allows inline scripts (GTM extracted)
  - Dead Google Drive OAuth code deleted
  - App Check client wired (no-op until site key registered)
  - `allowBackup=false` + data extraction rules on Android
  - Share toggle on cooks and recipes
  - Example review/cook fixed (no longer reappear when filters active)
  - Console logs stripped from prod bundle
- See `READY-TO-SHIP.md` for the full deploy walkthrough.

## Rules
- Every version gets a changelog entry, even patches
- Never use BBQ-Scorecard-Android\signing.keystore — only original-key\signing.keystore
- Always delete unsigned AABs after signing
- compileSdkVersion = 36, targetSdkVersion = 35
