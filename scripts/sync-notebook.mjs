// Capacitor sync for the BBQ Notebook Android project (android-notebook/).
//
// Capacitor's stock `npx cap sync` only knows about the standard
// android/ directory and reads its webDir from capacitor.config.ts.
// Since we host TWO Capacitor projects in this repo (Scorecard at
// android/, Notebook at android-notebook/), the Notebook one needs a
// custom sync. This script:
//
//   1. Copies the freshly-built notebook native bundle
//      (dist-notebook-native/) into android-notebook/app/src/main/assets/public/
//   2. Writes a Capacitor config JSON for the notebook into
//      android-notebook/app/src/main/assets/capacitor.config.json
//      (Capacitor reads this at runtime in the webview to know its app ID etc.)
//
// Run via `npm run sync:notebook` after `npm run build:notebook-native`.

import { existsSync, mkdirSync, cpSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { NOTEBOOK_NATIVE_PLUGINS } from './notebook-native-plugins.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'dist-notebook-native');
const TARGET_PUBLIC = join(ROOT, 'android-notebook', 'app', 'src', 'main', 'assets', 'public');
const TARGET_CONFIG = join(ROOT, 'android-notebook', 'app', 'src', 'main', 'assets', 'capacitor.config.json');

if (!existsSync(SOURCE)) {
  console.error('ERROR: dist-notebook-native/ not found. Run `npm run build:notebook-native` first.');
  process.exit(1);
}

console.log('Syncing Notebook native bundle to android-notebook/...');

// 1. Replace android-notebook/app/src/main/assets/public/ with fresh bundle.
//    Wipe-and-replace so removed files are properly gone (no stale assets).
if (existsSync(TARGET_PUBLIC)) {
  rmSync(TARGET_PUBLIC, { recursive: true, force: true });
}
mkdirSync(TARGET_PUBLIC, { recursive: true });
cpSync(SOURCE, TARGET_PUBLIC, { recursive: true });
console.log(`  + copied ${SOURCE} → ${TARGET_PUBLIC}`);

// Strip dead-weight static files that Vite copies from the shared public/
// directory but BBQ Notebook never links to. These files are written for
// the Scorecard web build (changelog, the original privacy + delete-
// account pages, robots.txt) and a Notebook tester would never reach
// them — but if anything navigated to /privacy.html on the local
// Capacitor server they would see Scorecard branding. Easier to delete
// the dead assets than to risk a stray link surfacing them.
const DEAD_ASSETS = ['changelog.html', 'privacy.html', 'delete-account.html', 'robots.txt'];
for (const name of DEAD_ASSETS) {
  const file = join(TARGET_PUBLIC, name);
  if (existsSync(file)) {
    unlinkSync(file);
    console.log(`  - removed dead asset ${name}`);
  }
}

// Same problem, directory scale. public/photos/ is the marketing site's
// gallery — Joel's portrait, the From the Pit stills, the episode frames.
// Vite copies all of public/ into every build, so these rode into the
// Notebook APK: 28 MB of website photography in a cook-logging app that
// never renders one of them (grep for 'photos/' across the Notebook
// screens returns nothing). It doubled the 3.0.6 bundle from 28 MB to
// 55 MB before this was caught. Anything added here must stay something
// Notebook genuinely does not link to.
const DEAD_DIRS = ['photos'];
for (const name of DEAD_DIRS) {
  const dir = join(TARGET_PUBLIC, name);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`  - removed dead asset dir ${name}/`);
  }
}

// 2. Write the Capacitor runtime config — what the BridgeActivity sees
//    at app startup. Keep in sync with capacitor.notebook.config.ts.
const capConfig = {
  appId: 'com.holysmokesbbq.notebook',
  appName: 'BBQ Notebook',
  webDir: 'dist-notebook-native',
  server: {
    // Tightened v2.1.9 audit: dropped `*.googleapis.com` wildcard which
    // allowed *.storage.googleapis.com (public GCS buckets) to load in
    // the WebView. Now enumerated to the specific hosts Firebase Auth
    // + Firestore + Storage + Sign-in actually navigate to.
    allowNavigation: [
      'holy-smokes-bbq-notebook.firebaseapp.com',
      'accounts.google.com',
      'oauth2.googleapis.com',
      'firestore.googleapis.com',
      'firebasestorage.googleapis.com',
      'identitytoolkit.googleapis.com',
      'securetoken.googleapis.com',
    ],
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

writeFileSync(TARGET_CONFIG, JSON.stringify(capConfig, null, 2));
console.log(`  + wrote ${TARGET_CONFIG}`);

// 3. Write the native plugin registry from the one manifest that also drives
//    the two gradle files (scripts/notebook-native-plugins.mjs).
//
//    This file used to be a committed leftover from the last real `cap add`,
//    and nothing regenerated it — so when ea11c9c dropped
//    @capacitor-firebase/app-check from the build in July, the registry kept
//    listing it. Capacitor's PluginManager.loadPluginClasses() walks the whole
//    registry inside ONE try block and rethrows ClassNotFoundException as
//    PluginLoadException; BridgeActivity catches that, logs "Error loading
//    plugins." and never calls addPlugins. app-check was the FIRST entry, so
//    every build from 3.0.5 on registered ZERO native plugins. Firebase
//    Authentication never loaded, which made native Google sign-in impossible
//    on any fresh install while existing sessions kept working off the JS SDK.
//    It took a new phone to surface it.
//
//    Generating it here means the registry cannot drift from the gradle files
//    again, because one list feeds all three. nativePlugins.notebook.test.js
//    asserts all three agree, and that every registry classpath is one the
//    build actually compiles.
const TARGET_PLUGINS = join(ROOT, 'android-notebook', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');
const registry = NOTEBOOK_NATIVE_PLUGINS.map(({ pkg, classpath }) => ({ pkg, classpath }));
writeFileSync(TARGET_PLUGINS, JSON.stringify(registry, null, 2) + '\n');
console.log(`  + wrote ${TARGET_PLUGINS} (${registry.length} plugins)`);
for (const p of registry) console.log(`      ${p.pkg}`);

console.log('Done.');
