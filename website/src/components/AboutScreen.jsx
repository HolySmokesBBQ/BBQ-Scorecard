import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import { sendProblemReport } from '../diagnostics.js';

// About modal for BBQ Scorecard. Ported from Board's v2.1.9 pattern
// (PORT-BOARD-ABOUT-TO-SCORECARD.md). Presents the Holy Smokes story
// plus cross-promo cards for the OTHER two apps in the family
// (Notebook + Board). Scorecard already has NotebookAdCard / launch
// modal for Notebook alone, but no surface exists that puts Notebook
// AND Board side by side and frames them as one family.
//
// Used from Profile.jsx's footer link — replaces the standalone
// "GET BBQ NOTEBOOK →" link with a single "About Holy Smokes BBQ"
// button that opens this modal (Board gets equal billing).

const OTHER_APPS = [
  {
    packageId: 'com.holysmokesbbq.notebook',
    label: 'notebook',
    name: 'BBQ Notebook',
    tagline: 'Cook log with rubs, sauces, weather, and what to change next time.',
    // Notebook has a live web version. On iOS we point users there (an
    // own-website link is App Store-safe) instead of at Google Play.
    webUrl: 'https://holysmokesbbqco.com/notebook/',
    iosNote: 'Live now on the web at holysmokesbbqco.com/notebook.',
  },
  {
    packageId: 'com.holysmokesbbq.board',
    label: 'board',
    name: 'BBQ Board',
    tagline: "Local butcher price directory. See who's cheapest on brisket this week.",
    // No web build to link to yet; on iOS it's a non-linking status card.
    iosNote: 'In beta testing for its App Store release.',
  },
];

export default function AboutScreen({ onClose }) {
  const { S, fbUser, reviews } = useAppContext();

  // iOS cross-promo rules (App Store Guideline 2.3.10 — no competing-store
  // links, no references to apps unavailable on iOS):
  //   • BBQ Notebook → not on the App Store, but its web version is live,
  //     so the card links to holysmokesbbqco.com/notebook (own-site links
  //     are fine) instead of Google Play.
  //   • BBQ Board    → no web build yet, so a non-linking status card that
  //     says it's in beta for its App Store release.
  // Android/web keep the full, tappable Google Play lineup unchanged.
  const isIOS = typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'ios';

  const reportProblem = async () => {
    track('report_problem_opened', {});
    await sendProblemReport({
      appName: 'BBQ Scorecard',
      supportEmail: 'support@holysmokesbbqco.com',
      fallbackVersion: '3.5.8',
      context: {
        'Signed in': !!fbUser,
        'Review count': (reviews || []).length,
      },
    });
  };

  // Where a card sends the user: on iOS, Notebook's web version (and
  // nothing for Board); everywhere else, Google Play.
  const linkFor = (app) => isIOS ? app.webUrl : `https://play.google.com/store/apps/details?id=${app.packageId}`;

  const openApp = (app) => {
    const url = linkFor(app);
    if (!url) return;
    track('scorecard_crosspromo_click', { target: app.label });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px',
          maxWidth: '520px', width: '100%', padding: '24px', color: S.text,
          marginTop: '24px', marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: '22px', fontWeight: 700, letterSpacing: '2px',
            color: S.accent, margin: 0,
          }}>
            HOLY SMOKES BBQ CO
          </h2>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: `1px solid ${S.border}`,
            color: S.muted, cursor: 'pointer',
            padding: '4px 10px', borderRadius: '6px', fontSize: '14px',
          }}>✕</button>
        </div>

        <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 12px' }}>
          Holy Smokes BBQ Co is a small operation that builds tools for people
          who take barbecue seriously. The ones who track every cook, chase
          the best cuts, and remember what the brisket ran per pound last time.
        </p>
        <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px' }}>
          BBQ Scorecard is one of three apps in the family. They stand alone, but
          together they cover eating out, cooking at home, and shopping for the meat.
        </p>

        <div style={{
          fontSize: '11px', color: S.muted, letterSpacing: '2px', marginBottom: '12px',
        }}>
          THE OTHER APPS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {OTHER_APPS.map(app => {
            const clickable = !!linkFor(app);
            // On iOS, append the platform-specific status (web-live / in-beta).
            const note = isIOS ? app.iosNote : null;
            const inner = (
              <>
                <div style={{ fontWeight: 700, color: S.accent, fontSize: '15px' }}>{app.name}</div>
                <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px', lineHeight: 1.4 }}>
                  {app.tagline}{note ? ` ${note}` : ''}
                </div>
              </>
            );
            const cardStyle = {
              background: S.dark, border: `1px solid ${S.border}`, borderRadius: '8px',
              padding: '12px 14px', textAlign: 'left', color: S.text,
            };
            return clickable ? (
              <button
                key={app.packageId}
                onClick={() => openApp(app)}
                style={{ ...cardStyle, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {inner}
              </button>
            ) : (
              <div key={app.packageId} style={cardStyle}>{inner}</div>
            );
          })}
        </div>

        <div style={{
          fontSize: '11px', color: S.muted, letterSpacing: '2px', marginBottom: '10px',
        }}>
          SOMETHING WRONG?
        </div>
        <button
          onClick={reportProblem}
          style={{
            width: '100%', background: S.dark, border: `1px solid ${S.border}`,
            borderRadius: '8px', padding: '12px 14px', cursor: 'pointer',
            textAlign: 'left', color: S.text, fontFamily: 'inherit', marginBottom: '20px',
          }}
        >
          <div style={{ fontWeight: 700, color: S.accent, fontSize: '15px' }}>Report a Problem</div>
          <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px', lineHeight: 1.4 }}>
            Sends an error log and your device details to support so we can investigate.
          </div>
        </button>

        <div style={{ fontSize: '12px', color: S.muted, textAlign: 'center' }}>
          holysmokesbbqco.com
        </div>
      </div>
    </div>
  );
}
