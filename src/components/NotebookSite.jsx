import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import Avatar from './Avatar.jsx';

// Notebook brand accent — deep olive/green pulled from the BBQ Notebook
// logo's inner panel. Used everywhere on this landing for headlines,
// buttons, and the friend-code highlight color.
const NOTEBOOK_ACCENT = '#4A6741';
const NOTEBOOK_ACCENT_DARK = '#3a5234';

export default function NotebookSite() {
  const {
    S, fbUser, userProfile, themePref, setThemePref,
    navigateTo, setAppMode, OfflineBanner, attemptSignIn,
  } = useAppContext();

  // Fire once on mount so the analytics can show how many people LAND on
  // /notebook/ regardless of whether they click Launch. Lets us compute
  // the Launch conversion rate (site_viewed → launched) and tell the
  // difference between "nobody visits" and "people visit but bounce."
  useEffect(() => { track('notebook_site_viewed'); }, []);

  // Launching the app forces appMode=cooks so the shared Home component
  // shows the cook list instead of the restaurant review list. Persists
  // in localStorage so a refresh keeps the user on the cook side.
  const launchNotebook = () => {
    setAppMode('cooks');
    track('notebook_launched', { from: 'site' });
    navigateTo('home');
  };

  return (
    <div className="bbq-container-wide" style={{ paddingBottom: '64px' }}>
      <OfflineBanner />
      <div style={{ padding: '0 16px' }}>

        {/* Top row: back to Notebook + theme toggle. About page stays in-app;
            no ties to the marketing site. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <button onClick={() => { track('back_to_notebook', { from: 'about' }); navigateTo('home'); }} style={{
            background: 'none', border: 'none',
            color: S.accent, cursor: 'pointer', padding: 0,
            fontSize: '13px', fontWeight: 600,
          }}>
            ← Back to Notebook
          </button>
          <button
            onClick={() => setThemePref(themePref === 'dark' ? 'light' : themePref === 'light' ? 'system' : 'dark')}
            aria-label="Toggle theme"
            style={{
              background: 'none', border: `1px solid ${S.border}`,
              borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: S.text,
            }}>
            {themePref === 'dark' ? '☀' : themePref === 'light' ? '☽' : '◐'}
          </button>
        </div>

        {/* Hero — LCP element. PNG only for now (AVIF/WebP can be added
            later via sharp — same approach as the Holy Smokes logo). */}
        <div className="bbq-landing-hero" style={{ textAlign: 'center' }}>
          <img
            src={`${import.meta.env.BASE_URL}bbq-notebook-logo.png`}
            alt="BBQ Notebook"
            width="200" height="200"
            className="bbq-hero-logo"
            style={{
              width: '200px', height: '200px', borderRadius: '50%',
              objectFit: 'cover', marginBottom: '20px',
            }}
            fetchpriority="high"
            decoding="async"
          />
          <h1 style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: '36px', fontWeight: '700',
            letterSpacing: '3px', color: NOTEBOOK_ACCENT,
            marginBottom: '4px',
          }}>BBQ NOTEBOOK</h1>
          <div style={{ fontSize: '14px', color: S.muted, letterSpacing: '2px', marginBottom: '32px' }}>
            EVERY COOK, REMEMBERED
          </div>
        </div>

        {/* The story */}
        <div style={{
          background: S.card, borderRadius: '14px', padding: '24px 20px',
          marginBottom: '24px', border: `1px solid ${S.border}`,
          maxWidth: '720px', margin: '0 auto 24px',
        }}>
          <h2 style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: '18px', fontWeight: '600',
            letterSpacing: '2px', color: NOTEBOOK_ACCENT,
            textAlign: 'center', marginBottom: '16px',
          }}>The Journey</h2>
          <p style={{ fontSize: '14px', color: S.text, lineHeight: '1.8', marginBottom: '14px' }}>
            Born and raised in the greater Kansas City area, so BBQ was never a hobby I picked
            up. It was just how we ate. When we got our first smoker a few years back, it was
            mine. Nobody else was touching it. Now the family's bigger, the smoker's bigger,
            and I needed a way to keep track of what I was actually doing every weekend.
          </p>
          <p style={{ fontSize: '14px', color: S.text, lineHeight: '1.8', marginBottom: '14px' }}>
            As a United Methodist pastor, currently in seminary, a lot of the best
            conversations I've had about God and about life happened around either a meat
            smoker or a table with smoked meat. I don't believe that's an accident.
          </p>
          <p style={{ fontSize: '14px', color: S.text, lineHeight: '1.8' }}>
            BBQ Notebook is the cook log I needed — every smoke logged end-to-end with the
            rub, the wood, the temps that stuck and the temps that drifted, the weather that
            morning, the outcome. Save your rubs and sauces once, reuse them on any cook.
            So when something works, you can do it again. And when it doesn't, you know why.
          </p>
        </div>

        {/* What it does — feature highlights, kept tight */}
        <div style={{ maxWidth: '720px', margin: '0 auto 32px' }}>
          <h2 style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: '16px', fontWeight: '600',
            letterSpacing: '2px', color: S.muted,
            textAlign: 'center', marginBottom: '16px',
          }}>WHAT YOU CAN TRACK</h2>
          <div style={{
            display: 'grid', gap: '12px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}>
            <FeatureCard S={S} accent={NOTEBOOK_ACCENT} title="Cooks"
              text="Meat, cut, weight, rub, wood, smoker, fuel, temps, wrap method, finish temp, rest time, weather, outcome notes." />
            <FeatureCard S={S} accent={NOTEBOOK_ACCENT} title="Recipes"
              text="Save your rubs and sauces once. Reuse them on cooks without re-typing every ingredient." />
            <FeatureCard S={S} accent={NOTEBOOK_ACCENT} title="Photos"
              text="Attach photos to any cook. They sync to the cloud so you don't lose them when you switch devices." />
            <FeatureCard S={S} accent={NOTEBOOK_ACCENT} title="Friends"
              text="Share cooks with friends by their 6-character friend code. Compare techniques, swap recipes." />
          </div>
        </div>

        {/* Primary CTA — Launch the app */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <button
            onClick={launchNotebook}
            style={{
              background: NOTEBOOK_ACCENT, color: '#fff',
              border: 'none', padding: '16px 40px',
              borderRadius: '10px',
              fontFamily: "'Oswald', sans-serif",
              fontSize: '16px', fontWeight: '700', letterSpacing: '2px',
              cursor: 'pointer', minWidth: '260px',
              boxShadow: `0 4px 14px ${NOTEBOOK_ACCENT_DARK}66`,
            }}>
            LAUNCH NOTEBOOK
          </button>
        </div>

        {/* Sign-in state */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {!fbUser ? (
            <button
              onClick={async () => {
                await attemptSignIn();
                track('sign_in_clicked', { from: 'notebook_site' });
              }}
              style={{
                background: 'none', color: S.muted,
                border: `1px solid ${S.border}`,
                padding: '10px 20px', borderRadius: '8px',
                fontSize: '13px', letterSpacing: '1px',
                cursor: 'pointer',
              }}>
              Sign in to sync your cooks
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              {/* Avatar handles missing photoURL + failed image loads
                  by falling back to colored initials. */}
              <Avatar src={fbUser.photoURL} name={fbUser.displayName} size={36} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: S.text }}>{fbUser.displayName}</div>
                {userProfile?.friendCode && (
                  <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px' }}>
                    Friend code: <span style={{ color: NOTEBOOK_ACCENT, fontWeight: '700' }}>{userProfile.friendCode}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', padding: '24px 0',
          borderTop: `1px solid ${S.border}`,
          fontSize: '11px', color: S.muted, letterSpacing: '1px',
        }}>
          <div style={{ marginBottom: '8px' }}>
            {/* Absolute, not relative: NotebookSite is the fallback view in
                App.notebook.jsx, so it renders inside the native build too.
                Relative paths there resolve against the packaged snapshot of
                these pages, which goes stale between releases. Legal and
                account-deletion pages must always resolve to the live copy. */}
            <a href="https://holysmokesbbqco.com/privacy-notebook.html" style={{ color: S.muted, textDecoration: 'none', margin: '0 8px' }}>Privacy</a>
            <span style={{ color: S.border }}>•</span>
            <a href="https://holysmokesbbqco.com/changelog-notebook.html" style={{ color: S.muted, textDecoration: 'none', margin: '0 8px' }}>Changelog</a>
            <span style={{ color: S.border }}>•</span>
            <a href="https://holysmokesbbqco.com/delete-account-notebook.html" style={{ color: S.muted, textDecoration: 'none', margin: '0 8px' }}>Delete account</a>
          </div>
          <div>By Holy Smokes BBQ Co</div>
        </div>

      </div>
    </div>
  );
}

function FeatureCard({ S, accent, title, text }) {
  return (
    <div style={{
      background: S.card, borderRadius: '10px', padding: '16px',
      border: `1px solid ${S.border}`,
    }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: '14px', fontWeight: '700',
        letterSpacing: '1.5px', color: accent, marginBottom: '6px',
      }}>{title.toUpperCase()}</div>
      <div style={{ fontSize: '13px', color: S.text, lineHeight: '1.5' }}>{text}</div>
    </div>
  );
}
