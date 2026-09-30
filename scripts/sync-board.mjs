// Capacitor sync for the BBQ Board Android project (android-board/).
//
// This is the third repo-hosted Capacitor project alongside Scorecard
// (android/) and Notebook (android-notebook/), so Board needs its own
// custom sync script instead of the stock `npx cap sync`.
//
// This script:
//   1. Copies the freshly-built Board native bundle
//      (dist-board-native/) into android-board/app/src/main/assets/public/
//   2. Writes a Capacitor config JSON for the Board into
//      android-board/app/src/main/assets/capacitor.config.json
//
// Run via `npm run sync:board` after `npm run build:board-native`.

import { existsSync, mkdirSync, cpSync, rmSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { TESSERACT_KEEP } from './board-native-assets.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'dist-board-native');
const TARGET_PUBLIC = join(ROOT, 'android-board', 'app', 'src', 'main', 'assets', 'public');
const TARGET_CONFIG = join(ROOT, 'android-board', 'app', 'src', 'main', 'assets', 'capacitor.config.json');

if (!existsSync(SOURCE)) {
  console.error('ERROR: dist-board-native/ not found. Run `npm run build:board-native` first.');
  process.exit(1);
}

console.log('Syncing Board native bundle to android-board/...');

if (existsSync(TARGET_PUBLIC)) {
  rmSync(TARGET_PUBLIC, { recursive: true, force: true });
}
mkdirSync(TARGET_PUBLIC, { recursive: true });
cpSync(SOURCE, TARGET_PUBLIC, { recursive: true });
console.log(`  + copied ${SOURCE} → ${TARGET_PUBLIC}`);

// Strip Scorecard/Notebook-only static files that Vite copies from the
// shared public/ directory but Board never links to. Prevents a stray
// deep-link from surfacing another app's branded pages inside Board.
const DEAD_ASSETS = [
  'changelog.html',
  'changelog-notebook.html',
  'privacy.html',
  'privacy-notebook.html',
  'delete-account.html',
  'delete-account-notebook.html',
  'robots.txt',
  'sitemap.xml',
];
for (const name of DEAD_ASSETS) {
  const file = join(TARGET_PUBLIC, name);
  if (existsSync(file)) {
    unlinkSync(file);
    console.log(`  - removed dead asset ${name}`);
  }
}

// Guardrail: Vite's `publicDir: 'public'` copies EVERY file from
// public/ into the build, so a marketing PNG left in public/ ships
// inside the AAB. That happened once (Social Posts-selection*.png,
// three orphan Canva exports totalling ~15 MB) and tripped Play's
// device-compatibility filter. Now: fail loudly for any file above
// this size that isn't in the known-large-and-intentional allowlist.
const LARGE_FILE_MB = 1;
// Only the OCR files Board can actually load (see board-native-assets.mjs).
// The other nine Tesseract builds are over 1 MB each, so if the Vite prune
// ever stops working they trip this guardrail instead of shipping.
const KNOWN_LARGE = new Set(TESSERACT_KEEP);
function walk(dir, rel = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walk(abs, relPath);
    } else {
      const size = statSync(abs).size;
      const mb = size / (1024 * 1024);
      if (mb > LARGE_FILE_MB && !KNOWN_LARGE.has(relPath)) {
        console.error(
          `  ! large asset: ${relPath} (${mb.toFixed(1)} MB) — not in KNOWN_LARGE allowlist. ` +
          `If this belongs in the AAB, add it to sync-board.mjs. If not, remove from public/ ` +
          `or add to DEAD_ASSETS.`,
        );
        process.exitCode = 2;
      }
    }
  }
}
walk(TARGET_PUBLIC);
if (process.exitCode === 2) {
  console.error('\nRefusing to sync: unexpected large asset in Board bundle. Fix and rerun.');
  process.exit(2);
}

// Capacitor runtime config — read by BridgeActivity at app startup.
// Keep in sync with capacitor.board.config.ts.
const capConfig = {
  appId: 'com.holysmokesbbq.board',
  appName: 'BBQ Board',
  webDir: 'dist-board-native',
  server: {
    allowNavigation: [
      'holy-smokes-bbq-scorecard.firebaseapp.com',
      'accounts.google.com',
      '*.googleapis.com',
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

console.log('Done.');
