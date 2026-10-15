import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';

const ACCENT = '#d4782f';
const ACCENT_DIM = '#a85e22';
const GOLD = '#d4a64a';

const CARDS = [
  {
    accentText: 'SCORE',
    title: 'Score Restaurants',
    body: '10 categories. 1 to 9 scale. Rate meat, sauce, sides, atmosphere — the full picture. Every score adds up to a single honest number.',
  },
  {
    accentText: 'COMPARE',
    title: 'Add friends and compare',
    body: 'Sign in, share your friend code, and see how your scores stack up. Head-to-head on shared spots, leaderboard across all of them.',
  },
  {
    accentText: 'DISCOVER',
    title: 'Find the best BBQ near you',
    body: 'Map view, nearby search, MVPs by category. Your reviews build a personal guide to every joint you\'ve tried — and the ones you haven\'t.',
  },
];

export default function ScorecardOnboarding({ onDismiss }) {
  const { S } = useAppContext();
  const [idx, setIdx] = useState(0);
  const last = idx === CARDS.length - 1;

  const dismiss = (source) => {
    track(source === 'skip' ? 'onboarding_skipped' : 'onboarding_completed', { at_card: idx + 1 });
    localStorage.setItem('bbq-onboarded', '1');
    onDismiss?.();
  };

  const card = CARDS[idx];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10, 10, 10, 0.97)',
      display: 'flex', flexDirection: 'column',
      padding: '24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => dismiss('skip')}
          style={{
            background: 'none', border: 'none', color: S.muted,
            fontSize: 13, letterSpacing: 1, cursor: 'pointer',
          }}>Skip</button>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 16px',
      }}>
        <div style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: 56, fontWeight: 900,
          letterSpacing: 5, color: GOLD,
          marginBottom: 24, lineHeight: 1,
        }}>{card.accentText}</div>

        <h2 style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: 28, fontWeight: 700,
          letterSpacing: 1.5, color: ACCENT,
          marginBottom: 20, maxWidth: 460,
        }}>{card.title}</h2>

        <p style={{
          fontSize: 16, color: '#d6c4ad',
          lineHeight: 1.6, maxWidth: 460,
        }}>{card.body}</p>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        marginBottom: 24,
      }}>
        {CARDS.map((_, i) => (
          <span key={i} style={{
            width: i === idx ? 24 : 8,
            height: 8, borderRadius: 4,
            background: i === idx ? ACCENT : '#3a2f22',
            transition: 'width 0.2s',
          }} />
        ))}
      </div>

      <button onClick={() => last ? dismiss('completed') : setIdx(idx + 1)}
        style={{
          width: '100%', padding: 16, background: ACCENT, color: '#fff',
          border: 'none', borderRadius: 12,
          fontFamily: "'Oswald', sans-serif",
          fontSize: 16, fontWeight: 700, letterSpacing: 2,
          cursor: 'pointer',
        }}>{last ? "LET'S EAT" : 'NEXT'}</button>
    </div>
  );
}
