// Safe-area insets for Scorecard's fixed-position UI, as CSS expressions.
//
// --safe-area-top / --safe-area-bottom are a dev override hook (set one in
// the browser preview to simulate a notch). Otherwise the inset is the
// LARGER of:
//   --safe-area-inset-top / -bottom   what Capacitor's SystemBars injects on
//                                     Android 15+ when the page uses
//                                     viewport-fit=cover (index.html does)
//   env(safe-area-inset-*)            what iOS (and some WebViews) fill in
// max() rather than a fallback chain, matching Board's f92b0fa: if either
// source reads 0 while the other has the real value, the real one wins.
//
// Android WebViews don't reliably fill env() for edge-to-edge apps, so
// reading only env() put the menu button under the status bar on Android
// (2026-10-12). Notebook never hit this because its page doesn't use
// viewport-fit=cover, so Capacitor pads its whole WebView natively instead.
// index.html's #root padding uses the same chain; keep them in step.
export const SAFE_TOP =
  'var(--safe-area-top, max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)))';
export const SAFE_BOTTOM =
  'var(--safe-area-bottom, max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))';

// `calc(<inset> + <extra>)`, for an element that should sit a fixed
// distance clear of the bar.
export const belowTop = (extra) => `calc(${SAFE_TOP} + ${extra})`;
export const aboveBottom = (extra) => `calc(${SAFE_BOTTOM} + ${extra})`;
