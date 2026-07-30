import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';

// Email/password auth UI — toggles between Sign In and Sign Up, plus a
// "Forgot password" mode that just collects the email and triggers a
// reset link. Renders alongside the Google Sign-In button, never as a
// replacement, so users keep both paths.

const ACCENT = '#4A6741';

export default function EmailSignInBox({ S, sBtn, sInput, onSignedIn }) {
  const { attemptEmailSignIn, attemptEmailSignUp, sendPasswordReset } = useAppContext();

  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (mode === 'reset') {
        const r = await sendPasswordReset(email);
        if (r?.error) setErr(r.error);
        else { setMsg('Reset link sent — check your email.'); track('password_reset_requested'); }
      } else if (mode === 'signUp') {
        const r = await attemptEmailSignUp(email, password);
        if (r?.error) { setErr(r.error); track('signin_failed', { method: 'email_signup', reason: r.error.slice(0, 60) }); }
        else { track('sign_up', { method: 'email' }); onSignedIn?.(r.user); }
      } else {
        const r = await attemptEmailSignIn(email, password);
        if (r?.error) { setErr(r.error); track('signin_failed', { method: 'email', reason: r.error.slice(0, 60) }); }
        else { track('sign_in', { method: 'email' }); onSignedIn?.(r.user); }
      }
    } finally {
      setBusy(false);
    }
  };

  const submitDisabled = busy
    || !email
    || (mode !== 'reset' && (!password || password.length < 6));

  return (
    <div style={{
      background: S.dark, border: `1px solid ${S.border}`,
      borderRadius: '10px', padding: '14px', marginTop: '12px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '12px',
        fontSize: '12px', letterSpacing: '1px',
      }}>
        <button onClick={() => { setMode('signIn'); setErr(null); setMsg(null); }}
          style={tabBtnStyle(mode === 'signIn', S)}>SIGN IN</button>
        <button onClick={() => { setMode('signUp'); setErr(null); setMsg(null); }}
          style={tabBtnStyle(mode === 'signUp', S)}>SIGN UP</button>
        <button onClick={() => { setMode('reset'); setErr(null); setMsg(null); }}
          style={tabBtnStyle(mode === 'reset', S)}>FORGOT</button>
      </div>

      <input type="email" placeholder="Email" autoComplete="email"
        value={email} onChange={e => setEmail(e.target.value)}
        style={{ ...sInput(), width: '100%', marginBottom: '8px' }} />

      {mode !== 'reset' && (
        <input type="password" placeholder={mode === 'signUp' ? 'New password (6+ chars)' : 'Password'}
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          value={password} onChange={e => setPassword(e.target.value)}
          style={{ ...sInput(), width: '100%', marginBottom: '8px' }} />
      )}

      {err && (
        <div style={{
          fontSize: '12px', color: '#fca5a5', background: '#3a1717',
          border: '1px solid #f87171', borderRadius: '6px',
          padding: '8px 10px', marginBottom: '8px',
        }}>{err}</div>
      )}
      {msg && (
        <div style={{
          fontSize: '12px', color: '#86efac', background: '#1f3d24',
          border: `1px solid ${ACCENT}`, borderRadius: '6px',
          padding: '8px 10px', marginBottom: '8px',
        }}>{msg}</div>
      )}

      <button onClick={submit} disabled={submitDisabled}
        style={{
          ...sBtn(!submitDisabled, false),
          width: '100%', padding: '10px',
          background: submitDisabled ? '#444' : ACCENT,
          color: '#fff', border: 'none',
        }}>
        {busy ? 'Working...'
          : mode === 'reset' ? 'Send reset link'
          : mode === 'signUp' ? 'Create account'
          : 'Sign in with email'}
      </button>
    </div>
  );
}

function tabBtnStyle(active, S) {
  return {
    background: 'none', border: 'none',
    color: active ? ACCENT : S.muted,
    cursor: 'pointer', fontWeight: '700',
    letterSpacing: '1px', fontSize: '11px',
    padding: '4px 0',
    borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
  };
}
