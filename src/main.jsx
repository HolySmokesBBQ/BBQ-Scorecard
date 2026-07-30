import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initDiagnostics } from './diagnostics.js';

// Start the rolling error buffer before anything renders so the
// "Report a Problem" log captures startup errors too.
initDiagnostics();

// Force restaurants mode for the Scorecard URL. The /scorecard/* URL is
// the Scorecard app — even if a user previously visited /notebook/ and
// localStorage was set to 'cooks', here they always see the restaurant
// review list and the restaurant-side UI.
if (typeof window !== 'undefined') {
  localStorage.setItem('bbq-app-mode', 'restaurants');
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// ─────────────────────────────────────────────────────────────
// Native crash reporting bridge (Android only).
// Routes unhandled JS errors + promise rejections to Firebase
// Crashlytics via the Capacitor plugin so they show up in the
// Crashlytics dashboard alongside native (Java) crashes. The
// plugin auto-collects native crashes once initialized.
//
// Dynamically imported so the web bundle stays free of any
// Capacitor-specific weight. The import resolves quickly because
// the plugin is also injected by `npx cap sync` into the Android
// runtime — on web, this Promise just rejects silently.
// ─────────────────────────────────────────────────────────────
if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
  import('@capacitor-firebase/crashlytics').then(({ FirebaseCrashlytics }) => {
    // Forward unhandled errors and promise rejections. Wrap each call
    // in a guard — the plugin throws if Crashlytics isn't yet ready,
    // and we don't want a logging failure to itself become a crash.
    const report = (err) => {
      try {
        FirebaseCrashlytics.recordException({
          message: err?.message || String(err) || 'Unknown error',
          stacktrace: err?.stack ? [{ fileName: 'app', lineNumber: 0, methodName: err.stack.slice(0, 4000) }] : undefined,
        });
      } catch { /* swallow */ }
    };
    window.addEventListener('error', (e) => report(e.error || e.message));
    window.addEventListener('unhandledrejection', (e) => report(e.reason));
  }).catch(() => { /* plugin not present (e.g. web build) */ });
}
