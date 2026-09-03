> ## ⚠️ HISTORICAL — DO NOT FOLLOW THE VERSION NUMBERS
>
> **This document describes the v3.1.3 release of June 2026 and is kept only as
> a record of what that batch contained.** As of 2026-09-03 the live Android
> release is **3.6.4 (versionCode 3604)** and `android/app/build.gradle` is at
> **versionCode 4000 / versionName 4.0.0**.
>
> Step 6 below tells you to set `package.json` to `3.1.3` and
> `android/app/build.gradle` to `versionCode 3103`. **Following it would move a
> shipped app backwards.** Play Console rejects a versionCode at or below the
> live one, so the upload would fail, but the version strings would already be
> wrong in source by then.
>
> For current release procedure use the ladder in memory: Internal → Closed →
> Open → Production, never skipping. Read the sections below for the security
> and bug-fix history only.

# Ready to Ship — v3.1.3

Everything from the security pass + bug fixes is in source but not deployed. Deploy in this order to minimize risk.

## What's in this batch

**Security**:
- Mutual-consent friend request flow (replaces forced-add IDOR — audit Finding #1)
- Crypto-secure random IDs + 6-char friend codes (Findings #2, #3, #11)
- Field-level Firestore write validation (Finding #6)
- Photo storage gated by friendship via `firestore.exists()` (Finding #7)
- CSP no longer allows inline scripts (Finding #5) — GTM extracted to `/gtm-init.js`
- Dead Google Drive OAuth code deleted (Finding #4)
- App Check client wired (no-op until you register key — see `APP-CHECK-SETUP.md`)
- Android manifest hardened: `allowBackup=false` + data extraction rules
- Console logs stripped from production bundles
- Security headers (CSP, HSTS, X-Frame-Options, etc.) in Netlify config

**Bugs fixed**:
- Photos disappearing after app updates (`mergeReviews` + `syncReviewsUp` bug — see `BUGS.md`)
- Example review/cook reappearing when filters match nothing

**Features**:
- Friend request inbox UI in Profile
- "Share with friends" toggle on cooks + recipes
- Friend code input widened to accept 6-char codes
- Updated Play Store description

## Step 1 — Publish Firestore rules (5 min)

The new rules introduce the `friendRequests` subcollection. Existing client code uses the back-compat `addFriendByCode` wrapper which now delegates to `sendFriendRequest` — so publishing new rules BEFORE the new website deploy will start blocking the old forced-add path even from any cached/standalone PWA clients. That's fine and desired.

1. Open https://console.firebase.google.com/project/holy-smokes-bbq-scorecard/firestore/rules
2. Replace entire content with the contents of `firestore.rules` (this file is in the project root)
3. Click **Publish**

**Rollback**: re-publish the previous rules (you can find them in the Rules tab's history dropdown, or paste back the wide-open `allow read, write: if request.auth != null;`).

## Step 2 — Publish Storage rules (2 min)

The Storage rules now check `firestore.exists()` for friendship.

1. Open https://console.firebase.google.com/project/holy-smokes-bbq-scorecard/storage/rules
2. Replace entire content with the contents of `storage.rules`
3. Click **Publish**

## Step 3 — Verify on live site BEFORE Netlify deploy (5 min)

Sign in to test.holysmokesbbqco.com (running the previous code). Verify:
- Your reviews still load ✓
- Friend reviews still load ✓
- New review save works ✓
- Photo loads for your own review ✓

If any of these fail, paste the console error to me — likely a field name I missed in the whitelist.

## Step 4 — Netlify deploy (one shot)

When everything in step 3 passes:

1. Open https://app.netlify.com → your site → **Deploys** → **Trigger deploy** → **Deploy site**
2. Wait for green
3. Hard-refresh test.holysmokesbbqco.com (Ctrl+Shift+R) — service worker can cache stale code

This carries: CSP changes, friend request UI, photo bug fix, example fix, console stripping, security headers, App Check init (no-op without env var).

## Step 5 — Live verification (5 min)

On the fresh deploy, sign in and verify:
1. Profile shows your friend code (now 4-char or 6-char depending on when generated)
2. Try entering an invalid friend code — should show error
3. Open Profile — if you have any incoming friend requests, they should appear there
4. Open a review — photos should load
5. Open Network tab → look at Firestore calls — should be 200s

## Step 6 — Build new AAB v3.1.3 (when ready)

When the website is verified working:

1. Bump in `package.json`: `"version": "3.1.3"`
2. Bump in `android/app/build.gradle`: `versionCode 3103`, `versionName "3.1.3"`
3. Build (`npx cap sync && cd android && ./gradlew bundleRelease`)
4. Sign with `BBQ-Scorecard-Android/original-key/signing.keystore`
5. Upload to Play Console internal testing

Release notes:
> Better friend privacy: friend requests now need both sides to accept. Fixed photos vanishing after app updates. New "share with friends" toggle on cooks and recipes. Internal security improvements.

## Step 7 — When all that works: App Check (separate task)

See `APP-CHECK-SETUP.md` for the standalone walk-through. **Don't enforce App Check until both web and Android sides are wired**, or Android users will get blocked.

## Step 8 — Production website (eventually)

Production site `holysmokesbbqco.com` is still on v3.0.8 per DEPLOY-STATUS.md. When v3.1.3 has been live on test for a few days with no issues:

1. Trigger a production Netlify deploy
2. Update `DEPLOY-STATUS.md`
3. Promote v3.1.3 from internal testing to closed/production in Play Console

## Files in this drop

```
Modified:
  .gitignore
  android/app/build.gradle
  android/app/src/main/AndroidManifest.xml
  index.html
  netlify.toml
  package.json
  src/App.jsx (no changes this batch)
  src/components/CookForm.jsx
  src/components/CookLog.jsx
  src/components/Home.jsx
  src/components/Profile.jsx
  src/components/RecipeForm.jsx
  src/context/AppContext.jsx
  src/firebase.js
  src/firebaseSync.js
  src/scoring.js
  src/storage.js
  store-listing.md
  vite.config.js

Created:
  .env.example
  android/app/src/main/res/xml/data_extraction_rules.xml
  APP-CHECK-SETUP.md
  BUGS.md
  firebase.json
  firestore.rules
  public/gtm-init.js
  READY-TO-SHIP.md (this file)
  SECURITY-AUDIT-RESPONSE.md
  SECURITY-PUNCH-LIST.md
  storage.rules
```
