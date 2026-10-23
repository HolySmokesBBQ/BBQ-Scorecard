import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase.board.js';
import { STATES } from './schema.js';
import { nativeAppVersion } from '../diagnostics.js';
import { signInErrorMessage } from './signIn.js';
import { setConsent } from '../consent.js';
import { useConsent, openBoardPrivacyPolicy } from './ConsentPrompt.jsx';
import { fetchMySubmissions, deleteSubmission, submissionLabel } from './mySubmissions.js';
import { track } from './analytics.js';
import { deleteBoardAccount, deletionOutcome } from './accountDeletion.board.js';
import { boardDeletionOps } from './accountDeletionFirebase.board.js';

// Board Settings — minimal by design. Board has less user-owned state
// than Scorecard/Notebook (no cooks, no reviews to export). This
// screen only surfaces things a user actually might want to change:
// default region + radius + units, plus authentication and legal links.

const PAL = {
  bg: '#1a1a1a', panel: '#232830', panelDeep: '#1c2027',
  border: '#3a4048', brass: '#d4a64a',
  text: '#f5e6d3', textDim: '#9aa3ad',
};

const S = {
  card: {
    background: PAL.panel, border: `1px solid ${PAL.border}`,
    borderRadius: 8, padding: 16, marginBottom: 16,
  },
  h2: {
    fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700,
    letterSpacing: 2, color: PAL.brass, margin: '0 0 12px 0',
  },
  label: { display: 'block', fontSize: 12, color: PAL.textDim, marginBottom: 6, letterSpacing: 1 },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: PAL.panelDeep, border: `1px solid ${PAL.border}`,
    borderRadius: 6, padding: '10px 12px', color: PAL.text, fontSize: 15,
  },
  chip: (active) => ({
    background: active ? PAL.brass : PAL.panelDeep,
    color: active ? '#1a1a1a' : PAL.text,
    border: `1px solid ${active ? PAL.brass : PAL.border}`,
    borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }),
  link: {
    color: PAL.brass, textDecoration: 'none', fontSize: 14, display: 'block',
    padding: '10px 0', borderBottom: `1px solid ${PAL.border}`,
  },
  btn: {
    background: 'transparent', border: `1px solid ${PAL.border}`,
    color: PAL.text, borderRadius: 6, padding: '8px 16px', cursor: 'pointer',
    fontSize: 14,
  },
};

const LS_REGION = 'board-default-region';
// STATES is keyed by state code, not an array — iterate its values and
// sort by label so the picker reads alphabetically by state name rather
// than by code (which put Arkansas ahead of Arizona).
const STATE_OPTIONS = Object.values(STATES).sort((a, b) => a.label.localeCompare(b.label));
const LS_RADIUS = 'board-default-radius';
const LS_UNITS = 'board-distance-units';
const RADIUS_OPTIONS = [10, 25, 50, 100];
const UNIT_OPTIONS = ['mi', 'km'];

function readLS(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeLS(key, value) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch {}
}

export default function Settings({ user, onSignIn, onClose }) {
  const [region, setRegion] = useState(() => readLS(LS_REGION, 'WI'));
  const [radius, setRadius] = useState(() => parseInt(readLS(LS_RADIUS, '25'), 10));
  const [units, setUnits] = useState(() => readLS(LS_UNITS, 'mi'));

  // Ask the platform what is actually installed rather than printing a
  // constant. On web there is no Capacitor App plugin, so it falls back to
  // the build-time version.
  // nativeAppVersion resolves to 'unknown' off-native (no Capacitor App
  // plugin in a browser), and 'BBQ Board vunknown' is worse than no version
  // at all — so treat it as absent.
  const [appVersion, setAppVersion] = useState(import.meta.env?.VITE_BUILD_VERSION || '');
  const showVersion = appVersion && appVersion !== 'unknown';

  // handleSignIn throws on failure now (it used to swallow it). Catch it
  // here and say so, rather than leaving the button looking dead.
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const handleSignInClick = async () => {
    setSignInBusy(true);
    setSignInError('');
    try {
      await onSignIn();
    } catch (e) {
      setSignInError(signInErrorMessage(e) || ''); // '' on a deliberate cancel
    } finally {
      setSignInBusy(false);
    }
  };
  useEffect(() => {
    let live = true;
    nativeAppVersion(import.meta.env?.VITE_BUILD_VERSION || '')
      .then(v => { if (live) setAppVersion(v); });
    return () => { live = false; };
  }, []);

  // Analytics choice lives here as well as on the home card, outside the
  // signed-in branch: withdrawing has to be as easy as allowing, and someone
  // who never signs in still needs to reach it.
  const consent = useConsent();
  const analyticsOn = consent?.choice === 'granted';

  // Own submissions, newest first, with delete.
  const [subs, setSubs] = useState(null); // null = not loaded
  const [subsError, setSubsError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) { setSubs(null); return; }
    let live = true;
    setSubsError('');
    fetchMySubmissions(db, uid)
      .then(rows => { if (live) setSubs(rows); })
      .catch(() => { if (live) { setSubs([]); setSubsError("Couldn't load your submissions. Check your connection and try again."); } });
    return () => { live = false; };
  }, [uid]);

  const handleDelete = async (id) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setDeletingId(id);
    setSubsError('');
    try {
      await deleteSubmission(db, id);
      setSubs(rows => (rows || []).filter(r => r.id !== id));
      track('board_submission_deleted');
    } catch {
      setSubsError("That price couldn't be deleted. Try again.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  // Delete account (legal register #1). 'idle' | 'confirm' | 'busy' | 'done'.
  const [delState, setDelState] = useState('idle');
  const [delResult, setDelResult] = useState(null);
  const handleDeleteAccount = async () => {
    setDelState('busy');
    setDelResult(null);
    const r = await deleteBoardAccount({ ops: boardDeletionOps });
    setDelResult(r);
    setDelState(r.ok ? 'done' : 'confirm');
  };

  const handleRegion = (v) => { setRegion(v); writeLS(LS_REGION, v); };
  const handleRadius = (v) => { setRadius(v); writeLS(LS_RADIUS, String(v)); };
  const handleUnits = (v) => { setUnits(v); writeLS(LS_UNITS, v); };

  return (
    <div style={{ minHeight: '100vh', background: PAL.bg, color: PAL.text, padding: 16 }}>
      <div className="bbq-container-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: 3, color: PAL.brass, margin: 0 }}>
            SETTINGS
          </h1>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: `1px solid ${PAL.border}`, color: PAL.text, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
            aria-label="Close settings"
          >
            ← Back
          </button>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>DEFAULTS</h2>

          <label style={S.label}>Default region</label>
          <select value={region} onChange={(e) => handleRegion(e.target.value)} style={S.input}>
            {STATE_OPTIONS.map(s => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>

          <label style={{ ...S.label, marginTop: 14 }}>Default search radius</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RADIUS_OPTIONS.map(r => (
              <button key={r} style={S.chip(radius === r)} onClick={() => handleRadius(r)}>
                {r} {units}
              </button>
            ))}
          </div>

          <label style={{ ...S.label, marginTop: 14 }}>Distance units</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {UNIT_OPTIONS.map(u => (
              <button key={u} style={S.chip(units === u)} onClick={() => handleUnits(u)}>
                {u === 'mi' ? 'Miles' : 'Kilometers'}
              </button>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>ACCOUNT</h2>
          {user ? (
            <>
              <div style={{ fontSize: 14, marginBottom: 12 }}>
                {user.isAnonymous
                  ? <>Using Board without an account</>
                  : <>Signed in as <strong>{user.email || user.displayName || 'Google user'}</strong></>}
              </div>
              <button style={S.btn} onClick={() => signOut(auth)}>Sign out</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, color: PAL.textDim, marginBottom: 12 }}>
                You can post prices without an account. Signing in with Google
                keeps your prices with you if you switch phones.
              </div>
              <button
                style={{ ...S.btn, opacity: signInBusy ? 0.6 : 1 }}
                onClick={handleSignInClick}
                disabled={signInBusy}
              >
                {signInBusy ? 'Signing in…' : 'Sign in with Google'}
              </button>
              {signInError && (
                <div role="alert" style={{ fontSize: 13, color: '#e8a33d', marginTop: 10, lineHeight: 1.4 }}>
                  {signInError}
                </div>
              )}
            </>
          )}
        </div>

        {user && (
          <div style={S.card}>
            <h2 style={S.h2}>YOUR SUBMISSIONS</h2>
            {user.isAnonymous && (
              <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 10, lineHeight: 1.4 }}>
                Prices you submitted without an account stay deletable here until you sign out.
              </div>
            )}
            {subs === null && !subsError && (
              <div style={{ fontSize: 14, color: PAL.textDim }}>Loading…</div>
            )}
            {subs && subs.length === 0 && !subsError && (
              <div style={{ fontSize: 14, color: PAL.textDim }}>You haven't submitted any prices yet.</div>
            )}
            {subs && subs.map(row => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${PAL.border}` }}>
                <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>{submissionLabel(row)}</div>
                <button
                  style={{ ...S.btn, padding: '6px 12px', fontSize: 13, opacity: deletingId === row.id ? 0.6 : 1,
                    borderColor: confirmId === row.id ? '#e8a33d' : PAL.border,
                    color: confirmId === row.id ? '#e8a33d' : PAL.text }}
                  onClick={() => handleDelete(row.id)}
                  disabled={deletingId === row.id}
                >
                  {deletingId === row.id ? 'Deleting…' : confirmId === row.id ? 'Tap to confirm' : 'Delete'}
                </button>
              </div>
            ))}
            {subsError && (
              <div role="alert" style={{ fontSize: 13, color: '#e8a33d', marginTop: 10, lineHeight: 1.4 }}>{subsError}</div>
            )}
          </div>
        )}

        {(user || delState === 'done') && (
          <div style={S.card}>
            <h2 style={S.h2}>DELETE ACCOUNT</h2>
            <DeleteAccount
              user={user}
              state={delState}
              result={delResult}
              onStart={() => { setDelResult(null); setDelState('confirm'); }}
              onCancel={() => { setDelResult(null); setDelState('idle'); }}
              onConfirm={handleDeleteAccount}
            />
          </div>
        )}

        <div style={S.card}>
          <h2 style={S.h2}>PRIVACY</h2>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            Usage analytics: <strong>{analyticsOn ? 'On' : 'Off'}</strong>
          </div>
          <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 12, lineHeight: 1.4 }}>
            {analyticsOn
              ? 'Board sends usage analytics to Google Analytics. Turn it off and nothing more is sent.'
              : 'Board sends nothing to Google Analytics unless you turn this on.'}{' '}
            <button onClick={openBoardPrivacyPolicy} style={{ background: 'none', border: 'none', padding: 0, color: PAL.brass, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>
              What's sent
            </button>
          </div>
          <button style={S.btn} onClick={() => setConsent(analyticsOn ? 'denied' : 'granted')}>
            {analyticsOn ? 'Turn off analytics' : 'Turn on analytics'}
          </button>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>LEGAL</h2>
          <a href="https://holysmokesbbqco.com/privacy-board.html" target="_blank" rel="noopener noreferrer" style={S.link}>
            Privacy Policy
          </a>
          <a href="https://holysmokesbbqco.com/delete-account-board.html" target="_blank" rel="noopener noreferrer" style={{ ...S.link, borderBottom: 'none' }}>
            Delete Account
          </a>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>ABOUT THIS APP</h2>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            BBQ Board{showVersion ? ` v${appVersion}` : ''}
          </div>
          <a href="https://holysmokesbbqco.com/board/changelog" target="_blank" rel="noopener noreferrer" style={{ color: PAL.brass, fontSize: 13 }}>
            Release notes →
          </a>
        </div>
      </div>
    </div>
  );
}

// Two steps (Delete my account, then a confirm panel that says exactly what
// goes), the same weight as the per-price delete above but harder to hit
// by accident. Once it finishes, Done reloads the app so nothing from the
// deleted account (city, filters, onboarding state) lingers in memory.
export function DeleteAccount({ user, state, result, onStart, onCancel, onConfirm }) {
  const outcome = deletionOutcome(result);
  const anon = user?.isAnonymous === true;
  const note = (o) => (
    <div role={o.ok ? 'status' : 'alert'} style={{ fontSize: 13, color: o.ok ? PAL.text : '#e8a33d', margin: '10px 0', lineHeight: 1.5 }}>
      {o.text}
    </div>
  );

  if (state === 'done') {
    return (
      <>
        {outcome && note(outcome)}
        <button style={S.btn} onClick={() => window.location.reload()}>Done</button>
      </>
    );
  }

  if (state === 'idle') {
    return (
      <>
        <div style={{ fontSize: 13, color: PAL.textDim, marginBottom: 12, lineHeight: 1.5 }}>
          Deletes every price you've posted and your Board sign-in, then clears Board's data from this phone.
        </div>
        <button style={S.btn} onClick={onStart}>Delete my account</button>
      </>
    );
  }

  const busy = state === 'busy';
  return (
    <>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
        {anon
          ? 'This deletes every price you posted from this phone and clears Board’s data from it. Deleted prices can’t be brought back.'
          : 'This deletes every price you’ve posted and your Board account, then signs you out. Google will ask you to sign in once more to confirm it’s you. Deleted prices can’t be brought back.'}
      </div>
      {outcome && !outcome.ok && note(outcome)}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          style={{ ...S.btn, borderColor: '#e8a33d', color: '#e8a33d', opacity: busy ? 0.6 : 1 }}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Deleting…' : 'Delete everything'}
        </button>
        <button style={S.btn} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </>
  );
}
