# BBQ Scorecard — iOS setup runbook

Status as of the scaffold (built on Windows, unbuilt/unverified — see below).

The web layer is shared with Android, so every screen, the scoring
logic, Firebase, and all features already work cross-platform. What
follows is only the native iOS shell: config, signing, and the one
code addition Apple requires.

---

## What is already done (in this repo, verified as file state only)

- `@capacitor/ios@^8.4.2` added to `package.json`.
- `ios/` Xcode project scaffolded via `npx cap add ios`. Capacitor 8
  uses Swift Package Manager (not CocoaPods), so no `pod install` step.
- All 7 native plugins wired into `Package.swift`: Firebase
  Analytics / App Check / Authentication / Crashlytics, App,
  Filesystem, Share.
- Bundle identifier: `com.holysmokesbbq.scorecard` (matches Android).
- Display name: `BBQ Scorecard`.
- Info.plist permission usage strings added for location, camera,
  photo library read, and photo library add. Without these iOS
  hard-crashes on first access — they are required, not optional.

**Nothing here has been built, run, or verified.** iOS builds require
macOS + Xcode. The first real compile happens on a Mac, and things
that only surface there are expected. Treat this scaffold as a
correct starting point, not a finished app.

---

## Step 0 — Apple Developer Program ($99/yr)

This is the "once I get paid" registration. Needed to run on a
physical device, use TestFlight, enable the Sign in with Apple
capability, and submit to the App Store. Free-tier Xcode can build to
the simulator without it, but cannot ship.

---

## Step 1 — Firebase iOS app (FREE — does not need the Apple account)

Firebase treats iOS as a separate app inside the same project. Do this
before the first build or Firebase Auth/Analytics/Crashlytics will not
initialize.

1. Firebase console → project `holy-smokes-bbq-scorecard` → Add app →
   iOS.
2. iOS bundle ID: `com.holysmokesbbq.scorecard`.
3. Download `GoogleService-Info.plist`.
4. Place it at `ios/App/App/GoogleService-Info.plist` and add it to the
   Xcode target (drag into the App group, "Copy if needed", App target
   checked).

## Step 2 — Google Sign-In URL scheme

Firebase Google sign-in on iOS needs a URL scheme so the OAuth callback
returns to the app.

1. Open the downloaded `GoogleService-Info.plist`, copy the
   `REVERSED_CLIENT_ID` value.
2. Add it as a URL scheme in Info.plist (Xcode → target → Info → URL
   Types → new, or add a `CFBundleURLTypes` block). This value does not
   exist until Step 1, which is why it is not pre-filled here.

Reference: @capacitor-firebase/authentication iOS setup docs.

---

## Step 3 — Sign in with Apple (REQUIRED before App Store submission)

**This is a code addition, not a registration, and it gates approval.**

App Store Review Guideline 4.8 requires that any app offering a
third-party login (this app offers Google) must also offer an
equivalent option that limits data to name + email and lets users hide
their email. Sign in with Apple is the canonical one. Shipping
Google-only is a near-certain rejection.

The current app wires only `GoogleAuthProvider`
(`src/firebase.js:87`, `capacitor.config.ts:24`). To add Apple:

1. Firebase console → Authentication → Sign-in method → enable Apple.
2. Add `"apple.com"` to the providers array in `capacitor.config.ts`.
3. Add a Sign in with Apple button to the sign-in UI and call the
   Apple provider through @capacitor-firebase/authentication.
4. In Xcode → Signing & Capabilities → add the "Sign in with Apple"
   capability (needs the paid Apple account from Step 0).
5. Apple Developer portal → the App ID → enable Sign in with Apple.

Apple sign-in can only be tested on a real Apple device with the
entitlement — not reliably in the simulator. Do not consider it done
until it has run on a device.

---

## Step 4 — Safe-area / inset sanity check

iOS has its own version of the edge-to-edge problem: the notch,
Dynamic Island, and home indicator. Capacitor generally handles safe
areas, but confirm on a device that the top nav and bottom controls
are not clipped or drawn under the indicator — the same class of issue
being triaged on Android API 36. Do not assume; look.

---

## Step 5 — Build sequence on the Mac

```bash
npm install
npm run build:native        # produces dist-native/
npx cap sync ios            # copies web assets + updates native deps
npx cap open ios            # opens Xcode
```

Then in Xcode: set the team (Signing & Capabilities), pick a device or
simulator, Product → Run. For release: Product → Archive → distribute
to App Store Connect.

---

## Path B — cloud build, no Apple hardware (preferred)

The build pipeline is already written at repo root: `codemagic.yaml`.
It runs on Codemagic's Mac, so no Mac is ever owned or touched. The
file is structurally complete but not yet runnable — it needs the
Apple-account values (App Store Connect API key) that only exist once
the $99 membership is active. Every one of those is an environment
variable, not hardcoded. Activation steps are in the header comment of
`codemagic.yaml`.

A shared Xcode scheme (`ios/App/App.xcodeproj/xcshareddata/xcschemes/
App.xcscheme`) is committed so CI can find something to build without a
Mac ever opening the project.

Reality check on "no Apple device": CI builds and signs fine without
one, but Sign in with Apple (Step 3) and a final does-it-actually-run
pass need a physical iPhone. That is a tester's device via TestFlight,
not a purchase. Plan the first TestFlight round around a tester who
owns an iPhone.

## Open questions for whoever runs the Mac build

- Marketing version / build number: mirror the Android
  `versionName` / `versionCode`, or start iOS at its own 1.0.0?
- App Store screenshots: iPhone sizes differ from Play; Joel makes
  these himself in his own style.
- Firebase App Check on iOS uses DeviceCheck/App Attest, not Play
  Integrity — needs its own console configuration.
