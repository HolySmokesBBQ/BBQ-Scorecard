import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { track } from '../scoring.js';
import { sendProblemReport } from '../diagnostics.js';

// About modal ported from BBQ Board's App.board.jsx pattern.
// Shows the Holy Smokes story and cross-promotes the two sibling apps
// (Scorecard + Board) — never Notebook itself. See
// PORT-BOARD-ABOUT-TO-NOTEBOOK.md for the full context.

const ACCENT = '#4A6741';

const CROSS_PROMOS = [
  {
    pkg: 'com.holysmokesbbq.scorecard',
    key: 'scorecard',
    name: 'BBQ Scorecard',
    tagline: 'Score restaurants on 10 categories. Composite scoring, side-by-side.',
  },
  {
    pkg: 'com.holysmokesbbq.board',
    key: 'board',
    name: 'BBQ Board',
    tagline: "Local butcher price directory. See who's cheapest on brisket this week.",
  },
];

export default function NotebookAboutModal({ onClose }) {
  const { S, fbUser } = useAppContext();
  const { cooks, recipes } = useCookContext();

  const openReport = () => {
    track('report_problem_opened', {});
    sendProblemReport({
      appName: 'BBQ Notebook',
      supportEmail: 'support@holysmokesbbqco.com',
      fallbackVersion: '2.2.0',
      context: {
        'Signed in': !!fbUser,
        'Cook count': (cooks || []).length,
        'Recipe count': (recipes || []).length,
      },
    });
  };

  const openApp = (pkg, key) => {
    track('notebook_crosspromo_click', { target: key });
    const url = `https://play.google.com/store/apps/details?id=${pkg}`;
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="About Holy Smokes BBQ"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 16, overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: S.card, border: `1px solid ${S.border}`, borderRadius: 12,
          maxWidth: 520, width: '100%', padding: 24, color: S.text, marginTop: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 1, color: ACCENT, margin: 0 }}>
            HOLY SMOKES BBQ
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: `1px solid ${S.border}`, borderRadius: 6,
              color: S.text, padding: '4px 10px', cursor: 'pointer', fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
          Holy Smokes BBQ Co is a small operation that builds tools for people
          who take barbecue seriously — the ones who track every cook, chase
          the best cuts, and remember what the brisket ran per pound last time.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
          BBQ Notebook is one of three apps in the family. They stand alone, but
          together they cover eating out, cooking at home, and shopping for the meat.
        </p>

        <div style={{ fontSize: 12, color: S.muted, letterSpacing: 2, marginBottom: 12 }}>
          THE OTHER APPS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {CROSS_PROMOS.map(({ pkg, key, name, tagline }) => (
            <button
              key={key}
              onClick={() => openApp(pkg, key)}
              style={{
                background: S.dark, border: `1px solid ${S.border}`, borderRadius: 8,
                padding: '12px 14px', cursor: 'pointer', textAlign: 'left', color: S.text,
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 700, color: ACCENT, fontSize: 15 }}>{name}</div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{tagline}</div>
            </button>
          ))}
        </div>

        {/* Absolute URLs, not the bundled copies — the native build ships a
            snapshot of these pages that goes stale between releases, and a
            privacy policy should always resolve to the current version. */}
        <div style={{ fontSize: 12, color: S.muted, textAlign: 'center', marginBottom: 8 }}>
          <a
            href="https://holysmokesbbqco.com/privacy-notebook.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('notebook_privacy_opened')}
            style={{ color: S.muted, textDecoration: 'none', margin: '0 8px' }}
          >
            Privacy Policy
          </a>
          <a
            href="https://holysmokesbbqco.com/changelog-notebook.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('notebook_changelog_opened')}
            style={{ color: S.muted, textDecoration: 'none', margin: '0 8px' }}
          >
            Changelog
          </a>
        </div>
        <div style={{ fontSize: 12, color: S.muted, letterSpacing: 2, marginBottom: 12, marginTop: 8 }}>
          SOMETHING WRONG?
        </div>
        <button
          onClick={openReport}
          style={{
            width: '100%',
            background: S.dark, border: `1px solid ${S.border}`, borderRadius: 8,
            padding: '12px 14px', cursor: 'pointer', textAlign: 'left', color: S.text,
            fontFamily: 'inherit', marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700, color: ACCENT, fontSize: 15 }}>Report a Problem</div>
          <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
            Sends an error log and your device details to support so we can investigate.
          </div>
        </button>

        <div style={{ fontSize: 12, color: S.muted, textAlign: 'center' }}>
          holysmokesbbqco.com
        </div>
      </div>
    </div>
  );
}
