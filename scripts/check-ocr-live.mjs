// Live check for BBQ Board's OCR engine files (scripts/ocr-manifest.mjs).
//
// Fetches each file from the live site, hashes the DECODED body (fetch
// undoes Netlify's brotli/gzip before we see the bytes), and compares it to
// the sha256 Board 2.5.0 carries as an integrity constant. Also confirms the
// response headers Board's loader depends on. Runs as part of `npm run
// check:deploy`; exits 1 on any mismatch so a chained deploy report fails.
//
// Usage: node scripts/check-ocr-live.mjs [--origin https://...]

import { createHash } from 'node:crypto';
import { OCR_FILES, OCR_SERVE_DIR, OCR_VERSION } from './ocr-manifest.mjs';

const originArg = process.argv.indexOf('--origin');
const ORIGIN = originArg > -1 ? process.argv[originArg + 1] : 'https://holysmokesbbqco.com';

let bad = 0;
console.log(`OCR engine ${OCR_VERSION} at ${ORIGIN}/${OCR_SERVE_DIR}/`);
for (const f of OCR_FILES) {
  const url = `${ORIGIN}/${OCR_SERVE_DIR}/${f.name}`;
  let line;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    if (res.status !== 200) { line = `MISSING  ${res.status}`; bad++; }
    else {
      const body = new Uint8Array(await res.arrayBuffer());
      const hash = createHash('sha256').update(body).digest('hex');
      const cc = res.headers.get('cache-control') || '';
      const acao = res.headers.get('access-control-allow-origin') || '';
      const ok = hash === f.sha256 && cc.includes('immutable') && acao === '*';
      if (!ok) bad++;
      line = `${ok ? 'OK      ' : 'MISMATCH'} ${body.length} B  sha256 ${hash === f.sha256 ? 'match' : 'DIFFERS ' + hash}  cache ${cc.includes('immutable') ? 'immutable' : cc || 'none'}  acao ${acao || 'none'}`;
    }
  } catch (e) {
    line = `ERROR    ${e.message}`; bad++;
  }
  console.log(`  ${line}  ${f.name}`);
}
console.log(bad === 0 ? 'All four OCR files live with the expected bytes.' : `${bad} OCR file(s) wrong or missing.`);
process.exit(bad === 0 ? 0 : 1);
