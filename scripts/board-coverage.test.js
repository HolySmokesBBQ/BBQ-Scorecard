import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { boardCoverage, fillCoverageTokens, COVERAGE_TOKENS } from './board-coverage.mjs';
import { CITIES } from '../src/board/schema.js';

const ROOT = resolve(__dirname, '..');

test('counts cities and distinct states from schema CITIES', () => {
  const c = boardCoverage({
    a: { label: 'A', state: 'WI' }, b: { label: 'B', state: 'WI' }, c: { label: 'C', state: 'TX' },
  });
  expect(c).toEqual({ cityCount: 3, stateCount: 2 });
});

test('fills every token and leaves no token behind', () => {
  const html = `<p>${COVERAGE_TOKENS.cities} cities in ${COVERAGE_TOKENS.states} states</p>`;
  expect(fillCoverageTokens(html, { cityCount: 109, stateCount: 24 })).toBe('<p>109 cities in 24 states</p>');
});

// No fixed numbers here: the count is meant to move as cities are added.
test('the real schema yields a sane coverage', () => {
  const { cityCount, stateCount } = boardCoverage(CITIES);
  expect(cityCount).toBeGreaterThan(stateCount);
  expect(stateCount).toBeGreaterThan(1);
});

// Ruling of record (auditor, 2026-10-23): schema.js at build time is the
// single source of truth for Board's counts. The native pre-render carries
// tokens, never a hand-typed city list or count.
test('index.board.html pre-render uses the tokens, not a hand-typed city list', () => {
  const html = readFileSync(resolve(ROOT, 'index.board.html'), 'utf8');
  expect(html).toContain(COVERAGE_TOKENS.cities);
  expect(html).toContain(COVERAGE_TOKENS.states);
  expect(html).not.toMatch(/Launched with coverage in/);
  expect(html).not.toMatch(/Milwaukee, WI · Waukesha, WI/);
});

// Auditor 2026-10-23: the native page's pre-render repeated stale website
// SEO copy. It now carries no claims at all; keep it that way.
test('index.board.html makes no price, "cheapest" or Google-only claims', () => {
  const html = readFileSync(resolve(ROOT, 'index.board.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  expect(html).not.toMatch(/cheap/i);
  expect(html).not.toMatch(/\$\d/);
  expect(html).not.toMatch(/sign(ing)? in with google/i);
});
