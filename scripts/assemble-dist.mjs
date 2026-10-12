// Post-build assembly: combines Scorecard (dist/scorecard/), Notebook
// (dist/notebook/), and brand landing (public-landing/) into a single
// dist/ tree ready for Netlify.
//
// Sub-app outputs are already in place from their own Vite builds.
// This script:
//   1. Copies public-landing/index.html → dist/index.html (brand landing)
//   2. Copies shared public/ assets (favicon, fonts, logos, privacy.html,
//      delete-account.html, changelog.html, sitemap.xml, robots.txt) to
//      dist/ root so / and /scorecard/ and /notebook/ all link to the
//      same canonical copies.
//
// Run after `npm run build && npm run build:notebook` via the build:all
// npm script.

import { mkdirSync, copyFileSync, cpSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');

function copyIfExists(src, dest) {
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  if (statSync(src).isDirectory()) {
    cpSync(src, dest, { recursive: true });
  } else {
    copyFileSync(src, dest);
  }
  return true;
}

// 1. Brand landing at dist/index.html
console.log('Assembling dist/...');
mkdirSync(DIST, { recursive: true });
const landed = copyIfExists(join(ROOT, 'website', 'public-landing', 'index.html'), join(DIST, 'index.html'));
console.log(landed ? '  + brand landing' : '  ! website/public-landing/index.html missing');
// 1b. Inner brand pages (served at /pit, /episodes, /about via Netlify
//     pretty URLs). Same allowlist trap as everything else here: a page not
//     named below never deploys.
for (const page of ['pit.html', 'episodes.html', 'about.html']) {
  const ok = copyIfExists(join(ROOT, 'website', 'public-landing', page), join(DIST, page));
  console.log(ok ? `  + ${page}` : `  ! website/public-landing/${page} missing`);
}

// 2. Shared assets at dist/ root. These get served at both /favicon.ico
//    AND inside the sub-apps via their own publicDir copies — but having
//    the canonical copy at root is what makes the brand landing work
//    standalone.
const sharedAssets = [
  'favicon.ico',
  'icon-192.png',
  'icon-512.png',
  'holy-smokes-logo.png',
  'holy-smokes-logo.webp',
  'holy-smokes-logo.avif',
  'holy-smokes-logo@2x.webp',
  'holy-smokes-logo@2x.avif',
  'bbq-scorecard-logo.png',
  'bbq-notebook-logo.png',
  'bbq-calculator-logo.png',
  'bbq-calculator-logo-144.png', // 2x for the 72px homepage card (audit-001 item 16)
  'bbq-board-logo.png',
  'bbq-board-logo@2x.png',
  'bbq-board-logo-180.png',      // 2x for the 90px homepage card (audit-001 item 16)
  'board-icon-192.png',
  'board-icon-512.png',
  'privacy.html',
  'delete-account.html',
  'changelog.html',
  // Board's compliance pages are served at the site ROOT on purpose.
  // The Play Console privacy + account-deletion URLs point straight here,
  // so these must be real 200s — not redirects, and not relative paths
  // that would break inside the native WebView bundle.
  'privacy-board.html',
  'delete-account-board.html',
  // App Store Support URL for Scorecard (Guideline 1.5) — must be a real
  // 200 at the site root; Scorecard's App Store Connect points here.
  'support.html',
  'sitemap.xml',
  'robots.txt',
  'gtm-init.js',
  'site.css',      // shared stylesheet for /, /pit, /episodes, /about; *.css is immutable, so bump ?v= on change
  'lightbox.js',   // /pit gallery dialog; external because CSP script-src has no 'unsafe-inline'; bump ?v= on change
  // SEO / verification files
  'googleb5ed7e361153ee65.html',
  // Android trusted-web-activity assetlinks
  '.well-known',
  // BBQ Board OCR engine, version-pinned under public/ocr/tesseract-<ver>/.
  // Directory copy; without this entry the files never reach dist/ (same
  // allowlist trap as support.html, 2026-09-03).
  'ocr',
  // NOTE: homepage/gallery photos are NOT here. They live in website/photos/
  // (step 2c) because every Vite build copies the whole of public/ into its
  // bundle, and 28 MB of marketing photography was shipping inside the
  // native apps (Notebook 3.0.6 AAB went 28 MB -> 55 MB; found 2026-10-05).
  'striker',  // Striker, the torch character (masters in assets-source/striker)
  '404.html', // custom not-found page (Netlify serves it for unmatched paths)
  'site-fx.js', // hero smoke + photo reveal; unhashed, no-cache header in netlify.toml
];

for (const asset of sharedAssets) {
  const src = join(ROOT, 'public', asset);
  const dest = join(DIST, asset);
  if (copyIfExists(src, dest)) {
    console.log(`  + ${asset}`);
  }
}

// 2b. Static SEO landing pages. These live outside the SPAs on purpose —
//     organic-search entry pages that convert into the apps. Without this
//     copy they never reach dist/ and never deploy (bug found 2026-07-20:
//     board-cities pages were authored but not shipping).
//     Underscore-prefixed files (_template.html) are authoring scaffolds —
//     filtered out so they can't be crawled or indexed.
for (const seoDir of ['board-cities', 'calculator-guests']) {
  const src = join(ROOT, 'website', 'public-landing', seoDir);
  if (existsSync(src)) {
    cpSync(src, join(DIST, seoDir), {
      recursive: true,
      filter: s => !basename(s).startsWith('_'),
    });
    console.log(`  + ${seoDir}/`);
  }
}

// 2c. Website-only photos: website/photos/ -> dist/photos/. Kept outside
//     public/ on purpose (see the note in sharedAssets). Serve path is
//     unchanged (/photos/...), so no HTML changes when files move here.
const photosDir = join(ROOT, 'website', 'photos');
if (existsSync(photosDir)) {
  cpSync(photosDir, join(DIST, 'photos'), { recursive: true });
  console.log(`  + photos/ (website-only, ${readdirSync(photosDir).length} files)`);
} else {
  console.log('  ! website/photos missing');
}

// 3. Fonts directory
const fontsDir = join(ROOT, 'public', 'fonts');
if (existsSync(fontsDir)) {
  cpSync(fontsDir, join(DIST, 'fonts'), { recursive: true });
  console.log(`  + fonts/`);
  // Also drop a copy inside the standalone Calculator sub-path. The
  // Calculator vite config doesn't run the full PWA pipeline so its
  // publicDir copy of public/ doesn't include fonts at the right URL.
  const calcFontsDir = join(DIST, 'calculator', 'fonts');
  if (existsSync(join(DIST, 'calculator'))) {
    cpSync(fontsDir, calcFontsDir, { recursive: true });
    console.log(`  + calculator/fonts/`);
  }
  // Same deal for the Catering tool — separate build target, needs its
  // own fonts/ at the sub-path so the @font-face URLs resolve.
  const cateringFontsDir = join(DIST, 'catering', 'fonts');
  if (existsSync(join(DIST, 'catering'))) {
    cpSync(fontsDir, cateringFontsDir, { recursive: true });
    console.log(`  + catering/fonts/`);
  }
  // BBQ Board — same standalone-build pattern.
  const boardFontsDir = join(DIST, 'board', 'fonts');
  if (existsSync(join(DIST, 'board'))) {
    cpSync(fontsDir, boardFontsDir, { recursive: true });
    console.log(`  + board/fonts/`);
  }
}

// 4. Make sure the BBQ Calculator's icon + favicon are in its sub-path
//    so the manifest preloads and apple-touch-icon links resolve.
const calcDir = join(DIST, 'calculator');
if (existsSync(calcDir)) {
  for (const asset of ['favicon.ico', 'icon-192.png', 'icon-512.png', 'bbq-calculator-logo.png']) {
    const src = join(ROOT, 'public', asset);
    const dest = join(calcDir, asset);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      console.log(`  + calculator/${asset}`);
    }
  }
}

// 5. Catering tool — internal, no public-facing icons or branding
//    needed, but a favicon is nice to have so the browser tab doesn't
//    look broken. Reuses the calculator favicon set.
const cateringDir = join(DIST, 'catering');
if (existsSync(cateringDir)) {
  for (const asset of ['favicon.ico', 'calc-icon-192.png']) {
    const src = join(ROOT, 'public', asset);
    const dest = join(cateringDir, asset);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      console.log(`  + catering/${asset}`);
    }
  }
}

// 6. BBQ Board — favicon + icons for tab, PWA installability comes later.
//    Uses the dedicated Board icons Joel commissioned (brick/pink cow +
//    cleaver + flames on umber ring).
const boardDir = join(DIST, 'board');
if (existsSync(boardDir)) {
  for (const asset of ['favicon.ico', 'board-icon-192.png', 'board-icon-512.png', 'bbq-board-logo.png', 'bbq-board-logo@2x.png']) {
    const src = join(ROOT, 'public', asset);
    const dest = join(boardDir, asset);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      console.log(`  + board/${asset}`);
    }
  }
}

// 7. Strip cross-app compliance pages from each app's sub-directory.
//    Every vite config sets `publicDir: 'public'`, so the WHOLE public/
//    tree lands in every app's dist — meaning /notebook/privacy.html
//    served Scorecard's policy, /calculator/privacy.html served
//    Scorecard's, and so on across all five apps (found 2026-07-20).
//    That is duplicate content for crawlers and, worse, a Play review
//    hazard: a reviewer opening /notebook/privacy.html read the wrong
//    app's policy, naming the wrong Firebase project and data set.
//
//    Fixed here rather than in each app's vite config because this
//    script is website-owned and runs LAST in build:all, after every
//    app build. Board already self-cleans via a closeBundle plugin in
//    vite.config.board.js; this pass is idempotent, so running over
//    Board again is a harmless no-op.
//
//    Safe to delete: every in-app link to these pages is an absolute
//    https://holysmokesbbqco.com/... root URL (verified 2026-07-20), so
//    nothing resolves relative to the app directory. The canonical
//    copies live at dist root and under /notebook/.
const COMPLIANCE_PAGES = [
  'privacy.html', 'delete-account.html', 'changelog.html',
  'privacy-notebook.html', 'delete-account-notebook.html', 'changelog-notebook.html',
  'privacy-board.html', 'delete-account-board.html',
];

// What each app legitimately serves from its own sub-path. Anything in
// COMPLIANCE_PAGES not on an app's keep-list gets removed from that app's
// dist. Calculator and Catering own no compliance pages — Calculator is
// account-free and Catering is internal + robots-blocked — so they keep
// none and link to the root copies.
const COMPLIANCE_KEEP = {
  scorecard:  ['privacy.html', 'delete-account.html', 'changelog.html'],
  notebook:   ['privacy-notebook.html', 'delete-account-notebook.html', 'changelog-notebook.html'],
  board:      ['privacy-board.html', 'delete-account-board.html'],
  calculator: [],
  catering:   [],
};

for (const [app, keep] of Object.entries(COMPLIANCE_KEEP)) {
  const appDir = join(DIST, app);
  if (!existsSync(appDir)) continue;
  for (const page of COMPLIANCE_PAGES) {
    if (keep.includes(page)) continue;
    const stale = join(appDir, page);
    if (existsSync(stale)) {
      unlinkSync(stale);
      console.log(`  - ${app}/${page} (belongs to another app)`);
    }
  }
}

// 8. Bake the Board price line into the homepage. The calculator build
//    already snapshots the cheapest price per cut from Board seed data
//    (website/calculator/calculatorPrices.js); the homepage quotes brisket
//    with the shop, the sample size and the build date, so the number is
//    sourced and dated rather than a marketing claim (antislop R-17).
try {
  const { MEAT_PRICES } = await import('../website/calculator/calculatorPrices.js');
  const b = MEAT_PRICES && MEAT_PRICES.Brisket;
  const home = join(DIST, 'index.html');
  if (b && existsSync(home)) {
    const { readFileSync, writeFileSync } = await import('node:fs');
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    let html = readFileSync(home, 'utf8');
    html = html.replace(/{{BRISKET_PRICE}}/g, '$' + b.pricePerLb.toFixed(2))
               .replace(/{{BRISKET_SHOP}}/g, b.shopName)
               .replace(/{{BRISKET_SAMPLES}}/g, String(b.sampleSize))
               .replace(/{{BUILD_DATE}}/g, date);
    writeFileSync(home, html);
    console.log(`  + board brisket line: ${b.pricePerLb} ${b.shopName} (${b.sampleSize}) as of ${date}`);
  }
} catch (e) {
  console.log('  ! board brisket line skipped: ' + e.message);
}

console.log('Done.');
