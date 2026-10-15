// Guards the native-bundle strip list in vite.config.native.js (2026-10-15).
// Every path stripped from dist-native must be unreferenced by Scorecard's
// own code and entry HTML. Otherwise the app would ship a broken image.

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { NATIVE_STRIP } from '../vite.config.native.js';

const ROOT = resolve(__dirname, '..');

function scorecardSources() {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      if (!m[1].startsWith('.')) continue;
      const base = resolve(dirname(f), m[1]);
      const hit = [base, base + '.js', base + '.jsx', join(base, 'index.js')]
        .find((c) => existsSync(c) && statSync(c).isFile());
      if (hit) walk(hit);
    }
  };
  walk(resolve(ROOT, 'src/main.jsx'));
  return [...seen, resolve(ROOT, 'index.html')];
}

test('nothing Scorecard references is on the strip list', () => {
  const text = scorecardSources().map((f) => readFileSync(f, 'utf8')).join('\n');
  // A folder counts as referenced only as a path ("BBQ Board/..."), not
  // when the app's name appears in copy; a file counts by its file name.
  const needle = (p) => (/\.[a-z0-9]+$/i.test(p) ? [p] : [`${p}/`, `${encodeURI(p)}/`]);
  const used = NATIVE_STRIP.filter((p) => needle(p).some((n) => text.includes(n)));
  expect(used, 'remove these from NATIVE_STRIP, the app uses them').toEqual([]);
});

test('the strip list still covers the OCR blobs and the press art', () => {
  expect(NATIVE_STRIP).toContain('tesseract');
  expect(NATIVE_STRIP).toContain('BBQ Scorecard App Logo');
});
