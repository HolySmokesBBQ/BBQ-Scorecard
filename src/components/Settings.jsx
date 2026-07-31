import { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { track, exportCSV } from '../scoring.js';
import {
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  getIncomingFriendRequests, removeFriendConnection, getFriendsList,
  firebaseSignOut,
} from '../firebaseSync.js';
import { sendProblemReport } from '../diagnostics.js';
import Avatar from './Avatar.jsx';
import EmailSignInBox from './EmailSignInBox.jsx';
import AboutScreen from './AboutScreen.jsx';

// Settings page (NAV_V2) — replaces the old Profile page. Same friends
// and account logic, reorganized into labeled sections, plus Appearance,
// Sync, Data, and Account groups. The 'profile' route aliases here.

export default function Settings() {
  const {
    S, sBtn, sInput,
    setView, reviews,
    fbUser, userProfile,
    fbFriends, setFbFriends,
    incomingRequests, setIncomingRequests,
    friendCodeInput, setFriendCodeInput,
    friendMsg, setFriendMsg,
    attemptSignIn, attemptAppleSignIn,
    themePref, setThemePref,
    syncStatus,
    exportBackup, handleImport,
  } = useAppContext();

  const [showAbout, setShowAbout] = useState(false);
  const importRef = useRef(null);

  const Section = ({ label, children }) => (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, color: S.muted, letterSpacing: 2, marginBottom: 10,
        fontFamily: "'Oswald', sans-serif",
      }}>{label}</div>
      {children}
    </div>
  );

  const openUrl = (path) => window.open(`https://holysmokesbbqco.com/${path}`, '_blank', 'noopener,noreferrer');

  const reportProblem = () => {
    track('report_problem_opened', {});
    sendProblemReport({
      appName: 'BBQ Scorecard',
      supportEmail: 'support@holysmokesbbqco.com',
      fallbackVersion: '3.5.8',
      context: { 'Signed in': !!fbUser, 'Review count': (reviews || []).length },
    });
  };

  const themes = [
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
    { key: 'system', label: 'Same as system' },
  ];

  return (
    <div className="bbq-container" style={{ padding: 16 }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 20 }}>Settings</h2>

      {/* APPEARANCE — always available, signed in or not */}
      <Section label="APPEARANCE">
        <div style={{ display: 'flex', gap: 8 }}>
          {themes.map(t => (
            <button key={t.key} onClick={() => { setThemePref(t.key); track('theme_changed', { theme: t.key }); }}
              style={{ ...sBtn(themePref === t.key, true), flex: 1 }}>{t.label}</button>
          ))}
        </div>
      </Section>

      {fbUser && userProfile ? (
        <>
          {/* PROFILE */}
          <Section label="PROFILE">
            <div style={{ background: S.card, borderRadius: 10, padding: 20, border: `1px solid ${S.border}`, textAlign: 'center' }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <Avatar src={fbUser.photoURL} name={fbUser.displayName} size={64} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{fbUser.displayName}</div>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 12 }}>{fbUser.email}</div>
              <div style={{ fontSize: 12, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>Your Friend Code</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Oswald', sans-serif", color: S.accent, letterSpacing: 4, padding: '8px 0' }}>{userProfile.friendCode}</div>
              <button onClick={() => {
                const url = `${window.location.origin}/#add-friend/${userProfile.friendCode}`;
                if (navigator.share) navigator.share({ title: 'Join me on Holy Smokes BBQ', text: `Add me on BBQ Scorecard! My friend code is ${userProfile.friendCode}`, url });
                else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
              }} style={{ ...sBtn(true, true), marginTop: 8 }}>Share Code</button>
            </div>
          </Section>

          {/* FRIENDS */}
          <Section label="FRIENDS">
            <div style={{ background: S.card, borderRadius: 10, padding: 16, border: `1px solid ${S.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>Add a Friend</div>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 10 }}>Enter their code to send a request. They must accept before you can see each other's reviews.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={friendCodeInput} onChange={e => setFriendCodeInput(e.target.value.toUpperCase())}
                  placeholder="BBQ-XXXXXX" maxLength={10}
                  style={{ ...sInput(), flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: 16, letterSpacing: 2, textAlign: 'center' }} />
                <button onClick={async () => {
                  setFriendMsg('Sending...');
                  const result = await sendFriendRequest(fbUser.uid, friendCodeInput);
                  setFriendMsg(result.ok ? 'Request sent' : result.error);
                  if (result.ok) { track('friend_request_sent'); setFriendCodeInput('BBQ-'); }
                  setTimeout(() => setFriendMsg(''), 4000);
                }} disabled={friendCodeInput.length < 8} style={sBtn(friendCodeInput.length >= 8, false)}>Send</button>
              </div>
              {friendMsg && <div style={{ fontSize: 12, color: friendMsg.includes('sent') || friendMsg.includes('Sending') ? '#4ade80' : '#f87171', marginTop: 8, textAlign: 'center' }}>{friendMsg}</div>}
            </div>

            {incomingRequests && incomingRequests.length > 0 && (
              <div style={{ background: S.card, borderRadius: 10, padding: 16, border: `1px solid ${S.accent}`, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>Friend Requests ({incomingRequests.length})</div>
                {incomingRequests.map(req => (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${S.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Avatar src={req.photoURL} name={req.displayName} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.displayName || 'BBQ Fan'}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{req.friendCode || ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={async () => {
                        const result = await acceptFriendRequest(fbUser.uid, req.id);
                        if (result.ok) {
                          track('friend_request_accepted');
                          const [reqs, friends] = await Promise.all([getIncomingFriendRequests(fbUser.uid), getFriendsList(fbUser.uid)]);
                          setIncomingRequests(reqs); setFbFriends(friends);
                        } else { setFriendMsg(result.error); setTimeout(() => setFriendMsg(''), 3000); }
                      }} style={{ ...sBtn(true, true), padding: '6px 12px' }}>Accept</button>
                      <button onClick={async () => {
                        if (!window.confirm(`Reject request from ${req.displayName || 'BBQ Fan'}?`)) return;
                        const result = await rejectFriendRequest(fbUser.uid, req.id);
                        if (result.ok) { const reqs = await getIncomingFriendRequests(fbUser.uid); setIncomingRequests(reqs); }
                      }} style={{ background: 'none', border: `1px solid ${S.border}`, color: S.muted, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: S.card, borderRadius: 10, padding: 16, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>Friends ({fbFriends.length})</div>
              {fbFriends.length === 0 ? (
                <div style={{ fontSize: 13, color: S.muted, textAlign: 'center', padding: '16px 0' }}>No friends yet. Share your code or enter a friend's code above.</div>
              ) : fbFriends.map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar src={f.photoURL} name={f.displayName} size={32} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{f.displayName}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{f.friendCode || ''}</div>
                    </div>
                  </div>
                  <button onClick={async () => {
                    if (!window.confirm(`Remove ${f.displayName}?`)) return;
                    await removeFriendConnection(fbUser.uid, f.id);
                    const friends = await getFriendsList(fbUser.uid); setFbFriends(friends);
                  }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 18 }}>{'✕'}</button>
                </div>
              ))}
            </div>
          </Section>

          {/* SYNC */}
          <Section label="SYNC">
            <div style={{ background: S.card, borderRadius: 10, padding: 16, border: `1px solid ${S.border}`, fontSize: 13, color: S.muted, lineHeight: 1.6 }}>
              Signed in as <span style={{ color: S.text }}>{fbUser.email}</span>. Your reviews sync to Google automatically each time you save.
              {syncStatus === 'done' && <span style={{ color: '#4ade80' }}>{' '}✓ Up to date.</span>}
            </div>
          </Section>
        </>
      ) : (
        <Section label="ACCOUNT">
          <div style={{ fontSize: 14, color: S.muted, marginBottom: 16, textAlign: 'center' }}>Sign in to sync across devices and add friends.</div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <button onClick={async () => { await attemptSignIn(); }} style={{ ...sBtn(true, false), padding: '14px 32px' }}>Sign In with Google</button>
            <button onClick={async () => { await attemptAppleSignIn(); }} style={{ ...sBtn(false, false), padding: '14px 32px' }}>Sign In with Apple</button>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: S.muted, letterSpacing: 2, margin: '14px 0 4px' }}>OR</div>
          <EmailSignInBox S={S} sBtn={sBtn} sInput={sInput} />
        </Section>
      )}

      {/* DATA — always available */}
      <Section label="DATA">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { exportBackup(); track('export_backup'); }} style={{ ...sBtn(false, true), flex: 1 }}>Export Backup</button>
          <button onClick={() => importRef.current?.click()} style={{ ...sBtn(false, true), flex: 1 }}>Import Backup</button>
          <button onClick={() => { exportCSV(reviews); track('export_csv'); }} style={{ ...sBtn(false, true), flex: 1 }}>Export CSV</button>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={handleImport} style={{ display: 'none' }} />
        </div>
      </Section>

      {/* ACCOUNT actions — always available */}
      <Section label={fbUser ? 'ACCOUNT' : 'HELP'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={reportProblem} style={{ ...sBtn(false, true), width: '100%', textAlign: 'left' }}>Report a Problem</button>
          <button onClick={() => {
            const shareData = { title: 'BBQ Scorecard by Holy Smokes BBQ Co', text: 'Score BBQ restaurants across 10 categories, track visits, and compare with friends.', url: 'https://holysmokesbbqco.com/scorecard' };
            if (navigator.share) navigator.share(shareData).catch(() => {});
            else { navigator.clipboard?.writeText(shareData.url); alert('Link copied!'); }
            track('share_app', { from: 'settings' });
          }} style={{ ...sBtn(false, true), width: '100%', textAlign: 'left' }}>Share BBQ Scorecard</button>
          <button onClick={() => openUrl('privacy.html')} style={{ ...sBtn(false, true), width: '100%', textAlign: 'left' }}>Privacy Policy</button>
          <button onClick={() => openUrl('changelog.html')} style={{ ...sBtn(false, true), width: '100%', textAlign: 'left' }}>Changelog</button>
          <button onClick={() => openUrl('delete-account.html')} style={{ ...sBtn(false, true), width: '100%', textAlign: 'left', color: '#f87171', borderColor: '#f87171' }}>Delete Account</button>
          {fbUser && (
            <button onClick={async () => {
              if (!window.confirm('Sign out of BBQ Scorecard? Your local reviews stay on this device.')) return;
              await firebaseSignOut(); track('sign_out'); setView('home');
            }} style={{ ...sBtn(false, true), width: '100%', textAlign: 'left', color: '#f87171', borderColor: '#f87171' }}>Sign Out</button>
          )}
        </div>
      </Section>

      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} />}
    </div>
  );
}
