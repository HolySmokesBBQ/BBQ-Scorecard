// public/ manifest guard.
//
// Born 2026-10-19: a staged website game left public/pit-game.js in the
// shared public/ folder, and because EVERY Vite build copies public/
// wholesale, 58 KB of dead game code rode inside every AAB/IPA built for
// four days. Nothing loaded it, but store bundles are not a junk drawer.
//
// Rule the mechanism enforces: public/ ships into every app, so its
// contents are a DELIBERATE list, not a scratch space. Any file added to
// or removed from public/ must be matched by an edit to
// scripts/public-manifest.txt in the same commit - which makes the change
// visible in review and fails every session's test suite until done.
//
// Usage: node scripts/check-public-manifest.mjs            check, exit 1 on drift
//        node scripts/check-public-manifest.mjs --update   rewrite the manifest
//        (the manifest lives OUTSIDE public/ so it never ships itself)

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PUB = join(ROOT, 'public');
const MANIFEST = join(ROOT, 'scripts', 'public-manifest.txt');

export function listPublic() {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(PUB, p).replaceAll('\\', '/'));
    }
  })(PUB);
  return out.sort();
}

export function readManifest() {
  return readFileSync(MANIFEST, 'utf8').split('\n').map(s => s.trim())
    .filter(s => s && !s.startsWith('#')).sort();
}

export function diff() {
  const actual = new Set(listPublic());
  const listed = new Set(readManifest());
  return {
    unlisted: [...actual].filter(f => !listed.has(f)).sort(),
    missing: [...listed].filter(f => !actual.has(f)).sort(),
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('check-public-manifest.mjs')) {
  if (process.argv.includes('--update')) {
    const header = '# Everything in public/ ships inside EVERY app bundle.\n# New files require a deliberate edit here (same commit). See check-public-manifest.mjs.\n';
    writeFileSync(MANIFEST, header + listPublic().join('\n') + '\n');
    console.log(`Manifest rewritten: ${listPublic().length} files.`);
  } else {
    const d = diff();
    if (d.unlisted.length) console.log(`UNLISTED in public/ (ships into every app!):\n  ${d.unlisted.join('\n  ')}`);
    if (d.missing.length) console.log(`IN MANIFEST but gone from public/:\n  ${d.missing.join('\n  ')}`);
    if (d.unlisted.length || d.missing.length) {
      console.log('\nIf deliberate: update scripts/public-manifest.txt in the SAME commit (node scripts/check-public-manifest.mjs --update).');
      process.exit(1);
    }
    console.log(`public/ matches the manifest (${readManifest().length} files).`);
  }
}
