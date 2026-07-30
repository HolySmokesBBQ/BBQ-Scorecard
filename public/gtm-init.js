/* GTM + GA4 initialization.
   Extracted from index.html inline scripts so the CSP no longer needs
   `script-src 'unsafe-inline'` (Security Audit Finding #5). Loaded from
   /gtm-init.js which is same-origin and matches `script-src 'self'`. */

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

// Consent Mode v2 defaults. Must fire BEFORE any gtag config or GTM
// loader so the consent state is known when tags initialize. Without
// this, undeclared consent = denied and all beacons are silently
// blocked. US-only audience, no ads — grant analytics, deny ad signals.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('consent', 'default', {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});

// Per-app measurement ID set by each entry HTML before this script loads.
// Falls back to the website property when no override is present.
var MID = window.GA_MEASUREMENT_ID || 'G-5JZJ75VWR3';

// Google Analytics 4 (gtag.js) — load via the Google tag ID (the only
// ID that returns 200 from googletagmanager.com/gtag/js).
var gtagScript = document.createElement('script');
gtagScript.async = true;
gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + MID;
document.head.appendChild(gtagScript);

window.gtag = gtag;
gtag('js', new Date());

gtag('config', MID, {
  page_title: window.GA_PAGE_TITLE || document.title,
  content_group: window.GA_CONTENT_GROUP || 'unknown',
});

// Global exception tracking. GA4 has a built-in 'exception' event type;
// firing it from window.onerror + unhandledrejection gives us a feed of
// production JS errors without bolting on a separate Sentry dep. Trim
// descriptions and stacks to stay under the GA4 100-char param limit.
function _trimErr(s) {
  return (s || 'unknown').toString().slice(0, 100);
}
window.addEventListener('error', function (e) {
  try {
    gtag('event', 'exception', {
      description: _trimErr(e.message),
      fatal: false,
      source: _trimErr((e.filename || '') + ':' + (e.lineno || '0')),
    });
  } catch {}
});
window.addEventListener('unhandledrejection', function (e) {
  try {
    var reason = e.reason && (e.reason.message || e.reason.toString());
    gtag('event', 'exception', {
      description: _trimErr(reason),
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
