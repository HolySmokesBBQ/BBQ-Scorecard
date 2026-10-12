// Board positions against the screen edges with --sa-top / --sa-bottom,
// defined once in index.board.html as the larger of Capacitor's
// --safe-area-inset-* (set on Android 15+, where WebView env() can read 0)
// and env(safe-area-inset-*) (iOS). A bare env() put the menu button under
// the status bar on Joel's new Android phone (2026-10-13). This fails if one
// creeps back into Board's native source.

import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const files = [
  'src/App.board.jsx',
  'src/components/BoardHamburger.jsx',
  ...readdirSync(resolve(ROOT, 'src/board')).filter(f => /\.jsx?$/.test(f) && !f.includes('.test.')).map(f => join('src/board', f)),
];

test('Board source uses --sa-top/--sa-bottom, not bare env(safe-area-inset-*)', () => {
  const bare = files.filter(f => /env\(\s*safe-area-inset/.test(readFileSync(resolve(ROOT, f), 'utf8')));
  expect(bare).toEqual([]);
});

test('index.board.html defines both from Capacitor vars and env()', () => {
  const html = readFileSync(resolve(ROOT, 'index.board.html'), 'utf8');
  expect(html).toMatch(/--sa-top:\s*max\(var\(--safe-area-inset-top, 0px\), env\(safe-area-inset-top, 0px\)\)/);
  expect(html).toMatch(/--sa-bottom:\s*max\(var\(--safe-area-inset-bottom, 0px\), env\(safe-area-inset-bottom, 0px\)\)/);
  expect(html).toMatch(/viewport-fit=cover/);
});
