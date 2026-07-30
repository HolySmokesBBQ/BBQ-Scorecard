import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { useCookContext } from '../context/CookContext.jsx';
import {
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  getIncomingFriendRequests, removeFriendConnection, getFriendsList,
  firebaseSignOut,
} from '../firebaseSync.js';
import { track } from '../scoring.js';
import Avatar from './Avatar.jsx';
import EmailSignInBox from './EmailSignInBox.jsx';
import { exportAllCooksToCsv, exportAllRecipesToCsv } from '../cookCsv.js';

// Settings — Appearance, Profile, Friends, Sync, Data, Danger.
// Replaces the old Profile page and consolidates all app config in
// one place. Reachable from the hamburger menu.

const ACCENT = '#4A6741';

const SECTION_LABEL = {
  fontSize: 11, color: 'inherit', letterSpacing: 2, marginBottom: 10, marginTop: 24,
  fontFamily: "'Oswald', sans-serif",
};

const CARD = (S) => ({
  background: S.card, border: `1px solid ${S.border}`, borderRadius: 10,
  padding: 16, marginBottom: 12,
});

export default function NotebookSettings() {
  const {
    S, sBtn, sInput,
    themePref, setThemePref,
    setView, navigateTo,
    fbUser, userProfile,
    fbFriends, setFbFriends,
    incomingRequests, setIncomingRequests,
    friendCodeInput, setFriendCodeInput,
    friendMsg, setFriendMsg,
    attemptSignIn,
  } = useAppContext();
  const {
    cooks, recipes,
    syncWithCloud, cookSyncStatus,
  } = useCookContext();

  const themeOptions = [
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
    { key: 'system', label: 'Same as system' },
  ];

  return (
    <>
      <header style={{ background: '#121a14', borderBottom: `1px solid ${S.border}`, padding: '14px 16px' }}>
        <div className="bbq-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}>
          <button
            onClick={() => navigateTo('home')}
            style={{ background: 'none', border: 'none', color: S.muted, fontSize: 14, cursor: 'pointer', padding: 0 }}
          >
            ← Home
          </button>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>
            SETTINGS
          </div>
          <div style={{ width: 60 }} />
        </div>
      </header>

      <div className="bbq-container" style={{ padding: '20px 16px', maxWidth: 560 }}>

        {/* APPEARANCE */}
        <div style={{ ...SECTION_LABEL, color: S.muted }}>APPEARANCE</div>
        <div style={CARD(S)}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Theme</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {themeOptions.map(opt => {
              const active = themePref === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setThemePref(opt.key)}
                  style={{
                    ...sBtn(active, true),
                    padding: '8px 14px',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* PROFILE + ACCOUNT (only when signed in) */}
        {fbUser && userProfile ? (
          <>
            <div style={{ ...SECTION_LABEL, color: S.muted }}>PROFILE</div>
            <div style={{ ...CARD(S), textAlign: 'center' }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <Avatar src={fbUser.photoURL} name={fbUser.displayName} size={64} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{fbUser.displayName}</div>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 12 }}>{fbUser.email}</div>
              <div style={{ fontSize: 11, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>Your Friend Code</div>
              <div style={{
                fontSize: 26, fontWeight: 700, fontFamily: "'Oswald', sans-serif",
                color: ACCENT, letterSpacing: 4, padding: '6px 0',
              }}>
                {userProfile.friendCode}
              </div>
              <button
                onClick={() => {
                  const code = userProfile.friendCode;
                  if (navigator.share) {
                    navigator.share({
                      title: 'Add me on BBQ Notebook',
                      text: `Add me on BBQ Notebook! My friend code is ${code}`,
                    });
                  } else {
                    navigator.clipboard?.writeText(code);
                    alert('Friend code copied!');
                  }
                }}
                style={{ ...sBtn(true, true), marginTop: 8 }}
              >
                Share Code
              </button>
            </div>

            {/* FRIENDS */}
            <div style={{ ...SECTION_LABEL, color: S.muted }}>FRIENDS</div>
            <div style={CARD(S)}>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>
                Add a friend by their code
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={e => setFriendCodeInput(e.target.value.toUpperCase())}
                  placeholder="BBQ-XXXXXX"
                  maxLength={10}
                  style={{ ...sInput(), flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: 15, letterSpacing: 2, textAlign: 'center' }}
                />
                <button
                  onClick={async () => {
                    setFriendMsg('Sending...');
                    const result = await sendFriendRequest(fbUser.uid, friendCodeInput);
                    setFriendMsg(result.ok ? 'Request sent' : result.error);
                    if (result.ok) {
                      track('friend_request_sent');
                      setFriendCodeInput('BBQ-');
                    }
                    setTimeout(() => setFriendMsg(''), 4000);
                  }}
                  style={sBtn(true, true)}
                >
                  Send
                </button>
              </div>
              {friendMsg && (
                <div style={{ fontSize: 12, color: friendMsg.includes('sent') ? '#4ade80' : '#f87171', marginTop: 8, textAlign: 'center' }}>
                  {friendMsg}
                </div>
              )}
              {incomingRequests?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: S.muted, letterSpacing: 1, marginBottom: 8 }}>INCOMING REQUESTS</div>
                  {incomingRequests.map(req => (
                    <div key={req.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${S.border}` }}>
                      <div>{req.displayName || req.uid.slice(0, 8)}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={async () => {
                          await acceptFriendRequest(fbUser.uid, req.uid);
                          const [reqs, friends] = await Promise.all([
                            getIncomingFriendRequests(fbUser.uid),
                            getFriendsList(fbUser.uid),
                          ]);
                          setIncomingRequests(reqs);
                          setFbFriends(friends);
                        }} style={{ ...sBtn(true, true), padding: '4px 10px' }}>Accept</button>
                        <button onClick={async () => {
                          await rejectFriendRequest(fbUser.uid, req.uid);
                          setIncomingRequests(await getIncomingFriendRequests(fbUser.uid));
                        }} style={{ ...sBtn(false, true), padding: '4px 10px' }}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {fbFriends?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: S.muted, letterSpacing: 1, marginBottom: 8 }}>YOUR FRIENDS</div>
                  {fbFriends.map(f => (
                    <div key={f.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${S.border}` }}>
                      <div>{f.displayName || f.uid.slice(0, 8)}</div>
                      <button onClick={async () => {
                        if (!window.confirm(`Remove ${f.displayName || 'this friend'}?`)) return;
                        await removeFriendConnection(fbUser.uid, f.uid);
                        setFbFriends(await getFriendsList(fbUser.uid));
                      }} style={{ ...sBtn(false, true), padding: '4px 10px', color: '#f87171', borderColor: '#f87171' }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SYNC */}
            <div style={{ ...SECTION_LABEL, color: S.muted }}>SYNC</div>
            <div style={CARD(S)}>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>
                Cooks and recipes sync to the cloud automatically when you save them (while signed in).
                Tap below to force a full sync if things look out of date.
              </div>
              <button
                onClick={() => syncWithCloud(fbUser.uid)}
                disabled={cookSyncStatus === 'syncing'}
                style={{
                  ...sBtn(cookSyncStatus === 'done', true),
                  width: '100%',
                  opacity: cookSyncStatus === 'syncing' ? 0.6 : 1,
                }}
              >
                {cookSyncStatus === 'syncing' ? 'Syncing…'
                  : cookSyncStatus === 'done' ? 'Synced ✓'
                  : cookSyncStatus === 'error' ? 'Retry sync'
                  : 'Sync now'}
              </button>
            </div>

            {/* DATA */}
            <div style={{ ...SECTION_LABEL, color: S.muted }}>DATA</div>
            <div style={CARD(S)}>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
                Export your cooks or recipes as a spreadsheet.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => exportAllCooksToCsv(cooks)} style={sBtn(false, true)}>Export cooks CSV</button>
                <button onClick={() => exportAllRecipesToCsv(recipes)} style={sBtn(false, true)}>Export recipes CSV</button>
              </div>
            </div>

            {/* DANGER */}
            <div style={{ ...SECTION_LABEL, color: S.muted }}>ACCOUNT</div>
            <div style={CARD(S)}>
              <button
                onClick={async () => {
                  if (!window.confirm('Sign out of BBQ Notebook? Your local cooks stay on this device.')) return;
                  await firebaseSignOut();
                  track('sign_out');
                  setView('home');
                }}
                style={{ ...sBtn(false, true), width: '100%', color: '#f87171', borderColor: '#f87171' }}
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ ...SECTION_LABEL, color: S.muted }}>ACCOUNT</div>
            <div style={CARD(S)}>
              <div style={{ fontSize: 13, color: S.text, marginBottom: 12, textAlign: 'center' }}>
                Sign in to back up your cooks to the cloud and share with friends.
              </div>
              <button
                onClick={async () => { await attemptSignIn(); }}
                style={{ ...sBtn(true, false), width: '100%', padding: '12px 24px', marginBottom: 8 }}
              >
                Sign In with Google
              </button>
              <div style={{ textAlign: 'center', fontSize: 11, color: S.muted, letterSpacing: 2, margin: '10px 0 6px' }}>OR</div>
              <EmailSignInBox S={S} sBtn={sBtn} sInput={sInput} />
            </div>
          </>
        )}

      </div>
    </>
  );
}
