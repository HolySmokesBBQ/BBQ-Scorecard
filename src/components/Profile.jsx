import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { calcScores, track } from '../scoring.js';
import {
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  getIncomingFriendRequests, removeFriendConnection, getFriendsList,
  firebaseSignOut,
} from '../firebaseSync.js';
import Avatar from './Avatar.jsx';
import EmailSignInBox from './EmailSignInBox.jsx';
import AboutScreen from './AboutScreen.jsx';

export default function Profile() {
  const {
    S, sBtn, sInput,
    setView, reviews,
    fbUser, userProfile,
    fbFriends, setFbFriends,
    incomingRequests, setIncomingRequests,
    friendCodeInput, setFriendCodeInput,
    friendMsg, setFriendMsg,
    attemptSignIn, attemptAppleSignIn, authBusy, authError,
  } = useAppContext();

  const [showAbout, setShowAbout] = useState(false);

  return (
    <div className="bbq-container" style={{ padding: '16px' }}>
      <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: S.accent, fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}>Back</button>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', letterSpacing: '2px', marginBottom: '16px' }}>Your Profile</h2>

      {fbUser && userProfile ? (
        <>
          <div className="bbq-profile-grid">
          {/* Profile card */}
          <div style={{ background: S.card, borderRadius: '10px', padding: '20px', border: `1px solid ${S.border}`, marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
              <Avatar src={fbUser.photoURL} name={fbUser.displayName} size={64} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{fbUser.displayName}</div>
            <div style={{ fontSize: '12px', color: S.muted, marginBottom: '12px' }}>{fbUser.email}</div>
            <div style={{ fontSize: '12px', color: S.muted, letterSpacing: '1px', marginBottom: '4px' }}>Your Friend Code</div>
            <div style={{
              fontSize: '28px', fontWeight: '700', fontFamily: "'Oswald', sans-serif",
              color: S.accent, letterSpacing: '4px', padding: '8px 0',
            }}>{userProfile.friendCode}</div>
            <button onClick={() => {
              const url = `${window.location.origin}/#add-friend/${userProfile.friendCode}`;
              if (navigator.share) navigator.share({ title: 'Join me on Holy Smokes BBQ', text: `Add me on BBQ Scorecard! My friend code is ${userProfile.friendCode}`, url });
              else { navigator.clipboard?.writeText(userProfile.friendCode); alert('Friend code copied!'); }
            }} style={{ ...sBtn(true, true), marginTop: '8px' }}>Share Code</button>
          </div>

          {/* Send Friend Request */}
          <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Add a Friend</div>
            <div style={{ fontSize: '11px', color: S.muted, marginBottom: '10px' }}>
              Enter their code to send a request. They must accept before you can see each other's {import.meta.env.VITE_NOTEBOOK_BUILD ? 'cooks' : 'reviews'}.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={friendCodeInput} onChange={e => setFriendCodeInput(e.target.value.toUpperCase())}
                placeholder="BBQ-XXXXXX" maxLength={10}
                onKeyDown={e => { if (e.key === 'Enter') {
                  e.preventDefault();
                  (async () => {
                    setFriendMsg('Sending...');
                    const result = await sendFriendRequest(fbUser.uid, friendCodeInput);
                    setFriendMsg(result.ok ? 'Request sent' : result.error);
                    if (result.ok) {
                      track('friend_request_sent');
                      setFriendCodeInput('BBQ-');
                    }
                    setTimeout(() => setFriendMsg(''), 4000);
                  })();
                }}}
                style={{ ...sInput(), flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: '16px', letterSpacing: '2px', textAlign: 'center' }} />
              <button onClick={async () => {
                setFriendMsg('Sending...');
                const result = await sendFriendRequest(fbUser.uid, friendCodeInput);
                setFriendMsg(result.ok ? 'Request sent' : result.error);
                if (result.ok) {
                  track('friend_request_sent');
                  setFriendCodeInput('BBQ-');
                }
                setTimeout(() => setFriendMsg(''), 4000);
              }} disabled={friendCodeInput.length < 8} style={sBtn(friendCodeInput.length >= 8, false)}>Send</button>
            </div>
            {friendMsg && (
              <div style={{ fontSize: '12px', color: friendMsg.includes('sent') || friendMsg.includes('Sending') ? '#4ade80' : '#f87171', marginTop: '8px', textAlign: 'center' }}>{friendMsg}</div>
            )}
          </div>

          {/* Pending Incoming Requests */}
          {incomingRequests && incomingRequests.length > 0 && (
            <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.accent}`, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>
                Friend Requests ({incomingRequests.length})
              </div>
              {incomingRequests.map(req => (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Avatar src={req.photoURL} name={req.displayName} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.displayName || 'BBQ Fan'}</div>
                      <div style={{ fontSize: '11px', color: S.muted }}>{req.friendCode || ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={async () => {
                      const result = await acceptFriendRequest(fbUser.uid, req.id);
                      if (result.ok) {
                        track('friend_request_accepted');
                        const [reqs, friends] = await Promise.all([
                          getIncomingFriendRequests(fbUser.uid),
                          getFriendsList(fbUser.uid),
                        ]);
                        setIncomingRequests(reqs);
                        setFbFriends(friends);
                      } else {
                        setFriendMsg(result.error);
                        setTimeout(() => setFriendMsg(''), 3000);
                      }
                    }} style={{ ...sBtn(true, true), padding: '6px 12px' }}>Accept</button>
                    <button onClick={async () => {
                      if (!window.confirm(`Reject request from ${req.displayName || 'BBQ Fan'}?`)) return;
                      const result = await rejectFriendRequest(fbUser.uid, req.id);
                      if (result.ok) {
                        const reqs = await getIncomingFriendRequests(fbUser.uid);
                        setIncomingRequests(reqs);
                      }
                    }} style={{ background: 'none', border: `1px solid ${S.border}`, color: S.muted, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friends list */}
          <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>
              Friends ({fbFriends.length})
            </div>
            {fbFriends.length === 0 ? (
              <div style={{ fontSize: '13px', color: S.muted, textAlign: 'center', padding: '16px 0' }}>
                No friends yet. Share your code or enter a friend's code above.
              </div>
            ) : (
              fbFriends.map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar src={f.photoURL} name={f.displayName} size={32} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>{f.displayName}</div>
                      <div style={{ fontSize: '11px', color: S.muted }}>{f.friendCode || ''}</div>
                    </div>
                  </div>
                  <button onClick={async () => {
                    if (!window.confirm(`Remove ${f.displayName}?`)) return;
                    await removeFriendConnection(fbUser.uid, f.id);
                    const friends = await getFriendsList(fbUser.uid);
                    setFbFriends(friends);
                  }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '18px' }}>{'✕'}</button>
                </div>
              ))
            )}
          </div>

          </div>{/* end bbq-profile-grid */}

          {/* Stats — Scorecard side only. In the Notebook build the
              dedicated Stats page (NotebookStats.jsx) carries cook-side
              numbers, so we don't display restaurant review counts here. */}
          {!import.meta.env.VITE_NOTEBOOK_BUILD && (
            <div style={{ background: S.card, borderRadius: '10px', padding: '16px', border: `1px solid ${S.border}`, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: S.accent, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' }}>Your Stats</div>
              <div className="bbq-stats-grid">
                <div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{reviews.length}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>Reviews</div>
                </div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>{fbFriends.length}</div>
                  <div style={{ fontSize: '11px', color: S.muted }}>Friends</div>
                </div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: S.accent, fontFamily: "'Oswald', sans-serif" }}>
                    {reviews.length ? (reviews.map(r => calcScores(r.scores).composite).reduce((a, b) => a + b, 0) / reviews.length).toFixed(1) : '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: S.muted }}>Avg Score</div>
                </div>
              </div>
            </div>
          )}

          {/* Show walkthrough again — clears the onboarded flag so the
              onboarding overlay re-appears on next home view. */}
          <button onClick={() => {
            try { localStorage.removeItem('bbq-onboarded'); } catch {}
            track('walkthrough_replayed');
            setView('home');
          }}
            style={{ ...sBtn(false, true), width: '100%', marginBottom: '8px' }}>Show app walkthrough again</button>

          {/* Sign out — confirm first so a stray tap doesn't blow away the session. */}
          <button onClick={async () => {
            if (!window.confirm('Sign out of BBQ Scorecard? Your local reviews stay on this device.')) return;
            await firebaseSignOut();
            track('sign_out');
            setView('home');
          }}
            style={{ ...sBtn(false, true), width: '100%', color: '#f87171', borderColor: '#f87171' }}>Sign Out</button>

          {/* About the family — replaces the earlier standalone
              "GET BBQ NOTEBOOK →" link. The About modal (ported from
              Board 2026-07-14) frames Notebook and Board together as
              part of the Holy Smokes family, so Board finally gets a
              discovery surface too. */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={() => {
                track('scorecard_about_opened');
                setShowAbout(true);
              }}
              style={{
                background: 'none', border: 'none', padding: '4px 8px',
                fontFamily: "'Oswald', sans-serif", fontSize: '12px',
                letterSpacing: '1px', color: S.accent, cursor: 'pointer',
              }}
            >
              ABOUT HOLY SMOKES BBQ
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding: '24px 0' }}>
          <div style={{ fontSize: '14px', color: S.muted, marginBottom: '16px', textAlign: 'center' }}>Sign in to create your profile and add friends.</div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            <button onClick={attemptSignIn} disabled={!!authBusy}
              style={{ ...sBtn(true, false), padding: '14px 32px' }}>
              {authBusy === 'google' ? 'Signing in…' : 'Sign In with Google'}
            </button>
            <button onClick={attemptAppleSignIn} disabled={!!authBusy}
              style={{ ...sBtn(false, false), padding: '14px 32px' }}>
              {authBusy === 'apple' ? 'Signing in…' : 'Sign In with Apple'}
            </button>
          </div>
          {authError && (
            <div style={{
              fontSize: '12px', color: '#fca5a5', background: '#3a1717',
              border: '1px solid #f87171', borderRadius: '6px',
              padding: '8px 10px', marginTop: '10px', textAlign: 'center',
            }}>{authError}</div>
          )}
          <div style={{
            textAlign: 'center', fontSize: '11px', color: S.muted,
            letterSpacing: '2px', margin: '14px 0 4px',
          }}>OR</div>
          <EmailSignInBox S={S} sBtn={sBtn} sInput={sInput} />
        </div>
      )}

      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} />}
    </div>
  );
}
