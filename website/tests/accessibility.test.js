// Accessibility gate for the static website pages (legal register
// 2026-10-14 #9). Runs axe-core inside jsdom over every landing and
// compliance page. jsdom has no layout engine, so the rules that need
// rendered geometry or computed colors (contrast, target size, scrolling)
// are left to the browser Delivery Gate; everything structural (names,
// roles, labels, landmarks, headings, language, duplicate ids) fails here.
//
// Serious or critical violations fail the suite. Moderate and minor are
// printed so they are visible, not swept under the rug.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ROOT = resolve(__dirname, '../..');

const LANDING = ['index.html', 'pit.html', 'episodes.html', 'about.html', 'game.html'].map(f => resolve(ROOT, 'website/public-landing', f));
const COMPLIANCE = ['privacy.html', 'privacy-notebook.html', 'privacy-board.html', 'delete-account.html', 'delete-account-notebook.html', 'delete-account-board.html', 'changelog.html', 'changelog-notebook.html', 'support.html', 'accessibility.html', '404.html'].map(f => resolve(ROOT, 'public', f));
const SEO = ['board-cities', 'calculator-guests'].flatMap(d => readdirSync(resolve(ROOT, 'website/public-landing', d)).filter(f => f.endsWith('.html') && !f.startsWith('_')).map(f => resolve(ROOT, 'website/public-landing', d, f)));

const SKIP = ['color-contrast', 'target-size', 'scrollable-region-focusable', 'region'];

async function audit(file) {
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.eval(axeSource);
  const results = await window.axe.run(window.document, {
    rules: Object.fromEntries(SKIP.map(r => [r, { enabled: false }])),
    resultTypes: ['violations'],
  });
  window.close();
  return results.violations;
}

function describeViolations(v) {
  return v.map(x => `${x.impact}: ${x.id} (${x.nodes.length}) ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`).join('\n');
}

describe('axe-core, static pages', () => {
  for (const file of [...LANDING, ...COMPLIANCE, ...SEO]) {
    const name = file.replace(ROOT, '').replace(/\\/g, '/');
    it(`${name} has no serious or critical violations`, async () => {
      const v = await audit(file);
      const bad = v.filter(x => x.impact === 'serious' || x.impact === 'critical');
      const soft = v.filter(x => !bad.includes(x));
      if (soft.length) console.log(`[axe minor/moderate] ${name}\n${describeViolations(soft)}`);
      expect(bad, describeViolations(bad)).toHaveLength(0);
    }, 20000);
  }
});
