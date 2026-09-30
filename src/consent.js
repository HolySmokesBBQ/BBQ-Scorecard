// Analytics consent: the single gate every analytics collector goes through.
//
// Nothing is collected until the user says yes. Until then the Google tag
// (gtm-init.js) is never loaded, so no request reaches Google at all, and
// track()/trackPageView()/setGaContext() in scoring.js are no-ops. The
// native Firebase Analytics SDK is switched off at the platform level
// (AndroidManifest meta-data / Info.plist) because it starts collecting
// before any of this JavaScript runs.
//
// Crash reporting (Crashlytics) is not gated here: it runs under
// legitimate interest and is disclosed in the privacy policy.
//
// Written app-agnostic so Notebook and Board can adopt it unchanged.
// Audit 2026-09-29, finding L-1.

export const CONSENT_KEY = 'hs-analytics-consent';

// Bump when the consent card's wording changes materially. Records made
// under an older version stop counting, so the user is asked again.
export const CONSENT_TEXT_VERSION = 1;

const listeners = new Set();
let loaderInjected = false;

// { choice: 'granted' | 'denied', at: ISO string, textVersion } or null.
export function getConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || (rec.choice !== 'granted' && rec.choice !== 'denied')) return null;
    if (rec.textVersion !== CONSENT_TEXT_VERSION) return null;
    return rec;
  } catch {
    return null;
  }
}

export function analyticsAllowed() {
  return getConsent()?.choice === 'granted';
}

export function setConsent(choice) {
  const rec = { choice, at: new Date().toISOString(), textVersion: CONSENT_TEXT_VERSION };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(rec)); } catch {}
  if (choice === 'granted') startAnalyticsIfAllowed();
  else stopAnalytics();
  listeners.forEach(fn => { try { fn(rec); } catch {} });
  return rec;
}

export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Inject the Google tag loader, once, and only with consent on record.
// Page config comes from the window.GA_* values the entry HTML sets.
export function startAnalyticsIfAllowed() {
  if (!analyticsAllowed() || loaderInjected) return;
  if (typeof document === 'undefined') return;
  const id = window.GA_MEASUREMENT_ID;
  if (id) window[`ga-disable-${id}`] = false;
  const s = document.createElement('script');
  s.src = '/gtm-init.js?v=7';
  s.defer = true;
  if (id) s.dataset.gaId = id;
  if (window.GA_PAGE_TITLE) s.dataset.gaTitle = window.GA_PAGE_TITLE;
  if (window.GA_CONTENT_GROUP) s.dataset.gaGroup = window.GA_CONTENT_GROUP;
  document.head.appendChild(s);
  loaderInjected = true;
}

// Withdrawal. If the tag already loaded this session, disable it and deny
// storage so it stops sending; on the next launch it is not loaded at all.
function stopAnalytics() {
  if (typeof window === 'undefined') return;
  const id = window.GA_MEASUREMENT_ID;
  if (id) window[`ga-disable-${id}`] = true;
  try { window.gtag?.('consent', 'update', { analytics_storage: 'denied' }); } catch {}
  try {
    document.cookie.split(';').map(c => c.trim().split('=')[0])
      .filter(n => /^_ga/.test(n))
      .forEach(n => { document.cookie = `${n}=; Max-Age=0; path=/`; });
  } catch {}
}

// Defence in depth: no event payload carries an email address, whatever
// consent says. Values are only rewritten when they contain one.
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
export function scrubParams(params) {
  if (!params) return params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = typeof v === 'string' ? v.replace(EMAIL_RE, '[redacted]') : v;
  }
  return out;
}
