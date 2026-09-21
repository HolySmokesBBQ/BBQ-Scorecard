import React from 'react';

// App-shell error boundary for BBQ Board.
//
// Board had none. When Settings threw on render (the STATES.map bug fixed
// in 2.4.0), Preact unmounted the whole tree and the user got a blank
// screen with no way back but force-quitting. GA logged app_exception
// across 6 users in the same window as a 37.5% uninstall rate. For a
// price-lookup app the blank screen is the single worst outcome: it
// tells the user nothing and leaves them nothing to tap.
//
// This catches a render throw anywhere below it and shows a small panel
// with the error and a Reload button. Reload is the right recovery for a
// Capacitor app: assets are on local disk, so it's instant and it clears
// whatever transient state caused the throw.
//
// The catch is also logged through console.error, which diagnostics.js
// wraps, so it lands in the error log that "Report a problem" attaches.

const PAL = {
  bg: '#1a1a1a', panel: '#232830',
  border: '#3a4048', brass: '#d4a64a',
  text: '#f5e6d3', textDim: '#9aa3ad',
};

// Exported for tests. Preact calls this statically with whatever was
// thrown, which is not guaranteed to be an Error.
export function deriveStateFromError(err) {
  const message = err && typeof err === 'object' && 'message' in err
    ? String(err.message)
    : (err == null ? 'unknown error' : String(err));
  return { hasError: true, message };
}

// Stack if we have it, else message, else String(). Capped so a
// pathological stack can't balloon the diagnostics log or the report email.
export function describeError(err) {
  const s = err?.stack || err?.message || String(err);
  return String(s).slice(0, 2000);
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(err) {
    return deriveStateFromError(err);
  }

  componentDidCatch(err, info) {
    // diagnostics.js wraps console.error and pushes into the error log,
    // so this one line gets the throw into the problem-report attachment.
    console.error('[board] render error caught by ErrorBoundary:',
      describeError(err), info?.componentStack || '');
    // Same shape as App.board.jsx's track(), inlined so this file has no
    // dependency on the tree it is protecting.
    try {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'board_error_boundary', {
          content_group: 'board',
          message: String(err?.message || err).slice(0, 100),
        });
      }
    } catch {}
  }

  handleReload() {
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', background: PAL.bg, color: PAL.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, boxSizing: 'border-box',
      }}>
        <div style={{
          maxWidth: 420, width: '100%',
          background: PAL.panel, border: `1px solid ${PAL.border}`,
          borderRadius: 8, padding: 20,
        }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700,
            letterSpacing: 2, color: PAL.brass, marginBottom: 10,
          }}>
            SOMETHING WENT WRONG
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
            BBQ Board hit an error it couldn't recover from on this screen.
            Reloading usually clears it.
          </div>
          {this.state.message && (
            <div style={{
              fontSize: 12, color: PAL.textDim, fontFamily: 'monospace',
              wordBreak: 'break-word', marginBottom: 16,
            }}>
              {this.state.message}
            </div>
          )}
          <button
            onClick={this.handleReload}
            style={{
              width: '100%', background: PAL.brass, color: '#1a1a1a',
              border: 'none', borderRadius: 6, padding: '12px 16px',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reload BBQ Board
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
