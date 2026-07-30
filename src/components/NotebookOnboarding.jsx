import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { markOnboarded } from '../storage.js';
import { track } from '../scoring.js';

// First-launch onboarding — three swipeable / tappable cards walking
// the user through the core loop. Persists "onboarded" on dismiss so
// it never shows again. Rendered as a full-screen overlay above
// NotebookHome.

const ACCENT       = '#4A6741';
const ACCENT_LIGHT = '#7a9670';
const GOLD         = '#d4a64a';

const CARDS = [
  {
    title: 'Log every cook',
    body: 'Meat, rub, wood, smoker, temps, weather, photos, outcome notes. Nothing left to memory.',
    accentText: 'LOG',
  },
  {
    title: 'Save what works',
    body: 'Save rubs and sauces as recipes. Reuse them on any cook with one tap. Get the BBQ Meat Calculator to pre-size your next cook.',
    accentText: 'LEARN',
  },
  {
    title: 'Compare with friends',
    body: 'Friend codes only — no public feed. Mark a cook "Share with friends" and the people you actually cook with see it next to theirs in Cook Compare.',
    accentText: 'REPEAT',
  },
];

export default function NotebookOnboarding({ onDismiss }) {
  const { S } = useAppContext();
  const [idx, setIdx] = useState(0);
  const last = idx === CARDS.length - 1;

  const dismiss = (source) => {
    track(source === 'skip' ? 'onboarding_skipped' : 'onboarding_completed', { at_card: idx + 1 });
    markOnboarded();
    onDismiss?.();
  };

  const card = CARDS[idx];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10, 10, 10, 0.96)',
      display: 'flex', flexDirection: 'column',
      padding: '24px',
    }}>
      {/* Skip — always reachable so power users can dismiss */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => dismiss('skip')}
          style={{
            background: 'none', border: 'none', color: S.muted,
            fontSize: '13px', letterSpacing: '1px', cursor: 'pointer',
          }}>Skip</button>
      </div>

      {/* Card */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 16px',
      }}>
        <div style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: '64px', fontWeight: '900',
          letterSpacing: '6px', color: GOLD,
          marginBottom: '24px',
        }}>{card.accentText}</div>

        <h2 style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: '32px', fontWeight: '700',
          letterSpacing: '2px', color: ACCENT_LIGHT,
          marginBottom: '20px',
        }}>{card.title}</h2>

        <p style={{
          fontSize: '17px', color: '#d6c4ad',
          lineHeight: 1.6, maxWidth: '420px',
        }}>{card.body}</p>
      </div>

      {/* Dots indicator */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '8px',
        marginBottom: '24px',
      }}>
        {CARDS.map((_, i) => (
          <span key={i} style={{
            width: i === idx ? '24px' : '8px',
            height: '8px', borderRadius: '4px',
            background: i === idx ? ACCENT_LIGHT : '#3a2f22',
            transition: 'width 0.2s',
          }} />
        ))}
      </div>

      {/* CTA */}
      <button onClick={() => last ? dismiss('completed') : setIdx(idx + 1)}
        style={{
          width: '100%', padding: '16px', background: ACCENT, color: '#fff',
          border: 'none', borderRadius: '12px',
          fontFamily: "'Oswald', sans-serif",
          fontSize: '16px', fontWeight: '700', letterSpacing: '2px',
          cursor: 'pointer',
        }}>{last ? 'GET COOKING' : 'NEXT'}</button>
    </div>
  );
}
