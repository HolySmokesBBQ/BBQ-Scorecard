// Deploy-freshness check: is what's LIVE the same as what's BUILT?
//
// Born from teardown-audit finding F-9 (2026-09-29): /board/ served a
// bundle with a known Settings crash for 22 days after the fix landed on
// main, because "committed on main" was treated as "shipped." The Board
// coder session proposed this check; the Overseer built it.
//
// What it does: fetches each live surface of holysmokesbbqco.com, extracts
// the hashed asset filenames its HTML references, and checks whether each
// exists in the local dist/ tree. Vite content-hashes filenames, so a
// missing file means live and dist were built from different source.
//
// IMPORTANT: the comparison is only meaningful against a FRESH build —
// run `npm run build:all` first. A stale dist/ makes live look wrong when
// it's dist that's behind.
//
// Usage:
//   npm run check:deploy             report, always exits 0
//   npm run check:deploy -- --strict exits 1 on any mismatch (CI-able)

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = join(ROOT, 'dist');
const strict = process.argv.includes('--strict');

const SURFACES = [
  ['landing', 'https://holysmokesbbqco.com/'],
  ['scorecard', 'https://holysmokesbbqco.com/scorecard/'],
  ['notebook', 'https://holysmokesbbqco.com/notebook/'],
  ['board', 'https://holysmokesbbqco.com/board/'],
  ['calculator', 'https://holysmokesbbqco.com/calculator/'],
  ['catering', 'https://holysmokesbbqco.com/catering/'],
];

// Hashed asset references: src/href to .js/.css whose filename carries a
// vite content hash (e.g. index.board.web.D-nylADx.js, index.BhTz9Q2k.css).
const ASSET_RE = /(?:src|href)="(\/[^"]*[.-][A-Za-z0-9_-]{8}\.(?:js|css))"/g;

let mismatches = 0;

for (const [name, url] of SURFACES) {
  let html;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) { console.log(`${name.padEnd(11)} FETCH FAILED (${res.status}) ${url}`); mismatches++; continue; }
    html = await res.text();
  } catch (e) {
    console.log(`${name.padEnd(11)} FETCH ERROR ${e.message}`);
    mismatches++;
    continue;
  }
  const assets = [...html.matchAll(ASSET_RE)].map(m => m[1]);
  if (!assets.length) { console.log(`${name.padEnd(11)} no hashed assets referenced (static page) — nothing to compare`); continue; }
  for (const a of [...new Set(assets)]) {
    const local = join(DIST, a.replace(/^\//, ''));
    const ok = existsSync(local);
    if (!ok) mismatches++;
    console.log(`${name.padEnd(11)} ${ok ? 'MATCH   ' : 'MISMATCH'} ${a}${ok ? '' : '   <-- live bundle not in dist/ (deploy or dist is stale)'}`);
  }
}

console.log(`\n${mismatches === 0 ? 'All live hashed assets exist in dist/.' : mismatches + ' mismatch(es). If dist/ is freshly built from main, the LIVE SITE is behind main -> deploy.'}`);
console.log('(Reminder: run `npm run build:all` first or this comparison means nothing.)');

if (strict && mismatches) process.exit(1);
