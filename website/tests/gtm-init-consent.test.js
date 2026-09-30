// Consent behaviour of public/gtm-init.js (COMPLIANCE-DATA-LAW-2026-09-29 L-1).
//
// gtm-init.js is a classic <script>, not a module, so these tests run the
// real file inside a vm sandbox with a stub window/document/localStorage and
// read what it pushed onto dataLayer and what it appended to the body.
//
// What must hold:
//   - Two Consent Mode v2 defaults, in order: region-scoped denied for
//     EEA+UK+CH, then unscoped granted for everyone else. Google applies the
//     region default server-side from the visitor's IP; that is the
//     enforcement layer. The hs_geo cookie only decides whether the banner
//     is shown.
//   - Banner only when hs_geo=eu and no stored choice. Unknown or missing
//     region falls to US behaviour (no banner; Google's region default still
//     denies for an EEA IP, so an edge miss loses data, never collects
//     unlawfully).
//   - A stored choice is re-applied on every page load as a consent update
//     before config, and stored as {choice, timestamp, consentTextVersion}
//     so the grant is demonstrable (GDPR Art. 7(1)).
//   - Banner copy never contains "anonymous" and no forward-looking promise.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const SRC = readFileSync(resolve(__dirname, '../../public/gtm-init.js'), 'utf8');

function makeNode(tag) {
  const node = {
    tagName: tag.toUpperCase(), id: '', children: [], style: {}, attrs: {},
    textContent: '', innerHTML: '', href: '', onclick: null, parentNode: null,
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); },
    addEventListener(type, fn) { if (type === 'click') this.onclick = fn; },
  };
  return node;
}
function findById(node, id) {
  if (node.id === id) return node;
  for (const c of node.children) { const f = findById(c, id); if (f) return f; }
  return null;
}
function allText(node) {
  return [node.textContent, ...node.children.map(allText)].join(' ');
}

function run({ cookie = '', stored = null, group = 'website', host = 'holysmokesbbqco.com' } = {}) {
  const store = new Map();
  if (stored) store.set('hs-consent-v1', JSON.stringify(stored));
  const body = makeNode('body');
  const head = makeNode('head');
  const sandbox = {
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    document: {
      cookie, title: 'Test page', visibilityState: 'visible', head, body,
      currentScript: { dataset: { gaId: 'G-TEST', gaTitle: 'T', gaGroup: group } },
      querySelector: () => null,
      createElement: makeNode,
      addEventListener() {},
    },
    navigator: { userAgent: 'test' },
    addEventListener() {},
    location: { hostname: host },
  };
  sandbox.window = sandbox;
  sandbox.window.location = sandbox.location;
  vm.runInNewContext(SRC, sandbox, { filename: 'gtm-init.js' });
  const calls = (sandbox.dataLayer || []).map(a => Array.from(a));
  const consent = calls.filter(c => c[0] === 'consent');
  return { sandbox, calls, consent, body, store, banner: findById(body, 'hs-consent') };
}

describe('gtm-init consent defaults', () => {
  it('fires a region-scoped denied default for EEA+UK+CH, then an unscoped granted default', () => {
    const { consent } = run();
    const defaults = consent.filter(c => c[1] === 'default');
    expect(defaults.length).toBe(2);
    const [regional, global] = defaults;
    expect(regional[2].analytics_storage).toBe('denied');
    expect(Array.isArray(regional[2].region)).toBe(true);
    for (const cc of ['DE', 'FR', 'IE', 'GB', 'CH', 'NO', 'IS', 'LI']) expect(regional[2].region).toContain(cc);
    expect(regional[2].region).not.toContain('US');
    expect(regional[2].region.length).toBe(32); // 27 EU + IS, LI, NO + GB + CH
    expect(global[2].analytics_storage).toBe('granted');
    expect(global[2].region).toBeUndefined();
    for (const d of defaults) {
      expect(d[2].ad_storage).toBe('denied');
      expect(d[2].ad_user_data).toBe('denied');
      expect(d[2].ad_personalization).toBe('denied');
    }
  });

  it('defaults precede config', () => {
    const { calls } = run();
    const firstConfig = calls.findIndex(c => c[0] === 'config');
    const lastDefault = calls.map((c, i) => (c[0] === 'consent' && c[1] === 'default' ? i : -1)).filter(i => i >= 0).pop();
    expect(firstConfig).toBeGreaterThan(lastDefault);
  });
});

describe('banner display', () => {
  it('shows no banner without a region cookie', () => {
    expect(run().banner).toBeNull();
  });
  it('shows no banner for hs_geo=other or unknown (fails to US behaviour)', () => {
    expect(run({ cookie: 'hs_geo=other' }).banner).toBeNull();
    expect(run({ cookie: 'hs_geo=unknown' }).banner).toBeNull();
  });
  it('shows the banner for hs_geo=eu with no stored choice, and pushes no update', () => {
    const { banner, consent } = run({ cookie: 'a=1; hs_geo=eu; b=2' });
    expect(banner).not.toBeNull();
    expect(consent.filter(c => c[1] === 'update').length).toBe(0);
  });
  it('banner copy has the approved text, a privacy link, and no banned words', () => {
    const { banner } = run({ cookie: 'hs_geo=eu' });
    const text = allText(banner);
    expect(text).toContain('We use Google Analytics to see which pages get used.');
    expect(text).toContain('Say no and everything still works the same.');
    expect(text.toLowerCase()).not.toContain('anonymous');
    expect(text.toLowerCase()).not.toContain('never');
    expect(text.toLowerCase()).not.toContain('nothing is sold');
    const link = findById(banner, 'hs-consent-privacy');
    expect(link.href).toMatch(/privacy/);
    expect(findById(banner, 'hs-consent-yes')).not.toBeNull();
    expect(findById(banner, 'hs-consent-no')).not.toBeNull();
  });
  it('links the privacy policy of the app the page belongs to', () => {
    expect(findById(run({ cookie: 'hs_geo=eu', group: 'notebook' }).banner, 'hs-consent-privacy').href).toBe('/notebook/privacy-notebook.html');
    expect(findById(run({ cookie: 'hs_geo=eu', group: 'board' }).banner, 'hs-consent-privacy').href).toBe('/privacy-board.html');
    expect(findById(run({ cookie: 'hs_geo=eu', group: 'scorecard' }).banner, 'hs-consent-privacy').href).toBe('/privacy.html');
    expect(findById(run({ cookie: 'hs_geo=eu', group: 'website' }).banner, 'hs-consent-privacy').href).toBe('/privacy.html');
  });
});

describe('choices', () => {
  it('accept stores {choice, timestamp, consentTextVersion}, pushes granted, removes the banner', () => {
    const r = run({ cookie: 'hs_geo=eu' });
    findById(r.banner, 'hs-consent-yes').onclick({ preventDefault() {} });
    const saved = JSON.parse(r.store.get('hs-consent-v1'));
    expect(saved.choice).toBe('granted');
    expect(typeof saved.timestamp).toBe('string');
    expect(new Date(saved.timestamp).toString()).not.toBe('Invalid Date');
    expect(saved.consentTextVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const updates = r.consent.filter(c => c[1] === 'update').concat(
      (r.sandbox.dataLayer || []).map(a => Array.from(a)).filter(c => c[0] === 'consent' && c[1] === 'update'));
    expect(updates.some(u => u[2].analytics_storage === 'granted')).toBe(true);
    expect(findById(r.body, 'hs-consent')).toBeNull();
  });
  it('decline stores denied, pushes nothing granted, removes the banner', () => {
    const r = run({ cookie: 'hs_geo=eu' });
    findById(r.banner, 'hs-consent-no').onclick({ preventDefault() {} });
    expect(JSON.parse(r.store.get('hs-consent-v1')).choice).toBe('denied');
    const later = (r.sandbox.dataLayer || []).map(a => Array.from(a)).filter(c => c[0] === 'consent' && c[1] === 'update');
    expect(later.some(u => u[2].analytics_storage === 'granted')).toBe(false);
    expect(findById(r.body, 'hs-consent')).toBeNull();
  });
  it('re-applies a stored grant on the next load as an update before config, with no banner', () => {
    const r = run({ cookie: 'hs_geo=eu', stored: { choice: 'granted', timestamp: '2026-09-29T00:00:00Z', consentTextVersion: '2026-09-29' } });
    expect(r.banner).toBeNull();
    const idxUpdate = r.calls.findIndex(c => c[0] === 'consent' && c[1] === 'update' && c[2].analytics_storage === 'granted');
    const idxConfig = r.calls.findIndex(c => c[0] === 'config');
    expect(idxUpdate).toBeGreaterThan(-1);
    expect(idxUpdate).toBeLessThan(idxConfig);
  });
  it('re-applies a stored denial with no banner', () => {
    const r = run({ cookie: 'hs_geo=eu', stored: { choice: 'denied', timestamp: '2026-09-29T00:00:00Z', consentTextVersion: '2026-09-29' } });
    expect(r.banner).toBeNull();
    expect(r.calls.some(c => c[0] === 'consent' && c[1] === 'update' && c[2].analytics_storage === 'granted')).toBe(false);
  });
  it('ignores a malformed stored value and shows the banner', () => {
    const store = { choice: 'maybe' };
    expect(run({ cookie: 'hs_geo=eu', stored: store }).banner).not.toBeNull();
  });
});
