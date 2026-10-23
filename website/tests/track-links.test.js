// track-links.js: the website's click events for the weekly brief. This test
// is the sender inventory: the exact event names and parameter keys the file
// can emit are asserted here, so a change to the inventory fails a test and
// gets read against the consent text before it ships (analytics audit
// 2026-10-23, auditor ruling 2026-10-23: fixed labels only, no PII).

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = resolve(__dirname, '../..');
const SRC = readFileSync(resolve(ROOT, 'website/public-landing/track-links.js'), 'utf8');

const PAGE = `<!doctype html><html><body>
  <a id="store" href="https://play.google.com/store/apps/details?id=x" data-track="app_store_click" data-app="scorecard" data-store="google_play" data-placement="apps_grid"><img id="badge" alt=""></a>
  <a id="apple" href="https://apps.apple.com/us/app/x" data-track="app_store_click" data-app="scorecard" data-store="app_store" data-placement="apps_grid">App Store</a>
  <a id="launch" href="/board/" data-track="app_launch_click" data-app="board" data-placement="apps_grid">Launch Board</a>
  <a id="still" href="https://youtu.be/abc" data-track="episode_click" data-episode="ep3" data-placement="still">still</a>
  <a id="sub" href="https://www.youtube.com/@x" data-track="episode_click" data-episode="channel" data-placement="subscribe">Subscribe</a>
  <a id="plain" href="/pit">no tracking</a>
  <a id="badvalue" href="/x" data-track="app_launch_click" data-app="hacked?user=1" data-placement="apps_grid">bad</a>
  <a id="missing" href="/x" data-track="app_store_click" data-app="board" data-placement="apps_grid">no store</a>
  <a id="badevent" href="/x" data-track="purchase" data-app="board" data-placement="apps_grid">bad event</a>
</body></html>`;

function boot({ withGtag = true } = {}) {
  const dom = new JSDOM(PAGE, { runScripts: 'outside-only', url: 'https://holysmokesbbqco.com/' });
  const { window } = dom;
  const calls = [];
  if (withGtag) window.gtag = (...args) => calls.push(args);
  // jsdom does not navigate; swallow the default action so no console noise.
  window.addEventListener('click', e => e.preventDefault(), true);
  window.eval(SRC);
  const click = id => window.document.getElementById(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return { window, calls, click };
}

describe('track-links.js', () => {
  let t;
  beforeEach(() => { t = boot(); });

  it('sends exactly the documented events with exactly the documented keys', () => {
    t.click('store'); t.click('apple'); t.click('launch'); t.click('still'); t.click('sub');
    expect(t.calls).toEqual([
      ['event', 'app_store_click', { app: 'scorecard', store: 'google_play', placement: 'apps_grid' }],
      ['event', 'app_store_click', { app: 'scorecard', store: 'app_store', placement: 'apps_grid' }],
      ['event', 'app_launch_click', { app: 'board', placement: 'apps_grid' }],
      ['event', 'episode_click', { episode: 'ep3', placement: 'still' }],
      ['event', 'episode_click', { episode: 'channel', placement: 'subscribe' }],
    ]);
  });

  it('inventory: only three event names, only these parameter keys, never a URL or id', () => {
    t.click('store'); t.click('launch'); t.click('still');
    const names = new Set(t.calls.map(c => c[1]));
    expect([...names].sort()).toEqual(['app_launch_click', 'app_store_click', 'episode_click']);
    const keys = new Set(t.calls.flatMap(c => Object.keys(c[2])));
    expect([...keys].sort()).toEqual(['app', 'episode', 'placement', 'store']);
    for (const c of t.calls) for (const v of Object.values(c[2])) expect(v).toMatch(/^[a-z0-9_]+$/);
  });

  it('a click inside the anchor (the badge image) still attributes to the anchor', () => {
    t.click('badge');
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0][1]).toBe('app_store_click');
  });

  it('sends nothing for links without data-track', () => {
    t.click('plain');
    expect(t.calls).toEqual([]);
  });

  it('drops an unknown value, a missing required key, and an unknown event name', () => {
    t.click('badvalue'); t.click('missing'); t.click('badevent');
    expect(t.calls).toEqual([]);
  });

  it('does nothing when window.gtag is absent (consent model never bypassed)', () => {
    const q = boot({ withGtag: false });
    expect(() => q.click('store')).not.toThrow();
    expect(q.calls).toEqual([]);
  });
});

describe('the pages carry the attributes the brief needs', () => {
  const home = readFileSync(resolve(ROOT, 'website/public-landing/index.html'), 'utf8');
  const episodes = readFileSync(resolve(ROOT, 'website/public-landing/episodes.html'), 'utf8');

  it('homepage: four store badges, four launch links, hero and card episode links, the script tag', () => {
    expect(home.match(/data-track="app_store_click"/g)).toHaveLength(4);
    expect(home.match(/data-track="app_launch_click"/g)).toHaveLength(4);
    expect(home.match(/data-track="episode_click"/g)).toHaveLength(3);
    expect(home).toMatch(/<script src="\/track-links\.js\?v=\d+" defer><\/script>/);
  });

  it('episodes: a still and a button per episode, the subscribe link, the script tag', () => {
    const stills = (episodes.match(/data-placement="still"/g) || []).length;
    const buttons = (episodes.match(/data-placement="button"/g) || []).length;
    expect(stills).toBeGreaterThanOrEqual(3);
    expect(buttons).toBe(stills);
    expect(episodes).toMatch(/data-episode="channel" data-placement="subscribe"/);
    expect(episodes).toMatch(/<script src="\/track-links\.js\?v=\d+" defer><\/script>/);
  });
});
