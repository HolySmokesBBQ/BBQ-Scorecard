import React, { useState } from 'react';

// First-launch walkthrough for BBQ Board. Three tap-through cards
// covering the core loop: SHOP → SUBMIT → SUPPORT LOCAL. Same layout
// pattern as Notebook's onboarding so the four apps feel consistent
// on first open. Persists dismissal to localStorage so it never shows
// again unless the user clears storage.

const LS_KEY = 'board:onboarded';

// BBQ Board palette — brass + butcher-red, matching the app chrome.
const BRASS       = '#d4a64a';
const BRASS_DIM   = '#a17c33';
const BUTCHER_RED = '#A85F52';
const TEXT_DIM    = '#9aa3ad';
const BG          = 'rgba(10, 10, 10, 0.97)';

const CARDS = [
  {
    accentText: 'SHOP',
    title: 'Find the cheapest meat near you',
    body: 'Pick your city and radius. Board shows every butcher, warehouse club, and grocery meat counter in range. Cheapest priced first — closest priced first when they’re neck and neck.',
  },
  {
    accentText: 'SUBMIT',
    title: 'See a shop with no price? Add it.',
    body: 'Every unpriced shop has a Submit button. Sign in with Google, pick the cut, enter the number you saw on the shelf. Twenty seconds. The next pitmaster looking for brisket in your city sees it.',
  },
  {
    accentText: 'SUPPORT LOCAL',
    title: 'Filter to just the butchers',
    body: 'Tap the Butchers chip and every Costco, Walmart, and Meijer drops out. What’s left is Bunzel’s, Kettle Range, Ray’s, Rupena’s, and every other neighborhood shop keeping meat honest.',
  },
];

export function hasOnboarded() {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
}

export function markOnboarded() {
  try { localStorage.setItem(LS_KEY, '1'); } catch {}
}

const track = (event, params = {}) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  try { window.gtag('event', event, { content_group: 'board', ...params }); } catch {}
};

export default function Onboarding({ onDismiss }) {
  const [idx, setIdx] = useState(0);
  const last = idx === CARDS.length - 1;
  const card = CARDS[idx];

  const dismiss = (source) => {
    track(source === 'skip' ? 'board_onboarding_skipped' : 'board_onboarding_completed', { at_card: idx + 1 });
    markOnboarded();
    onDismiss?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: BG,
      display: 'flex', flexDirection: 'column',
      padding: '24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => dismiss('skip')}
          style={{
            background: 'none', border: 'none', color: TEXT_DIM,
            fontSize: 13, letterSpacing: 1, cursor: 'pointer',
          }}>Skip</button>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 16px',
      }}>
        <div style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 56, fontWeight: 900,
          letterSpacing: 5, color: BRASS,
          marginBottom: 24, lineHeight: 1,
        }}>{card.accentText}</div>

        <h2 style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 28, fontWeight: 700,
          letterSpacing: 1.5, color: BUTCHER_RED,
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
            background: i === idx ? BUTCHER_RED : '#3a2f22',
            transition: 'width 0.2s',
          }} />
        ))}
      </div>

      <button onClick={() => last ? dismiss('completed') : setIdx(idx + 1)}
        style={{
          width: '100%', padding: 16, background: BRASS, color: '#111',
          border: 'none', borderRadius: 12,
          fontFamily: 'Oswald, sans-serif',
          fontSize: 16, fontWeight: 700, letterSpacing: 2,
          cursor: 'pointer',
        }}>{last ? 'START SHOPPING' : 'NEXT'}</button>
    </div>
  );
}
