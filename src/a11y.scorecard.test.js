// Accessibility guard for Scorecard's screens (legal register #9,
// 2026-10-14). A WCAG pass found sign-in fields with no label, clickable
// <div>s a keyboard can't reach, and a removed focus outline. This walks
// every component reachable from src/main.jsx and fails if any of those
// come back:
//   - an <input>/<select>/<textarea> with no aria-label, aria-labelledby or
//     id (placeholder text is not a label; it disappears as you type)
//   - a <div>/<span> with onClick but no role (keyboard users can't reach
//     it, screen readers don't announce it), except modal backdrops, which
//     close on a tap outside and always have a real close button
//   - an inline outline: 'none', which beats index.html's :focus-visible ring

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { pressable } from './a11y.js';

const ROOT = resolve(__dirname, '..');
const norm = (p) => p.split(sep).join('/');
const rel = (p) => norm(p).replace(norm(ROOT) + '/', '');

function reachableJsx() {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      if (!m[1].startsWith('.')) continue;
      const base = resolve(dirname(f), m[1]);
      const hit = [base, base + '.js', base + '.jsx', join(base, 'index.js'), join(base, 'index.jsx')]
        .find((c) => existsSync(c) && statSync(c).isFile());
      if (hit) walk(hit);
    }
  };
  walk(resolve(ROOT, 'src/main.jsx'));
  return [...seen].filter((f) => f.endsWith('.jsx') && !f.includes('.test.'));
}

// Opening tags of the given element names, read with brace counting so a
// `=>` inside an attribute doesn't end the tag early.
function openingTags(src, names) {
  const out = [];
  const re = new RegExp(`<(${names.join('|')})\\b`, 'g');
  for (const m of src.matchAll(re)) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ name: m[1], text: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

// A dialog panel whose only onClick stops a tap from reaching the backdrop
// behind it isn't a control.
const onlyStopsPropagation = (tag) => /onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(tag);

const isBackdrop = (tag) =>
  /currentTarget/.test(tag) || /inset:\s*0/.test(tag) || /position:\s*'fixed'[\s\S]*?(top:\s*0|inset)/.test(tag);

test('the walk reaches the screens it is guarding', () => {
  const files = reachableJsx().map(rel);
  expect(files).toContain('src/components/EmailSignInBox.jsx');
  expect(files).toContain('src/components/ReviewForm.jsx');
  expect(files.length).toBeGreaterThan(20);
});

test('every form field has an accessible name', () => {
  const bad = [];
  for (const f of reachableJsx()) {
    for (const t of openingTags(readFileSync(f, 'utf8'), ['input', 'select', 'textarea'])) {
      if (/type="(hidden|file)"/.test(t.text)) continue;
      if (/aria-label|aria-labelledby|\bid=/.test(t.text)) continue;
      // A checkbox wrapped in a <label> with text is named by that label.
      if (/type="checkbox"/.test(t.text)) continue;
      bad.push(`${rel(f)}:${t.line} <${t.name}>`);
    }
  }
  expect(bad, 'add aria-label (the visible label text) to these fields').toEqual([]);
});

test('nothing clickable is a bare div or span', () => {
  const bad = [];
  for (const f of reachableJsx()) {
    for (const t of openingTags(readFileSync(f, 'utf8'), ['div', 'span'])) {
      if (!/onClick=|onMouseDown=/.test(t.text) && !/pressable\(/.test(t.text)) continue;
      if (/pressable\(/.test(t.text)) continue;
      if (/role=/.test(t.text)) continue;
      if (isBackdrop(t.text) || onlyStopsPropagation(t.text)) continue;
      bad.push(`${rel(f)}:${t.line} <${t.name}>`);
    }
  }
  expect(bad, 'use pressable() from src/a11y.js, or a <button>').toEqual([]);
});

test('no inline outline: none anywhere in the Scorecard graph', () => {
  const bad = reachableJsx().filter((f) => /outline:\s*['"]?none|outline:\s*0\b/.test(readFileSync(f, 'utf8'))).map(rel);
  expect(bad).toEqual([]);
  expect(readFileSync(resolve(ROOT, 'index.html'), 'utf8')).toMatch(/:focus-visible\s*\{\s*outline:/);
});

test('pressable() gives role, tab focus, and Enter/Space activation', () => {
  let hits = 0;
  const p = pressable(() => { hits++; }, 'Open');
  expect(p.role).toBe('button');
  expect(p.tabIndex).toBe(0);
  expect(p['aria-label']).toBe('Open');
  const ev = (key) => ({ key, preventDefault() {} });
  p.onKeyDown(ev('Enter'));
  p.onKeyDown(ev(' '));
  p.onKeyDown(ev('a'));
  p.onClick();
  expect(hits).toBe(3);
});
