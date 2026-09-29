// Fork-drift reporter: src/ (native) vs website/src/ (web).
//
// The fork is deliberate (website-standalone migration, 2026-08-17) — web
// and native are ALLOWED to diverge. What is not allowed is divergence
// nobody can see: the 2026-09-29 teardown audit found a fix Apple rejected
// a build over (auth error swallowing) live on the web fork six weeks
// after native fixed it, because no tool showed which shared files differ.
//
// This script is a REPORT, not a gate. It normalizes line endings (native
// is CRLF, web is LF — a plain `diff` marks every file 100% changed) and
// prints, for every file present in both trees, whether the contents
// actually differ, plus files that exist on only one side.
//
// Usage:
//   npm run check:drift            report, always exits 0
//   npm run check:drift -- --strict  exits 1 if any shared file differs
//
// Run it before porting a fix, and after: the file you just patched should
// move from DIFF to same (or its divergence should be explainable).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const NATIVE = join(ROOT, 'src');
const WEB = join(ROOT, 'website', 'src');
const strict = process.argv.includes('--strict');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(jsx?|mjs)$/.test(name)) acc.push(p);
  }
  return acc;
}

const norm = p => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const lines = p => norm(p).split('\n').length;

const nativeFiles = walk(NATIVE).map(p => relative(NATIVE, p).replace(/\\/g, '/'));
const webFiles = walk(WEB).map(p => relative(WEB, p).replace(/\\/g, '/'));
const webSet = new Set(webFiles);
const nativeSet = new Set(nativeFiles);

const diffs = [];
const nativeOnly = [];
const webOnly = webFiles.filter(f => !nativeSet.has(f));

for (const f of nativeFiles.sort()) {
  const n = join(NATIVE, f);
  const w = join(WEB, f);
  if (!webSet.has(f)) { nativeOnly.push(f); continue; }
  if (norm(n) !== norm(w)) diffs.push({ f, n: lines(n), w: lines(w) });
}

console.log('Fork drift: src/ (native) vs website/src/ (web)\n');
if (diffs.length) {
  console.log('SHARED FILES THAT DIFFER (CRLF/LF-normalized):');
  const pad = Math.max(...diffs.map(d => d.f.length)) + 2;
  for (const d of diffs) {
    console.log(`  DIFF  ${d.f.padEnd(pad)} native:${String(d.n).padStart(5)}  web:${String(d.w).padStart(5)}  (${d.n - d.w >= 0 ? '+' : ''}${d.n - d.w})`);
  }
} else {
  console.log('No shared files differ.');
}
if (nativeOnly.length) {
  console.log('\nNATIVE-ONLY (no web counterpart):');
  nativeOnly.forEach(f => console.log('  ' + f));
}
if (webOnly.length) {
  console.log('\nWEB-ONLY (no native counterpart):');
  webOnly.forEach(f => console.log('  ' + f));
}
console.log(`\nSummary: ${diffs.length} differing, ${nativeOnly.length} native-only, ${webOnly.length} web-only, ${nativeFiles.length - nativeOnly.length - diffs.length} identical.`);

if (strict && diffs.length) process.exit(1);
