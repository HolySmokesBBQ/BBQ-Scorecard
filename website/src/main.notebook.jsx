import React from 'react';
import ReactDOM from 'react-dom/client';
import NotebookApp from './App.notebook.jsx';
import { initDiagnostics } from './diagnostics.js';

// Start the rolling error buffer immediately so any startup exception
// is captured for the Report a Problem flow (see NotebookAboutModal).
initDiagnostics();

// Pin the shared AppContext to cooks mode on every load. BBQ Notebook
// is a standalone cook log — this guarantees the cook UI regardless of
// any stale localStorage value left over from prior testing.
if (typeof window !== 'undefined') {
  localStorage.setItem('bbq-app-mode', 'cooks');
}

ReactDOM.createRoot(document.getElementById('root')).render(<NotebookApp />);

// Fade out the brand splash once React has painted. requestAnimationFrame
// runs after the first paint, so the user never sees the black flash that
// happens on native cold launch before the WebView is ready.
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    const splash = document.getElementById('brand-splash');
    if (splash) {
      splash.classList.add('fade');
      setTimeout(() => splash.remove(), 350);
    }
  });
}

// Native crash reporting bridge (Android only). Same pattern as
// main.jsx — routes unhandled JS errors and promise rejections to
// Firebase Crashlytics via the Capacitor plugin. Dynamically imported
// so the web bundle stays free of any Capacitor-specific weight.
if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
  import('@capacitor-firebase/crashlytics').then(({ FirebaseCrashlytics }) => {
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
  }).catch(() => { /* plugin not present on web build */ });
}
