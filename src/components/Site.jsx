import { useAppContext } from '../context/AppContext.jsx';
import { CATEGORIES } from '../constants.js';
import { calcScores, track } from '../scoring.js';
import Avatar from './Avatar.jsx';

export default function Site() {
  const {
    S, sBtn, sInput, sLabel,
    reviews,
    fbUser, userProfile, syncStatus, setSyncStatus,
    themePref, setThemePref,
    navigateTo,
    OfflineBanner, attemptSignIn,
  } = useAppContext();

  // Get the latest review by date
  const latestReview = reviews.length > 0
    ? [...reviews].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
    : null;
  const latestSc = latestReview ? calcScores(latestReview.scores) : null;

  return (
    <div className="bbq-container-wide" style={{ paddingBottom: '64px' }}>
      <OfflineBanner />
      <div style={{ padding: '0 16px' }}>
      {/* Top row: Holy Smokes marketing site link (web only) + theme toggle.
          The "← Back" link goes to holysmokesbbqco.com, which is meaningful
          on the web PWA where the user may have arrived from there, but
          in the native Android app it opens an external browser tab —
          confusing UX. Hide the link entirely on native; keep the theme
          toggle in place so the row stays balanced. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
        {!window.Capacitor?.isNativePlatform?.() ? (
          <a href="https://holysmokesbbqco.com/" onClick={() => track('cross_app_nav', { from: 'scorecard', to: 'site' })} style={{
            color: S.accent, textDecoration: 'none',
            fontSize: '13px', fontWeight: 600,
          }}>
            ← Holy Smokes
          </a>
        ) : <span />}
        <button onClick={() => setThemePref(t => t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark')}
          style={{ background: 'none', border: `1px solid ${S.border}`,
            borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.text }}>
          {themePref === 'dark' ? '☀' : themePref === 'light' ? '☽' : '◐'}
        </button>
      </div>

      {/* Hero — LCP element. Picture element with AVIF → WebP → PNG
          fallback chain. Modern browsers (Chrome/Safari/Firefox) all
          support AVIF as of 2024+, saving ~25% vs WebP and ~75% vs PNG. */}
      <div className="bbq-landing-hero" style={{ textAlign: 'center' }}>
        <picture>
          <source
            type="image/avif"
            srcSet={`${import.meta.env.BASE_URL}holy-smokes-logo.avif 1x, ${import.meta.env.BASE_URL}holy-smokes-logo@2x.avif 2x`}
          />
          <source
            type="image/webp"
            srcSet={`${import.meta.env.BASE_URL}holy-smokes-logo.webp 1x, ${import.meta.env.BASE_URL}holy-smokes-logo@2x.webp 2x`}
          />
          <img
            src={`${import.meta.env.BASE_URL}holy-smokes-logo.png`}
            alt="Holy Smokes BBQ"
            width="200"
            height="200"
            className="bbq-hero-logo"
            style={{ width: '200px', height: '200px', borderRadius: '50%', marginBottom: '16px' }}
            onError={(e) => { e.target.style.display = 'none'; }}
            fetchpriority="high"
            decoding="async"
          />
        </picture>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '32px', fontWeight: '700',
          letterSpacing: '3px', color: S.accent }}>HOLY SMOKES BBQ</h1>
        <div style={{ fontSize: '14px', color: S.muted, marginTop: '8px', letterSpacing: '2px' }}>
          FAITH, FAMILY & FIRE
        </div>
      </div>

      {/* Story */}
      <div style={{ background: S.card, borderRadius: '12px', padding: '24px', marginBottom: '24px',
        border: `1px solid ${S.border}`, maxWidth: '720px', margin: '0 auto 24px' }}>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px',
          color: S.accent, marginBottom: '12px', textAlign: 'center' }}>The Journey</h2>
        <p style={{ fontSize: '14px', lineHeight: '1.8', color: S.text, marginBottom: '12px' }}>
          Born and raised in the greater Kansas City area, so BBQ was never a hobby I picked
          up. It was just how we ate. When we got our first smoker a few years back, it was
          mine. Nobody else was touching it. Now the family's bigger, the smoker's bigger,
          and we needed a way to keep track of all the places we're hitting on the road.
        </p>
        <p style={{ fontSize: '14px', lineHeight: '1.8', color: S.text, marginBottom: '12px' }}>
          As a United Methodist pastor, currently in seminary, a lot of the best conversations
          I've had about God and about life happened around either a meat smoker or a table
          with smoked meat. I don't believe that's an accident.
        </p>
        <p style={{ fontSize: '14px', lineHeight: '1.8', color: S.text }}>
          The competition-style scorecard rates every restaurant across 10 categories:
          appearance, taste, tenderness, smoke, sides, sauce, portions, and how the place
          treats families. Every review on here uses it. If the food's bad, the score says so.
        </p>
      </div>

      {/* Launch Card — single CTA into the Scorecard. The dual-app
          picker was removed in v3.1.12 when the BBQ Notebook moved to
          its own standalone Play Store app. Notebook cross-promo now
          appears as a dismissible card on Home.jsx instead. */}
      <div style={{ maxWidth: '480px', margin: '0 auto 24px' }}>
        <div style={{ background: S.card, borderRadius: '14px', padding: '28px 20px',
          border: `2px solid ${S.accent}`, textAlign: 'center' }}>
          <img src={`${import.meta.env.BASE_URL}bbq-scorecard-logo.png`} alt=""
            style={{ width: '72px', height: '72px', borderRadius: '50%', marginBottom: '12px' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: '700',
            letterSpacing: '2px', color: S.accent, marginBottom: '8px' }}>BBQ Scorecard</div>
          <div style={{ fontSize: '13px', color: S.muted, lineHeight: '1.5', marginBottom: '16px' }}>
            Rate BBQ restaurants across 10 categories. Track every visit, compare scores with friends, and find out who does it best.
          </div>
          <button onClick={() => navigateTo('home')} style={{
            padding: '10px 28px', background: S.accent, color: '#fff', border: 'none',
            borderRadius: '8px', fontFamily: "'Oswald', sans-serif", fontSize: '14px',
            fontWeight: '700', letterSpacing: '1px', cursor: 'pointer', width: '100%',
          }}>Launch Scorecard</button>
        </div>
      </div>

      {/* Sign In / Account.
          Unsigned users get a low-friction text link instead of a giant
          "Sign In" card. Reason: GA4 data showed 77% of users were
          skipping sign-in; the prominent card was creating a perceived
          wall before they'd even tried the app. The link still gets
          them to auth but doesn't compete with the launch buttons. */}
      <div style={{ maxWidth: '720px', margin: '0 auto 24px' }}>
        {!fbUser ? (
          <div style={{ textAlign: 'center', padding: '4px 16px 12px' }}>
            <button onClick={async () => {
              setSyncStatus('connecting');
              const user = await attemptSignIn();
              setSyncStatus(user ? 'done' : 'error');
              setTimeout(() => setSyncStatus(''), 2000);
            }} style={{
              background: 'transparent', color: S.muted, border: 'none',
              fontSize: '12px', letterSpacing: '0.5px', cursor: 'pointer',
              textDecoration: 'underline',
            }}>
              {syncStatus === 'connecting' ? 'Connecting…' : 'Sign in with Google to sync across devices'}
            </button>
          </div>
        ) : (
          <div style={{ background: S.dark, borderRadius: '12px', padding: '20px',
            border: `1px solid ${S.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', justifyContent: 'center' }}>
              <Avatar src={fbUser.photoURL} name={fbUser.displayName} size={40} />
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700' }}>{fbUser.displayName}</div>
                <div style={{ fontSize: '11px', color: S.muted }}>Signed in</div>
              </div>
            </div>
            {userProfile && (
              <div style={{ textAlign: 'center', marginBottom: '12px', padding: '10px', background: S.card, borderRadius: '8px', border: `1px solid ${S.border}` }}>
                <div style={{ fontSize: '10px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Your Friend Code</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '22px', fontWeight: '700', fontFamily: "'Oswald', sans-serif",
                    color: S.accent, letterSpacing: '3px',
                  }}>{userProfile.friendCode}</span>
                  <button onClick={() => {
                    const url = `${window.location.origin}/#add-friend/${userProfile.friendCode}`;
                    if (navigator.share) navigator.share({ title: 'Join me on Holy Smokes BBQ', text: `Add me on the BBQ Scorecard! My friend code is ${userProfile.friendCode}`, url });
                    else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
                  }} style={{ ...sBtn(true, true), padding: '4px 10px', fontSize: '11px' }}>Share</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigateTo('leaderboard')} style={sBtn(false, false)}>Leaderboard</button>
              <button onClick={() => navigateTo('profile')} style={sBtn(false, false)}>Profile</button>
            </div>
          </div>
        )}
      </div>

      {/* Latest Review */}
      {latestReview && (
        <div style={{ maxWidth: '720px', margin: '0 auto 24px' }}>
          <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', letterSpacing: '2px',
            color: S.accent, marginBottom: '16px', textAlign: 'center' }}>
            Latest Review
          </h2>
          <div style={{ background: S.card, borderRadius: '10px', padding: '16px',
            border: `1px solid ${S.border}`, cursor: 'pointer' }}
            onClick={() => { track('skip_sign_in'); navigateTo('home'); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '700', fontSize: '16px' }}>{latestReview.restaurant}</span>
                </div>
                <div style={{ fontSize: '12px', color: S.muted, marginTop: '3px' }}>
                  {latestReview.location || 'Unknown'}{latestReview.trip ? ` · ${latestReview.trip}` : ''} · {latestReview.date}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#fbbf24', fontSize: '15px', letterSpacing: '1px' }}>
                  {'★'.repeat(latestSc.stars)}{'☆'.repeat(5 - latestSc.stars)}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: S.accent }}>{latestSc.composite.toFixed(2)}</div>
              </div>
            </div>

            {/* Score breakdown */}
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${S.border}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: '10px' }}>
                {[...CATEGORIES.bbq, ...CATEGORIES.family].map(c => {
                  const v = latestReview.scores[c.key];
                  return v > 0 ? (
                    <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0',
                      borderBottom: `1px solid ${S.border}`, fontSize: '12px' }}>
                      <span style={{ color: S.muted }}>{c.label}</span>
                      <span style={{ fontWeight: '600', color: v >= 7 ? '#4ade80' : v >= 5 ? S.text : '#f87171' }}>{v}/9</span>
                    </div>
                  ) : null;
                })}
              </div>
              <div style={{ fontSize: '12px', color: S.muted, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>BBQ: {latestSc.bbqAvg.toFixed(2)}</span>
                <span>Family: {latestSc.famAvg.toFixed(2)}</span>
                <span>Bonus: +{latestSc.bonus.toFixed(2)}</span>
              </div>
              {latestReview.wouldReturn && <div style={{ fontSize: '12px', color: S.muted, marginTop: '6px' }}>Would return: {latestReview.wouldReturn}</div>}
            </div>

            <div style={{ fontSize: '11px', color: S.accent, marginTop: '12px', textAlign: 'center', letterSpacing: '1px' }}>
              Tap to view all {reviews.length} reviews {'→'}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '16px 0', borderTop: `1px solid ${S.border}` }}>
        <a href="https://holysmokesbbqco.com/privacy.html"
          style={{ fontSize: '11px', color: S.muted, textDecoration: 'none' }}>Privacy Policy</a>
        <span style={{ fontSize: '11px', color: S.border, margin: '0 6px' }}>{'·'}</span>
        <a href={`${import.meta.env.BASE_URL}changelog.html`}
          style={{ fontSize: '11px', color: S.muted, textDecoration: 'none' }}>Changelog</a>
        <div style={{ fontSize: '10px', color: S.border, marginTop: '6px' }}>
          {'©'} {new Date().getFullYear()} Holy Smokes BBQ
        </div>
      </div>
      </div>
    </div>
  );
}
