import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { deleteAccount } from '../accountDeletion.js';
import { firebaseDeletionOps, SCORECARD_OWNED } from '../accountDeletionFirebase.js';

// In-app account deletion (legal register #1, Apple 5.1.1(v)). The order
// and failure rules live in accountDeletion.js; this is only the screen.

const STAGE_TEXT = {
  reauth: "Confirming it's you…",
  data: 'Deleting your reviews, photos and friends…',
  account: 'Deleting your account…',
  device: 'Clearing this phone…',
};

function errorText(res) {
  if (res.stage === 'reauth') {
    if (res.error === 'auth/user-mismatch') return "That's a different account from the one signed in here. Nothing was deleted.";
    if (res.error === 'auth/wrong-password' || res.error === 'auth/invalid-credential') return 'That password is wrong. Nothing was deleted.';
    if (res.error === 'auth/missing-password') return 'Enter your password to confirm. Nothing was deleted.';
    return "We couldn't confirm it's you, so nothing was deleted. Try again.";
  }
  if (res.stage === 'data') return "Some of your data couldn't be deleted, so your account was kept and you can try again. If it keeps failing, email support@holysmokesbbqco.com.";
  if (res.stage === 'auth') return 'Your data is deleted, but your sign-in record is still there. Tap Try again to finish.';
  return 'Something went wrong. Try again.';
}

export default function DeleteAccountScreen({ onClose }) {
  const { S, sBtn, sInput, reviews, fbUser } = useAppContext();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState('confirm'); // confirm | working | done | error
  const [stage, setStage] = useState('');
  const [message, setMessage] = useState('');

  const providerIds = (fbUser?.providerData || []).map((p) => p.providerId);
  const needsPassword = providerIds.includes('password') && !providerIds.includes('google.com') && !providerIds.includes('apple.com');
  const isIOS = typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'ios';
  const ready = typed.trim().toUpperCase() === 'DELETE' && (!needsPassword || password.length > 0);
  const count = (reviews || []).length;

  const run = async () => {
    setPhase('working');
    setMessage('');
    const res = await deleteAccount({
      ops: firebaseDeletionOps,
      ownedCollections: SCORECARD_OWNED,
      password: needsPassword ? password : undefined,
      onProgress: setStage,
    });
    if (res.ok) { setPhase('done'); return; }
    setMessage(errorText(res));
    setPhase('error');
  };

  const box = {
    background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px',
    padding: '22px 20px', maxWidth: '400px', width: '100%', color: S.text,
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-account-title"
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'working') onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div style={box}>
        <h2 id="delete-account-title" style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700, letterSpacing: '1px', color: '#f87171', margin: '0 0 10px' }}>
          {phase === 'done' ? 'Account deleted' : 'Delete your account?'}
        </h2>

        {phase === 'confirm' && (
          <>
            <div style={{ fontSize: '14px', lineHeight: 1.55, marginBottom: '12px' }}>
              This permanently deletes:
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                <li>your {count === 1 ? 'review' : `${count} reviews`} and their photos</li>
                <li>your friends and friend requests</li>
                <li>your profile and friend code</li>
                <li>your sign-in</li>
              </ul>
            </div>
            <div style={{ fontSize: '13px', color: S.muted, lineHeight: 1.5, marginBottom: '14px' }}>
              It also clears Scorecard's data from this phone. This can't be reversed.
              {isIOS && ' Your App Store purchase isn\'t affected; you can restore it later.'}
            </div>
            {needsPassword && (
              <input type="password" aria-label="Your password" placeholder="Your password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ ...sInput(), marginBottom: '10px' }} />
            )}
            <label style={{ display: 'block', fontSize: '12px', color: S.muted, marginBottom: '6px' }} htmlFor="delete-confirm">
              Type DELETE to confirm
            </label>
            <input id="delete-confirm" type="text" autoCapitalize="characters" autoComplete="off"
              value={typed} onChange={(e) => setTyped(e.target.value)}
              style={{ ...sInput(), marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onClose} style={{ ...sBtn(false, true), flex: 1 }}>Cancel</button>
              <button onClick={run} disabled={!ready}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '14px',
                  background: ready ? '#dc2626' : '#555', color: '#fff', cursor: ready ? 'pointer' : 'default' }}>
                Delete account
              </button>
            </div>
          </>
        )}

        {phase === 'working' && (
          <div role="status" aria-live="polite" style={{ fontSize: '14px', color: S.text, padding: '10px 0' }}>
            {STAGE_TEXT[stage] || 'Working…'}
            {stage === 'reauth' && <div style={{ fontSize: '12px', color: S.muted, marginTop: '6px' }}>Sign in once more when asked.</div>}
          </div>
        )}

        {phase === 'error' && (
          <>
            <div role="alert" style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>{message}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onClose} style={{ ...sBtn(false, true), flex: 1 }}>Close</button>
              <button onClick={run} style={{ ...sBtn(true, true), flex: 1 }}>Try again</button>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <div style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Your account and your data are deleted, and Scorecard has been cleared from this phone.
            </div>
            <button onClick={() => window.location.reload()} style={{ ...sBtn(true, true), width: '100%' }}>OK</button>
          </>
        )}
      </div>
    </div>
  );
}
