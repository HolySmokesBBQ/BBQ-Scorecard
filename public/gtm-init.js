/* GTM + GA4 initialization.
   Extracted from index.html inline scripts so the CSP no longer needs
   `script-src 'unsafe-inline'` (Security Audit Finding #5). Loaded from
   /gtm-init.js which is same-origin and matches `script-src 'self'`.

   Per-page GA config (measurement ID, page title, content group) is read
   from data-* attributes on THIS script tag — not from inline
   `window.GA_*` scripts, which the CSP (no 'unsafe-inline') silently
   blocks. That block is why website content_group was always 'unknown'
   and per-app pages fell back to the shared measurement ID (found
   2026-07-22). Entry HTML now uses:
     <script src="/gtm-init.js?v=8"
             data-ga-id="G-XXXX" data-ga-title="…" data-ga-group="…">
   The window.GA_* reads are kept as a fallback for any page not yet
   migrated, then a hardcoded shared-property fallback last. */

// Read config off this script's own tag. currentScript is null for
// deferred/async scripts in some engines, so fall back to querying for
// the gtm-init tag by src — deterministic regardless of load mode.
var _gaCfg = (function () {
  var s = document.currentScript
    || document.querySelector('script[src*="gtm-init"]')
    || {};
  var d = s.dataset || {};
  return {
    id:    d.gaId    || (typeof window !== 'undefined' && window.GA_MEASUREMENT_ID) || 'G-7X235L8GQS',
    title: d.gaTitle || (typeof window !== 'undefined' && window.GA_PAGE_TITLE) || null,
    group: d.gaGroup || (typeof window !== 'undefined' && window.GA_CONTENT_GROUP) || 'unknown',
  };
})();

// Skip analytics on Netlify deploy-preview URLs (e.g.
// 6a1d99…--holysmokesbbqco.netlify.app). Each preview gets a unique
// hostname so they pollute GA's "additional domains" detection and
// inflate event counts without representing real users. The production
// site is holysmokesbbqco.com — the only hostname we want to measure.
if (typeof window !== 'undefined' && /\.netlify\.app$/i.test(window.location.hostname)) {
  // Stub gtag so calls in app code don't error, but no data is sent.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { /* no-op on preview URLs */ };
} else {

// ── Consent Mode v2 (COMPLIANCE-DATA-LAW-2026-09-29, L-1) ──────────
// Must fire BEFORE any gtag config so the consent state is known when
// tags initialize (undeclared consent = denied, beacons silently dropped).
//
// Two defaults, in this order:
//   1. region-scoped: analytics DENIED for EEA + UK + Switzerland until the
//      visitor says yes. Google applies this server-side from the visitor's
//      IP. THIS is the enforcement layer.
//   2. unscoped: analytics granted everywhere else (US behaviour unchanged).
// Ad signals stay denied everywhere; the site runs no ads.
//
// The banner is display only. It shows when the hs_geo cookie (set by
// netlify/edge-functions/geo-region.js) says "eu" and no choice is stored.
// If the cookie is missing or "unknown" the page behaves like the US:
// no banner. That is deliberate: an edge miss for an EEA visitor leaves
// analytics_storage denied at Google's end via default #1, so the failure
// mode is lost data, never unlawful collection.
//
// A stored choice ({choice, timestamp, consentTextVersion}, kept so the
// grant is demonstrable under GDPR Art. 7(1)) is re-applied on every page
// load as a consent update, before config. A choice recorded against an
// older consentTextVersion is treated as unanswered: the wording changed
// (2026-10-01 it grew an Adobe font clause; 2026-10-12 that clause left again). Keep EEA_UK_CH in sync with the
// edge function.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

var EEA_UK_CH = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
  'US-CA', // California (legal register 2026-10-14 #11): CIPA demand-letter economics; denied by default like the EEA, banner shown, withdrawal link everywhere else in the US
];
var CONSENT_KEY = 'hs-consent-v1';
// Bump when the banner wording changes, so a stored grant can be tied to
// the exact text the visitor saw.
var CONSENT_TEXT_VERSION = '2026-10-01'; // 2026-10-12: Adobe clause removed again (font is self-hosted now); version kept, a shorter disclosure needs no re-ask

gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  region: EEA_UK_CH,
  wait_for_update: 500,
});
gtag('consent', 'default', {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});

function _readConsent() {
  try {
    var raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    var v = JSON.parse(raw);
    if (!v || (v.choice !== 'granted' && v.choice !== 'denied')) return null;
    if (v.consentTextVersion !== CONSENT_TEXT_VERSION) return null;
    return v;
  } catch (e) { return null; }
}
function _writeConsent(choice) {
  var v = { choice: choice, timestamp: new Date().toISOString(), consentTextVersion: CONSENT_TEXT_VERSION };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(v)); } catch (e) {}
  return v;
}
function _applyConsent(choice) {
  gtag('consent', 'update', { analytics_storage: choice });
  if (choice === 'denied') _stopAnalytics();
}
// Withdrawal has to bite, not just be recorded (GDPR Art. 7(3)): flag the
// tag off for this page and expire every _ga* cookie on both the host and
// the apex domain. Same discipline as the apps' stopAnalytics().
function _stopAnalytics() {
  try { window['ga-disable-' + _gaCfg.id] = true; } catch (e) {}
  try {
    var names = (document.cookie || '').split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid'; });
    var host = (location.hostname || '').replace(/^www./, '');
    var domains = ['', host, '.' + host];
    for (var i = 0; i < names.length; i++) for (var j = 0; j < domains.length; j++) {
      document.cookie = names[i] + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (domains[j] ? '; domain=' + domains[j] : '') + '; SameSite=Lax; Secure';
    }
  } catch (e) {}
}
function _geoRegion() {
  var m = /(?:^|;\s*)hs_geo=([a-z]+)/.exec(document.cookie || '');
  return m ? m[1] : null;
}
// The policy for the app this page belongs to (data-ga-group on the tag).
function _privacyHref(group) {
  if (group === 'notebook') return '/notebook/privacy-notebook.html';
  if (group === 'board') return '/privacy-board.html';
  return '/privacy.html';
}

var _stored = _readConsent();
if (_stored) _applyConsent(_stored.choice);

// Minimal self-built banner. Inline styles only (CSP allows 'unsafe-inline'
// for style-src, and no third-party CMP script is loaded). Equal-weight
// buttons; the page is fully usable behind it either way.
function _showConsentBanner() {
  var el = function (tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text) n.textContent = text;
    return n;
  };
  var wrap = el('div',
    'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:14px 16px;' +
    'background:#1f1f1f;color:#f5e6d3;border-top:1px solid #3a3a3a;' +
    'font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
    'box-shadow:0 -4px 16px rgba(0,0,0,.4)');
  wrap.id = 'hs-consent';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'Analytics consent');
  var inner = el('div', 'max-width:720px;margin:0 auto;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between');
  var text = el('p', 'margin:0;flex:1 1 320px');
  text.textContent = 'We use Google Analytics to see which pages get used. Say no and everything still works the same. ';
  var link = el('a', 'color:#d4a64a;text-decoration:underline', 'Privacy policy');
  link.id = 'hs-consent-privacy';
  link.href = _privacyHref(_gaCfg.group);
  text.appendChild(link);
  var btns = el('div', 'display:flex;gap:10px;flex:0 0 auto');
  var btnCss = 'font:inherit;font-weight:600;padding:10px 18px;border-radius:8px;cursor:pointer;' +
    'background:#2b2b2b;color:#f5e6d3;border:1px solid #777;min-width:120px';
  var no = el('button', btnCss, 'No thanks');
  no.id = 'hs-consent-no';
  no.type = 'button';
  var yes = el('button', btnCss, 'Yes, that\'s fine');
  yes.id = 'hs-consent-yes';
  yes.type = 'button';
  function choose(choice) {
    return function (e) {
      if (e && e.preventDefault) e.preventDefault();
      _writeConsent(choice);
      _applyConsent(choice);
      if (choice === 'granted') { try { window['ga-disable-' + _gaCfg.id] = false; } catch (err) {} _loadGtag(); }
      // Kept for any page script that wants to react to a choice (nothing listens today; the Adobe loader is gone).
      try { window.dispatchEvent(new CustomEvent('hs-consent', { detail: { choice: choice } })); } catch (e) {}
      gtag('event', 'consent_choice', { choice: choice, content_group: _gaCfg.group });
      wrap.remove();
    };
  }
  no.addEventListener('click', choose('denied'));
  yes.addEventListener('click', choose('granted'));
  btns.appendChild(no);
  btns.appendChild(yes);
  inner.appendChild(text);
  inner.appendChild(btns);
  wrap.appendChild(inner);
  document.body.appendChild(wrap);
}
if (!_stored && _geoRegion() === 'eu') {
  // This script is deferred, so body exists; guard anyway for odd loaders.
  if (document.body) _showConsentBanner();
  else document.addEventListener('DOMContentLoaded', _showConsentBanner);
}
// "Analytics choices" (footer link on every page that loads this script):
// forget the stored choice and show the same banner again, so a visitor
// can withdraw a grant, or opt out where analytics runs by default.
function _openAnalyticsChoices(e) {
  if (e && e.preventDefault) e.preventDefault();
  try { localStorage.removeItem(CONSENT_KEY); } catch (err) {}
  if (!document.getElementById('hs-consent')) _showConsentBanner();
}
window.hsAnalyticsChoices = _openAnalyticsChoices;
document.addEventListener('click', function (e) {
  var t = e.target;
  while (t && t !== document) {
    if (t.getAttribute && t.hasAttribute('data-analytics-choices')) return _openAnalyticsChoices(e);
    t = t.parentNode;
  }
});

// Per-app measurement ID from the script tag's data-ga-id (see _gaCfg).
// Falls back to the shared website property when no override is present.
var MID = _gaCfg.id;

// Google Analytics 4 (gtag.js) — load via the Google tag ID (the only
// ID that returns 200 from googletagmanager.com/gtag/js).
//
// The shared-website fallback is the GOOGLE TAG ID for the 'Holy Smokes
// Website' stream: G-7X235L8GQS — note the trailing letter S, not the
// digit 5. G-7X235L8GQ5 (digit 5) is a DIFFERENT live tag that routes
// nowhere useful; this codebase carried that typo and sent every website
// page view to the wrong tag. Verified 2026-08-17 by fetching each tag's
// gtag.js: only G-7X235L8GQS / GT-NM8C5HG9 embed the stream's Measurement
// ID G-5JZJ75VWR3. Do NOT use G-5JZJ75VWR3 itself here — gtag/js?id= for
// a bare Measurement ID returns 404 and nothing is collected.
var _gtagLoaded = false;
function _loadGtag() {
  if (_gtagLoaded) return;
  _gtagLoaded = true;
  var gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + MID;
  document.head.appendChild(gtagScript);
}
// Basic consent mode: no Google script at all until there is a basis for it.
// Outside EEA/UK/CH analytics runs by default (disclosed in every policy);
// inside, only a stored grant loads the tag. Events pushed before the tag
// loads sit in dataLayer and are honoured if a grant follows.
if (_geoRegion() !== 'eu' ? !(_stored && _stored.choice === 'denied') : !!(_stored && _stored.choice === 'granted')) _loadGtag();

window.gtag = gtag;
gtag('js', new Date());

gtag('config', MID, {
  page_title: _gaCfg.title || document.title,
  content_group: _gaCfg.group,
});

// Global exception tracking. GA4 has a built-in 'exception' event type;
// firing it from window.onerror + unhandledrejection gives us a feed of
// production JS errors without bolting on a separate Sentry dep. Trim
// descriptions and stacks to stay under the GA4 100-char param limit.
// Never the message text: a thrown error can carry an email, a token or a
// URL. We send a fixed code from this list (the apps' analyticsCodes rule)
// and the script's file name without its query string.
var _ERR_CODES = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError', 'SecurityError', 'NetworkError', 'QuotaExceededError', 'AbortError', 'NotAllowedError'];
function _errCode(err, msg) {
  var name = err && err.name ? String(err.name) : '';
  if (_ERR_CODES.indexOf(name) >= 0) return name;
  var m = String(msg || '');
  if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(m)) return 'ChunkLoadError';
  if (/QuotaExceeded/i.test(m)) return 'QuotaExceededError';
  if (/NetworkError|Failed to fetch|Load failed/i.test(m)) return 'NetworkError';
  if (/Script error/i.test(m)) return 'CrossOriginScriptError';
  return 'other';
}
function _errSource(filename, line) {
  var f = String(filename || '').split('?')[0].split('#')[0];
  f = f.substring(f.lastIndexOf('/') + 1) || 'inline';
  return (f + ':' + (line || '0')).slice(0, 100);
}
window.addEventListener('error', function (e) {
  try {
    gtag('event', 'exception', {
      description: _errCode(e.error, e.message),
      fatal: false,
      source: _errSource(e.filename, e.lineno),
    });
  } catch {}
});
window.addEventListener('unhandledrejection', function (e) {
  try {
    var r = e.reason;
    gtag('event', 'exception', {
      description: _errCode(r, r && (r.message || String(r))),
      fatal: false,
      source: 'unhandledrejection',
    });
  } catch {}
});

// Core Web Vitals → GA4. Inline implementation using PerformanceObserver
// so we don't ship a 2 KB npm dep into every bundle. Buckets follow the
// Google Web Vitals thresholds (good / needs-improvement / poor).
//
// LCP: largest-contentful-paint entries, report the last one at page hide
// CLS: cumulative-layout-shift sum, report at page hide
// INP: longest event-duration over interactions, report at page hide
//
// Page-hide is the right moment because Web Vitals are monotonic — they
// can only get worse — so we want the final value, not an early sample.
(function () {
  if (typeof PerformanceObserver !== 'function') return;
  var lcpValue = 0;
  var clsValue = 0;
  var inpValue = 0;
  function safeObserve(type, cb, opts) {
    try {
      var po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(cb);
      });
      po.observe(Object.assign({ type: type, buffered: true }, opts || {}));
    } catch {}
  }
  safeObserve('largest-contentful-paint', function (entry) {
    lcpValue = entry.renderTime || entry.loadTime || entry.startTime;
  });
  safeObserve('layout-shift', function (entry) {
    if (!entry.hadRecentInput) clsValue += entry.value;
  });
  safeObserve('event', function (entry) {
    var d = entry.duration || 0;
    if (d > inpValue) inpValue = d;
  }, { durationThreshold: 16 });
  function report() {
    try {
      if (lcpValue) gtag('event', 'web_vital', { metric: 'LCP', value: Math.round(lcpValue) });
      if (clsValue) gtag('event', 'web_vital', { metric: 'CLS', value: Math.round(clsValue * 1000) / 1000 });
      if (inpValue) gtag('event', 'web_vital', { metric: 'INP', value: Math.round(inpValue) });
    } catch {}
  }
  // Fire once on first hide/pagehide — earliest reliable point where the
  // final values are known. visibilitychange covers tab-switch on most
  // browsers; pagehide covers bfcache/unload on Safari.
  var reported = false;
  function once() { if (reported) return; reported = true; report(); }
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') once(); });
  addEventListener('pagehide', once);
})();

} // end: not on netlify.app preview URL
