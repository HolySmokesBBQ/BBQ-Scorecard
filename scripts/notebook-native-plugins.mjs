// The Capacitor plugins compiled into BBQ Notebook's Android build.
//
// This is the single source of truth. android-notebook/capacitor.settings.gradle
// and android-notebook/app/capacitor.build.gradle both carry "DO NOT EDIT, IT IS
// GENERATED" headers, but nothing regenerates them: `npx cap sync android`
// targets Scorecard's project (root capacitor.config.ts is Scorecard's, and
// capacitor.notebook.config.ts declares no android.path), and
// scripts/sync-notebook.mjs only copies the web bundle. So those files are
// maintained by hand against this list, and src/nativePlugins.notebook.test.js
// fails if the three ever disagree.
//
// Why a test rather than care: the two drift directions are not symmetric.
// A plugin listed here but not installed fails the build loudly with
// "Could not resolve project :capacitor-*". A plugin imported by the app but
// missing from the gradle files builds fine and fails on the device, and every
// call site in this codebase wraps its native path in try/catch with a
// fallback — so it degrades silently. That is how Report a Problem, PDF export
// and share ran on the web download path instead of a real share sheet in
// every Notebook build up to 3.0.9: @capacitor/filesystem and @capacitor/share
// were imported by src/diagnostics.js, src/reviewPdf.js and
// src/context/AppContext.jsx but were never in the gradle files. Found
// 2026-10-12 by diffing against Scorecard's cap-synced project.
//
// Adding a plugin: install it, add an entry here, add the matching
// `include ':capacitor-NAME'` to capacitor.settings.gradle and
// `implementation project(':capacitor-NAME')` to app/capacitor.build.gradle,
// then run the test. The gradle name is the package minus the leading @ with
// the slash turned into a hyphen.

export const NOTEBOOK_NATIVE_PLUGINS = [
  {
    pkg: '@capacitor/app',
    classpath: 'com.capacitorjs.plugins.app.AppPlugin',
  },
  {
    pkg: '@capacitor/filesystem',
    classpath: 'com.capacitorjs.plugins.filesystem.FilesystemPlugin',
  },
  {
    pkg: '@capacitor/share',
    classpath: 'com.capacitorjs.plugins.share.SharePlugin',
  },
  {
    pkg: '@capacitor-firebase/authentication',
    classpath:
      'io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin',
  },
  {
    pkg: '@capacitor-firebase/crashlytics',
    classpath:
      'io.capawesome.capacitorjs.plugins.firebase.crashlytics.FirebaseCrashlyticsPlugin',
  },
  {
    // Deliberately compiled in although no Notebook JS imports it. The app
    // sends its analytics through gtag.js, not this plugin, but including the
    // plugin is what pulls the native Firebase Analytics SDK into the APK --
    // the SDK that AndroidManifest's firebase_analytics_collection_enabled /
    // _deactivated meta-data flags control, and that the Play AD_ID
    // declaration is answered against. Dropping it to satisfy a tidier
    // include list would be a behaviour and a compliance change, not a
    // cleanup. jsImported: false keeps the test from demanding an import.
    pkg: '@capacitor-firebase/analytics',
    classpath:
      'io.capawesome.capacitorjs.plugins.firebase.analytics.FirebaseAnalyticsPlugin',
    jsImported: false,
  },
];

// '@capacitor/share' -> 'capacitor-share'
// '@capacitor-firebase/analytics' -> 'capacitor-firebase-analytics'
export const gradleName = (pkg) => pkg.replace(/^@/, '').replace('/', '-');
