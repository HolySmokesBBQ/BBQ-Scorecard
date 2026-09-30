// Verify the live BBQ Board OCR assets against Board's SHA-256 manifest.
//
//   node scripts/verify-ocr-live.mjs <manifest.json> [origin]
//
// manifest.json: { "version": "tesseract-7.0.0", "files": { "<name>": "<sha256 hex>", ... } }
// (the shape scripts/gen-ocr-hashes.mjs writes; pass Board's file verbatim).
//
// Fetches every file from https://holysmokesbbqco.com/ocr/<version>/<name>,
// hashes the bytes actually served, and compares. Also checks the headers
// the spec depends on: immutable cache and a cross-origin allow header,
// because the app fetches from a Capacitor origin. Exit 1 on any mismatch.
// A green Netlify deploy log proves nothing; this does.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [manifestPath, origin = 'https://holysmokesbbqco.com'] = process.argv.slice(2);
if (!manifestPath) { console.error('usage: node scripts/verify-ocr-live.mjs <manifest.json> [origin]'); process.exit(2); }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const { version, files } = manifest;
if (!version || !files) { console.error('manifest needs { version, files }'); process.exit(2); }

let bad = 0;
for (const [name, expected] of Object.entries(files)) {
  const url = `${origin}/ocr/${version}/${name}`;
  let line = `${name.padEnd(40)}`;
  try {
    const res = await fetch(url);
    const bytes = Buffer.from(await res.arrayBuffer());
    const actual = createHash('sha256').update(bytes).digest('hex');
    const cc = res.headers.get('cache-control') || '';
    const acao = res.headers.get('access-control-allow-origin') || '';
    const ct = res.headers.get('content-type') || '';
    const ok = res.status === 200 && actual === expected.toLowerCase();
    const cacheOk = /immutable/.test(cc);
    const corsOk = acao === '*';
    // An SPA fallback returns HTML with a 200; the hash catches it, but say so.
    const looksHtml = /text\/html/i.test(ct);
    if (!ok || !cacheOk || !corsOk) bad++;
    line += ` ${res.status} ${(bytes.length / 1048576).toFixed(2).padStart(6)} MB  hash ${ok ? 'MATCH' : 'MISMATCH'}`
      + `  cache ${cacheOk ? 'ok' : 'NOT immutable'}  cors ${corsOk ? 'ok' : 'MISSING'}`
      + (looksHtml ? '  (served HTML: SPA fallback, file missing from dist)' : '');
  } catch (e) {
    bad++; line += `  FETCH FAILED ${e.message}`;
  }
  console.log(line);
}
console.log(bad ? `\n${bad} problem(s)` : '\nall live OCR assets verified');
process.exit(bad ? 1 : 0);
