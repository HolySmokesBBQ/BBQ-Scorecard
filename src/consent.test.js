import { describe, test, expect, beforeEach, vi } from 'vitest';

// Minimal browser stand-ins: consent.js touches localStorage, document
// (to inject the analytics loader) and window flags.
function freshEnv() {
  const store = new Map();
  const appended = [];
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.window = { GA_MEASUREMENT_ID: 'G-TEST', GA_PAGE_TITLE: 'T', GA_CONTENT_GROUP: 'scorecard' };
  globalThis.document = {
    cookie: '',
    createElement: () => ({ dataset: {} }),
    head: { appendChild: (el) => appended.push(el) },
    querySelector: () => null,
  };
  return { store, appended };
}

let consent, env;
beforeEach(async () => {
  env = freshEnv();
  vi.resetModules();
  consent = await import('./consent.js');
});

describe('consent record', () => {
  test('no answer yet means analytics is not allowed', () => {
    expect(consent.getConsent()).toBeNull();
    expect(consent.analyticsAllowed()).toBe(false);
  });

  test('records choice, timestamp and text version, not a bare boolean', () => {
    consent.setConsent('granted');
    const rec = JSON.parse(env.store.get(consent.CONSENT_KEY));
    expect(rec.choice).toBe('granted');
    expect(rec.textVersion).toBe(consent.CONSENT_TEXT_VERSION);
    expect(typeof rec.at).toBe('string');
    expect(consent.analyticsAllowed()).toBe(true);
  });

  test('a record from an older consent text does not count', () => {
    env.store.set(consent.CONSENT_KEY, JSON.stringify({ choice: 'granted', at: '2026-01-01T00:00:00Z', textVersion: consent.CONSENT_TEXT_VERSION - 1 }));
    expect(consent.getConsent()).toBeNull();
    expect(consent.analyticsAllowed()).toBe(false);
  });

  test('garbage in storage is treated as unanswered', () => {
    env.store.set(consent.CONSENT_KEY, '{not json');
    expect(consent.getConsent()).toBeNull();
  });
});

describe('analytics loader', () => {
  test('nothing is injected before consent', () => {
    consent.startAnalyticsIfAllowed();
    expect(env.appended).toHaveLength(0);
  });

  test('granting injects the loader exactly once, carrying the page config', () => {
    consent.setConsent('granted');
    consent.startAnalyticsIfAllowed();
    expect(env.appended).toHaveLength(1);
    expect(env.appended[0].src).toMatch(/gtm-init\.js/);
    expect(env.appended[0].dataset.gaId).toBe('G-TEST');
  });

  test('declining never injects and withdrawing disables the loaded tag', () => {
    consent.setConsent('denied');
    consent.startAnalyticsIfAllowed();
    expect(env.appended).toHaveLength(0);
    consent.setConsent('granted');
    expect(env.appended).toHaveLength(1);
    consent.setConsent('denied');
    expect(window['ga-disable-G-TEST']).toBe(true);
    expect(consent.analyticsAllowed()).toBe(false);
  });
});

describe('scrubParams', () => {
  test('redacts anything shaped like an email, leaves the rest alone', () => {
    expect(consent.scrubParams({ reason: 'no account for pat@example.com', count: 3, restaurant: 'Kewpie' }))
      .toEqual({ reason: 'no account for [redacted]', count: 3, restaurant: 'Kewpie' });
  });
});
