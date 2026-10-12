// Safe-area insets for Scorecard's fixed-position UI, as CSS expressions.
//
// Lookup order, first defined wins:
//   --safe-area-top / --safe-area-bottom   dev override hook: set it in the
//                                          browser preview to simulate a notch
//   --safe-area-inset-top / -bottom        what Capacitor's SystemBars injects
//                                          on Android 15+ when the page uses
//                                          viewport-fit=cover (index.html does)
//   env(safe-area-inset-*)                 what iOS fills in
//
// Android WebViews don't reliably fill env() for edge-to-edge apps, so
// reading only env() put the menu button under the status bar on Android
// (2026-10-12). Notebook never hit this because its page doesn't use
// viewport-fit=cover, so Capacitor pads its whole WebView natively instead.
// index.html's #root padding uses the same chain; keep them in step.
export const SAFE_TOP =
  'var(--safe-area-top, var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))';
export const SAFE_BOTTOM =
  'var(--safe-area-bottom, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))';

// `calc(<inset> + <extra>)`, for an element that should sit a fixed
// distance clear of the bar.
export const belowTop = (extra) => `calc(${SAFE_TOP} + ${extra})`;
export const aboveBottom = (extra) => `calc(${SAFE_BOTTOM} + ${extra})`;
