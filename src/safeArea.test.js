// Pins the status-bar fix (2026-10-12). Scorecard's page uses
// viewport-fit=cover (needed for notched iPhones), so on Android 15+
// Capacitor passes the insets through and injects --safe-area-inset-*;
// Android WebViews don't reliably fill env() there. Reading env() alone put
// the menu button under the status bar. These tests fail if any of the
// fixed-position pieces goes back to env()-only.

import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SAFE_TOP, SAFE_BOTTOM, belowTop, aboveBottom } from './safeArea.js';

const ROOT = resolve(__dirname, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test("the inset is the larger of Capacitor's injected variable and env()", () => {
  expect(SAFE_TOP).toBe('var(--safe-area-top, max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)))');
  expect(SAFE_BOTTOM).toBe('var(--safe-area-bottom, max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))');
  expect(SAFE_BOTTOM).toContain('--safe-area-inset-bottom');
  expect(belowTop('10px')).toBe(`calc(${SAFE_TOP} + 10px)`);
  expect(aboveBottom('24px')).toBe(`calc(${SAFE_BOTTOM} + 24px)`);
});

test('index.html pads #root with the same chain', () => {
  const html = read('index.html');
  expect(html).toMatch(/viewport-fit=cover/);
  const rule = html.match(/#root\s*\{[^}]*\}/)[0];
  expect(rule).toContain(`padding-top: ${SAFE_TOP}`);
});

test('the menu button, drawer header and + button all clear the bars', () => {
  expect(read('src/components/AppNav.jsx')).toMatch(/top:\s*belowTop\(/);
  expect(read('src/components/NavDrawer.jsx')).toMatch(/paddingTop:\s*belowTop\(/);
  expect(read('src/components/Home.jsx')).toMatch(/bottom:\s*aboveBottom\(/);
  // First-run onboarding: its Skip button sat inside the status bar.
  const onb = read('src/components/ScorecardOnboarding.jsx');
  expect(onb).toMatch(/paddingTop:\s*belowTop\(/);
  expect(onb).toMatch(/paddingBottom:\s*aboveBottom\(/);
});

test('no Scorecard screen reads the top inset from env() alone', () => {
  for (const f of ['src/components/AppNav.jsx', 'src/components/NavDrawer.jsx', 'src/components/Home.jsx', 'src/components/ScorecardOnboarding.jsx']) {
    expect(read(f)).not.toMatch(/['"`]calc\(env\(safe-area-inset/);
  }
});
