import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import { sendFriendRequest } from '../firebaseSync.js';
import { hasOnboarded } from '../storage.js';
import { track } from '../scoring.js';
import Avatar from './Avatar.jsx';
import CookLog from './CookLog.jsx';
import NotebookOnboarding from './NotebookOnboarding.jsx';
import NotebookAboutModal from './NotebookAboutModal.jsx';
import NotebookHamburger from './NotebookHamburger.jsx';
import EmailSignInBox from './EmailSignInBox.jsx';

// Notebook-specific Home — forked from the shared Home.jsx and stripped
// of every Scorecard code path. The mode toggle, restaurant search,
// review-side empty states, and the conditional 'BBQ Notebook' /
// 'BBQ Scorecard' branding all evaporate. What's left is just the
// Notebook header + CookLog + the minimum friend/sync UI a cook log
// user actually needs at the home view.

const ACCENT = '#4A6741';

export default function NotebookHome() {
  const {
    S, sBtn, sInput,
    fbUser, userProfile,
    fbFriends,
    friendCodeInput, setFriendCodeInput,
    friendMsg, setFriendMsg,
    themePref, setThemePref,
    setView, navigateTo,
    syncStatus, setSyncStatus,
    attemptSignIn,
    OfflineBanner,
  } = useAppContext();

  const { savedNotice, setSavedNotice, syncWithCloud, cookSyncStatus, startNewCook } = useCookContext();
  useEffect(() => {
    if (!savedNotice) return;
    const t = setTimeout(() => setSavedNotice(''), 3500);
    return () => clearTimeout(t);
  }, [savedNotice, setSavedNotice]);

  // First-launch onboarding overlay — only renders if the user hasn't
  // dismissed it before. Persists via markOnboarded() inside the child.
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded());
  const [showAbout, setShowAbout] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <header style={{ background: '#121a14', borderBottom: `1px solid ${S.border}`, padding: '14px 16px' }}>
        <div className="bbq-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Web-only back link — the installed app has no "back" from home. */}
            {!window.Capacitor?.isNativePlatform?.() && (
              <a href="/" onClick={() => track('cross_app_nav', { from: 'notebook', to: 'site' })}
                style={{ color: S.muted, textDecoration: 'none', fontSize: 14 }}>← Back</a>
            )}
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>
              BBQ NOTEBOOK
            </div>
          </div>
          <button
            onClick={() => { track('hamburger_opened'); setShowMenu(true); }}
            aria-label="Open menu"
            style={{
              background: 'none', border: `1px solid ${S.border}`, borderRadius: 6,
              width: 40, height: 40, cursor: 'pointer', color: S.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}
          >
            ☰
          </button>
        </div>
      </header>
    <div className="bbq-container" style={{ padding: '16px' }}>
      {showOnboarding && <NotebookOnboarding onDismiss={() => setShowOnboarding(false)} />}
      <OfflineBanner />

      {savedNotice && (
        <div onClick={() => setSavedNotice('')}
          style={{
            background: '#1f3d24', border: '1px solid #4A6741', color: '#cce6ce',
            padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: '12px',
          }}>
          <span>{savedNotice}</span>
          <span style={{ fontSize: '16px', opacity: 0.7 }}>×</span>
        </div>
      )}

      {/* Brand block */}
      <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '16px' }}>
        <img src={`${import.meta.env.BASE_URL}bbq-notebook-logo.png`}
          alt="BBQ Notebook"
          style={{ width: '150px', height: '150px', borderRadius: '50%', marginBottom: '8px' }}
          onError={(e) => { e.target.style.display = 'none'; }} />
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', fontWeight: '700',
          letterSpacing: '2px', color: ACCENT }}>BBQ Notebook</h1>
        <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '3px' }}>by Holy Smokes BBQ Co</div>
      </div>

      {/* Cook log — search, filters, list, empty state */}
      <CookLog />

      {/* Account block — sign-in CTA or friend code + actions */}
      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${S.border}` }}>
        {!fbUser ? (
          <div>
            <div style={{ fontSize: '12px', color: S.muted, marginBottom: '10px', textAlign: 'center' }}>
              Sign in to back up your cooks and share with friends
            </div>
            <div style={{ textAlign: 'center' }}>
              <button onClick={async () => {
                setSyncStatus('connecting');
                const user = await attemptSignIn();
                setSyncStatus(user ? 'done' : 'error');
                setTimeout(() => setSyncStatus(''), 2000);
              }} style={sBtn(true, true)}>
                {syncStatus === 'connecting' ? 'Connecting...' : 'Sign In with Google'}
              </button>
            </div>
            <div style={{
              textAlign: 'center', fontSize: '11px', color: S.muted,
              letterSpacing: '2px', margin: '14px 0 4px',
            }}>OR</div>
            <EmailSignInBox S={S} sBtn={sBtn} sInput={sInput} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Avatar src={fbUser.photoURL} name={fbUser.displayName} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{fbUser.displayName}</div>
                <div style={{ fontSize: '11px', color: S.muted }}>{fbUser.email}</div>
              </div>
              <button onClick={() => navigateTo('profile')} style={{ ...sBtn(false, true), padding: '4px 10px' }}>Profile</button>
            </div>

            {/* Friend code */}
            {userProfile && (
              <div style={{ background: S.dark, borderRadius: '8px', padding: '12px', marginBottom: '12px',
                textAlign: 'center', border: `1px solid ${S.border}` }}>
                <div style={{ fontSize: '10px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Your Friend Code</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '22px', fontWeight: '700', fontFamily: "'Oswald', sans-serif",
                    color: ACCENT, letterSpacing: '3px',
                  }}>{userProfile.friendCode}</span>
                  <button onClick={() => {
                    const url = `${window.location.origin}/#add-friend/${userProfile.friendCode}`;
                    if (navigator.share) navigator.share({
                      title: 'Join me on BBQ Notebook',
                      text: `Add me on BBQ Notebook! My friend code is ${userProfile.friendCode}`,
                      url,
                    });
                    else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
                  }} style={{ ...sBtn(true, true), padding: '4px 10px', fontSize: '11px' }}>Share</button>
                </div>
              </div>
            )}

            {/* Add friend inline */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: S.muted, letterSpacing: '1px', marginBottom: '6px' }}>Add a Friend</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="text" value={friendCodeInput}
                  onChange={e => { const v = e.target.value.toUpperCase(); setFriendCodeInput(v.startsWith('BBQ-') ? v : 'BBQ-'); }}
                  placeholder="BBQ-XXXXXX" maxLength={10}
                  style={{ ...sInput(), flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: '14px',
                    letterSpacing: '2px', textAlign: 'center', padding: '8px' }} />
                <button onClick={async () => {
                  setFriendMsg('Sending...');
                  const result = await sendFriendRequest(fbUser.uid, friendCodeInput);
                  setFriendMsg(result.ok ? 'Request sent — they must accept' : result.error);
                  if (result.ok) {
                    track('friend_request_sent');
                    setFriendCodeInput('BBQ-');
                  }
                  setTimeout(() => setFriendMsg(''), 4000);
                }} disabled={friendCodeInput.length < 8} style={sBtn(friendCodeInput.length >= 8, false)}>Send</button>
              </div>
              {friendMsg && (
                <div style={{ fontSize: '12px', color: friendMsg.includes('sent') ? '#4ade80' : '#f87171',
                  marginTop: '6px', textAlign: 'center' }}>{friendMsg}</div>
              )}
            </div>

            {/* Quick-action strip removed in v3.0 — everything is in the hamburger now. */}
            <div style={{ fontSize: '11px', color: S.muted, textAlign: 'center', marginTop: '4px' }}>
              {fbFriends.length} friend{fbFriends.length !== 1 ? 's' : ''} connected
            </div>
          </>
        )}
      </div>

      {/* Footer share */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button onClick={() => {
          const shareData = {
            title: 'BBQ Notebook by Holy Smokes BBQ Co',
            text: 'Log every cook with rubs, woods, temps, weather, and outcomes. Save recipes and reuse them across cooks.',
            url: 'https://play.google.com/store/apps/details?id=com.holysmokesbbq.notebook',
          };
          if (navigator.share) navigator.share(shareData).catch(() => {});
          else { navigator.clipboard?.writeText(shareData.url); alert('Link copied!'); }
        }} style={{ ...sBtn(false, true), fontSize: '12px', padding: '8px 16px' }}>
          Share BBQ Notebook
        </button>
      </div>

      {/* Floating add-cook button — always visible on home, no more
          hidden-behind-empty-state. Bottom-right with safe-area inset
          so it clears the gesture nav bar on modern Android. */}
      <button
        onClick={() => { track('new_cook_started', { source: 'fab' }); startNewCook(); }}
        aria-label="Log a new cook"
        style={{
          position: 'fixed',
          right: '20px',
          bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: ACCENT,
          color: '#fff',
          border: 'none',
          fontSize: '32px',
          fontWeight: '300',
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
    {showAbout && <NotebookAboutModal onClose={() => setShowAbout(false)} />}
    {showMenu && (
      <NotebookHamburger
        onClose={() => setShowMenu(false)}
        onOpenAbout={() => setShowAbout(true)}
      />
    )}
    </>
  );
}
