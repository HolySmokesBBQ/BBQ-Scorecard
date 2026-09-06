import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.board.js';
import { STATES } from './schema.js';

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
                Signed in as <strong>{user.email || user.displayName || 'Google user'}</strong>
              </div>
              <button style={S.btn} onClick={() => signOut(auth)}>Sign out</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, color: PAL.textDim, marginBottom: 12 }}>
                Google Sign-In lets you submit prices and appear on the Leaderboard.
              </div>
              <button style={S.btn} onClick={onSignIn}>Sign in with Google</button>
            </>
          )}
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
            BBQ Board v{import.meta.env?.VITE_BUILD_VERSION || '2.3.6'}
          </div>
          <a href="https://holysmokesbbqco.com/board/changelog" target="_blank" rel="noopener noreferrer" style={{ color: PAL.brass, fontSize: 13 }}>
            Release notes →
          </a>
        </div>
      </div>
    </div>
  );
}
